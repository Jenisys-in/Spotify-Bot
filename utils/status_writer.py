import json
import os
import threading

STATUS_FILE = os.path.join(os.path.dirname(__file__), '..', 'bot_status.json')
lock = threading.Lock()

def update_bot_status(bot_id, status_data):
    with lock:
        try:
            if os.path.exists(STATUS_FILE):
                with open(STATUS_FILE, 'r') as f:
                    all_data = json.load(f)
            else:
                all_data = {}

            all_data[bot_id] = status_data

            with open(STATUS_FILE, 'w') as f:
                json.dump(all_data, f, indent=2)

        except Exception as e:
            print(f"[ERROR] Failed to write bot status for {bot_id}: {e}")
