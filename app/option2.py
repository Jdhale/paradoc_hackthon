import redis
import json
import time
import random

r = redis.Redis(host='localhost', port=6379, decode_responses=True)

ips = ["45.142.212.100", "103.21.244.0", "185.220.101.45", "91.108.4.32"]
endpoints = ["/api/auth/login", "/api/admin", "/api/payments", "/api/users"]
methods = ["GET", "POST", "PUT"]

print("Sending traffic... watch your dashboard!")

while True:
    r.publish("traffic_stream", json.dumps({
        "ip": random.choice(ips),
        "endpoint": random.choice(endpoints),
        "method": random.choice(methods),
        "status_code": random.choice([200, 200, 200, 401, 403, 500]),
        "duration": round(random.uniform(0.01, 2.0), 4),
        "payload_size": random.randint(0, 5000),
    }))
    print(".", end="", flush=True)
    time.sleep(0.5)  # send every 500ms