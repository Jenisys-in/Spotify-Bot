import subprocess
import os
import platform
import shutil

def launch_chrome(profile_path: str, port: int, proxy: str = None):
    profile_path = os.path.abspath(profile_path)
    system_platform = platform.system()

    if system_platform == "Darwin":  # macOS
        chrome_path = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    elif system_platform == "Windows":
        # Try common Windows Chrome install paths
        possible_paths = [
            os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
            os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
            shutil.which("chrome"),  # In case it's in PATH
            shutil.which("chrome.exe")
        ]
        chrome_path = next((path for path in possible_paths if path and os.path.exists(path)), None)

        if not chrome_path:
            raise FileNotFoundError("Google Chrome not found on this Windows machine.")
    else:
        raise RuntimeError(f"Unsupported platform: {system_platform}")

    # Proxy setup (optional)
    proxy_arg = f'--proxy-server={proxy}' if proxy else ''
    proxy_msg = proxy if proxy else "No proxy"

    print(f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Launching Chrome instance on port {port}
 Profile: {profile_path}
 Proxy:   {proxy_msg}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
""")

    args = [
        chrome_path,
        f'--remote-debugging-port={port}',
        f'--user-data-dir={profile_path}',
        '--remote-allow-origins=*',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-sync',
        '--disable-extensions',
        '--autoplay-policy=no-user-gesture-required',
        '--no-sandbox',
        '--window-size=1280,720',
    ]

    if proxy:
        args.append(proxy_arg)

    return subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
