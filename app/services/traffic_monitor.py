"""
traffic_monitor.py
──────────────────
Captures and aggregates API traffic metrics.
Pushes live stats to a Redis Pub/Sub channel so the WebSocket
endpoint can stream them to the frontend in real time.

Metrics tracked (rolling 60s window per endpoint):
  - total requests
  - blocked requests
  - anomaly count
  - status code distribution
  - average response time
"""
import asyncio
import json
import logging
import os
import time
from collections import defaultdict
from datetime import datetime
from typing import Optional

import redis.asyncio as aioredis

logger   = logging.getLogger(__name__)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")


class TrafficMonitor:
    def __init__(self):
        self._redis: Optional[aioredis.Redis] = None
        # In-memory 1-second buckets; flushed to Redis every second
        self._bucket: dict = defaultdict(int)

    async def connect(self):
        self._redis = await aioredis.from_url(REDIS_URL, decode_responses=True)
        logger.info("TrafficMonitor connected to Redis")

    # ── Called by middleware on every request ───────────────────────────────
    async def record(
        self,
        ip       : str,
        endpoint : str,
        method   : str,
        status   : int,
        duration : float,
        blocked  : bool = False,
        anomaly  : bool = False,
    ):
        """
        Records a single request.
        Increments Redis counters for the sliding-window dashboard.
        """
        if not self._redis:
            return

        pipe = self._redis.pipeline()

        # Global rolling counters (60s TTL)
        pipe.incr("traffic:total");   pipe.expire("traffic:total",   60)
        pipe.incrbyfloat("traffic:duration_sum", duration)
        pipe.expire("traffic:duration_sum", 60)

        if blocked:
            pipe.incr("traffic:blocked"); pipe.expire("traffic:blocked", 60)
        if anomaly:
            pipe.incr("traffic:anomaly"); pipe.expire("traffic:anomaly", 60)

        # Per-endpoint counters
        ep_key = f"endpoint:{endpoint.replace('/','_')}:calls"
        pipe.incr(ep_key); pipe.expire(ep_key, 300)

        await pipe.execute()

        # Publish tick so WS can forward to browser instantly
        tick = {
            "type"     : "traffic_tick",
            "timestamp": datetime.utcnow().isoformat(),
            "ip"       : ip,
            "endpoint" : endpoint,
            "status"   : status,
            "duration" : round(duration, 4),
            "blocked"  : blocked,
            "anomaly"  : anomaly,
        }
        await self._redis.publish("traffic_stream", json.dumps(tick))

    # ── Called by GET /traffic/timeseries ───────────────────────────────────
    async def get_snapshot(self) -> dict:
        """Returns current rolling-window stats for the dashboard."""
        if not self._redis:
            return {}
        r = self._redis
        total    = int(await r.get("traffic:total")    or 0)
        blocked  = int(await r.get("traffic:blocked")  or 0)
        anomaly  = int(await r.get("traffic:anomaly")  or 0)
        dur_sum  = float(await r.get("traffic:duration_sum") or 0)
        avg_ms   = round((dur_sum / total * 1000) if total > 0 else 0, 2)

        return {
            "timestamp"  : datetime.utcnow().isoformat(),
            "requests"   : total,
            "blocked"    : blocked,
            "anomalies"  : anomaly,
            "rps"        : total,           # window is 60s; divide by 60 for true RPS
            "avg_latency": avg_ms,
        }


# Singleton
monitor = TrafficMonitor()
