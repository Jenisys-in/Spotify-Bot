# 🎧 Spotify Bot Automation Suite

This project is a highly sophisticated automation system for simulating human-like interaction with Spotify. It is designed to play tracks, albums, and playlists using real browser sessions, fully mimicking user behavior with stealth techniques, advanced browser fingerprinting, and robust proxy handling.

## ✅ Features

- 🔒 **Undetectable Login System**  
  - Uses Puppeteer with a deeply patched stealth layer (`stealth_patch.js`)
  - Passes major anti-bot fingerprinting checks (BrowserLeaks, Sannysoft)
  - Handles retries, OTP detection, fallback reloads, and dynamic waits

- 🎵 **Track / Album / Playlist Support**  
  - Simulates real Spotify web player usage
  - Clicks the *top green play button* only (not sidebar or fallback)
  - Includes playback verification by checking pause button state and progress bar

- 🌐 **Proxy Support (Sticky + Rotating)**  
  - Full support for IPRoyal, Smartproxy, and other proxy providers
  - Rotation via port 823 (HTTP) and 824 (SOCKS5) compliant
  - Proxies are dynamically attached per bot instance

- 🧠 **Smart Bot Orchestration**  
  - Clean execution via `orchestrator/main.py`
  - Launches multiple bots in parallel with isolated persistent contexts
  - Each bot runs in a sandboxed profile with fingerprint isolation

- 📈 **Playback Verification**  
  - Ensures that clicking play starts actual playback
  - Logs false positives if Spotify UI fails to respond
  - Optionally retries or exits cleanly if playback fails

- 🧹 **Clean Shutdown and Resource Handling**  
  - Gracefully closes Playwright contexts and browsers
  - Prevents orphaned processes or hanging sessions
  - Robust error handling and final logging per bot session

- 🔎 **Logging and Debugging**  
  - Colored terminal logs with clear emoji indicators
  - Logs proxy used, login status, playback status, and browser feedback
  - Handles Unicode/emoji logging compatibility on Windows

## 📂 Project Structure

spotify-bot/
├── bots/
│ └── bot_runner.py # Executes a single Spotify bot instance
├── orchestrator/
│ └── main.py # Master controller for launching multiple bots
├── login/
│ ├── login.js # Puppeteer script for Spotify login (with stealth)
│ └── stealth_patch.js # Custom stealth patch script
├── data/
│ ├── accounts.json # List of Spotify accounts
│ └── targets.json # Track/album/playlist URLs
├── utils/
│ ├── proxy_manager.py # Proxy allocation logic
│ └── logger.py # Emoji + color logger for terminal
├── .env # Contains credentials, proxy keys, etc.
├── requirements.txt
└── README.md


## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/spotify-bot.git
cd spotify-bot
pip install -r requirements.txt
2. Setup Environment
Create a .env file:

SPOTIFY_EMAILS=accounts.json
PROXY_SOURCE=data/proxies.txt
CHROME_EXEC_PATH=/path/to/chrome
3. Add Accounts and Targets
data/accounts.json: List of account credentials
data/targets.json: Each bot will randomly pick a track/album/playlist URL
Example:

[
  { "email": "acc1@example.com", "password": "pass123" },
  { "email": "acc2@example.com", "password": "pass456" }
]
[
  "https://open.spotify.com/track/xxxx",
  "https://open.spotify.com/album/yyyy",
  "https://open.spotify.com/playlist/zzzz"
]
4. Run the Bot
python orchestrator/main.py --count 10
Launches 10 parallel Spotify bots using Playwright.

⚙️ Advanced Configuration

Proxy Types
Type	Port	Usage
Sticky	any	Connect once, re-use IP
Rotating	823	New IP per session
SOCKS5	824	Encrypted + dynamic location
Persistent Context
Each bot uses:

launch_persistent_context() from Playwright
Separate browser profile to maintain cookies, storage, etc.
Playback Verification Logic
Checks for:
Top green play button (div[data-testid="action-bar-row"] button[data-testid="play-button"])
Pause button state after click
Optional audio progress movement
🛠 Debug Tips

❗ If you see:
TimeoutError: Waiting for selector context-header
→ Spotify UI may be delayed. Increase timeout or debug slow proxies.
❌ If playback fails with no pause button detected:
→ Possibly blocked or account not premium.
⚠️ WebGL Errors (like "Canvas has no webgl context"):
→ Chrome not properly hardware accelerated. Try reinstalling or using a fresh profile.
🪟 On Windows:
Set terminal encoding to UTF-8 to avoid charmap emoji errors
Use PYTHONIOENCODING=utf-8 when running scripts
🤖 Tech Stack

Python 3.10+
Playwright (Python)
Puppeteer (Node.js)
Custom stealth fingerprinting engine
Proxy rotation & management
🧪 Future Improvements

Support shuffle mode, repeat mode
Automatically detect captcha and fallback to 2Captcha
Integrate streaming status monitoring API
Multi-platform support: Mac, Linux, Windows tested
🧑‍💻 Author

Built by Tuhin | Jenisys.ai — AI + Automation Developer

Feel free to reach out for custom bot automation or AI services.

