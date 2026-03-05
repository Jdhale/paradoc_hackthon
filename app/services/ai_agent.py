"""
ai_agent.py
───────────
The Agentic AI — the main character of the system.

It ties together three layers:
  1. AnomalyDetector  — statistical/ML signal
  2. LLM Reasoning    — calls Claude API for contextual judgment
  3. Decision Engine  — decides action and writes to DB

Agent modes (stored in Redis key "agent:mode"):
  active   → detects + acts autonomously (blocks IPs, alerts)
  learning → detects + logs, no automatic actions
  passive  → logs everything, no detection triggers
"""
import os
import json
import asyncio
import logging
from datetime import datetime
from typing import Optional

import httpx
import redis.asyncio as aioredis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.threat_model import ThreatEvent
from app.services.anomaly_detector import AnomalyDetector

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
REDIS_URL         = os.getenv("REDIS_URL", "redis://localhost:6379")


class AIAgent:
    """
    Core agentic loop. Instantiated once at startup and reused.

    Attributes:
        detector  : AnomalyDetector instance for ML-based signals
        redis     : async Redis client for live state / counters
        mode      : current operating mode
    """

    def __init__(self):
        self.detector = AnomalyDetector()
        self.redis: Optional[aioredis.Redis] = None
        self.mode = "active"

    async def connect(self):
        """Call once at app startup to initialise Redis connection."""
        self.redis = await aioredis.from_url(REDIS_URL, decode_responses=True)
        stored_mode = await self.redis.get("agent:mode")
        if stored_mode:
            self.mode = stored_mode
        logger.info(f"AIAgent started in mode={self.mode}")

    # ── Main entry point ────────────────────────────────────────────────────
    async def analyze(self, request_data: dict, db: AsyncSession) -> Optional[dict]:
        """
        Called for every incoming API request captured by the traffic monitor.

        Steps:
          1. Run anomaly detection (fast, local)
          2. If anomaly score is high enough, call LLM for reasoning
          3. Decide action
          4. Persist ThreatEvent to DB
          5. Execute action (block/alert/throttle)

        Returns the threat dict if a threat was found, else None.
        """
        if self.mode == "passive":
            return None  # passive mode: do nothing

        score, signals = await self.detector.score(request_data)

        # Below threshold → not interesting
        if score < 0.45:
            return None

        # Get LLM reasoning for scores above 0.45
        reasoning = await self._llm_reason(request_data, signals, score)

        # Determine severity bucket
        severity = (
            "critical" if score >= 0.90 else
            "high"     if score >= 0.75 else
            "medium"   if score >= 0.60 else
            "low"
        )

        # Choose action
        action = self._decide_action(score, severity)

        # Persist to DB
        threat = ThreatEvent(
            threat_type  = signals.get("top_signal", "Anomalous Traffic"),
            severity     = severity,
            source_ip    = request_data.get("ip", "unknown"),
            endpoint     = request_data.get("endpoint", "/"),
            confidence   = round(score * 100, 1),
            status       = "active",
            reasoning    = reasoning,
            action_taken = action,
        )
        db.add(threat)
        await db.commit()
        await db.refresh(threat)

        # Execute action (only in active mode)
        if self.mode == "active":
            await self._execute(action, request_data.get("ip"), threat.id)

        return {
            "id"        : str(threat.id),
            "severity"  : severity,
            "confidence": threat.confidence,
            "action"    : action,
            "reasoning" : reasoning,
        }

    # ── LLM Reasoning ───────────────────────────────────────────────────────
    async def _llm_reason(self, request_data: dict, signals: dict, score: float) -> str:
        """
        Sends context to Claude and asks for a plain-English explanation
        of why this request looks malicious.
        Falls back to a template string if the API call fails.
        """
        if not ANTHROPIC_API_KEY:
            return self._fallback_reasoning(signals, score)

        prompt = f"""You are an API security analyst AI.
Analyze this suspicious API request and explain in 2-3 sentences why it looks malicious.
Be specific about the signals. Do not use bullet points.

Request context:
- IP: {request_data.get("ip")}
- Endpoint: {request_data.get("endpoint")}
- Method: {request_data.get("method")}
- Anomaly score: {score:.2f}
- Detected signals: {json.dumps(signals)}

Respond with ONLY the explanation text, no preamble."""

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key"        : ANTHROPIC_API_KEY,
                        "anthropic-version": "2023-06-01",
                        "content-type"     : "application/json",
                    },
                    json={
                        "model"     : "claude-sonnet-4-20250514",
                        "max_tokens": 200,
                        "messages"  : [{"role": "user", "content": prompt}],
                    },
                )
                data = resp.json()
                return data["content"][0]["text"].strip()
        except Exception as e:
            logger.warning(f"LLM reasoning failed: {e}")
            return self._fallback_reasoning(signals, score)

    def _fallback_reasoning(self, signals: dict, score: float) -> str:
        return (
            f"Anomaly score {score:.2f} exceeded threshold. "
            f"Top signal: {signals.get('top_signal', 'unknown')}. "
            "Pattern deviates significantly from established baseline behavior."
        )

    # ── Decision Engine ─────────────────────────────────────────────────────
    def _decide_action(self, score: float, severity: str) -> str:
        """Maps severity → action. Can be overridden by agent config."""
        if severity == "critical":
            return "BLOCK_IP"
        if severity == "high":
            return "ALERT"
        if severity == "medium":
            return "THROTTLE"
        return "LOG"

    # ── Action Executor ─────────────────────────────────────────────────────
    async def _execute(self, action: str, ip: Optional[str], threat_id):
        """Writes the action outcome to Redis so the frontend can react instantly."""
        if not self.redis or not ip:
            return
        if action == "BLOCK_IP":
            # Store blocked IPs in a Redis Set — traffic_monitor checks this
            await self.redis.sadd("blocked_ips", ip)
            await self.redis.publish("agent_actions", json.dumps({
                "action": "BLOCK_IP", "ip": ip, "threat_id": str(threat_id)
            }))
        elif action == "THROTTLE":
            await self.redis.setex(f"throttle:{ip}", 300, "1")  # 5-minute throttle
        elif action == "ALERT":
            await self.redis.publish("agent_actions", json.dumps({
                "action": "ALERT", "ip": ip, "threat_id": str(threat_id)
            }))

    # ── Mode management ─────────────────────────────────────────────────────
    async def set_mode(self, mode: str):
        self.mode = mode
        if self.redis:
            await self.redis.set("agent:mode", mode)

    async def get_status(self) -> dict:
        blocked_count  = await self.redis.scard("blocked_ips") if self.redis else 0
        return {
            "mode"         : self.mode,
            "blocked_ips"  : blocked_count,
            "uptime_seconds": 0,   # populate from process start time in production
        }


# Singleton — imported by routes and main.py
agent = AIAgent()
