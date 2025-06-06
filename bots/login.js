const puppeteer = require("puppeteer");
const fs = require("fs-extra");
const path = require("path");
const args = process.argv.slice(2);

if (args.length < 3) {
  console.error("Usage: node login.js <email> <password> <profile_path>");
  process.exit(1);
}

// Helper function to get a random language
function getRandomLanguage() {
  const languages = ['en-US', 'en-GB', 'fr', 'de', 'es', 'pt', 'it'];
  return languages[Math.floor(Math.random() * languages.length)];
}

const [email, password, profilePath] = args;
const bot_number = profilePath.split("/").pop(); // For logging
const CDP_PORT = process.env.CDP_PORT || "9222";
const PROXY = process.env.PROXY || "http://gw.dataimpulse.com:823"; // Get proxy from env or use default
const stealthScriptPath = path.join(__dirname, "..", "stealth", "stealth_patch.js");
const stealthScript = fs.readFileSync(stealthScriptPath, "utf8");

// Constants for retry logic
const MAX_RETRIES = 3;
const SHORT_DELAY = 1000;
const MEDIUM_DELAY = 3000;
const LONG_DELAY = 5000;

async function takeScreenshot(page, name) {
  try {
    const screenshotPath = path.join(profilePath, `${name}_${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`[Bot ${bot_number}]  Saved screenshot to ${screenshotPath}`);
  } catch (e) {
    console.log(`[Bot ${bot_number}]  Failed to save screenshot: ${e.message}`);
  }
}

async function injectStealth(page) {
  await page.evaluateOnNewDocument(stealthScript);
  console.log(`[Bot ${bot_number}]  Injected stealth_patch.js`);
}

async function setupBrowser() {
  await fs.ensureDir(profilePath);

  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: profilePath,
    args: [
      `--proxy-server=${PROXY}`,
      `--remote-debugging-port=${CDP_PORT}`,
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      `--lang=${getRandomLanguage()}`
    ],
    defaultViewport: null
  });

  const page = await browser.newPage();
  await injectStealth(page);

  // Apply stealth script to all new pages/tabs
  browser.on('targetcreated', async target => {
    try {
      const newPage = await target.page();
      if (newPage) {
        await injectStealth(newPage);
      }
    } catch (e) {
      console.log(`[Bot ${bot_number}]  Failed to inject stealth into new page: ${e.message}`);
    }
  });

  return { browser, page };
}

async function goToLoginPage(page) {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      await page.goto("https://accounts.spotify.com/en/login", { timeout: 60000 });
      
      // Check for error page or redirect issues
      const url = page.url();
      if (!url.includes("accounts.spotify.com")) {
        console.log(`[Bot ${bot_number}]  Redirected to unexpected URL: ${url}`);
        if (i === MAX_RETRIES - 1) throw new Error("Failed to reach Spotify login page");
        await new Promise(r => setTimeout(r, MEDIUM_DELAY));
        continue;
      }
      
      // Validate stealth effectiveness
      const webdriver = await page.evaluate(() => navigator.webdriver);
      if (webdriver) {
        console.log(`[Bot ${bot_number}]  Detected as bot (navigator.webdriver = true)`);
      } else {
        console.log(`[Bot ${bot_number}]  Stealth check passed (navigator.webdriver = false)`);
      }
      
      // Additional fingerprinting checks
      const userAgent = await page.evaluate(() => navigator.userAgent);
      console.log(`[Bot ${bot_number}]  User-Agent: ${userAgent}`);
      
      return true;
    } catch (e) {
      console.log(`[Bot ${bot_number}]  Page load attempt ${i+1} failed: ${e.message}`);
      if (i === MAX_RETRIES - 1) throw new Error("Page failed to load after multiple retries");
      await new Promise(r => setTimeout(r, MEDIUM_DELAY));
    }
  }
}

async function enterEmail(page) {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      await page.waitForSelector('input#login-username', { timeout: 15000 });
      await page.type('input#login-username', email, { delay: 100 });
      
      // Check if password field is already visible
      const passwordVisible = await page.$('input#login-password').then(Boolean).catch(() => false);
      
      if (!passwordVisible) {
        // Need to click continue button
        for (let j = 0; j < MAX_RETRIES; j++) {
          try {
            await page.click('button[data-testid="login-button"]');
            break;
          } catch (e) {
            console.log(`[Bot ${bot_number}]  Continue button click attempt ${j+1} failed: ${e.message}`);
            if (j === MAX_RETRIES - 1) throw new Error("Continue button failed to click");
            await new Promise(r => setTimeout(r, SHORT_DELAY));
          }
        }
      }
      
      return passwordVisible;
    } catch (e) {
      console.log(`[Bot ${bot_number}]  Email entry attempt ${i+1} failed: ${e.message}`);
      if (i === MAX_RETRIES - 1) throw new Error("Failed to enter email");
      
      // Try refreshing the page on subsequent attempts
      if (i > 0) {
        await page.reload({ waitUntil: ['networkidle0', 'domcontentloaded'] }).catch(() => {});
      }
      
      await new Promise(r => setTimeout(r, MEDIUM_DELAY));
    }
  }
}

async function enterPassword(page, passwordAlreadyVisible) {
  let password_field_found = passwordAlreadyVisible;
  
  if (!passwordAlreadyVisible) {
    // Try finding password field with retries
    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        await page.waitForSelector('input#login-password', { timeout: 5000 });
        password_field_found = true;
        break;
      } catch {
        try {
          // Try the OTP fallback button
          const fallbackBtn = await page.evaluateHandle(`document.evaluate("//button[contains(., 'Log in with a password')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue`);
          const fallbackBtnExists = await page.evaluate(btn => btn !== null, fallbackBtn);
          
          if (fallbackBtnExists) {
            console.log(`[Bot ${bot_number}] 🪄 Found 'Log in with a password' button`);
            await fallbackBtn.click();
            await page.waitForSelector('input#login-password', { timeout: 5000 });
            console.log(`[Bot ${bot_number}]  Password field appeared after fallback`);
            password_field_found = true;
            break;
          }
          await fallbackBtn.dispose();
        } catch (e) {
          console.log(`[Bot ${bot_number}]  Fallback button check attempt ${i+1} failed: ${e.message}`);
        }
        
        if (i === MAX_RETRIES - 1) {
          console.log(`[Bot ${bot_number}]  Password field never appeared — trying page refresh`);
          await page.reload({ waitUntil: ['networkidle0', 'domcontentloaded'] }).catch(() => {});
          await new Promise(r => setTimeout(r, MEDIUM_DELAY));
          
          // Try one last time after refresh
          try {
            await page.waitForSelector('input#login-password', { timeout: 5000 });
            password_field_found = true;
          } catch {
            console.log(`[Bot ${bot_number}]  Password field still not found after refresh`);
            return false;
          }
        }
        
        await new Promise(r => setTimeout(r, SHORT_DELAY));
      }
    }
  }

  if (password_field_found) {
    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        await page.type('input#login-password', password, { delay: 100 });
        await new Promise(r => setTimeout(r, 1500));
        return true;
      } catch (e) {
        console.log(`[Bot ${bot_number}]  Password entry attempt ${i+1} failed: ${e.message}`);
        if (i === MAX_RETRIES - 1) throw new Error("Failed to enter password");
        await new Promise(r => setTimeout(r, SHORT_DELAY));
      }
    }
  }
  
  return false;
}

async function clickLoginButton(page) {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      // Try CSS selector first
      let finalBtn = await page.$('button[type="submit"]');
      
      // If not found, try XPath for fallback
      if (!finalBtn) {
        const loginBtnHandle = await page.evaluateHandle(`document.evaluate("//button[contains(., 'Log in') or contains(., 'Sign in')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue`);
        const btnExists = await page.evaluate(btn => btn !== null, loginBtnHandle);
        
        if (btnExists) {
          finalBtn = loginBtnHandle;
        } else {
          await loginBtnHandle.dispose();
        }
      }
      
      // Last resort: look for any button that might be a login button
      if (!finalBtn) {
        finalBtn = await page.$('button.Button-sc-qlcn5g-0');
      }

      if (!finalBtn) {
        console.log(`[Bot ${bot_number}]  Could not find login button by any method (attempt ${i+1})`);
        if (i === MAX_RETRIES - 1) throw new Error("Login button not found");
        await new Promise(r => setTimeout(r, SHORT_DELAY));
        continue;
      }

      // Check if button is visible
      const isVisible = await finalBtn.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return !!(rect.width && rect.height);
      });

      if (!isVisible) {
        console.log(`[Bot ${bot_number}]  Login button is not visible (attempt ${i+1})`);
        await finalBtn.dispose();
        if (i === MAX_RETRIES - 1) throw new Error("Login button not visible");
        await new Promise(r => setTimeout(r, SHORT_DELAY));
        continue;
      }

      // Retry the actual click up to 3 times
      for (let j = 0; j < MAX_RETRIES; j++) {
        try {
          await finalBtn.click();
          console.log(`[Bot ${bot_number}]  Clicked final Log In button`);
          break;
        } catch (e) {
          console.log(`[Bot ${bot_number}]  Login button click attempt ${j+1} failed: ${e.message}`);
          if (j === MAX_RETRIES - 1) throw new Error("Login button click failed after multiple attempts");
          await new Promise(r => setTimeout(r, SHORT_DELAY));
        }
      }
      
      // Clean up handle
      if (finalBtn.dispose) {
        await finalBtn.dispose();
      }
      
      return true;
    } catch (e) {
      console.log(`[Bot ${bot_number}]  Login button handling attempt ${i+1} failed: ${e.message}`);
      if (i === MAX_RETRIES - 1) throw new Error("Login button handling failed completely");
      
      // Try a refresh on subsequent attempts
      if (i > 0) {
        await page.reload({ waitUntil: ['networkidle0', 'domcontentloaded'] }).catch(() => {});
        await enterEmail(page).catch(() => {});
        await enterPassword(page, false).catch(() => {});
      }
      
      await new Promise(r => setTimeout(r, MEDIUM_DELAY));
    }
  }
}

async function checkLoginSuccess(page) {
  try {
    // Wait for possible redirection
    await page.waitForNavigation({ timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, MEDIUM_DELAY));

    // Check for error message
    const errorVisible = await page.$eval('div.alert-warning', el => el.innerText.includes('Something went wrong')).catch(() => false);
    if (errorVisible) {
      console.log(`[Bot ${bot_number}]  Spotify login error UI appeared`);
      await takeScreenshot(page, "error_message");
      return false;
    }

    // Check for OTP/verification challenge
    if (page.url().includes("verify") || page.url().includes("challenge")) {
      console.log(`[Bot ${bot_number}]  Stuck in OTP challenge — skipping`);
      await takeScreenshot(page, "verification_challenge");
      return false;
    }

    // Check for authentication cookies
    const cookies = await page.cookies();
    const loggedIn = cookies.some(c => c.name === 'sp_dc' || c.name === 'sp_key');
    
    if (!loggedIn) {
      console.log(`[Bot ${bot_number}]  Login cookies not found — login likely failed.`);
      await takeScreenshot(page, "login_failed");
      return false;
    }

    console.log(`[Bot ${bot_number}]  Login successful. Session saved to: ${profilePath}`);
    fs.writeFileSync(`${profilePath}/.login_done`, "true");
    await fs.writeJson(`${profilePath}/cookies.json`, cookies, { spaces: 2 });
    console.log(`[Bot ${bot_number}]  Saved cookies to cookies.json`);
    return true;
  } catch (e) {
    console.log(`[Bot ${bot_number}]  Error checking login status: ${e.message}`);
    await takeScreenshot(page, "login_check_error");
    return false;
  }
}

async function performLogin() {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    console.log(`[Bot ${bot_number}]  Starting login attempt ${attempt + 1}/${MAX_RETRIES}`);
    
    let browser, page;
    try {
      // Setup new browser and page for each attempt
      const setup = await setupBrowser();
      browser = setup.browser;
      page = setup.page;
      
      // Step 1: Go to login page
      await goToLoginPage(page);
      
      // Step 2: Enter email (and possibly click continue)
      const passwordAlreadyVisible = await enterEmail(page);
      
      // Step 3: Enter password
      await enterPassword(page, passwordAlreadyVisible);
      
      // Step 4: Click login button
      await clickLoginButton(page);
      
      // Step 5: Check login success
      const loginSuccessful = await checkLoginSuccess(page);
      
      if (loginSuccessful) {
        console.log(`[Bot ${bot_number}]  Login session finalized. Closing Puppeteer browser...`);
        await new Promise(r => setTimeout(r, MEDIUM_DELAY));
        await browser.close();
        return true;
      } else {
        console.log(`[Bot ${bot_number}]  Login attempt ${attempt + 1} failed. Trying again...`);
        await browser.close();
        await new Promise(r => setTimeout(r, LONG_DELAY));  // Longer delay between full retries
      }
    } catch (err) {
      console.log(`[Bot ${bot_number}]  Login attempt ${attempt + 1} error: ${err.message}`);
      
      if (page) {
        await takeScreenshot(page, `error_attempt_${attempt + 1}`);
      }
      
      if (browser) {
        await browser.close().catch(() => {});
      }
      
      if (attempt < MAX_RETRIES - 1) {
        console.log(`[Bot ${bot_number}]  Waiting before retry...`);
        await new Promise(r => setTimeout(r, LONG_DELAY));
      }
    }
  }
  
  console.log(`[Bot ${bot_number}]  All login attempts failed after ${MAX_RETRIES} tries`);
  return false;
}

(async () => {
  try {
    await performLogin();
  } catch (err) {
    console.log(`[Bot ${bot_number}]  Fatal error in login script: ${err.message}`);
    process.exit(1);
  }
})();