import sys
import asyncio
import json
import os
import random
import math
from pathlib import Path
import io

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.detach(), encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.detach(), encoding='utf-8', errors='replace')

#  Add path patching at the very top
sys.path.append(str(Path(__file__).resolve().parents[1]))

#  Now safe to import internal modules
from utils.status_writer import update_bot_status
from utils.proxy_utils import get_public_ip_info
from playwright.async_api import async_playwright

STEALTH_PATH = os.path.join(os.path.dirname(__file__), '..', 'stealth', 'stealth_patch.js')



def log_bot_session(session_data):
    """Log bot session data"""
    try:
        print(f"[BOT]  Logging session: {session_data}")
        # Implement actual logging functionality here
    except Exception as e:
        print(f"[BOT]  Failed to log session: {e}")

async def simulate_human_behavior(page, intensity="medium"):
    """Simulate more realistic human behavior on the page
    
    Args:
        page: The browser page to interact with
        intensity: Level of simulation ("low", "medium", "high")
    """
    try:
        # Determine simulation complexity based on intensity
        actions_count = {
            "low": random.randint(2, 4),
            "medium": random.randint(4, 8), 
            "high": random.randint(8, 12)
        }.get(intensity, 5)
        
        print(f"[BOT]  Simulating {intensity} human behavior ({actions_count} actions)")
        
        for _ in range(actions_count):
            # Choose a random action with weighted probability
            action = random.choices(
                ["scroll", "mouse_move", "pause", "hover_ui", "resize_window"],
                weights=[0.35, 0.25, 0.20, 0.15, 0.05],
                k=1
            )[0]
            
            if action == "scroll":
                # Natural scrolling with variable speed and direction
                direction = 1 if random.random() > 0.2 else -1  # Mostly scroll down
                scroll_amount = random.randint(100, 800) * direction
                # Simulate smooth scrolling with multiple smaller movements
                divisions = random.randint(3, 8)
                for i in range(divisions):
                    small_scroll = scroll_amount // divisions
                    await page.evaluate(f"window.scrollBy(0, {small_scroll})")
                    await asyncio.sleep(random.uniform(0.05, 0.2))
                await asyncio.sleep(random.uniform(0.3, 1.5))
                
            elif action == "mouse_move":
                # More natural mouse movement with multiple points
                start_x, start_y = random.randint(100, 800), random.randint(100, 600)
                end_x, end_y = random.randint(100, 800), random.randint(100, 600)
                
                # Move in small increments for more natural movement
                steps = random.randint(3, 8)
                for i in range(steps + 1):
                    progress = i / steps
                    # Add slight curve to movement
                    curve = math.sin(progress * math.pi) * random.randint(-30, 30)
                    x = start_x + (end_x - start_x) * progress + curve
                    y = start_y + (end_y - start_y) * progress
                    await page.mouse.move(x, y)
                    await asyncio.sleep(random.uniform(0.01, 0.08))
                await asyncio.sleep(random.uniform(0.2, 0.8))
                
            elif action == "pause":
                # Just wait - humans pause to read content
                await asyncio.sleep(random.uniform(1.0, 3.5))
                
            elif action == "hover_ui":
                # Find and hover over UI elements without clicking
                try:
                    selectors = [
                        'button', 
                        'a[href]', 
                        'div[role="button"]',
                        'div[data-testid]',
                        '.tracklist-row',
                        '.artist-profile'
                    ]
                    selector = random.choice(selectors)
                    elements = await page.query_selector_all(selector)
                    
                    if elements and len(elements) > 0:
                        # Choose random element
                        element = random.choice(elements)
                        if await element.is_visible():
                            await element.hover()
                            await asyncio.sleep(random.uniform(0.5, 1.5))
                except Exception:
                    # Silently ignore errors in simulation
                    pass
                    
            elif action == "resize_window":
                # Occasionally resize browser window slightly
                try:
                    current_viewport = await page.viewport_size()
                    width_change = random.randint(-50, 50)
                    height_change = random.randint(-30, 30)
                    new_width = max(800, current_viewport['width'] + width_change)
                    new_height = max(600, current_viewport['height'] + height_change)
                    
                    await page.set_viewport_size({
                        'width': new_width,
                        'height': new_height
                    })
                except Exception:
                    # Silently ignore errors in simulation
                    pass
                    
        # Final pause to let things settle
        await asyncio.sleep(random.uniform(0.5, 1.0))
        return True
        
    except Exception as e:
        print(f"[BOT]  Human simulation error: {e}")
        return False

async def accept_cookies_if_present(page, bot_id):
    """Check and accept Spotify cookie banner in English or Spanish"""
    try:
        print(f"[{bot_id}]   Checking for cookie banner...")
        await asyncio.sleep(2)  # Give time for banner to render

        # English and Spanish cookie accept button variations
        cookie_selectors = [
            'text="Accept Cookies"',
            'text="Accept cookies"',
            'text="Accept"',
            'text="Aceptar cookies"',
            'text="Aceptar Cookies"',
            'text="Aceptar"',
            'text="Aceptar todas las cookies"',
            'button:has-text("Accept")',
            'button:has-text("Aceptar")',
            'button[aria-label="Accept Cookies"]',
            'button[aria-label="Aceptar cookies"]',
            'div[data-testid="cookie-banner"] button',
            'div[id*="cookie"] button',
            'div[class*="cookie"] button:not([aria-label*="Reject"]):not([aria-label*="Rechazar"])',
            '[role="dialog"] button:first-child'
        ]

        for selector in cookie_selectors:
            try:
                locator = page.locator(selector)
                if await locator.is_visible(timeout=1000):
                    await locator.click()
                    print(f"[{bot_id}]   Accepted cookies via selector: {selector}")
                    await asyncio.sleep(1)
                    return True
            except Exception as inner_e:
                continue

        print(f"[{bot_id}]   No cookie banner detected or buttons matched.")
        return False

    except Exception as e:
        print(f"[{bot_id}]   Cookie accept error: {e}")
        return False


async def run_stealth_test(page, bot_id):
    """Visit browser fingerprinting test sites and take screenshots"""
    test_urls = [
        "https://browserleaks.com/webrtc",
        "https://bot.sannysoft.com/"
    ]
    
    for url in test_urls:
        try:
            print(f"[{bot_id}]  Visiting {url} for stealth test...")
            await page.goto(url, timeout=60000)
            await asyncio.sleep(5)  # Let scripts load
            
            # Take a screenshot of the test page
            screenshot_path = f"bot_{bot_id}_stealth_{url.split('//')[1].split('.')[0]}.png"
            await page.screenshot(path=screenshot_path, full_page=True)
            print(f"[{bot_id}]  Stealth screenshot saved: {screenshot_path}")
        except Exception as e:
            print(f"[{bot_id}]  Failed stealth test visit to {url}: {e}")

async def is_playing_track(page, timeout=5000):
    """Helper function to check if a track is actually playing by looking for Pause button"""
    try:
        return await page.locator('button[aria-label="Pause"]').is_visible(timeout=timeout)
    except:
        return False
    

async def verify_stealth(page, bot_id):
    try:
        print(f"[{bot_id}]  Running stealth checks...")

        # Check navigator.webdriver is undefined or false
        webdriver_flag = await page.evaluate("() => navigator.webdriver === false")
        if not webdriver_flag:
            print(f"[{bot_id}]  Stealth fail: navigator.webdriver = true or defined")
            return False

        # Confirm permissions spoofing (push, geolocation, etc.)
        permissions_result = await page.evaluate("""
            () => {
                return navigator.permissions.query({name: 'notifications'})
                    .then(res => res.state)
                    .catch(() => 'unsupported');
            }
        """)
        if permissions_result not in ['denied', 'granted', 'prompt']:
            print(f"[{bot_id}]  Stealth fail: navigator.permissions spoofing issue")
            return False

        # WebGL vendor/renderer check (do not fail unless completely missing or obviously headless)
        webgl_vendor = await page.evaluate("""
            () => {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                if (!gl) return null;
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                return debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : null;
            }
        """)

        webgl_renderer = await page.evaluate("""
            () => {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                if (!gl) return null;
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                return debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : null;
            }
        """)

        if not webgl_vendor or not webgl_renderer:
            print(f"[{bot_id}]  Stealth fail: WebGL context or renderer unavailable")
            return False

        print(f"[{bot_id}]  Stealth passed: WebGL → {webgl_vendor} / {webgl_renderer}")
        return True

    except Exception as e:
        print(f"[{bot_id}]  Stealth verification error: {e}")
        return False


def calculate_real_roi(streams):
    payment_per_stream = 0.0048     # Confirmed by Pedro
    proxy_cost_per_gb = 0.48        # Confirmed by Pedro
    traffic_gb = (streams * 1.0) / 1024  # 1MB per stream
    income = streams * payment_per_stream
    cost = traffic_gb * proxy_cost_per_gb
    if cost == 0:
        return 0
    roi = ((income - cost) / cost) * 100
    return round(roi, 2)




async def run_bot(bot_config):
    track_url = bot_config['track_url']
    bot_id = bot_config['bot_id']
    cdp_port = bot_config['cdp_port']
    cdp_url = f"http://localhost:{cdp_port}"
    profile_dir = bot_config['profile_dir']
    login_marker_path = os.path.join(profile_dir, ".login_done")
    
    #  IMPROVEMENT 2: Normalize and detect the page type (Track, Album, Playlist)
    is_track = "/track/" in track_url
    
    if "/album/" in track_url:
        print(f"[{bot_id}]  Detected ALBUM URL")
    elif "/playlist/" in track_url:
        print(f"[{bot_id}]  Detected PLAYLIST URL")
    elif is_track:
        print(f"[{bot_id}]  Detected TRACK URL")
    else:
        print(f"[{bot_id}]  Unknown URL type — defaulting to TRACK behavior")
    
    print(f"[{bot_id}]  Connecting to Chrome via CDP on {cdp_url}...")
    
    async with async_playwright() as p:
        try:
            browser = await p.chromium.connect_over_cdp(cdp_url)
            context = browser.contexts[0]

            # Improved cookie handling
            cookies_path = os.path.join(profile_dir, "cookies.json")
            if os.path.exists(cookies_path):
                try:
                    with open(cookies_path, "r") as f:
                        saved_cookies = json.load(f)
                    
                    # Fix domain and set security flags for all cookies
                    for cookie in saved_cookies:
                        # Override domain to target open.spotify.com explicitly
                        cookie["domain"] = "open.spotify.com"
                        # Prevent cross-origin blocking
                        cookie["sameSite"] = "None"
                        # Spotify requires HTTPS
                        cookie["secure"] = True
                    
                    await context.add_cookies(saved_cookies)
                    print(f"[{bot_id}]  Injected cookies into context")
                except Exception as e:
                    print(f"[{bot_id}]  Failed to inject cookies: {e}")
            
            # Reuse existing login tab if available
            page = None
            for p_ in context.pages:
                if "spotify.com" in p_.url:
                    page = p_
                    break
            if not page:
                page = context.pages[0]
                
                
            # Inject stealth script
            stealth_code = Path(STEALTH_PATH).read_text()
            print(f"[{bot_id}]  Injecting stealth patch...")
            await page.add_init_script(stealth_code)

            stealth_verified = await verify_stealth(page, bot_id)
            
            #  Wait for login marker file
            print(f"[{bot_id}]  Waiting for login completion marker...")
            for _ in range(20):
                if os.path.exists(login_marker_path):
                    print(f"[{bot_id}]  Login marker file found")
                    break
                await asyncio.sleep(1)
            else:
                raise Exception(f"[{bot_id}]  Login marker file not found — login likely failed")
                
            # Navigate to Spotify first and let session hydrate
            await page.goto("https://open.spotify.com", timeout=60000)
            await asyncio.sleep(4)  # Let the session fully hydrate
            
            # Check for cookie consent on main page first
            await accept_cookies_if_present(page, bot_id)
            
            #  Verify login via cookies - more reliable method
            print(f"[{bot_id}]  Verifying login via cookies...")
            for i in range(10):  # Check a few times with delay
                cookies = await context.cookies()
                cookie_names = [c["name"] for c in cookies]
                if "sp_dc" in cookie_names or "sp_key" in cookie_names:
                    print(f"[{bot_id}]  Login confirmed via cookie")
                    break
                await asyncio.sleep(1)
            else:
                print(f"[{bot_id}]  Login cookie missing — not logged in")
                # Continue anyway and try UI-based verification as fallback
            
            #  Navigate to track and simulate playback
            await page.goto(track_url, timeout=60000)
            
            # Check for cookie consent on track page
            await accept_cookies_if_present(page, bot_id)
            
            #  Wait for account menu or avatar to confirm login via UI
            print(f"[{bot_id}]  Verifying login via UI elements...")
            for i in range(30):  # wait up to 30s
                content = await page.content()
                if "Account" in content or "Log out" in content or "Premium" in content:
                    print(f"[{bot_id}]  Detected logged-in UI")
                    break
                await asyncio.sleep(1)
            else:
                raise Exception(f"[{bot_id}]  UI never showed login — Spotify not logged in in this session")
                
            print(f"[{bot_id}]  Loaded track: {track_url}")
            
            user_agent = await page.evaluate("navigator.userAgent")
            media_capabilities = await page.evaluate("navigator.mediaCapabilities !== undefined")
            print(f"[{bot_id}]  User Agent: {user_agent}")
            print(f"[{bot_id}]  Media Capabilities Support: {media_capabilities}")
            
            # STEP 1: Target the green play button using data-testid (works across all content types)
            play_clicked = False
            print(f"[{bot_id}]  Targeting ONLY the top green Play button with data-testid...")
            
            # Scroll to top of page to ensure button is in viewport
            await page.evaluate("window.scrollTo(0, 0)")
            await asyncio.sleep(1)
            
            
            # Try clicking the top green play button, robust to all types (track, album, playlist)
            try:
                play_button = page.locator('div[data-testid="action-bar-row"] button[data-testid="play-button"]')
                await play_button.wait_for(state="visible", timeout=15000)
                
                # Get position for debugging
                box = await play_button.bounding_box()
                print(f"[{bot_id}]  True Play button location: x={int(box['x'])}, y={int(box['y'])}")

                print(f"[{bot_id}]  Resetting playback position to 0s...")
                try:
                    await page.evaluate("""
                        try {
                            const progressBar = document.querySelector('[data-testid="playback-progressbar"]');
                            if (progressBar) {
                                const rect = progressBar.getBoundingClientRect();
                                const clickX = rect.left + 5;
                                const clickY = rect.top + rect.height / 2;
                                const mouseDown = new MouseEvent('mousedown', {
                                    bubbles: true,
                                    clientX: clickX,
                                    clientY: clickY
                                });
                                const mouseUp = new MouseEvent('mouseup', {
                                    bubbles: true,
                                    clientX: clickX,
                                    clientY: clickY
                                });
                                progressBar.dispatchEvent(mouseDown);
                                progressBar.dispatchEvent(mouseUp);
                            }
                        } catch (e) {
                            console.error("Failed to reset progress bar", e);
                        }
                    """)
                except Exception as e:
                    print(f"[{bot_id}]  Playback reset failed: {e}")


                
                # Hover and click
                await play_button.hover()
                await asyncio.sleep(0.3)
                await play_button.click()
                print(f"[{bot_id}]  Successfully clicked green Play button")
                await asyncio.sleep(3)
                
                # Take screenshot after clicking
                
                
                # Verify playback started
                if await is_playing_track(page):
                    print(f"[{bot_id}]  Play button clicked and playback confirmed")
                    play_clicked = True
                else:
                    print(f"[{bot_id}]  Play button clicked but playback not confirmed")
            except Exception as e:
                print(f"[{bot_id}]  Error clicking Play button: {e}")
            
            # STEP 3: Removed ALL fallback methods - no generic selectors
            
            # 🔊 Resume audio context + unmute tab (keeping this for audio compatibility)
            try:
                print(f"[{bot_id}]  Ensuring audio is enabled...")
                await page.evaluate("""
                try {
                    // Unmute any audio elements
                    const audio = document.querySelector('audio');
                    if (audio) {
                        audio.muted = false;
                        audio.volume = 1.0;
                        audio.play().catch(() => {});
                    }
                    
                    // Resume any audio contexts
                    if (typeof AudioContext !== 'undefined') {
                        const ctx = new AudioContext();
                        if (ctx.state === 'suspended') {
                            ctx.resume();
                        }
                    }
                } catch(e) {
                    console.log("Audio resume error", e);
                }
                """)
            except Exception as e:
                print(f"[{bot_id}]  Audio initialization error: {e}")

            #  Verify track playback 
            playback_verified = False
            
            # Method 1: Check now-playing widget in footer
            try:
                print(f"[{bot_id}]  Verifying playback via now-playing widget...")
                await page.wait_for_selector('footer [data-testid="now-playing-widget"]', timeout=10000)
                playing_href = await page.locator('footer [data-testid="now-playing-widget"] a[href*="/track/"]').get_attribute("href")
                expected_id = track_url.split("/")[-1].split("?")[0]
                
                if expected_id in playing_href:
                    print(f"[{bot_id}]  Now playing correct track: {expected_id}")
                    playback_verified = True
                else:
                    print(f"[{bot_id}]  Wrong track playing: {playing_href}")
            except Exception as e:
                print(f"[{bot_id}]  Now-playing widget check failed: {e}")
                
            # Method 2: Check if progress bar is active
            if not playback_verified:
                try:
                    print(f"[{bot_id}]  Verifying playback via progress bar...")
                    # Check if playback time element exists
                    progress_selector = 'div.playback-bar__progress-time, div[data-testid="playback-position"]'
                    
                    # Wait for progress element to appear
                    await page.wait_for_selector(progress_selector, timeout=10000)
                    
                    # Get initial time
                    initial_time = await page.locator(progress_selector).first.inner_text()
                    print(f"[{bot_id}]  Initial progress time: {initial_time}")
                    
                    # Wait 5 seconds and check if time changed
                    await asyncio.sleep(5)
                    current_time = await page.locator(progress_selector).first.inner_text()
                    print(f"[{bot_id}]  Current progress time: {current_time}")
                    
                    if initial_time != current_time:
                        print(f"[{bot_id}]  Playback confirmed: Progress time is advancing")
                        playback_verified = True
                    else:
                        print(f"[{bot_id}]  Progress time not advancing")
                except Exception as e:
                    print(f"[{bot_id}]  Progress bar check failed: {e}")
            
            # Method 3: Check if play button changed to pause
            if not playback_verified:
                try:
                    print(f"[{bot_id}]  Checking if play changed to pause...")
                    pause_exists = await page.locator('button[aria-label="Pause"]').is_visible(timeout=5000)
                    if pause_exists:
                        print(f"[{bot_id}]  Pause button visible - track is playing")
                        playback_verified = True
                except Exception as e:
                    print(f"[{bot_id}]  Pause button check failed: {e}")
                    
            if not playback_verified:
                print(f"[{bot_id}]  Could not verify track playback through any method")

            # Simulate listening
            wait_time = random.randint(31, 34)
            print(f"[{bot_id}]  Listening for {wait_time} seconds...")
            await asyncio.sleep(wait_time)

            # Screenshot of Spotify playback
            try:
                screenshot_path = f"bot_{bot_id}_screenshot.png"
                await page.screenshot(path=screenshot_path)
                print(f"[{bot_id}]  Screenshot saved: {screenshot_path}")
            except:
                print(f"[{bot_id}]  Screenshot failed")
                
            # Run stealth detection tests
            await run_stealth_test(page, bot_id)

            # Get IP
            try:
                ip = await page.evaluate("""() => fetch('https://api.ipify.org').then(res => res.text())""")
                print(f"[{bot_id}]  Public IP: {ip}")
                ip_info = {"ip": ip, "country": "Unknown"}
            except Exception as e:
                print(f"[{bot_id}]  Failed to get IP: {e}")
                ip_info = {"ip": "Unknown", "country": "Unknown"}

            # Log session
            ip_info = await get_public_ip_info(proxy_url=bot_config["proxy"])
            log_bot_session({
                "track_url": track_url,
                "account": bot_id,
                "ip": ip_info.get("ip", "Unknown"),
                "country": ip_info.get("country", "Unknown"),
                "port": cdp_port,
                "playback_verified": playback_verified
            })

            playback_seconds = wait_time
            streams = max(1, int(playback_seconds / random.randint(31, 34)))
            roi = calculate_real_roi(streams)


            try:
                 update_bot_status(
                     bot_id=bot_id,
                     status_data={
                        "proxy_ip": ip_info.get("ip", "Unknown"),
                        "track": track_url.split("/")[-1].split("?")[0],
                        "evasion": "PASS" if stealth_verified else "FAIL",
                        "roi": f"{roi}%"
                    }
                 )
                 print(f"[{bot_id}]  Status written to bot_status.json")
            except Exception as status_err:
                print(f"[{bot_id}]  Failed to write status: {status_err}")

        except Exception as e:
            print(f"[{bot_id}]  Error: {e}")
        finally:
            try:
                for context in browser.contexts:
                    for page in context.pages:
                        await page.close()
                await browser.close()
                print(f"[{bot_id}]  Browser and all pages closed.")
            except Exception as e:
                print(f"[{bot_id}]  Cleanup error: {e}")
            finally:
                import sys
                sys.exit(0)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 bot_runner.py <bot_config_json>")
        sys.exit(1)
    
    bot_config = json.loads(sys.argv[1])
    asyncio.run(run_bot(bot_config))