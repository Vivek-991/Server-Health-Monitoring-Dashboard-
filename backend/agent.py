#!/usr/bin/env python3
"""
ServerPulse Health Monitoring Agent
Collects CPU, memory, disk, network, and uptime metrics and pushes them to the central dashboard.

Prerequisites:
    pip install psutil requests
"""

import os
import sys
import time
import socket
import requests

# ── Configuration (Update these to match your environment) ────────────────────
DASHBOARD_URL = os.environ.get("SERVERPULSE_URL", "http://localhost:5000/api/metrics/push")
SERVER_ID = os.environ.get("SERVERPULSE_ID", socket.gethostname())
API_KEY = os.environ.get("SERVERPULSE_KEY", "default-secure-key-123")
INTERVAL_SECONDS = int(os.environ.get("SERVERPULSE_INTERVAL", "5"))

try:
    import psutil
except ImportError:
    print("❌ Error: 'psutil' library is not installed.")
    print("Please install it using: pip install psutil")
    sys.exit(1)

def get_cpu_info():
    try:
        # Load averages (only works on Unix systems, fallback to 0 on Windows)
        load_avg = os.getloadavg()[0] if hasattr(os, "getloadavg") else 0
    except Exception:
        load_avg = 0

    return {
        "usage": psutil.cpu_percent(interval=1),
        "cores": psutil.cpu_count(logical=False) or 1,
        "speed": getattr(psutil.cpu_freq(), "current", 0) or 2.5,
        "model": "Cloud VM Processor"
    }

def get_memory_info():
    mem = psutil.virtual_memory()
    return {
        "total": mem.total,
        "used": mem.used,
        "free": mem.available,
        "usagePercent": mem.percent
    }

def get_disk_info():
    # Gather root partition diagnostics
    path = "/" if os.name != "nt" else "C:\\"
    try:
        disk_stats = psutil.disk_usage(path)
        return [{
            "fs": psutil.disk_partitions()[0].fstype or "ext4",
            "mount": path,
            "size": disk_stats.total,
            "used": disk_stats.used,
            "usagePercent": disk_stats.percent
        }]
    except Exception:
        return []

def get_network_info():
    # Calculate difference over 1 second to find RX/TX speeds
    net1 = psutil.net_io_counters()
    time.sleep(1)
    net2 = psutil.net_io_counters()
    
    return {
        "rx_bytes": net2.bytes_recv,
        "tx_bytes": net2.bytes_sent,
        "rx_sec": max(0, net2.bytes_recv - net1.bytes_recv),
        "tx_sec": max(0, net2.bytes_sent - net1.bytes_sent),
        "interface": "eth0"
    }

def collect_payload():
    cpu = get_cpu_info()
    return {
        "hostname": socket.gethostname(),
        "os": {
            "distro": sys.platform.title(),
            "platform": sys.platform,
            "uptime": int(time.time() - psutil.boot_time())
        },
        "cpu": cpu,
        "memory": get_memory_info(),
        "disks": get_disk_info(),
        "network": get_network_info(),
        "temperatures": [],
        "services": [],
        "load": {
            "avgLoad": (cpu["usage"] / 100) * cpu["cores"],
            "currentLoad": cpu["usage"]
        },
        "status": "online"
    }

def main():
    print("================================================================")
    print(f"🚀 Starting ServerPulse Monitoring Agent")
    print(f"📡 Target URL:   {DASHBOARD_URL}")
    print(f"🖥️ Server ID:   {SERVER_ID}")
    print(f"⏱️ Interval:    {INTERVAL_SECONDS} seconds")
    print("================================================================")

    while True:
        try:
            metrics = collect_payload()
            payload = {
                "serverId": SERVER_ID,
                "apiKey": API_KEY,
                "metrics": metrics
            }
            
            res = requests.post(DASHBOARD_URL, json=payload, timeout=5)
            if res.status_code == 200:
                print(f"✔ [{time.strftime('%H:%M:%S')}] Metrics pushed. CPU: {metrics['cpu']['usage']}% | RAM: {metrics['memory']['usagePercent']}%")
            else:
                print(f"❌ [{time.strftime('%H:%M:%S')}] Server error ({res.status_code}): {res.text}")
        except requests.exceptions.RequestException as e:
            print(f"⚠️ [{time.strftime('%H:%M:%S')}] Connection failed: {e}")
        
        # Deduct time elapsed during calculation to keep interval steady
        time.sleep(max(1, INTERVAL_SECONDS - 2))

if __name__ == "__main__":
    main()
