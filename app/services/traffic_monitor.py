"""
traffic_monitor.py
──────────────────
Captures and aggregates API traffic metrics.
Pushes live stats to Redis Pub/Sub every 2 seconds so the WebSocket
endpoint can stream them to the frontend in real time.
"""
import asyncio
import json
import logging
import math
import os
import random
import time
from collections import defaultdict
from datetime import datetime
from typing import Optional

import redis.asyncio as aioredis

logger    = logging.getLogger(__name__)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")


class TrafficMonitor:
    def __init__(self):
        self._redis: Optional[aioredis.Redis] = None
        self._bucket: dict = defaultdict(int)
        self._ip_counts: dict = defaultdict(int)
        self._tick = 0
        self._baseline_rps = 300.0

    async def connect(self):
        self._redis = await aioredis.from_url(REDIS_URL, decode_responses=True)
        logger.info("TrafficMonitor connected to Redis")
        # Start background tick loop
        asyncio.create_task(self._tick_loop())

    # ── Background loop — publishes traffic_tick every 2s ─────────────────
    async def _tick_loop(self):
        """Continuously publishes traffic ticks to Redis pub/sub."""
        while True:
            try:
                await self._publish_tick()
                await asyncio.sleep(2.0)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"TrafficMonitor tick error: {e}")
                await asyncio.sleep(5)

    async def _publish_tick(self):
        if not self._redis:
            return

        self._tick += 1
        now = datetime.utcnow()

        # Read real counters from Redis
        total   = int(await self._redis.get("traffic:total")   or 0)
        blocked = int(await self._redis.get("traffic:blocked") or 0)
        anomaly = int(await self._redis.get("traffic:anomaly") or 0)

        # If no real traffic yet, simulate realistic data
        if total == 0:
            hour = now.hour
            diurnal = 0.4 + 0.6 * math.sin(math.pi * (hour - 4) / 20) ** 2
            base = self._baseline_rps * diurnal * 2  # 2s window

            # Occasional spike
            if self._tick % 30 == 0:
                spike = random.uniform(2.0, 3.5)
            else:
                spike = 1.0

            total   = max(50, int(base * spike + random.gauss(0, base * 0.1)))
            blocked = int(total * random.uniform(0.05, 0.12))
            anomaly = max(0, int(random.gauss(5, 3)))

        rps = round(total / 2.0, 1)

        # Update baseline with EWMA
        self._baseline_rps = 0.95 * self._baseline_rps + 0.05 * rps

        tick = {
            "type"     : "traffic_tick",
            "payload"  : {
                "timestamp": now.isoformat() + "Z",
                "requests" : total,
                "blocked"  : blocked,
                "anomalies": anomaly,
                "rps"      : rps,
            }
        }

        await self._redis.publish("traffic_stream", json.dumps(tick))

        # Store in timeseries ring buffer for REST API
        point = {
            "time"     : now.isoformat() + "Z",
            "requests" : total,
            "blocked"  : blocked,
            "anomalies": anomaly,
            "rps"      : rps,
        }
        await self._redis.lpush("timeseries:traffic", json.dumps(point))
        await self._redis.ltrim("timeseries:traffic", 0, 719)  # keep 720 points (24h)

        # Reset rolling counters after reading
        await self._redis.delete("traffic:total", "traffic:blocked", "traffic:anomaly", "traffic:duration_sum")

    # ── Called by middleware on every request ──────────────────────────────
    async def record(
        self,
        ip      : str,
        endpoint: str,
        method  : str,
        status  : int,
        duration: float,
        blocked : bool = False,
        anomaly : bool = False,
    ):
        if not self._redis:
            return

        # Track per-IP request counts
        self._ip_counts[ip] += 1

        pipe = self._redis.pipeline()
        pipe.incr("traffic:total");  pipe.expire("traffic:total",  60)
        pipe.incrbyfloat("traffic:duration_sum", duration)
        pipe.expire("traffic:duration_sum", 60)

        if blocked:
            pipe.incr("traffic:blocked"); pipe.expire("traffic:blocked", 60)
        if anomaly:
            pipe.incr("traffic:anomaly"); pipe.expire("traffic:anomaly", 60)

        # Per-IP counter (for reputation endpoint)
        ip_key = f"ip:requests:{ip}"
        pipe.incr(ip_key); pipe.expire(ip_key, 60)

        # Per-endpoint counter
        ep_key = f"endpoint:{endpoint.replace('/', '_')}:calls"
        pipe.incr(ep_key); pipe.expire(ep_key, 300)

        # Push raw event for agent to consume
        event = json.dumps({
            "ip"          : ip,
            "endpoint"    : endpoint,
            "method"      : method,
            "status_code" : status,
            "duration"    : round(duration, 4),
            "payload_size": 0,
        })
        pipe.lpush("traffic:events", event)
        pipe.ltrim("traffic:events", 0, 9999)

        await pipe.execute()

    async def get_ip_request_count(self, ip: str) -> int:
        if not self._redis:
            return self._ip_counts.get(ip, 0)
        val = await self._redis.get(f"ip:requests:{ip}")
        return int(val) if val else 0

    async def get_snapshot(self) -> dict:
        if not self._redis:
            return {}
        r = self._redis
        total   = int(await r.get("traffic:total")   or 0)
        blocked = int(await r.get("traffic:blocked") or 0)
        anomaly = int(await r.get("traffic:anomaly") or 0)
        dur_sum = float(await r.get("traffic:duration_sum") or 0)
        avg_ms  = round((dur_sum / total * 1000) if total > 0 else 0, 2)

        return {
            "timestamp"  : datetime.utcnow().isoformat(),
            "requests"   : total,
            "blocked"    : blocked,
            "anomalies"  : anomaly,
            "rps"        : round(total / 60, 1),
            "avg_latency": avg_ms,
        }


# Singleton
monitor = TrafficMonitor()