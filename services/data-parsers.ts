import * as XLSX from 'xlsx';
import { DepartmentMismatch, FinanceMismatchReport, ProductionReport, FinanceCategory, FinanceWeek } from '../types.ts';
import { MONTH_NAMES, SALES_TEAMS } from '../config.ts';

// --- HELPERS ---

export const cleanValue = (val: any): number => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const str = String(val).replace(/,/g, '').trim();
    if (str === '-' || str === '') return 0;
    if (str.startsWith('(') && str.endsWith(')')) {
        return -1 * parseFloat(str.replace(/[()]/g, ''));
    }
    return parseFloat(str) || 0;
};

export const calculateDailyPlans = (monthlyPlan: number, daysInMonth: number): number[] => {
    const basePlan = monthlyPlan / daysInMonth;
    const last7DaysPlan = basePlan * 1.05;
    const last7DaysTotal = last7DaysPlan * 7;
    const remainingDays = daysInMonth - 7;
    const remainingPlan = monthlyPlan - last7DaysTotal;
    const earlyDayPlan = remainingPlan / remainingDays;

    const plans: number[] = [];
    for (let i = 1; i <= daysInMonth; i++) {
        if (i > daysInMonth - 7) plans.push(last7DaysPlan);
        else plans.push(earlyDayPlan);
    }
    const totalPlanned = plans.reduce((a, b) => a + b, 0);
    const diff = monthlyPlan - totalPlanned;
    plans[plans.length - 1] += diff;
    return plans;
};

// --- PARSERS ---

export const parseProductionExcel = (rows: any[][], selectedMonth: number, selectedYear: number): ProductionReport => {
    let headerRow = -1;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const rowStr = rows[i].join('|').toLowerCase();
        if ((rowStr.includes('product') || rowStr.includes('plan')) && (rowStr.includes('achiev') || /\d{1,2}\/\d{1,2}\/\d{4}/.test(rowStr))) {
            headerRow = i; break;
        }
    }
    if (headerRow === -1) throw new Error('Missing Production headers');

    const headers = rows[headerRow];
    let monthlyPlanCol = headers.findIndex(h => String(h).toLowerCase().includes('plan') && (String(h).toLowerCase().includes('unit') || String(h).toLowerCase().includes('no.')));
    if (monthlyPlanCol === -1) monthlyPlanCol = 1;

    let firstDailyCol = -1;
    for (let c = monthlyPlanCol + 1; c < headers.length; c++) {
        const h = String(headers[c]).toLowerCase();
        if (h.includes('achiev') || /\d{1,2}\/\d{1,2}\/\d{4}/.test(h)) { firstDailyCol = c; break; }
    }
    if (firstDailyCol === -1) firstDailyCol = monthlyPlanCol + 1;

    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const particulars: any[] = [];

    for (let i = headerRow + 1; i < rows.length; i++) {
        const row = rows[i];
        const name = String(row[0] || '').trim();
        if (!name || name.toLowerCase().includes('total') || name.toLowerCase() === 'product category') continue;

        const monthlyPlan = cleanValue(row[monthlyPlanCol]);
        if (monthlyPlan === 0) continue;

        const dailyAchieved: number[] = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const col = firstDailyCol + (d - 1);
            dailyAchieved.push(col < row.length ? cleanValue(row[col]) : 0);
        }

        const totalAchieved = dailyAchieved.reduce((a, b) => a + b, 0);
        const dailyPlans = calculateDailyPlans(monthlyPlan, daysInMonth);
        const dailyData = dailyPlans.map((planned, idx) => ({
            day: idx + 1, planned, achieved: dailyAchieved[idx], variance: dailyAchieved[idx] - planned, percentage: planned > 0 ? (dailyAchieved[idx] / planned) * 100 : 0
        }));

        let lastDay = daysInMonth;
        for (let j = dailyAchieved.length - 1; j >= 0; j--) { if (dailyAchieved[j] > 0) { lastDay = j + 1; break; } }

        const mtdPlan = dailyPlans.slice(0, lastDay).reduce((a, b) => a + b, 0);
        const mtdAchieved = dailyAchieved.slice(0, lastDay).reduce((a, b) => a + b, 0);

        particulars.push({
            name, monthlyPlan, totalAchieved, dailyData, mtdPlan, mtdAchieved,
            mtdPercentage: mtdPlan > 0 ? (mtdAchieved / mtdPlan) * 100 : 0,
            remaining: monthlyPlan - totalAchieved
        });
    }

    return {
        month: `${MONTH_NAMES[selectedMonth]} ${selectedYear}`,
        monthKey: `${selectedYear}-${selectedMonth}`,
        particulars,
        totalMonthlyPlan: particulars.reduce((s, p) => s + p.monthlyPlan, 0),
        totalAchieved: particulars.reduce((s, p) => s + p.totalAchieved, 0),
        totalRemaining: particulars.reduce((s, p) => s + p.remaining, 0),
        overallPercentage: 0,
        reportDate: new Date().toISOString(),
        daysInMonth
    };
};

export const parseFinanceExcel = (rows: any[][], selectedMonth: number, selectedYear: number): FinanceMismatchReport => {
    let headerRowIdx = -1;
    let particularsColIdx = 0;

    for (let i = 0; i < Math.min(rows.length, 50); i++) {
        const rowStr = rows[i].join('|').toLowerCase();
        if (rowStr.includes('particulars')) {
            headerRowIdx = i;
            particularsColIdx = rows[i].findIndex(c => String(c).toLowerCase().trim() === 'particulars');
            break;
        }
    }
    if (headerRowIdx === -1) throw new Error("Missing Finance headers");

    const weekCols: any[] = [];
    const headers = rows[headerRowIdx].map(h => String(h).trim());
    for (let c = 0; c < headers.length; c++) {
        const h = headers[c];
        if (/\d+.*(?:TO|-).*\d+/i.test(h) || (/week/i.test(h) && !/total/i.test(h))) {
            if (c + 1 < headers.length) weekCols.push({ weekLabel: h, projectedIdx: c, actualIdx: c + 1 });
        }
    }

    const parseSection = (start: number, end: number, type: 'inflow' | 'outflow') => {
        const cats = [];
        for (let i = start; i < end; i++) {
            const row = rows[i];
            const name = String(row[particularsColIdx] || '').trim();
            if (!name || name.toLowerCase().includes('total') || name.toLowerCase() === 'inflow' || name.toLowerCase() === 'outflow') continue;

            const weeks = weekCols.map((wc, idx) => {
                const proj = cleanValue(row[wc.projectedIdx]);
                const act = cleanValue(row[wc.actualIdx]);
                return { weekLabel: wc.weekLabel, weekNumber: idx + 1, projected: proj, actual: act, variance: act - proj, percentage: proj > 0 ? (act / proj) * 100 : 0 };
            });
            cats.push({ name, type, weeks, totalProjected: weeks.reduce((s, w) => s + w.projected, 0), totalActual: weeks.reduce((s, w) => s + w.actual, 0), percentage: 0 });
        }
        return cats;
    };

    let inflowStart = rows.findIndex(r => String(r[particularsColIdx]).toLowerCase().trim() === 'inflow');
    let outflowStart = rows.findIndex(r => String(r[particularsColIdx]).toLowerCase().trim() === 'outflow');
    if (inflowStart === -1) inflowStart = headerRowIdx + 1;

    const inflowCats = parseSection(inflowStart, outflowStart !== -1 ? outflowStart : rows.length, 'inflow');
    const outflowCats = outflowStart !== -1 ? parseSection(outflowStart, rows.length, 'outflow') : [];

    return {
        month: `${MONTH_NAMES[selectedMonth]} ${selectedYear}`,
        monthKey: `${selectedYear}-${selectedMonth}`,
        openingBalance: { projected: 0, actual: 0 },
        closingBalance: { projected: 0, actual: 0, variance: 0 },
        inflow: { projected: 0, actual: 0, percentage: 0 },
        outflow: { projected: 0, actual: 0, percentage: 0 },
        netPosition: { projected: 0, actual: 0, variance: 0 },
        inflowCategories: inflowCats as any,
        outflowCategories: outflowCats as any,
        reportDate: new Date().toISOString()
    };
};

// Helper to get consistent FY label
const getFYLabel = (month: number, year: number): string => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    if (month >= 6) { // Jul - Dec
        return `FY ${pad(year % 100)}-${pad((year + 1) % 100)}`;
    } else { // Jan - Jun
        return `FY ${pad((year - 1) % 100)}-${pad(year % 100)}`;
    }
};

export const parseSalesExcel = (rows: any[][], selectedMonth: number, selectedYear: number, isMaster: boolean, isTerritory: boolean): DepartmentMismatch[] => {
    const allNewEntries: DepartmentMismatch[] = [];
    const fy = getFYLabel(selectedMonth, selectedYear);

    const headerRow = rows.find(r => r.some(c => {
        const low = String(c).toLowerCase();
        return low === 'teams' || low === 'brands' || low === 'all regions' || low === 'products' || low === 'target units';
    })) || rows[0];

    const teamIdx = headerRow.findIndex(c => String(c).toLowerCase() === 'teams' || String(c).toLowerCase() === 'team');
    const regionIdx = headerRow.findIndex(c => String(c).toLowerCase() === 'all regions');
    const productIdx = headerRow.findIndex(c => String(c).toLowerCase().includes('product'));
    const targetIdx = headerRow.findIndex(c => String(c).toLowerCase() === 'target units' || String(c).toLowerCase() === 'plan');

    const dateColumnMap: Record<number, number> = {};
    if (!isMaster) {
        headerRow.forEach((h, idx) => {
            const match = String(h).match(/^(\d{1,2})[-./]([A-Za-z]{3})[-./](\d{2})$/);
            if (match) {
                const mStr = match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase();
                if (MONTH_NAMES.indexOf(mStr) === selectedMonth) dateColumnMap[parseInt(match[1])] = idx;
            }
        });
    }

    const daysToProcess = isMaster ? [0] : Object.keys(dateColumnMap).map(Number);
    daysToProcess.forEach(day => {
        let currentTeam = "";
        const dataIdx = isMaster ? targetIdx : (dateColumnMap[day] ?? -1);
        if (dataIdx === -1) return;

        rows.forEach(row => {
            if (row === headerRow) return;
            const teamFound = SALES_TEAMS.find(t => String(row[teamIdx !== -1 ? teamIdx : 0]).toUpperCase() === t);
            if (teamFound) currentTeam = teamFound;
            if (!currentTeam) return;

            const metric = String(row[productIdx !== -1 ? productIdx : 0]).trim();
            const region = regionIdx !== -1 ? String(row[regionIdx]).trim() : currentTeam;
            if (!metric || metric.toLowerCase().includes('total') || region.toLowerCase().includes('total')) return;

            const val = cleanValue(row[dataIdx]);
            if (val !== 0 || isMaster) {
                allNewEntries.push({
                    department: 'Sales', team: currentTeam, metric, plan: isMaster ? val : 0, actual: isMaster ? 0 : val,
                    variance: isMaster ? -val : val, unit: 'Units', status: 'on-track',
                    reportDate: isMaster ? `MASTER_${MONTH_NAMES[selectedMonth]}_${selectedYear}` : `${MONTH_NAMES[selectedMonth]} ${day}, ${selectedYear}`,
                    fy: fy
                });
                if (region && region !== currentTeam) {
                    allNewEntries.push({
                        department: 'Territory Sales', team: region, metric, plan: isMaster ? val : 0, actual: isMaster ? 0 : val,
                        variance: isMaster ? -val : val, unit: 'Units', status: 'on-track',
                        reportDate: isMaster ? `MASTER_${MONTH_NAMES[selectedMonth]}_${selectedYear}` : `${MONTH_NAMES[selectedMonth]} ${day}, ${selectedYear}`,
                        fy: fy
                    });
                }
            }
        });
    });

    return allNewEntries;
};

