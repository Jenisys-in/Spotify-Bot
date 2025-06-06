import tkinter as tk
from tkinter import scrolledtext, ttk
import tkinter.font as tkFont
import subprocess
import json
import os
import threading
import time
import signal
import sys

# Path settings
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
BOT_SCRIPT = os.path.join(PROJECT_ROOT, '..', 'orchestrator', 'main.py')
STATUS_FILE = os.path.join(PROJECT_ROOT, '..', 'bot_status.json')
LOG_FILE_PATH = os.path.join(PROJECT_ROOT, 'gui_bots.log')

# Clean startup
with open(STATUS_FILE, 'w') as f:
    json.dump({}, f)

with open(LOG_FILE_PATH, 'w') as f:
    f.write("[INFO] Fresh session started.\n")

# Globals
bot_process = None
update_interval = 5  # seconds

def start_bots():
    global bot_process
    if bot_process is None:
        log_file = open(LOG_FILE_PATH, 'w')  # Overwrite log fresh

        bot_process = subprocess.Popen(
            [sys.executable, "-u", BOT_SCRIPT],
            stdout=log_file,
            stderr=subprocess.STDOUT,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        )
        log("[INFO] Bots started. Output is being written to gui_bots.log")
    else:
        log("[WARN] Bots are already running.")

def stop_bots():
    global bot_process
    if bot_process is not None:
        bot_process.terminate()
        bot_process.wait()
        bot_process = None
        log("[INFO] Bots stopped. Exiting GUI...")
    else:
        log("[WARN] No bot process running.")

    # Exit entire GUI + process
    root.after(500, lambda: root.destroy())

def log(message):
    log_area.configure(state='normal')
    log_area.insert(tk.END, message + '\n')
    log_area.see(tk.END)
    log_area.configure(state='disabled')

def update_status_loop():
    while True:
        update_status()
        time.sleep(update_interval)

def update_status():
    if os.path.exists(STATUS_FILE):
        try:
            with open(STATUS_FILE, 'r') as f:
                data = json.load(f)
                log_area.configure(state='normal')
                log_area.delete(1.0, tk.END)
                for bot_id, info in data.items():
                    line = f"Bot {bot_id}: Proxy={info.get('proxy_ip', 'N/A')} | Track={info.get('track', 'N/A')} | Evasion={info.get('evasion', 'N/A')} | ROI={info.get('roi', 'N/A')}"
                    log_area.insert(tk.END, line + '\n')
                log_area.configure(state='disabled')
        except Exception as e:
            log(f"[ERROR] Failed to read status: {e}")
    else:
        log("[WARN] bot_status.json not found")

# GUI Setup
root = tk.Tk()
root.title("Komene Spotify Bot Dashboard")
root.geometry("720x400")

# Font and styling
btn_font = tkFont.Font(family="Helvetica", size=12, weight="bold")

# Create a style
style = ttk.Style()
style.theme_use("clam")

style.configure("TButton", font=btn_font, padding=10, foreground="white", background="#28a745")
style.map("TButton", background=[("active", "#218838")])

style.configure("Stop.TButton", font=btn_font, padding=10, foreground="white", background="#dc3545")
style.map("Stop.TButton", background=[("active", "#c82333")])

start_btn = ttk.Button(root, text="ACTIVATE BOTS", command=start_bots, style="TButton")
stop_btn = ttk.Button(root, text="STOP BOTS", command=stop_bots, style="Stop.TButton")

log_area = scrolledtext.ScrolledText(root, width=85, height=20, state='disabled', bg="#1e1e1e", fg="white")

start_btn.pack(pady=10)
stop_btn.pack(pady=5)
log_area.pack(padx=10, pady=10)

# Start update loop in background
threading.Thread(target=update_status_loop, daemon=True).start()

# Ensure proper cleanup on window close (same as Stop button)
root.protocol("WM_DELETE_WINDOW", stop_bots)

# Run the app
root.mainloop()
