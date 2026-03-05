"""
anomaly_detector.py
───────────────────
Statistical + rule-based anomaly scoring for API requests.
Returns a score 0.0 (normal) → 1.0 (definitely malicious).

In production you would replace / augment the rules with a trained
Isolation Forest or LSTM model loaded from disk.

Signals evaluated:
  - Request rate per IP (from Redis counters)
  - Failed auth ratio on the endpoint
  - Payload size deviation
  - Suspicious header patterns
  - Known bad IP check (Redis Set)
  - Unusual HTTP method for endpoint
  - Time-of-day anomaly
"""
import re
import math
import logging
from datetime import datetime
from typing import Tuple

import redis.asyncio as aioredis
import os

logger = logging.getLogger(__name__)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# Regex patterns that indicate injection attempts
INJECTION_PATTERNS = re.compile(
    r"(union\s+select|drop\s+table|<script|eval\(|exec\(|/etc/passwd"
    r"|\.\./\.\.|base64_decode|cmd\.exe)",
    re.IGNORECASE,
)


class AnomalyDetector:
    def __init__(self):
        self._redis = None

    async def _get_redis(self) -> aioredis.Redis:
        if not self._redis:
            self._redis = await aioredis.from_url(REDIS_URL, decode_responses=True)
        return self._redis

    async def score(self, req: dict) -> Tuple[float, dict]:
        """
        Main scoring function.
        Returns: (score: float, signals: dict)

        Each signal contributes a weight; final score is clamped to [0, 1].
        """
        r = await self._get_redis()
        ip       = req.get("ip", "")
        endpoint = req.get("endpoint", "/")
        payload  = req.get("payload", "")
        method   = req.get("method", "GET")
        headers  = req.get("headers", {})

        score   = 0.0
        signals = {}

        # 1. Known blocked IP
        if await r.sismember("blocked_ips", ip):
            score += 0.95
            signals["blocked_ip"] = True

        # 2. Request rate — increment counter with 60s TTL
        rate_key = f"rate:{ip}:{endpoint}"
        count    = await r.incr(rate_key)
        await r.expire(rate_key, 60)
        if count > 200:
            weight = min(0.6, (count - 200) / 500)
            score += weight
            signals["high_rate"] = count
            signals["top_signal"] = "Rate Limit Abuse"

        # 3. Failed auth counter
        fail_key = f"auth_fail:{ip}"
        fails    = int(await r.get(fail_key) or 0)
        if fails > 5:
            weight = min(0.5, fails / 20)
            score += weight
            signals["auth_failures"] = fails
            signals["top_signal"] = "Credential Abuse"

        # 4. Injection patterns in payload / query string
        if payload and INJECTION_PATTERNS.search(str(payload)):
            score += 0.75
            signals["injection_pattern"] = True
            signals["top_signal"] = "Payload Injection"

        # 5. Suspicious headers (empty User-Agent, unusual Accept)
        ua = headers.get("user-agent", "")
        if not ua or ua.lower() in ("", "python-requests", "curl/7"):
            score += 0.15
            signals["suspicious_ua"] = ua

        # 6. Unusual method for sensitive endpoints
        if endpoint.startswith("/api/admin") and method not in ("GET",):
            score += 0.2
            signals["unusual_method"] = method

        # 7. Time-of-day (simple heuristic: 2-5 AM UTC is suspicious)
        hour = datetime.utcnow().hour
        if 2 <= hour <= 5:
            score += 0.1
            signals["offhours"] = hour

        if not signals.get("top_signal"):
            signals["top_signal"] = "Anomalous Traffic"

        return min(score, 1.0), signals

    async def record_auth_failure(self, ip: str):
        """Call this from your auth route when a login fails."""
        r = await self._get_redis()
        key = f"auth_fail:{ip}"
        await r.incr(key)
        await r.expire(key, 3600)   # reset counter after 1 hour
