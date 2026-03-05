"""
database.py
───────────
Creates the SQLAlchemy engine, session factory, and Base class.
All models import Base from here so Alembic can auto-detect them.

DATABASE_URL env var format:
  postgresql+asyncpg://user:password@host:port/dbname
"""
import os
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/sentinel"
)

# echo=True prints every SQL query to stdout — great for dev, turn off in prod
engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True)

# Each request gets its own session; expire_on_commit=False lets us read
# ORM objects after commit without another DB round-trip
AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()


async def get_db():
    """FastAPI dependency — yields a DB session and closes it after the request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
