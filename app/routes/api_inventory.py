from datetime import datetime
from typing import Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import get_current_user, require_role
from app.models.user_model import User, UserRole
from app.models.threat_model import ThreatEvent, ThreatSeverity

router = APIRouter(tags=["API Inventory"])

_REGISTRY = {
    "ep1": {"id": "ep1", "path": "/api/auth/login", "method": "POST"},
    "ep2": {"id": "ep2", "path": "/api/users/{id}", "method": "GET"},
    "ep3": {"id": "ep3", "path": "/api/payments", "method": "POST"},
    "ep4": {"id": "ep4", "path": "/api/admin/config", "method": "PUT"},
    "ep5": {"id": "ep5", "path": "/api/search", "method": "GET"},
    "ep6": {"id": "ep6", "path": "/api/export/data", "method": "GET"},
}

class EndpointCreate(BaseModel): path: str; method: str

@router.get("/endpoints")
def list_endpoints(db: Session=Depends(get_db), _: User=Depends(get_current_user)):
    result = []
    for ep in _REGISTRY.values():
        tc = (db.query(func.count(ThreatEvent.id))
              .filter(ThreatEvent.target_endpoint.ilike(f"%{ep['path'].split('{')[0]}%")).scalar()) or 0
        risk = "critical" if tc>=10 else "high" if tc>=5 else "medium" if tc>=2 else "low"
        result.append({**ep, "rps": abs(hash(ep["path"])) % 400 + 100,
                       "error_rate": round(1.5 + (hash(ep["path"]) % 200) / 10, 1),
                       "calls_24h": abs(hash(ep["path"])) % 100000 + 1000,
                       "risk": risk, "threat_count": tc})
    return result

@router.get("/endpoints/{ep_id}/stats")
def endpoint_stats(ep_id: str, db: Session=Depends(get_db), _: User=Depends(get_current_user)):
    ep = _REGISTRY.get(ep_id)
    if not ep: raise HTTPException(404, "Endpoint not found")
    base = ep["path"].split("{")[0].rstrip("/")
    threats = db.query(ThreatEvent).filter(ThreatEvent.target_endpoint.ilike(f"%{base}%")).order_by(ThreatEvent.created_at.desc()).limit(50).all()
    by_sev = {s.value: sum(1 for t in threats if t.severity == s) for s in ThreatSeverity}
    top_ips = {}
    for t in threats: top_ips[t.source_ip] = top_ips.get(t.source_ip, 0) + 1
    return {"endpoint": ep, "total_threats": len(threats), "by_severity": by_sev,
            "top_ips": [{"ip": ip, "count": c} for ip, c in sorted(top_ips.items(), key=lambda x: -x[1])[:5]],
            "recent": [{"id": str(t.id), "type": t.threat_type.value, "severity": t.severity.value, "created_at": t.created_at.isoformat()} for t in threats[:10]]}

@router.post("/endpoints", status_code=201)
def register_endpoint(body: EndpointCreate, _: User=Depends(require_role(UserRole.admin))):
    ep_id = f"ep_{uuid.uuid4().hex[:8]}"
    _REGISTRY[ep_id] = {"id": ep_id, "path": body.path, "method": body.method.upper()}
    return {"message": "Registered", "id": ep_id}

@router.delete("/endpoints/{ep_id}", status_code=204)
def delete_endpoint(ep_id: str, _: User=Depends(require_role(UserRole.admin))):
    if ep_id not in _REGISTRY: raise HTTPException(404, "Not found")
    del _REGISTRY[ep_id]

@router.get("/traffic")
async def traffic_snapshot(request: Request, _: User=Depends(get_current_user)):
    return await request.app.state.monitor.get_snapshot()

@router.get("/traffic/timeseries")
async def traffic_timeseries(points: int=Query(60, le=300), request: Request=None, _: User=Depends(get_current_user)):
    return await request.app.state.monitor.get_timeseries(points)