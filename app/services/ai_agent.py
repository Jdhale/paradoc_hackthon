import json
import logging
import os
import redis.asyncio as aioredis
from typing import Dict, Any

logger = logging.getLogger(__name__)

class SentinelAgent:
    def __init__(self):
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        self.redis = None

    async def connect(self):
        self.redis = await aioredis.from_url(self.redis_url, decode_responses=True)
        logger.info("AIAgent connected to Redis")

    async def analyze_traffic(self, traffic_data: Dict[str, Any]):
        """
        Analyzes traffic data for threats.
        In a production environment, this calls the Gemini API.
        For real-time testing, we use pattern-based logic.
        """
        payload = str(traffic_data.get("payload", "")).upper()
        path = traffic_data.get("path", "")
        
        # 1. SQL Injection Detection
        if "UNION" in payload or "SELECT" in payload or "DROP" in payload:
            return {
                "risk_score": 0.95,
                "action": "block",
                "category": "SQL Injection",
                "reasoning": "Detected SQL keywords (UNION/SELECT) in request parameters."
            }
            
        # 2. Path Traversal / Admin Probing
        if "ADMIN" in path.upper() or "PASSWORD" in path.upper():
            return {
                "risk_score": 0.7,
                "action": "block",
                "category": "Unauthorized Access Attempt",
                "reasoning": "Sensitive path access detected without authorization."
            }

        # 3. Default (Clean)
        return {
            "risk_score": 0.1,
            "action": "monitor",
            "category": "Normal",
            "reasoning": "Standard API interaction."
        }

agent = SentinelAgent()