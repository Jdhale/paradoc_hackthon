from datetime import datetime
from typing import Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import get_current_user, require_role
from app.models.user_model import User, UserRole
from app.models.threat_model import ThreatEvent, ThreatOut, ThreatSeverity, ThreatStatus

router = APIRouter(tags=["Threats"])

@router.get("/threats", response_model=dict)
def list_threats(severity: Optional[ThreatSeverity]=Query(None), status: Optional[ThreatStatus]=Query(None),
                 source_ip: Optional[str]=Query(None), endpoint: Optional[str]=Query(None),
                 limit: int=Query(50, le=200), offset: int=Query(0, ge=0),
                 db: Session=Depends(get_db), _: User=Depends(get_current_user)):
    q = db.query(ThreatEvent)
    if severity: q = q.filter(ThreatEvent.severity == severity)
    if status: q = q.filter(ThreatEvent.status == status)
    if source_ip: q = q.filter(ThreatEvent.source_ip == source_ip)
    if endpoint: q = q.filter(ThreatEvent.target_endpoint.ilike(f"%{endpoint}%"))
    total = q.count()
    items = q.order_by(ThreatEvent.created_at.desc()).offset(offset).limit(limit).all()
    return {"total": total, "offset": offset, "limit": limit, "items": [ThreatOut.model_validate(t) for t in items]}

@router.get("/threats/{threat_id}", response_model=ThreatOut)
def get_threat(threat_id: uuid.UUID, db: Session=Depends(get_db), _: User=Depends(get_current_user)):
    t = db.query(ThreatEvent).filter(ThreatEvent.id == threat_id).first()
    if not t: raise HTTPException(404, "Threat not found")
    return t

@router.post("/threats/{threat_id}/resolve", response_model=ThreatOut)
def resolve_threat(threat_id: uuid.UUID, db: Session=Depends(get_db), current_user: User=Depends(require_role(UserRole.analyst, UserRole.admin))):
    t = db.query(ThreatEvent).filter(ThreatEvent.id == threat_id).first()
    if not t: raise HTTPException(404, "Threat not found")
    t.status = ThreatStatus.resolved; t.resolved_at = datetime.utcnow(); t.resolved_by = current_user.id
    db.commit(); db.refresh(t); return t

@router.post("/threats/{threat_id}/dismiss", response_model=ThreatOut)
def dismiss_threat(threat_id: uuid.UUID, db: Session=Depends(get_db), current_user: User=Depends(require_role(UserRole.analyst, UserRole.admin))):
    t = db.query(ThreatEvent).filter(ThreatEvent.id == threat_id).first()
    if not t: raise HTTPException(404, "Threat not found")
    t.status = ThreatStatus.dismissed; t.resolved_at = datetime.utcnow(); t.resolved_by = current_user.id
    db.commit(); db.refresh(t); return t

@router.post("/ip/block")
def block_ip(body: dict, request: Request, _: User=Depends(require_role(UserRole.analyst, UserRole.admin))):
    ip = body.get("ip")
    if not ip: raise HTTPException(422, "'ip' required")
    request.app.state.agent._blocked_ips.add(ip)
    return {"message": f"IP {ip} blocked", "reason": body.get("reason", "manual")}

@router.post("/ip/{ip}/unblock")
def unblock_ip(ip: str, request: Request, _: User=Depends(require_role(UserRole.admin))):
    request.app.state.agent.unblock_ip(ip)
    return {"message": f"IP {ip} unblocked"}

@router.get("/ip/{ip}/reputation")
async def ip_reputation(ip: str, request: Request, db: Session=Depends(get_db), _: User=Depends(get_current_user)):
    threat_count = db.query(ThreatEvent).filter(ThreatEvent.source_ip == ip).count()
    recent_count = await request.app.state.monitor.get_ip_request_count(ip)
    risk_score = min(100, threat_count * 10 + (recent_count // 10))
    return {"ip": ip, "is_blocked": request.app.state.agent.is_blocked(ip),
            "threat_count": threat_count, "requests_60s": recent_count, "risk_score": risk_score,
            "risk_level": "critical" if risk_score>=80 else "high" if risk_score>=50 else "medium" if risk_score>=20 else "low"}