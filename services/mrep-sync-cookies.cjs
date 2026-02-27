const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const MREP_CONFIG = {
    url: 'https://swiss.mrep.com.pk/Reports/DailySalesTrend',
    domain: 'swiss.mrep.com.pk',
    downloadDir: path.join(__dirname, '..', 'mrep-downloads')
};

if (!fs.existsSync(MREP_CONFIG.downloadDir)) {
    fs.mkdirSync(MREP_CONFIG.downloadDir, { recursive: true });
}

/**
 * Parses a raw cookie string (from browser header) into Playwright cookie objects
 */
function parseCookieString(cookieString, domain) {
    if (!cookieString) return [];

    return cookieString.split(';').map(pair => {
        const [name, ...valueParts] = pair.trim().split('=');
        return {
            name: name.trim(),
            value: valueParts.join('=').trim(),
            domain: domain,
            path: '/',
            httpOnly: false,
            secure: true,
            sameSite: 'Lax'
        };
    }).filter(c => c.name && c.value);
}

async function runSync() {
    console.log('🚀 Starting MREP Automation Sync (COOKIE BYPASS MODE)...');

    const cookieString = process.env.MREP_COOKIE_STRING;

    if (!cookieString) {
        throw new Error("Missing MREP_COOKIE_STRING in .env file");
    }

    const browser = await chromium.launch({
        headless: false, // Keep visible for debugging
        slowMo: 100
    });

    const context = await browser.newContext({ acceptDownloads: true });

    // INJECT COOKIES 💉
    const cookies = parseCookieString(cookieString, MREP_CONFIG.domain);
    console.log(`🍪 Injecting ${cookies.length} cookies...`);
    await context.addCookies(cookies);

    const page = await context.newPage();

    try {
        console.log('📍 Navigating directly to report...');
        await page.goto(MREP_CONFIG.url, { waitUntil: 'load', timeout: 60000 });

        // CHECK: Did it work?
        const currentUrl = page.url();
        console.log(`🔗 Landed at: ${currentUrl}`);

        if (currentUrl.includes('Login')) {
            throw new Error("Cookie injection failed - Redirected to Login");
        }

        console.log('✅ Session active! Proceeding to filters...');

        // Step 3: Apply filters
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

        await browser.close();
        return { downloadPath, fileName, success: true };

    } catch (error) {
        console.error('❌ MREP Sync Error:', error.message);
        // Save state for debug
        try {
            await page.screenshot({ path: path.join(MREP_CONFIG.downloadDir, 'cookie-fail.png') });
        } catch (e) { }

        await browser.close();
        throw error;
    }
}

module.exports = { runSync };
