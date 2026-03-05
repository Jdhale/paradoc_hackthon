"""
threat_model.py - ORM + Pydantic schemas for Threat Events
"""
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Literal, Optional
from sqlalchemy import Column, String, Float, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from pydantic import BaseModel
from app.database import Base


# ORM Table
class ThreatEvent(Base):
    __tablename__ = "threat_events"

    id          = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # What kind of attack: Credential Abuse, Payload Injection, etc.
    threat_type = Column(String, nullable=False, index=True)
    # critical | high | medium | low
    severity    = Column(String, nullable=False, index=True)
    # Source IP that triggered the threat
    source_ip   = Column(String, nullable=False, index=True)
    # Which API endpoint was targeted
    endpoint    = Column(String, nullable=False)
    # 0.0 - 1.0 confidence from the AI agent
    confidence  = Column(Float, nullable=False)
    # active | investigating | resolved
    status      = Column(String, nullable=False, default="active")
    # Human-readable explanation from the LLM reasoning layer
    reasoning   = Column(Text, nullable=True)
    # What the agent did: BLOCK_IP | ALERT | THROTTLE | LOG
    action_taken= Column(String, nullable=True)
    detected_at = Column(DateTime, default=datetime.utcnow, index=True)
    resolved_at = Column(DateTime, nullable=True)


# Pydantic Schemas
class ThreatOut(BaseModel):
    id          : uuid.UUID
    threat_type : str
    severity    : str
    source_ip   : str
    endpoint    : str
    confidence  : float
    status      : str
    reasoning   : Optional[str]
    action_taken: Optional[str]
    detected_at : datetime
    resolved_at : Optional[datetime]

    class Config:
        from_attributes = True


class ThreatFilterParams(BaseModel):
    """Query params for GET /threats"""
    severity  : Optional[str] = None
    status    : Optional[str] = None
    source_ip : Optional[str] = None
    limit     : int = 50
    offset    : int = 0


class ThreatActionRequest(BaseModel):
    """Body for POST /threats/{id}/action"""
    action : Literal["dismiss", "resolve", "escalate"]
    note   : Optional[str] = None
