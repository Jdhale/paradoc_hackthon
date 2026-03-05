from datetime import datetime, timedelta
from collections import defaultdict
import csv, io
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import get_current_user, require_role
from app.models.user_model import User, UserRole
from app.models.threat_model import ThreatEvent, ThreatSeverity, ThreatType, ThreatStatus, AgentAction

router = APIRouter(prefix="/reports", tags=["Reports"])

def _range_delta(r):
    m = {"24h": timedelta(hours=24), "7d": timedelta(days=7), "30d": timedelta(days=30), "90d": timedelta(days=90)}
    d = m.get(r)
    if not d: raise HTTPException(422, f"Invalid range. Use: {list(m)}")
    return d

@router.get("/summary")
def summary(range: str=Query("7d"), db: Session=Depends(get_db), _: User=Depends(get_current_user)):
    delta = _range_delta(range); now = datetime.utcnow(); start = now - delta; prev = start - delta
    def q(s, u): return db.query(ThreatEvent).filter(ThreatEvent.created_at >= s, ThreatEvent.created_at < u).all()
    curr = q(start, now); prev_r = q(prev, start)
    def pct(a, b): return round((a-b)/b*100, 1) if b else 0.0
    cb = sum(1 for t in curr if t.agent_action == AgentAction.block_ip)
    pb = sum(1 for t in prev_r if t.agent_action == AgentAction.block_ip)
    cd = sum(1 for t in curr if t.status == ThreatStatus.dismissed)
    pd = sum(1 for t in prev_r if t.status == ThreatStatus.dismissed)
    confs = [t.confidence for t in curr if t.confidence]
    return {"range": range, "total_threats": len(curr), "total_delta": pct(len(curr), len(prev_r)),
            "auto_blocked": cb, "blocked_delta": pct(cb, pb), "false_positives": cd, "fp_delta": pct(cd, pd),
            "mean_confidence": round(sum(confs)/len(confs), 1) if confs else 0,
            "by_severity": {s.value: sum(1 for t in curr if t.severity == s) for s in ThreatSeverity}}

@router.get("/trend")
def trend(range: str=Query("7d"), db: Session=Depends(get_db), _: User=Depends(get_current_user)):
    delta = _range_delta(range); now = datetime.utcnow(); start = now - delta
    days = int(delta.total_seconds() / 86400)
    threats = db.query(ThreatEvent).filter(ThreatEvent.created_at >= start).all()
    buckets = {(start + timedelta(days=i)).strftime("%b %d"): {"day": (start + timedelta(days=i)).strftime("%b %d"), "threats": 0, "blocked": 0, "resolved": 0} for i in range(days)}
    for t in threats:
        d = t.created_at.strftime("%b %d")
        if d in buckets:
            buckets[d]["threats"] += 1
            if t.agent_action == AgentAction.block_ip: buckets[d]["blocked"] += 1
            if t.status == ThreatStatus.resolved: buckets[d]["resolved"] += 1
    return list(buckets.values())

@router.get("/top-ips")
def top_ips(range: str=Query("7d"), limit: int=Query(10, le=50), request: Request=None, db: Session=Depends(get_db), _: User=Depends(get_current_user)):
    delta = _range_delta(range); start = datetime.utcnow() - delta
    rows = (db.query(ThreatEvent.source_ip, func.count(ThreatEvent.id).label("count"))
            .filter(ThreatEvent.created_at >= start).group_by(ThreatEvent.source_ip)
            .order_by(func.count(ThreatEvent.id).desc()).limit(limit).all())
    agent = request.app.state.agent if request else None
    return [{"ip": r.source_ip, "attacks": r.count, "country": "N/A", "blocked": agent.is_blocked(r.source_ip) if agent else False} for r in rows]

@router.get("/by-type")
def by_type(range: str=Query("7d"), db: Session=Depends(get_db), _: User=Depends(get_current_user)):
    delta = _range_delta(range); start = datetime.utcnow() - delta
    rows = (db.query(ThreatEvent.threat_type, func.count(ThreatEvent.id).label("count"))
            .filter(ThreatEvent.created_at >= start).group_by(ThreatEvent.threat_type)
            .order_by(func.count(ThreatEvent.id).desc()).all())
    COLORS = {"Credential Abuse": "#ef4444", "Payload Injection": "#f97316", "Rate Limit Abuse": "#f59e0b",
              "Port Scanning": "#a78bfa", "DDoS": "#ec4899", "Data Exfiltration": "#06b6d4"}
    total = sum(r.count for r in rows) or 1
    return [{"name": r.threat_type.value, "value": round(r.count/total*100, 1), "count": r.count, "color": COLORS.get(r.threat_type.value, "#6b7280")} for r in rows]

@router.post("/export")
def export_report(range: str=Query("7d"), format: str=Query("csv"), db: Session=Depends(get_db), _: User=Depends(require_role(UserRole.analyst, UserRole.admin))):
    if format != "csv": raise HTTPException(422, "Only csv supported")
    delta = _range_delta(range); start = datetime.utcnow() - delta
    events = db.query(ThreatEvent).filter(ThreatEvent.created_at >= start).order_by(ThreatEvent.created_at.desc()).all()
    out = io.StringIO()
    w = csv.DictWriter(out, fieldnames=["id","threat_type","severity","source_ip","target_endpoint","confidence","status","agent_action","created_at"])
    w.writeheader()
    for e in events:
        w.writerow({"id": str(e.id), "threat_type": e.threat_type.value, "severity": e.severity.value,
                    "source_ip": e.source_ip, "target_endpoint": e.target_endpoint, "confidence": e.confidence,
                    "status": e.status.value, "agent_action": e.agent_action.value if e.agent_action else "",
                    "created_at": e.created_at.isoformat()})
    out.seek(0)
    fn = f"threats_{range}_{datetime.utcnow().strftime('%Y%m%d')}.csv"
    return StreamingResponse(iter([out.getvalue()]), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={fn}"})