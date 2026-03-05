import asyncio
import json
import logging
import time
import os
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.database import engine, Base, get_db
from app.services.ai_agent import agent
from app.services.traffic_monitor import monitor
from app.models.user_model import User, UserLogin, UserOut
from app.auth import hash_password, verify_password, create_access_token

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# ── Agent Background Worker (The Brain) ───────────────────────────────────────
async def agent_decision_worker():
    """Listens to the traffic stream and makes autonomous security decisions."""
    try:
        r = await aioredis.from_url(REDIS_URL, decode_responses=True)
        pubsub = r.pubsub()
        await pubsub.subscribe("traffic_stream")
        logger.info("🛡️  Agent Worker: Subscribed and listening for threats...")

        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    raw = json.loads(message["data"])
                    traffic_data = raw.get("payload", raw)  # unwrap if needed
                    if "ip" not in traffic_data:
                        continue  # skip traffic_tick messages, only process real traffic events
                    decision = await agent.analyze_traffic(traffic_data)
                    # Log every analysis for visibility during testing
                    logger.info(f"Analysis for {traffic_data['ip']}: Score {decision['risk_score']} - {decision['category']}")
                    
                    if decision["risk_score"] > 0.6: 
                        logger.warning(f"🚨 ACTION REQUIRED: {decision['action']} IP {traffic_data['ip']} Reason: {decision['reasoning']}")
                        
                        if decision["action"] == "block":
                            await r.sadd("blocked_ips", traffic_data["ip"])
                            await r.expire("blocked_ips", 600) # Block for 10 mins
                        
                        # Notify Frontend via Agent Actions channel
                        alert = {
                            "type": "agent_decision",        # ← must be "type"
                            "payload": {                      # ← must be "payload"
                                "ip": traffic_data["ip"],
                                **decision
                            }
                        }
                        await r.publish("agent_actions", json.dumps(alert))
                except Exception as e:
                    logger.error(f"Processing Error: {e}")
    except Exception as e:
        logger.error(f"Worker Startup Error: {e}")

# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Initialize Services
    await agent.connect()
    await monitor.connect()
    
    # Start the background brain
    worker_task = asyncio.create_task(agent_decision_worker())
    logger.info("Sentinel AI backend started")
    
    yield
    
    worker_task.cancel()
    logger.info("Sentinel AI backend shutting down")

app = FastAPI(title="Sentinel AI", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Middleware: Enhanced Interceptor ──────────────────────────────────────────
@app.middleware("http")
async def sentinel_interceptor(request: Request, call_next):
    ip = request.client.host if request.client else "127.0.0.1"
    
    # Check Blacklist first
    r = await aioredis.from_url(REDIS_URL, decode_responses=True)
    is_blocked = await r.sismember("blocked_ips", ip)
    
    if is_blocked:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=403,
            content={"detail": "Access Denied", "reason": "Sentinel AI blocked this IP for suspicious activity"}
        )

    # Capture Request
    start_time = time.perf_counter()
    response = await call_next(request)
    duration = time.perf_counter() - start_time

    # Capture raw query string for SQLi detection
    query_string = str(request.query_params)
    
    asyncio.create_task(monitor.record(
        ip=ip,
        endpoint=request.url.path,
        method=request.method,
        status=response.status_code,
        duration=duration,
        payload=query_string
    ))
    
    return response

# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health(): return {"status": "ok"}

@app.get("/api/inventory")
async def inventory(): return {"items": ["server-1", "db-cluster"]}

@app.post("/api/auth/login")
async def login(body: UserLogin):
    return {"detail": "Invalid credentials", "status": 401}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    r = await aioredis.from_url(REDIS_URL, decode_responses=True)
    pubsub = r.pubsub()
    await pubsub.subscribe("traffic_stream", "agent_actions")
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                await websocket.send_text(message["data"])
    except WebSocketDisconnect:
        pass
    finally:
        await r.close()