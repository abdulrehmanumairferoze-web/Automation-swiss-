const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

/**
 * MREP Portal Automation Sync
 * Logs into MREP portal, applies filters, drags "All Regions" to Sheets, and downloads Excel
 */

const MREP_CONFIG = {
    url: 'https://swiss.mrep.com.pk/Reports/DailySalesTrend',
    credentials: {
        company: 'COO',
        user: '2003',
        password: '2003'
    },
    downloadDir: path.join(__dirname, '..', 'mrep-downloads')
};

// Ensure download directory exists
if (!fs.existsSync(MREP_CONFIG.downloadDir)) {
    fs.mkdirSync(MREP_CONFIG.downloadDir, { recursive: true });
}

/**
 * Main sync function
 * @returns {Promise<{downloadPath: string, fileName: string}>}
 */
async function runSync() {
    console.log('🚀 Starting MREP Automation Sync...');

    const browser = await chromium.launch({
        headless: false, // Set to true for production
        slowMo: 100 // Slow down for debugging
    });

    const context = await browser.newContext({
        acceptDownloads: true
    });

    const page = await context.newPage();

    try {
        // Step 1: Navigate to MREP login page
        console.log('📍 Navigating to MREP portal...');
        await page.goto(MREP_CONFIG.url, { waitUntil: 'networkidle' });

        // Step 2: Login (adjust selectors based on actual MREP login form)
        // Step 2: Login
        console.log('🔐 Logging in (VERSION 2 - DEBUG MODE)...');

        try {
            // Wait for ANY input to appear first to verify page load
            await page.waitForSelector('input', { timeout: 10000 });

            // Fill in credentials - Company Code
            // We search broadly first to find what's actually there
            const companyInput = await page.locator('input[name*="Company"], input[id*="Company"], input[name="company"]').first();
            if (await companyInput.count() > 0) {
                console.log('✅ Found company input');
                await companyInput.fill(MREP_CONFIG.credentials.company);
            } else {
                console.log('❌ Company input not found by standard selectors');
                throw new Error("Company input missing");
            }

            // Fill in credentials - Territory/User Code
            const userInput = await page.locator('input[name*="Territory"], input[id*="Territory"], input[name="user"]').first();
            if (await userInput.count() > 0) {
                console.log('✅ Found user/territory input');
                await userInput.fill(MREP_CONFIG.credentials.user);
            } else {
                // Try fallback for "User" if Territory failed
                const altUserInput = await page.locator('input[name*="User"], input[id*="User"]').first();
                if (await altUserInput.count() > 0) {
                    await altUserInput.fill(MREP_CONFIG.credentials.user);
                } else {
                    console.error("❌ User/Territory input not found");
                }
            }

            const passwordInput = await page.locator('input[type="password"]').first();
            await passwordInput.fill(MREP_CONFIG.credentials.password);

            // Click login button
            const loginButton = await page.locator('button[type="submit"], input[type="submit"], button:has-text("Login")').first();
            await loginButton.click();
        } catch (loginError) {
            console.error('⚠️ Login selectors failed. Capturing debug info...');

            // Capture HTML for debugging
            const html = await page.content();
            const debugPath = path.join(MREP_CONFIG.downloadDir, 'debug-login.html');
            fs.writeFileSync(debugPath, html);
            console.log(`📄 Saved debug HTML to ${debugPath}`);

            // Capture Screenshot
            const screenshotPath = path.join(MREP_CONFIG.downloadDir, 'debug-screenshot.png');
            await page.screenshot({ path: screenshotPath });
            console.log(`📸 Saved debug screenshot to ${screenshotPath}`);

            throw new Error(`Login failed (Debug info saved): ${loginError.message}`);
        }

        const passwordInput = await page.locator('input[name="Password"], input[id="Password"], input[name="password"], input[type="password"]').first();
        await passwordInput.fill(MREP_CONFIG.credentials.password);

        // Click login button
        const loginButton = await page.locator('button[type="submit"], input[type="submit"], button:has-text("Login"), input[value="Login"]').first();
        await loginButton.click();

        // Wait for navigation after login
        await page.waitForLoadState('networkidle');
        console.log('✅ Login successful');

        // Step 3: Apply filters
        console.log('🔧 Applying filters...');

        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.toLocaleString('en-US', { month: 'long' });

        // Select current year
        const yearSelect = await page.locator('select[name*="year"], select[id*="year"], select:has-text("Year")').first();
        await yearSelect.selectOption({ label: currentYear.toString() });

        // Select current month
        const monthSelect = await page.locator('select[name*="month"], select[id*="month"], select:has-text("Month")').first();
        await monthSelect.selectOption({ label: currentMonth });

        // Select Type = Units
        const typeSelect = await page.locator('select[name*="type"], select[id*="type"], select:has-text("Type")').first();
        await typeSelect.selectOption({ label: 'Units' });

        // Click Filter button
        const filterButton = await page.locator('button:has-text("Filter"), input[value="Filter"]').first();
        await filterButton.click();

        await page.waitForLoadState('networkidle');
        console.log('✅ Filters applied');

        // Step 4: Drag "All Regions" to Sheets
        console.log('🎯 Dragging "All Regions" to Sheets...');

        // Locate the "All Regions" card/element
        const allRegionsCard = await page.locator('text="All Regions"').first();

        // Locate the Sheets drop zone (adjust selector based on actual page structure)
        const sheetsDropZone = await page.locator('[class*="sheets"], [id*="sheets"], text="Sheets"').first();

        try {
            // Primary approach: Standard dragTo
            await allRegionsCard.dragTo(sheetsDropZone);
            console.log('✅ Drag-and-drop successful (standard method)');
        } catch (dragError) {
            console.log('⚠️ Standard drag failed, trying manual mouse coordinates...');

            // Fallback: Manual mouse coordinates
            const sourceBox = await allRegionsCard.boundingBox();
            const targetBox = await sheetsDropZone.boundingBox();

            if (sourceBox && targetBox) {
                await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
                await page.mouse.down();
                await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
                await page.mouse.up();
                console.log('✅ Drag-and-drop successful (manual method)');
            } else {
                throw new Error('Could not get bounding boxes for drag-and-drop');
            }
        }

        // Wait for any processing after drag
        await page.waitForTimeout(2000);

        // Step 5: Capture download
        console.log('📥 Waiting for download...');

        const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

        // Trigger download (might be automatic or require clicking an export button)
        // Adjust this based on actual MREP behavior
        try {
            const exportButton = await page.locator('button:has-text("Export"), button:has-text("Download"), a:has-text("Excel")').first();
            await exportButton.click();
        } catch (e) {
            console.log('⚠️ No explicit export button found, download might be automatic');
        }

        const download = await downloadPromise;
        const fileName = `mrep-sync-${Date.now()}.xlsx`;
        const downloadPath = path.join(MREP_CONFIG.downloadDir, fileName);

        await download.saveAs(downloadPath);
        console.log(`✅ Download saved: ${downloadPath}`);

        await browser.close();

        return {
            downloadPath,
            fileName,
            success: true
        };

    } catch (error) {
        console.error('❌ MREP Sync Error:', error.message);
        await browser.close();
        throw error;
    }
}

/**
 * Test mode for debugging
 */
async function testLogin() {
    console.log('🧪 Testing MREP Login...');
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    await page.goto(MREP_CONFIG.url);
    await page.waitForTimeout(5000);

    console.log('✅ Page loaded. Check browser window.');
    await page.waitForTimeout(10000);
    await browser.close();
}

// CLI support
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.includes('--test-login')) {
        testLogin().catch(console.error);
    } else {
        runSync()
            .then(result => {
                console.log('✅ MREP Sync Complete:', result);
                process.exit(0);
            })
            .catch(err => {
                console.error('❌ MREP Sync Failed:', err);
                process.exit(1);
            });
    }
}

module.exports = { runSync, testLogin };
