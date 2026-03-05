"""
main.py
───────
FastAPI application entry point.

Responsibilities:
  - Create the app with CORS, lifespan hooks
  - Mount all routers
  - WebSocket endpoint for real-time frontend updates
  - Traffic-capture middleware
  - Health check
"""
import asyncio
import json
import logging
import time
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, Depends
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.services.ai_agent import agent
from app.services.traffic_monitor import monitor

from app.routes.threats import router as threats_router, ip_router
from app.routes.agent import router as agent_router
from app.routes.reports import router as reports_router
from app.routes.api_inventory import router as inventory_router
from app.auth import get_current_user           # used in WS auth below

import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all DB tables (use Alembic migrations in production)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Boot services
    await agent.connect()
    await monitor.connect()
    logger.info("Sentinel AI backend started")

    yield  # app is running

    # Cleanup
    if agent.redis:
        await agent.redis.close()
    logger.info("Sentinel AI backend shutting down")


# ── App instance ──────────────────────────────────────────────────────────────
app = FastAPI(
    title      = "Sentinel AI — API Threat Intelligence",
    version    = "1.0.0",
    lifespan   = lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["http://localhost:5173", "http://localhost:3000"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)


# ── Traffic-capture middleware ────────────────────────────────────────────────
@app.middleware("http")
async def capture_traffic(request: Request, call_next):
    """
    Intercepts every request:
      1. Records it in the traffic monitor
      2. Checks if the IP is blocked (returns 403 immediately)
      3. After the response, runs AI analysis in background
    """
    start   = time.perf_counter()
    ip      = request.client.host if request.client else "unknown"

    # Blocked IP check (Redis Set lookup — sub-millisecond)
    blocked = False
    try:
        r = await aioredis.from_url(REDIS_URL, decode_responses=True)
        blocked = bool(await r.sismember("blocked_ips", ip))
        await r.close()
    except Exception:
        pass  # Redis unavailable — fail open

    if blocked:
        from fastapi.responses import JSONResponse
        return JSONResponse({"detail": "Your IP is blocked"}, status_code=403)

    response = await call_next(request)
    duration = time.perf_counter() - start

    # Fire-and-forget traffic recording (non-blocking)
    asyncio.create_task(monitor.record(
        ip       = ip,
        endpoint = request.url.path,
        method   = request.method,
        status   = response.status_code,
        duration = duration,
    ))

    return response


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(threats_router,  prefix="/api")
app.include_router(ip_router,       prefix="/api")
app.include_router(agent_router,    prefix="/api")
app.include_router(reports_router,  prefix="/api")
app.include_router(inventory_router,prefix="/api")


# ── Auth routes (inline for simplicity) ───────────────────────────────────────
from fastapi import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.user_model import User, UserCreate, UserLogin, TokenResponse, UserOut
from app.auth import hash_password, verify_password, create_access_token
from sqlalchemy import select

auth_router = APIRouter(prefix="/auth", tags=["Auth"])

@auth_router.post("/register", response_model=UserOut)
async def register(body: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if existing:
        from fastapi import HTTPException
        raise HTTPException(400, "Email already registered")
    user = User(
        email           = body.email,
        hashed_password = hash_password(body.password),
        name            = body.name,
        role            = body.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@auth_router.post("/login", response_model=TokenResponse)
async def login(body: UserLogin, db: AsyncSession = Depends(get_db)):
    from fastapi import HTTPException
    user = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(401, "Invalid credentials")
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=token, user=UserOut.from_orm(user))

@auth_router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user

app.include_router(auth_router, prefix="/api")


# ── WebSocket — real-time feed ────────────────────────────────────────────────
class ConnectionManager:
    """Tracks active WS connections and broadcasts messages to all."""
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        self.active = [c for c in self.active if c != ws]

    async def broadcast(self, msg: str):
        dead = []
        for conn in self.active:
            try:
                await conn.send_text(msg)
            except Exception:
                dead.append(conn)
        for d in dead:
            self.disconnect(d)


ws_manager = ConnectionManager()


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    """
    Frontend connects here to receive live events.
    Subscribes to two Redis Pub/Sub channels:
      - traffic_stream  → forwarded as traffic_tick events
      - agent_actions   → forwarded as agent_decision events
    """
    await ws_manager.connect(ws)
    r = await aioredis.from_url(REDIS_URL, decode_responses=True)
    pubsub = r.pubsub()
    await pubsub.subscribe("traffic_stream", "agent_actions")

    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                await ws.send_text(message["data"])
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(ws)
        await pubsub.unsubscribe()
        await r.close()


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "agent_mode": agent.mode}
