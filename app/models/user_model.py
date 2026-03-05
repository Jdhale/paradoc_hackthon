"""
user_model.py - SQLAlchemy ORM + Pydantic schemas for Users
"""
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Literal
from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from pydantic import BaseModel, EmailStr, Field
from app.database import Base


# ORM Table
class User(Base):
    __tablename__ = "users"
    id              = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email           = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    name            = Column(String, nullable=False)
    role            = Column(String, nullable=False, default="Analyst")
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime, default=datetime.utcnow)


# Pydantic Schemas
class UserCreate(BaseModel):
    email    : EmailStr
    password : str = Field(min_length=8)
    name     : str
    role     : Literal["Admin", "Analyst", "Viewer"] = "Analyst"

class UserLogin(BaseModel):
    email    : EmailStr
    password : str

class UserOut(BaseModel):
    id         : uuid.UUID
    email      : str
    name       : str
    role       : str
    is_active  : bool
    created_at : datetime
    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token : str
    token_type   : str = "bearer"
    user         : UserOut
