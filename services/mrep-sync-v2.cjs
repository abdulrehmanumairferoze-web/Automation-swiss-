const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const MREP_CONFIG = {
    url: 'https://swiss.mrep.com.pk/Reports/DailySalesTrend',
    landingUrl: 'https://swiss.mrep.com.pk/Home/DistributorSaleDashboard',
    credentials: {
        company: 'COO',
        user: '2003',
        password: '2003'
    },
    downloadDir: path.join(__dirname, '..', 'mrep-downloads'),
    userDataDir: path.join(__dirname, '..', 'mrep-session-data')
};

if (!fs.existsSync(MREP_CONFIG.downloadDir)) {
    fs.mkdirSync(MREP_CONFIG.downloadDir, { recursive: true });
}

// Ensure session directory exists
if (!fs.existsSync(MREP_CONFIG.userDataDir)) {
    fs.mkdirSync(MREP_CONFIG.userDataDir, { recursive: true });
}

async function runSync() {
    console.log('🚀 Starting MREP Automation Sync (V3 - PERSISTENT SESSION)...');

    // Use persistent context to save login state (cookies, local storage)
    // trying 'msedge' first (Windows default), falling back to bundled chromium if needed
    let context;
    try {
        console.log('🌐 Launching Edge (Persistent)...');
        context = await chromium.launchPersistentContext(MREP_CONFIG.userDataDir, {
            headless: false,
            channel: 'msedge', // Try to use installed Edge
            slowMo: 100,
            viewport: { width: 1280, height: 720 },
            acceptDownloads: true,
            args: ['--start-maximized'] // Help user see everything
        });
    } catch (e) {
        console.log('⚠️ Edge not found, falling back to Chromium...');
        context = await chromium.launchPersistentContext(MREP_CONFIG.userDataDir, {
            headless: false,
            slowMo: 100,
            viewport: { width: 1280, height: 720 },
            acceptDownloads: true
        });
    }

    // Get the default page or create new one
    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

    try {
        console.log('📍 Navigating to MREP portal...');
        await page.goto(MREP_CONFIG.url, { waitUntil: 'load', timeout: 60000 });

        // --- SESSION CHECK & LOGIN LOGIC ---
        console.log('⏳ Checking login state...');
        let onDashboard = await isDashboard(page);

        if (onDashboard) {
            console.log('✅ Already logged in (Session Restored)!');
        } else {
            console.log('🔐 Not logged in. Attempting automation...');

            try {
                await performLogin(page);
            } catch (loginErr) {
                console.warn(`⚠️ Automated login encountered issues: ${loginErr.message}`);
                console.log('🛑 PAUSING FOR MANUAL INTERVENTION.');
                console.log('👉 Please manually logs in the browser window if needed.');
            }

            // FALLBACK: Wait for user to manually login if automation failed or was partial
            console.log('⏳ Waiting for Dashboard to load (Manual or Auto)...');
            // Wait up to 2 minutes for the user/script to get to the dashboard
            try {
                await page.waitForFunction(() => {
                    return window.location.href.includes('DistributorSaleDashboard') ||
                        window.location.href.includes('DailySalesTrend') ||
                        document.body.innerText.includes('Log Off');
                }, null, { timeout: 120000 });
                console.log('✅ Login successful (Dashboard detected)');
            } catch (waitErr) {
                console.error("❌ Timed out waiting for login. Please login manually next time.");
                throw new Error("Login timeout - Sync aborted");
            }


            // If we landed on the main dashboard, navigate back to the report
            if (!page.url().includes('DailySalesTrend')) {
                console.log('🔄 Redirecting to Daily Sales Trend report...');
                await page.goto(MREP_CONFIG.url, { waitUntil: 'load' });
            }
        }

        // --- REPORT PROCESSING ---
        console.log('🔧 Processing Report...');

        // Step 3: Apply filters
        console.log('🔧 Applying filters...');
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.toLocaleString('en-US', { month: 'long' });

        await page.waitForSelector('select', { timeout: 15000 });

        const yearSelect = await page.locator('select[name*="year"], select[id*="year"], select:has-text("Year")').first();
        await yearSelect.selectOption({ label: currentYear.toString() });

        const monthSelect = await page.locator('select[name*="month"], select[id*="month"], select:has-text("Month")').first();
        await monthSelect.selectOption({ label: currentMonth });

        const typeSelect = await page.locator('select[name*="type"], select[id*="type"], select:has-text("Type")').first();
        await typeSelect.selectOption({ label: 'Units' });

        const filterButton = await page.locator('button:has-text("Filter"), input[value="Filter"]').first();
        await filterButton.click();

        await page.waitForLoadState('networkidle');
        console.log('✅ Filters applied');

        // Step 4: Drag "All Regions" to Sheets
        console.log('🎯 Dragging "All Regions" to Sheets...');
        // (Keeping existing drag logic)
        const allRegionsCard = await page.locator('text="All Regions"').first();
        const sheetsDropZone = await page.locator('[class*="sheets"], [id*="sheets"], text="Sheets"').first();

        // Ensure elements are visible
        await allRegionsCard.waitFor({ state: 'visible' });
        await sheetsDropZone.waitFor({ state: 'visible' });

        try {
            await allRegionsCard.dragTo(sheetsDropZone);
        } catch (e) {
            const sourceBox = await allRegionsCard.boundingBox();
            const targetBox = await sheetsDropZone.boundingBox();
            if (sourceBox && targetBox) {
                await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
                await page.mouse.down();
                await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
                await page.mouse.up();
            }
        }

        // Wait for grid to update
        await page.waitForTimeout(2000);

        // Step 5: Capture download
        console.log('📥 Waiting for download...');
        const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

        try {
            const exportButton = await page.locator('button:has-text("Export"), button:has-text("Download"), a:has-text("Excel")').first();
            await exportButton.click();
        } catch (e) {
            console.log('⚠️ No explicit export button found, download might be automatic or already triggered');
        }

        const download = await downloadPromise;
        const fileName = `mrep-sync-${Date.now()}.xlsx`;
        const downloadPath = path.join(MREP_CONFIG.downloadDir, fileName);
        await download.saveAs(downloadPath);
        console.log(`✅ Saved to: ${downloadPath}`);

        await context.close();
        return { downloadPath, fileName, success: true };

    } catch (error) {
        console.error('❌ MREP Sync Error:', error.message);
        try {
            const html = await page.content();
            fs.writeFileSync(path.join(MREP_CONFIG.downloadDir, 'error-v3.html'), html);
            await page.screenshot({ path: path.join(MREP_CONFIG.downloadDir, 'error-v3.png') });
        } catch (e) { console.error("Could not save debug info"); }

        await context.close();
        throw error;
    }
}

async function isDashboard(page) {
    const url = page.url();
    if (url.includes('DistributorSaleDashboard') || url.includes('DailySalesTrend')) {
        // Double check for logout button to confirm authenticated state
        const logoutBtn = await page.locator('text=Log Off, text=Logout, .fa-sign-out').count();
        if (logoutBtn > 0) return true;
        // If we are on DailySalesTrend, we are likely logged in
        if (url.includes('DailySalesTrend')) return true;
    }
    return false;
}

// Updated robust login with fail-fast to allow manual fallback
async function performLogin(page) {
    // Check if login form exists, otherwise skip
    if (await page.locator('input[type="password"]').count() === 0) return;

    // Company (Click + Type)
    const companyInput = await page.locator('input[name*="Company"], input[id*="Company"], input[name="company"]').first();
    if (await companyInput.isVisible()) {
        await companyInput.click();
        await page.waitForTimeout(300);
        await companyInput.pressSequentially(MREP_CONFIG.credentials.company, { delay: 50 });
    }

    // User (Click + Type)
    const userSelectors = ['input[name*="Territory"]', 'input[name="user"]', 'input[name*="User"]'];
    for (const sel of userSelectors) {
        const input = page.locator(sel).first();
        if (await input.count() > 0 && await input.isVisible()) {
            await input.click();
            await page.waitForTimeout(300);
            await input.pressSequentially(MREP_CONFIG.credentials.user, { delay: 50 });
            break;
        }
    }

    // Password
    const passInput = await page.locator('input[type="password"]').first();
    await passInput.click();
    await page.waitForTimeout(300);
    await passInput.pressSequentially(MREP_CONFIG.credentials.password, { delay: 50 });

    // Click Login
    const loginBtn = await page.locator('button[type="submit"], input[type="submit"], button:has-text("Login")').first();
    await loginBtn.click();

    // We do NOT wait here forever. We return and let the main loop wait for dashboard detection.
    // This allows the user to intervene if the click didn't work.
}

module.exports = { runSync };
