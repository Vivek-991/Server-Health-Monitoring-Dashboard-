#!/usr/bin/env python3
"""
ServerPulse Monitoring Agent v2
================================
Collects CPU, memory, disk, network, and uptime metrics and pushes them
to your ServerPulse dashboard every few seconds.

Prerequisites:
    pip install psutil requests

Usage:
    # Set environment variables and run:
    SERVERPULSE_ID="my-server" SERVERPULSE_KEY="shd_xxxx..." python3 agent.py

    # Or run in background (Linux):
    nohup SERVERPULSE_ID="my-server" SERVERPULSE_KEY="shd_xxxx..." \\
        python3 agent.py > /var/log/serverpulse.log 2>&1 &

Environment Variables:
    SERVERPULSE_URL     Dashboard push URL  (default: http://localhost:5000/api/metrics/push)
    SERVERPULSE_ID      Unique server name  (default: system hostname)
    SERVERPULSE_KEY     Your API key from the dashboard (required for user isolation)
    SERVERPULSE_INTERVAL Push interval in seconds (default: 5)
"""

import os
import sys
import time
import socket
import platform
import logging

# ── Setup logging ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)
log = logging.getLogger('serverpulse')

# ── Configuration ─────────────────────────────────────────────────────────────
DASHBOARD_URL = os.environ.get('SERVERPULSE_URL', 'http://localhost:5000/api/metrics/push')
SERVER_ID     = os.environ.get('SERVERPULSE_ID', socket.gethostname())
API_KEY       = os.environ.get('SERVERPULSE_KEY', 'default-secure-key-123')
INTERVAL      = int(os.environ.get('SERVERPULSE_INTERVAL', '5'))

# ── Check dependencies ────────────────────────────────────────────────────────
try:
    import psutil
except ImportError:
    log.error("'psutil' is not installed. Run: pip install psutil requests")
    sys.exit(1)

try:
    import requests
except ImportError:
    log.error("'requests' is not installed. Run: pip install psutil requests")
    sys.exit(1)

# ── Metric collectors ─────────────────────────────────────────────────────────

def get_cpu():
    try:
        load_avg = os.getloadavg()[0] if hasattr(os, 'getloadavg') else 0
    except Exception:
        load_avg = 0

    freq = psutil.cpu_freq()
    return {
        'usage': round(psutil.cpu_percent(interval=1), 2),
        'cores': psutil.cpu_count(logical=False) or 1,
        'threads': psutil.cpu_count(logical=True) or 1,
        'speed': round(freq.current / 1000, 2) if freq else 0,  # GHz
        'model': _cpu_model(),
    }

def _cpu_model():
    """Try to get a real CPU model name."""
    try:
        if platform.system() == 'Linux':
            with open('/proc/cpuinfo') as f:
                for line in f:
                    if 'model name' in line:
                        return line.split(':')[1].strip()
        elif platform.system() == 'Darwin':
            import subprocess
            out = subprocess.check_output(['sysctl', '-n', 'machdep.cpu.brand_string'])
            return out.decode().strip()
    except Exception:
        pass
    return platform.processor() or 'Unknown CPU'

def get_memory():
    m = psutil.virtual_memory()
    return {
        'total': m.total,
        'used': m.used,
        'free': m.available,
        'usagePercent': round(m.percent, 2),
    }

def get_disks():
    disks = []
    for part in psutil.disk_partitions(all=False):
        try:
            usage = psutil.disk_usage(part.mountpoint)
            disks.append({
                'fs': part.fstype or 'unknown',
                'mount': part.mountpoint,
                'device': part.device,
                'size': usage.total,
                'used': usage.used,
                'free': usage.free,
                'usagePercent': round(usage.percent, 2),
            })
        except (PermissionError, OSError):
            pass
    return disks or [{'fs': 'unknown', 'mount': '/', 'size': 0, 'used': 0, 'free': 0, 'usagePercent': 0}]

def get_network():
    try:
        n1 = psutil.net_io_counters()
        time.sleep(0.5)
        n2 = psutil.net_io_counters()
        return {
            'rx_bytes': n2.bytes_recv,
            'tx_bytes': n2.bytes_sent,
            'rx_sec': max(0, n2.bytes_recv - n1.bytes_recv) * 2,  # *2 because 0.5s sample
            'tx_sec': max(0, n2.bytes_sent - n1.bytes_sent) * 2,
            'interface': _primary_iface(),
        }
    except Exception:
        return {'rx_bytes': 0, 'tx_bytes': 0, 'rx_sec': 0, 'tx_sec': 0, 'interface': 'unknown'}

def _primary_iface():
    """Return the primary non-loopback interface name."""
    try:
        for name, addrs in psutil.net_if_addrs().items():
            if name.startswith(('lo', 'Loopback')):
                continue
            for addr in addrs:
                if addr.family == socket.AF_INET and not addr.address.startswith('127.'):
                    return name
    except Exception:
        pass
    return 'eth0'

def get_temperatures():
    try:
        temps = psutil.sensors_temperatures()
        if not temps:
            return []
        result = []
        for name, entries in temps.items():
            for entry in entries[:3]:
                result.append({
                    'sensor': name,
                    'label': entry.label or name,
                    'main': round(entry.current, 1),
                    'high': entry.high,
                    'critical': entry.critical,
                })
        return result
    except (AttributeError, Exception):
        return []

def get_os_info():
    try:
        uptime_seconds = int(time.time() - psutil.boot_time())
    except Exception:
        uptime_seconds = 0

    return {
        'distro': _os_name(),
        'platform': sys.platform,
        'arch': platform.machine(),
        'hostname': socket.gethostname(),
        'uptime': uptime_seconds,
        'uptime_human': _format_uptime(uptime_seconds),
    }

def _os_name():
    try:
        if platform.system() == 'Linux':
            with open('/etc/os-release') as f:
                for line in f:
                    if line.startswith('PRETTY_NAME='):
                        return line.split('=', 1)[1].strip().strip('"')
    except Exception:
        pass
    return platform.system() or 'Unknown OS'

def _format_uptime(seconds):
    d = seconds // 86400
    h = (seconds % 86400) // 3600
    m = (seconds % 3600) // 60
    if d > 0:
        return f'{d}d {h}h {m}m'
    if h > 0:
        return f'{h}h {m}m'
    return f'{m}m'

def collect_payload():
    cpu  = get_cpu()
    disk = get_disks()
    mem  = get_memory()
    net  = get_network()
    os_  = get_os_info()

    return {
        'hostname': os_['hostname'],
        'os': os_,
        'cpu': cpu,
        'memory': mem,
        'disks': disk,
        'network': net,
        'temperatures': get_temperatures(),
        'load': {
            'avgLoad': round((cpu['usage'] / 100) * cpu['cores'], 2),
            'currentLoad': cpu['usage'],
        },
        'services': [],
        'status': 'online',
    }

# ── Main loop ─────────────────────────────────────────────────────────────────

def main():
    print()
    print('=' * 60)
    print('  ⚡ ServerPulse Monitoring Agent v2')
    print('=' * 60)
    print(f'  Server ID  : {SERVER_ID}')
    print(f'  Dashboard  : {DASHBOARD_URL}')
    print(f'  Interval   : {INTERVAL}s')
    print(f'  Hostname   : {socket.gethostname()}')
    print(f'  OS         : {_os_name()}')
    print('=' * 60)
    print()

    if API_KEY == 'default-secure-key-123':
        print('⚠️  WARNING: Using default API key. For per-user isolation, get your')
        print('   unique server API key from the dashboard → Servers → Add Server.')
        print()

    consecutive_failures = 0
    max_backoff = 60

    while True:
        loop_start = time.monotonic()

        try:
            payload_data = collect_payload()

            payload = {
                'serverId': SERVER_ID,
                'apiKey':   API_KEY,
                'metrics':  payload_data,
            }

            resp = requests.post(DASHBOARD_URL, json=payload, timeout=10)

            if resp.status_code == 200:
                consecutive_failures = 0
                cpu_val  = payload_data['cpu']['usage']
                ram_val  = payload_data['memory']['usagePercent']
                disk_val = payload_data['disks'][0]['usagePercent'] if payload_data['disks'] else 0
                net_rx   = payload_data['network']['rx_sec']
                net_tx   = payload_data['network']['tx_sec']
                log.info(
                    f'✔ CPU:{cpu_val:5.1f}%  RAM:{ram_val:5.1f}%  '
                    f'Disk:{disk_val:5.1f}%  '
                    f'↓{_human_bytes(net_rx)}/s  ↑{_human_bytes(net_tx)}/s'
                )
            elif resp.status_code == 401:
                log.error(f'❌ Unauthorized — check your SERVERPULSE_KEY. Response: {resp.text[:200]}')
                # Don't retry auth failures instantly — wait
                time.sleep(30)
                continue
            else:
                consecutive_failures += 1
                log.warning(f'⚠ Server returned {resp.status_code}: {resp.text[:200]}')

        except requests.exceptions.ConnectionError as e:
            consecutive_failures += 1
            backoff = min(INTERVAL * consecutive_failures, max_backoff)
            log.warning(f'⚠ Cannot connect to {DASHBOARD_URL} — retry in {backoff}s ({e})')
            time.sleep(backoff)
            continue

        except requests.exceptions.Timeout:
            consecutive_failures += 1
            log.warning(f'⚠ Request timed out after 10s')

        except Exception as e:
            consecutive_failures += 1
            log.error(f'❌ Unexpected error: {e}')

        # Sleep for the remainder of the interval
        elapsed = time.monotonic() - loop_start
        sleep_for = max(1, INTERVAL - elapsed)
        time.sleep(sleep_for)

def _human_bytes(n):
    for unit in ['B', 'KB', 'MB', 'GB']:
        if n < 1024:
            return f'{n:.0f}{unit}'
        n /= 1024
    return f'{n:.0f}TB'

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\n\n👋 Agent stopped.')
        sys.exit(0)
