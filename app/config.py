"""
config.py
─────────
Centralised settings loaded from environment variables (or a .env file).
Access anywhere via: from app.config import settings
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://sentinel:sentinel@localhost:5432/sentinel_db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET_KEY:     str = "CHANGE_ME_32_CHAR_SECRET_KEY_HERE"
    TOKEN_TTL_MINUTES:  int = 1440   # 24 hours

    # Anthropic Claude API
    ANTHROPIC_API_KEY: str = ""

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # Agent defaults
    AGENT_MODE:             str   = "active"
    AUTO_BLOCK_THRESHOLD:   float = 0.85
    ALERT_THRESHOLD:        float = 0.55

    class Config:
        env_file = ".env"
        extra    = "ignore"


settings = Settings()
