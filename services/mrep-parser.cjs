const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

/**
 * MREP Excel Parser
 * Parses downloaded MREP Excel file and maps to operation_data schema
 */

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Parse MREP Excel file
 * @param {string} filePath - Path to downloaded Excel file
 * @returns {Promise<Array>} - Array of operation_data records
 */
async function parseFile(filePath) {
    console.log(`📊 Parsing MREP file: ${filePath}`);

    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON with header row
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (rows.length === 0) return [];

    console.log(`📋 Found ${rows.length} rows in Excel`);

    // Detect file type and relevant columns
    const headers = Object.keys(rows[0]);
    const isMasterFormat = headers.some(h => h.includes('Target Units') || h.includes('PM SaleUnits'));
    const dateColumns = detectDateColumns(rows);

    console.log(`🔍 Format Detected: ${isMasterFormat ? 'MASTER/TARGET' : 'DAILY SALES TREND'}`);

    const parsedData = [];

    for (const row of rows) {
        // Updated logic to support Merged format (Team/All Regions/Product_Name)
        const teamHeader = String(row['Team'] || row['Teams'] || '').trim();
        const regionHeader = String(row['All Regions'] || row['ALL REGIONS'] || row['ALL_REGIONS'] || row['ZONE'] || '').trim();
        const productName = String(row['Product_Name'] || row['Product Name'] || row['Products'] || row['PRODUCTS'] || row['PRODUCT_NAME'] || '').trim();

        // Effective Zone: Prioritize Region name (Territory) over Sales Force name
        const zone = regionHeader || teamHeader;

        // Skip rows without zone/team or product
        if (!zone || !productName) continue;

        // EXCLUSION LOGIC: Ignore summary/total rows
        const lowerZone = zone.toLowerCase();
        const lowerProduct = productName.toLowerCase();

        const isTotalRow = lowerZone.includes('total') ||
            lowerProduct.includes('total') ||
            lowerProduct === 'all' ||
            lowerProduct === 'product_name'; // Skip header repeats if any

        if (isTotalRow) continue;

        if (isMasterFormat) {
            // --- HANDLE MASTER/TARGET FORMAT ---
            const targetUnits = parseFloat(String(row['Target Units'] || row['Units'] || '0').replace(/,/g, ''));
            const monthStr = String(row['MONTH'] || row['Month'] || '').trim();
            const reportDate = getFirstOfMonth(monthStr);

            // 1. Map to Main Sales Dashboard (Team level)
            if (teamHeader) {
                parsedData.push({
                    department: 'Sales',
                    team: teamHeader,
                    metric: productName,
                    plan: targetUnits,
                    actual: 0,
                    variance: -targetUnits,
                    unit: 'Units',
                    status: 'on-track',
                    reasoning: 'MREP Master Sync',
                    reportDate: reportDate
                });
            }

            // 2. Map to Territory Sales Dashboard (Territory level)
            if (regionHeader && regionHeader !== teamHeader) {
                parsedData.push({
                    department: 'Territory Sales',
                    team: regionHeader,
                    metric: productName,
                    plan: targetUnits,
                    actual: 0,
                    variance: -targetUnits,
                    unit: 'Units',
                    status: 'on-track',
                    reasoning: 'MREP Master Sync',
                    reportDate: reportDate
                });
            }

        } else if (dateColumns.length > 0) {
            // --- HANDLE DAILY SALES TREND ---
            for (const dateCol of dateColumns) {
                const valRaw = String(row[dateCol.columnName] || '0').replace(/,/g, '');
                const actualValue = parseFloat(valRaw);
                if (actualValue === 0) continue;

                // 1. Map to Main Sales Dashboard
                if (teamHeader) {
                    parsedData.push({
                        department: 'Sales',
                        team: teamHeader,
                        metric: productName,
                        plan: 0,
                        actual: actualValue,
                        variance: actualValue,
                        unit: 'Units',
                        status: 'on-track',
                        reasoning: 'MREP Daily Sync',
                        reportDate: dateCol.formattedDate
                    });
                }

                // 2. Map to Territory Sales Dashboard
                if (regionHeader && regionHeader !== teamHeader) {
                    parsedData.push({
                        department: 'Territory Sales',
                        team: regionHeader,
                        metric: productName,
                        plan: 0,
                        actual: actualValue,
                        variance: actualValue,
                        unit: 'Units',
                        status: 'on-track',
                        reasoning: 'MREP Daily Sync',
                        reportDate: dateCol.formattedDate
                    });
                }
            }
        }
    }

    console.log(`✅ Parsed ${parsedData.length} records from MREP data`);
    return parsedData;
}

/**
 * Helper to get the Master Month identifier
 * Returns "MASTER_January_2026" pattern used by Dashboard for plans
 */
function getFirstOfMonth(monthName) {
    const currentYear = new Date().getFullYear();
    const month = monthName || MONTH_NAMES[new Date().getMonth()];
    // Align with Dashboard.tsx pattern: MASTER_Month_Year
    return `MASTER_${month}_${currentYear}`;
}

/**
 * Detect date columns in the Excel data
 * Looks for columns like "27-Jan-26", "28-Jan-26", etc.
 * @param {Array} rows - Excel rows
 * @returns {Array} - Array of {columnName, formattedDate, day, month, year}
 */
function detectDateColumns(rows) {
    if (rows.length === 0) return [];

    const firstRow = rows[0];
    const dateColumns = [];

    // Date pattern: "27-Jan-26" or "27.Jan.26" or "27/Jan/26"
    const datePattern = /^(\d{1,2})[-./]([A-Za-z]{3})[-./](\d{2})$/;

    for (const key of Object.keys(firstRow)) {
        const match = key.match(datePattern);

        if (match) {
            const day = parseInt(match[1]);
            const monthAbbr = match[2];
            const year = 2000 + parseInt(match[3]); // Convert "26" to 2026

            // Convert month abbreviation to month number
            const monthMap = {
                'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
            };

            const monthIndex = monthMap[monthAbbr];

            if (monthIndex !== undefined) {
                const formattedDate = `${MONTH_NAMES[monthIndex]} ${day < 10 ? '0' + day : day}, ${year}`;

                dateColumns.push({
                    columnName: key,
                    formattedDate,
                    day,
                    month: monthIndex,
                    year
                });
            }
        }
    }

    // Sort by date
    dateColumns.sort((a, b) => {
        const dateA = new Date(a.year, a.month, a.day);
        const dateB = new Date(b.year, b.month, b.day);
        return dateA - dateB;
    });

    return dateColumns;
}

/**
 * Test parser with a sample file
 */
async function testParser(filePath) {
    console.log('🧪 Testing MREP Parser...');

    try {
        const data = await parseFile(filePath);
        console.log(`✅ Successfully parsed ${data.length} records`);

        // Show first 5 records
        console.log('\n📋 First 5 records:');
        data.slice(0, 5).forEach((record, i) => {
            console.log(`\n${i + 1}. ${record.team} - ${record.metric}`);
            console.log(`   Date: ${record.reportDate}, Actual: ${record.actual}`);
        });

    } catch (error) {
        console.error('❌ Parser test failed:', error.message);
    }
}

// CLI support
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.includes('--test-file') && args[1]) {
        testParser(args[1]).catch(console.error);
    } else {
        console.log('Usage: node mrep-parser.cjs --test-file <path-to-excel>');
    }
}

module.exports = { parseFile, detectDateColumns };
