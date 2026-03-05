import requests
import time
import json
import random

BASE_URL = "http://127.0.0.1:8000"

def log_test(name, description):
    print(f"\n{'='*60}")
    print(f"TEST: {name}")
    print(f"DESC: {description}")
    print(f"{'='*60}")

def simulate_activity():
    log_test("Step 1: Normal Activity", "Checking health and legitimate endpoints.")
    requests.get(f"{BASE_URL}/health")
    requests.get(f"{BASE_URL}/api/inventory")
    print("Normal activity logged.")

def simulate_attack():
    log_test("Step 2: SQL Injection Attack", "Injecting UNION SELECT into query params.")
    # Target /health but with a malicious query string
    attack_url = f"{BASE_URL}/health?query=1' UNION SELECT * FROM users--"
    print(f"Targeting: {attack_url}")
    resp = requests.get(attack_url)
    print(f"Initial Attack Response: {resp.status_code}")

def verify_block():
    log_test("Step 3: Verification", "Checking if IP is now blocked.")
    print("Waiting for Agent reasoning...")
    time.sleep(2) # Give the background worker time to process the Redis stream
    
    resp = requests.get(f"{BASE_URL}/health")
    if resp.status_code == 403:
        print("✅ SUCCESS: Sentinel AI has successfully blocked the attacker IP!")
        try:
            print(f"AI Message: {resp.json().get('reason', 'Access Denied')}")
        except:
            print("Access Denied.")
    else:
        print("❌ FAILED: IP is still active. Check your uvicorn console for 'Agent Worker' logs.")

if __name__ == "__main__":
    try:
        simulate_activity()
        simulate_attack()
        verify_block()
    except Exception as e:
        print(f"Connection Error: {e}. Is your server running at {BASE_URL}?")