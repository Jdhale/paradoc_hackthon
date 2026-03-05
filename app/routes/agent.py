import asyncio
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from app.auth import require_role
from app.models.user_model import User, UserRole
from app.services.ai_agent import AgentMode

router = APIRouter(prefix="/agent", tags=["Agent"])

class ModeUpdate(BaseModel): mode: AgentMode
class ConfigUpdate(BaseModel):
    auto_block: Optional[bool]=None; alert_on_high: Optional[bool]=None
    alert_on_medium: Optional[bool]=None; adaptive_threshold: Optional[bool]=None
    sensitivity_score: Optional[int]=None; block_threshold: Optional[int]=None; rate_limit: Optional[int]=None

@router.get("/status")
def agent_status(request: Request, _: User=Depends(require_role(UserRole.viewer, UserRole.analyst, UserRole.admin))):
    return request.app.state.agent.get_status()

@router.post("/mode")
def set_mode(body: ModeUpdate, request: Request, _: User=Depends(require_role(UserRole.analyst, UserRole.admin))):
    request.app.state.agent.set_mode(body.mode)
    return {"message": f"Mode set to {body.mode.value}", "mode": body.mode.value}

@router.get("/decisions")
def get_decisions(request: Request, limit: int=50, _: User=Depends(require_role(UserRole.viewer, UserRole.analyst, UserRole.admin))):
    if limit < 1 or limit > 500: raise HTTPException(422, "limit must be 1-500")
    return request.app.state.agent.get_recent_decisions(limit)

@router.put("/config")
def update_config(body: ConfigUpdate, request: Request, _: User=Depends(require_role(UserRole.admin))):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates: raise HTTPException(422, "No fields provided")
    request.app.state.agent.update_config(updates)
    return {"message": "Config updated", "updated_fields": list(updates.keys()), "current_config": request.app.state.agent.config}

@router.post("/retrain")
async def retrain(request: Request, _: User=Depends(require_role(UserRole.admin))):
    async def _run():
        await asyncio.get_event_loop().run_in_executor(None, request.app.state.detector.retrain, [])
    asyncio.create_task(_run())
    return {"message": "Retraining started"}