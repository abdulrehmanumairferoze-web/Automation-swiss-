/**
 * =========================================================================================
 * MREP TARGET VS ACHIEVEMENT AUTOMATION SCRIPT
 * =========================================================================================
 * 
 * This script automates the extraction of "Target Vs Achievement" reports from the MREP portal.
 * 
 * -- RUNNING --
 *    node mrep_target_achievement.cjs
 * 
 * =========================================================================================
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Load environment variables if .env.automation exists, but don't fail if it doesn't (we use secrets in CI)
const envAutoPath = path.join(process.cwd(), '.env.automation');
if (fs.existsSync(envAutoPath)) {
    require('dotenv').config({ path: envAutoPath });
} else {
    require('dotenv').config();
}


// -- CONFIGURATION --
const CONFIG = {
    // Login at a known working URL
    loginUrl: 'https://swiss.mrep.com.pk/Reports/DailySalesTrend',
    // The target report URL to navigate to AFTER login
    reportUrl: 'https://swiss.mrep.com.pk/Reports/TerritoryWiseSaleV5',
    credentials: {
        company: process.env.MREP_COMPANY,
        user: process.env.MREP_USERNAME,
        password: process.env.MREP_PASSWORD
    },
    downloadDir: path.join(process.cwd(), 'downloads'),
    headless: true,
    retryAttempts: 3
};

// Fail immediately if secrets are missing
if (!CONFIG.credentials.company || !CONFIG.credentials.user || !CONFIG.credentials.password) {
    console.error('CRITICAL ERROR: Missing required environment variables (MREP_COMPANY, MREP_USERNAME, MREP_PASSWORD)');
    process.exit(1);
}


// Ensure directories exist
if (!fs.existsSync(CONFIG.downloadDir)) fs.mkdirSync(CONFIG.downloadDir, { recursive: true });

// -- LOGGING --
// -- LOGGING --
const logStream = fs.createWriteStream(path.join(process.cwd(), 'mrep_target_achievement.log'), { flags: 'a' });
function logger(msg, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const line = `${timestamp} [${level}] ${msg}\n`;
    console.log(line.trim());
    logStream.write(line);
}

// -- AUTOMATION --
async function login(page) {
    logger(`Starting login process at ${CONFIG.loginUrl}...`);
    try {
        await page.goto(CONFIG.loginUrl, { waitUntil: 'networkidle', timeout: 60000 });
    } catch (e) {
        logger(`Initial navigation failed, retrying once: ${e.message}`, 'WARN');
        await page.goto(CONFIG.loginUrl, { waitUntil: 'load', timeout: 60000 });
    }

    logger('Waiting for login fields...');
    await page.getByPlaceholder('Territory Code').waitFor({ state: 'visible', timeout: 30000 });
    await page.getByPlaceholder('Territory Code').fill(CONFIG.credentials.company);
    await page.waitForTimeout(800);
    await page.getByPlaceholder('Username').fill(CONFIG.credentials.user);
    await page.waitForTimeout(800);
    await page.getByPlaceholder('Password').fill(CONFIG.credentials.password);
    await page.waitForTimeout(800);

    logger('Submitting login form...');
    await page.locator('input[value="Sign in"], button:has-text("Sign in"), .btn:has-text("Sign in")').first().click();

    // Stabilization delay before check
    await page.waitForTimeout(3000);

    // Check for portal exceptions
    const pageText = await page.innerText('body');
    if (pageText.includes('Some exception has been occured')) {
        const exceptionFile = path.join(process.cwd(), 'debug_portal_exception.png');
        await page.screenshot({ path: exceptionFile });
        logger(`Portal exception detected. Screenshot saved to ${exceptionFile}. Retrying after cooldown...`, 'ERROR');
        await page.waitForTimeout(60000); // 60s cooldown for server-side exceptions
        throw new Error('MREP Portal Exception occurred during login');
    }

    // Wait for URL change OR a logged-in element (like the sidebar or logout button)
    try {
        await page.waitForURL(url => !url.href.includes('Login'), { timeout: 30000 });
        logger('Redirected successfully.');
    } catch (e) {
        logger('URL did not change after login, checking for error messages...', 'WARN');
        const error = await page.locator('.text-danger, .alert-danger, .validation-summary-errors').first().textContent().catch(() => null);
        if (error) throw new Error(`Login failed with error: ${error.trim()}`);
    }

    await page.waitForLoadState('networkidle', { timeout: 45000 });
    logger(`Navigating to Target vs Achievement report page: ${CONFIG.reportUrl}...`);
    await page.goto(CONFIG.reportUrl, { waitUntil: 'networkidle', timeout: 60000 });

    // Verify we are actually on the report page and not redirected back to Login
    if (page.url().includes('Login')) {
        logger('Redirected back to Login page. Session might be invalid or portal is unstable.', 'ERROR');
        throw new Error('Session lost: redirected back to Login');
    }

    await page.waitForTimeout(5000);
}

async function downloadReport(page) {
    try {
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000);
        logger('Page stable. Starting report generation...');

        // Helper to click dropdowns safely
        async function openDropdownAndSelect(name, placeholderRegex, valueText, isList = true) {
            logger(`Selecting ${name}...`);
            let clicked = false;

            // Strategy 1: Find by Placeholder
            const byPlaceholder = page.locator('.dx-texteditor-container').filter({ has: page.locator(`[data-dx_placeholder]`).filter({ hasText: placeholderRegex }) }).locator('.dx-dropdowneditor-button').first();

            // Strategy 2: Find by Value (if already selected)
            const byValue = page.locator('.dx-texteditor-container').filter({ has: page.locator('input').filter({ hasText: valueText }) }).locator('.dx-dropdowneditor-button').first();

            if (await byPlaceholder.count() > 0 && await byPlaceholder.isVisible()) {
                await byPlaceholder.click({ force: true });
                clicked = true;
                logger(`Clicked ${name} dropdown (by placeholder)`);
            } else if (await byValue.count() > 0 && await byValue.isVisible()) {
                await byValue.click({ force: true });
                clicked = true;
                logger(`Clicked ${name} dropdown (by value)`);
            } else {
                // Fallback: try finding generic index if name implies order
                if (name === 'Year') await page.locator('.dx-dropdowneditor-button').nth(0).click({ force: true });
                else if (name === 'Month') await page.locator('.dx-dropdowneditor-button').nth(1).click({ force: true });
                else if (name === 'Team') await page.locator('.dx-dropdowneditor-button').nth(2).click({ force: true });
                clicked = true;
                logger(`Clicked ${name} dropdown (by index fallback)`);
            }

            if (clicked) {
                await page.waitForTimeout(1000);

                if (isList) {
                    // Standard List (e.g., Year)
                    const item = page.locator('.dx-item-content.dx-list-item-content').filter({ hasText: valueText }).last();
                    if (await item.isVisible()) {
                        await item.click({ force: true });
                        logger(`Selected ${name}: ${valueText}`);
                    } else {
                        // Overlay fallback
                        const overlayItem = page.locator('.dx-overlay-content .dx-item-content').filter({ hasText: valueText }).last();
                        if (await overlayItem.isVisible()) {
                            await overlayItem.click({ force: true });
                            logger(`Selected ${name}: ${valueText} (overlay fallback)`);
                        } else {
                            logger(`Could not find item "${valueText}" in ${name} list`, 'WARN');
                        }
                    }
                } else {
                    // DataGrid with Checkboxes (e.g., Month, Team)
                    // The user provided structure shows tr.dx-data-row containing the text
                    const row = page.locator('.dx-overlay-content tr.dx-data-row').filter({ hasText: valueText }).first();

                    if (await row.isVisible()) {
                        // Click the checkbox inside the row if present, or the row itself
                        const checkbox = row.locator('.dx-checkbox').first();
                        if (await checkbox.isVisible()) {
                            // MREP often acts as a toggle. If we want multiselection, we click it.
                            await checkbox.click({ force: true });
                            logger(`Selected ${name}: ${valueText} (via checkbox)`);
                        } else {
                            await row.click({ force: true });
                            logger(`Selected ${name}: ${valueText} (via row click)`);
                        }
                    } else {
                        logger(`Could not find row "${valueText}" in ${name} grid`, 'WARN');
                    }
                }

                // Close dropdown just in case
                await page.keyboard.press('Escape');
                await page.waitForTimeout(1000);
            }
        }

        const currentYear = new Date().getFullYear().toString();
        const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });

        // 1. YEAR (List)
        await openDropdownAndSelect('Year', /Year/i, currentYear, true);

        // 2. MONTH (Grid)
        await openDropdownAndSelect('Month', /Month/i, currentMonth, false);

        // 3. TEAM 
        // Logic: Try to Select All via header checkbox in the Team Grid
        logger('Selecting Team...');
        const teamBtn = page.locator('.dx-dropdowneditor-button').nth(2); // Assuming 3rd position for Team
        await teamBtn.click({ force: true });
        await page.waitForTimeout(1500);

        // Try to click "Select All" in the header row of the grid
        const selectAllHeader = page.locator('.dx-overlay-content .dx-header-row .dx-checkbox').first();
        if (await selectAllHeader.isVisible()) {
            await selectAllHeader.click({ force: true });
            logger('Clicked "Select All" in Team dropdown header');
        } else {
            logger('"Select All" header checkbox not found in Team dropdown', 'WARN');
            // Fallback: try the first data row checkbox if header fails
            const firstRowCheckbox = page.locator('.dx-overlay-content tr.dx-data-row .dx-checkbox').first();
            if (await firstRowCheckbox.isVisible()) {
                await firstRowCheckbox.click({ force: true });
                logger('Clicked first checkbox in Team dropdown as fallback');
            }
        }
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);

        // 4. FILTER
        logger('Clicking Search/Filter button...');
        // User HTML: <div class="dx-button-content"><span class="dx-button-text">Filter</span></div>
        const filterBtn = page.locator('.dx-button-content').filter({ hasText: 'Filter' }).first();
        if (await filterBtn.isVisible()) {
            await filterBtn.click();
        } else {
            // Fallback
            await page.getByText('Filter').click();
        }

        // Wait for results
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(15000);
        logger('Filter executed.');

        // Manual Drag Helper Function
        async function manualDrag(sourceLocator, targetLocator, label) {
            try {
                // Ensure we get exactly one element
                const source = sourceLocator.first();
                const target = targetLocator.first();

                // Wait for source to be visible
                try {
                    await source.waitFor({ state: 'visible', timeout: 5000 });
                } catch (e) {
                    logger(`${label} source not visible within timeout.`, 'WARN');
                    return false;
                }

                const sourceBox = await source.boundingBox();
                const targetBox = await target.boundingBox(); // Target is usually visible

                if (sourceBox && targetBox) {
                    logger(`Performing manual drag for ${label}...`);

                    // 1. Move to source center
                    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
                    await page.waitForTimeout(200);

                    // 2. Mouse Down
                    await page.mouse.down();
                    await page.waitForTimeout(500); // Wait for drag class to activate

                    // 3. Move slightly to trigger drag start
                    await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 15, sourceBox.y + sourceBox.height / 2 + 15);
                    await page.waitForTimeout(200);

                    // 4. Move to target center with steps to simulate human movement
                    // Drag to center of grid (drop zone)
                    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 20 });
                    await page.waitForTimeout(500);

                    // 5. Mouse Up
                    await page.mouse.up();
                    logger(`${label} manual drag completed.`);
                    await page.waitForTimeout(3000); // Wait for grid to update/render
                    return true;
                } else {
                    logger(`${label} bounding box issue (Source: ${!!sourceBox}, Target: ${!!targetBox})`, 'WARN');
                }
            } catch (e) {
                logger(`${label} manual drag error: ${e.message}`, 'ERROR');
            }
            return false;
        }

        const targetGrid = page.locator('.wdr-grid-layout').first();

        // 5. DRAG AND DROP 'All Zones' 
        logger('Dragging "All Zones" into report...');
        // Selector logic: Look for .wdr-draggable with text 'All Zones'. 
        // We use a looser text match because the innerHTML might have spans.
        let allZonesField = page.locator('.wdr-draggable').filter({ hasText: 'All Zones' });
        // Fallback to data-h if available
        if (await allZonesField.count() === 0) {
            allZonesField = page.locator('.wdr-draggable[data-h="3"]');
        }
        await manualDrag(allZonesField, targetGrid, 'All Zones');

        // 6. DRAG AND DROP 'All Regions'
        logger('Dragging "All Regions" into report...');
        let allRegionsField = page.locator('.wdr-draggable').filter({ hasText: 'All Regions' });
        if (await allRegionsField.count() === 0) {
            allRegionsField = page.locator('.wdr-draggable[data-h="4"]');
        }
        await manualDrag(allRegionsField, targetGrid, 'All Regions');

        // 7. EXPORT (Targeting specific SVG structure)
        logger('Attempting to click Export button...');
        // User HTML has <title>menu_export</title> inside an SVG
        const exportBtn = page.locator('.wdr-svg-icon').filter({ has: page.locator('svg title', { hasText: 'menu_export' }) }).first();

        if (await exportBtn.isVisible()) {
            const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
            await exportBtn.click({ force: true });
            await page.waitForTimeout(2000);

            const excelOption = page.locator('li, div, span, .wdr-item-label').filter({ hasText: /Excel|xlsx/i }).first();
            if (await excelOption.isVisible()) {
                await excelOption.click();
            }

            const download = await downloadPromise;
            if (download) {
                const filePath = path.join(CONFIG.downloadDir, download.suggestedFilename());
                await download.saveAs(filePath);
                logger(`Download success: ${filePath}`);
                return filePath;
            }
        }

        throw new Error('Export failed: Export button or Excel option not found');

    } catch (error) {
        logger(`FAILED at Report Generation: ${error.message}`, 'ERROR');
        await page.screenshot({ path: path.join(process.cwd(), 'debug_target_ach_fail.png') });
        throw error;
    }
}

async function main() {
    logger('=== MREP Target vs Achievement Automation Started ===');

    for (let attempt = 1; attempt <= CONFIG.retryAttempts; attempt++) {
        const browser = await chromium.launch({ headless: CONFIG.headless });
        try {
            const context = await browser.newContext({ acceptDownloads: true });
            const page = await context.newPage();
            await login(page);

            // Capture post-login/navigation screenshot
            const postLoginScreenshot = path.join(process.cwd(), 'debug_post_login.png');
            await page.screenshot({ path: postLoginScreenshot, fullPage: true });
            logger(`Progress: Post-login screenshot saved to ${postLoginScreenshot}`);

            const filePath = await downloadReport(page);

            // VALIDATION BEFORE EXIT
            if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
                logger(`Success! File downloaded and validated: ${filePath}`);
                // Capture success screenshot
                const successScreenshot = path.join(process.cwd(), 'debug_success_download.png');
                await page.screenshot({ path: successScreenshot, fullPage: true });
                logger(`Success screenshot saved to ${successScreenshot}`);
                await browser.close();
                logger('=== MREP Automation Success ===');
                process.exit(0);
            } else {
                throw new Error('PDF validation failed: File missing or empty.');
            }
        } catch (error) {
            logger(`Attempt ${attempt} failed: ${error.message}`, 'ERROR');
            await browser.close();
            if (attempt < CONFIG.retryAttempts) {
                logger('Retrying in 10 seconds...');
                await new Promise(r => setTimeout(r, 10000));
            } else {
                logger('All retry attempts exhausted.', 'ERROR');
                process.exit(1);
            }
        }
    }
}

main().catch(err => {
    logger('Fatal error: ' + err.message, 'ERROR');
    process.exit(1);
});
