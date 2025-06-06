import json
import subprocess
import asyncio
import os
import socket
import httpx
from pathlib import Path
import signal
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.detach(), encoding='utf-8', errors='ignore')
sys.stderr = io.TextIOWrapper(sys.stderr.detach(), encoding='utf-8', errors='ignore')

sys.path.append(str(Path(__file__).resolve().parents[1]))

from utils.chrome_launcher import launch_chrome


CONFIG_PATH = "config/bot_configs.json"
BASE_CDP_PORT = 9222
chrome_procs = []
bot_tasks = []

def is_port_open(port):
    try:
        with socket.create_connection(("localhost", port), timeout=2):
            return True
    except:
        return False

async def wait_for_chrome_ready(port, timeout=20):
    url = f"http://localhost:{port}/json"
    for _ in range(timeout * 2):
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(url)
                tabs = r.json()
                if any("spotify.com" in tab.get("url", "") for tab in tabs):
                    return True
        except:
            pass
        await asyncio.sleep(0.5)
    return False

async def ensure_chrome_and_login(bot, cdp_port):
    profile_dir = bot["profile_dir"]
    email = bot["email"]
    password = bot["password"]
    proxy = bot.get("proxy", None)
    login_marker = os.path.join(profile_dir, ".login_done")
    env = os.environ.copy()
    env["CDP_PORT"] = str(cdp_port)

    # Fresh login needed
    if not os.path.exists(login_marker):
        print(f"[LOGIN]  Fresh login for {profile_dir} on port {cdp_port}")
        subprocess.run(["node", "bots/login.js", email, password, profile_dir], env=env)
    
    # Session now exists — launch real Chrome
    print(f"[LOGIN]  Launching real Chrome for {profile_dir} on port {cdp_port}")
    chrome_proc = launch_chrome(profile_dir, cdp_port, proxy)
    chrome_procs.append(chrome_proc)
    await asyncio.sleep(2)
    await wait_for_chrome_ready(cdp_port)

async def launch_bot(bot_config):
    print(f"[{bot_config['bot_id']}]  Spawning...")
    print(f"[{bot_config['bot_id']}]  Running on CDP port {bot_config['cdp_port']} with profile {bot_config['profile_dir']}")
    
    proc = await asyncio.create_subprocess_exec(
       sys.executable, "bots/bot_runner.py", json.dumps(bot_config),
    )
    await proc.wait()

def shutdown_all():
    print(" Shutting down all Chrome instances and bot tasks...")
    for proc in chrome_procs:
        try:
            proc.terminate()
        except:
            pass
    for task in bot_tasks:
        if not task.done():
            task.cancel()
    print(" All processes terminated.")

def handle_exit(sig, frame):
    shutdown_all()
    sys.exit(0)

signal.signal(signal.SIGINT, handle_exit)
signal.signal(signal.SIGTERM, handle_exit)

async def main():
    with open(CONFIG_PATH, "r") as f:
        raw_configs = json.load(f)
    
    updated_configs = []
    for i, bot in enumerate(raw_configs):
        bot["bot_id"] = f"bot{i+1}"
        cdp_port = BASE_CDP_PORT + i
        bot["cdp_port"] = cdp_port
        await ensure_chrome_and_login(bot, cdp_port)
        updated_configs.append(bot)

    # Launch bots with staggered delay
    for bot in updated_configs:
        task = asyncio.create_task(launch_bot(bot))
        bot_tasks.append(task)
        await asyncio.sleep(2)

    # Wait for all bots to complete
    await asyncio.gather(*bot_tasks, return_exceptions=True)
    shutdown_all()

if __name__ == "__main__":
    asyncio.run(main())
