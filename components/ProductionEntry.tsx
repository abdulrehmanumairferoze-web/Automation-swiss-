
import React, { useState } from 'react';
import { ProductionReport } from '../types.ts';
import * as XLSX from 'xlsx';

interface ProductionEntryProps {
    currentData: ProductionReport[];
    onDataUpdate: (data: ProductionReport[]) => void;
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const ProductionEntry: React.FC<ProductionEntryProps> = ({ currentData, onDataUpdate }) => {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const handleMonthChange = (offset: number) => {
        const newDate = new Date(selectedYear, selectedMonth + offset, 1);
        setSelectedMonth(newDate.getMonth());
        setSelectedYear(newDate.getFullYear());
        setUploadError(null);
    };

    const calculateDailyPlans = (monthlyPlan: number, daysInMonth: number): number[] => {
        const basePlan = monthlyPlan / daysInMonth;
        const last7DaysPlan = basePlan * 1.05;
        const last7DaysTotal = last7DaysPlan * 7;

        const remainingDays = daysInMonth - 7;
        const remainingPlan = monthlyPlan - last7DaysTotal;
        const earlyDayPlan = remainingPlan / remainingDays;

        const plans: number[] = [];
        for (let i = 1; i <= daysInMonth; i++) {
            if (i > daysInMonth - 7) {
                plans.push(last7DaysPlan);
            } else {
                plans.push(earlyDayPlan);
            }
        }

        // Adjust last day for rounding to ensure SUM(daily plan) = monthly plan
        const totalPlanned = plans.reduce((a, b) => a + b, 0);
        const diff = monthlyPlan - totalPlanned;
        plans[plans.length - 1] += diff;

        return plans;
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setUploadError(null);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = evt.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

                console.log('📊 Production Excel Upload - Rows:', rows.length);

                // Find header row (contains "Product" or "Plan" and date/achievement patterns)
                let headerRow = -1;
                for (let i = 0; i < Math.min(rows.length, 10); i++) {
                    const row = rows[i];
                    const rowStr = row.join('|').toLowerCase();
                    // Look for "product" or "plan" AND either "achievement" or date patterns
                    if ((rowStr.includes('product') || rowStr.includes('plan')) &&
                        (rowStr.includes('achiev') || /\d{1,2}\/\d{1,2}\/\d{4}/.test(rowStr))) {
                        headerRow = i;
                        break;
                    }
                }

                if (headerRow === -1) {
                    throw new Error('Could not find header row. Expected columns: Product Category, Plan No.of Units, and date columns with Achievement');
                }

                console.log(`✅ Header row found at index ${headerRow}`);
                const headers = rows[headerRow];

                console.log('📋 Headers:', headers);

                // Find the monthly plan column (contains "plan" and "units" or just "plan")
                let monthlyPlanCol = -1;
                for (let c = 0; c < headers.length; c++) {
                    const header = String(headers[c] || '').toLowerCase();
                    if (header.includes('plan') && (header.includes('unit') || header.includes('no.'))) {
                        monthlyPlanCol = c;
                        break;
                    }
                }

                // Fallback: if not found, assume column 1
                if (monthlyPlanCol === -1) {
                    monthlyPlanCol = 1;
                    console.log('⚠️ Using default column 1 for monthly plan');
                }

                console.log(`📊 Monthly Plan Column: ${monthlyPlanCol} (${headers[monthlyPlanCol]})`);

                // Find first daily achievement column (after plan column, contains date or "achiev")
                let firstDailyCol = -1;
                for (let c = monthlyPlanCol + 1; c < headers.length; c++) {
                    const header = String(headers[c] || '').toLowerCase();
                    // Check if it's a date pattern or contains "achiev"
                    if (header.includes('achiev') || /\d{1,2}\/\d{1,2}\/\d{4}/.test(header)) {
                        firstDailyCol = c;
                        break;
                    }
                }

                if (firstDailyCol === -1) {
                    // Fallback: assume column after plan column
                    firstDailyCol = monthlyPlanCol + 1;
                    console.log('⚠️ Using default column after plan for daily data');
                }

                console.log(`📅 First Daily Column: ${firstDailyCol} (${headers[firstDailyCol]})`);

                // Count how many daily columns exist (from first daily col to end, excluding empty or total)
                let dailyColCount = 0;
                for (let c = firstDailyCol; c < headers.length; c++) {
                    const header = String(headers[c] || '').trim().toLowerCase();
                    // Skip if empty or contains "total"
                    if (!header || header.includes('total')) {
                        break;
                    }
                    dailyColCount++;
                }

                console.log(`📅 Found ${dailyColCount} daily achievement columns`);

                // Find Remarks column
                let remarksCol = -1;
                for (let c = 0; c < headers.length; c++) {
                    const header = String(headers[c] || '').toLowerCase();
                    if (header.includes('remark') || header.includes('comment')) {
                        remarksCol = c;
                        break;
                    }
                }
                console.log(`📝 Remarks Column: ${remarksCol !== -1 ? remarksCol : 'Not Found'}`);

                const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

                if (dailyColCount > daysInMonth) {
                    console.warn(`⚠️ More columns (${dailyColCount}) than days in month (${daysInMonth}). Will use first ${daysInMonth} columns.`);
                }

                const particulars: any[] = [];

                // Parse data rows (skip header and total rows)
                for (let i = headerRow + 1; i < rows.length; i++) {
                    const row = rows[i];
                    const particularName = String(row[0] || '').trim();

                    // Skip empty rows and total rows
                    if (!particularName ||
                        particularName.toLowerCase().includes('total') ||
                        particularName.toLowerCase() === 'product category') {
                        continue;
                    }

                    const monthlyPlan = parseFloat(String(row[monthlyPlanCol] || '0').replace(/,/g, '')) || 0;

                    if (monthlyPlan === 0) {
                        console.log(`⏭️ Skipping ${particularName} - zero monthly plan`);
                        continue;
                    }

                    // Extract daily achieved values
                    const dailyAchieved: number[] = [];
                    for (let day = 1; day <= daysInMonth; day++) {
                        const colIndex = firstDailyCol + (day - 1);
                        if (colIndex < row.length) {
                            const val = parseFloat(String(row[colIndex] || '0').replace(/,/g, '')) || 0;
                            dailyAchieved.push(val);
                        } else {
                            dailyAchieved.push(0);
                        }
                    }

                    const totalAchieved = dailyAchieved.reduce((sum, val) => sum + val, 0);
                    const dailyPlans = calculateDailyPlans(monthlyPlan, daysInMonth);

                    // Create daily data array
                    const dailyData = dailyPlans.map((planned, idx) => {
                        const achieved = dailyAchieved[idx] || 0;
                        const variance = achieved - planned;
                        const percentage = planned > 0 ? (achieved / planned) * 100 : 0;

                        return {
                            day: idx + 1,
                            planned,
                            achieved,
                            variance,
                            percentage
                        };
                    });

                    // Calculate MTD (assuming today is the last day with data)
                    let lastDayWithData = daysInMonth;
                    for (let i = dailyAchieved.length - 1; i >= 0; i--) {
                        if (dailyAchieved[i] > 0) {
                            lastDayWithData = i + 1;
                            break;
                        }
                    }
                    const mtdPlan = dailyPlans.slice(0, lastDayWithData).reduce((sum, val) => sum + val, 0);
                    const mtdAchieved = dailyAchieved.slice(0, lastDayWithData).reduce((sum, val) => sum + val, 0);
                    const mtdPercentage = mtdPlan > 0 ? (mtdAchieved / mtdPlan) * 100 : 0;

                    // Extract Remarks if column exists
                    const remarks = remarksCol !== -1 ? String(row[remarksCol] || '').trim() : undefined;

                    particulars.push({
                        name: particularName,
                        monthlyPlan,
                        totalAchieved,
                        dailyData,
                        mtdPlan,
                        mtdAchieved,
                        mtdPercentage,
                        remaining: monthlyPlan - totalAchieved,
                        remarks
                    });

                    console.log(`✓ ${particularName}: Plan=${monthlyPlan}, Achieved=${totalAchieved}, MTD%=${mtdPercentage.toFixed(1)}%`);
                }

                if (particulars.length === 0) {
                    throw new Error('No valid production data found in Excel file');
                }

                // Create production report
                const monthKey = `${selectedYear}-${selectedMonth}`;
                const productionReport: ProductionReport = {
                    month: `${MONTH_NAMES[selectedMonth]} ${selectedYear}`,
                    monthKey,
                    particulars,
                    totalMonthlyPlan: particulars.reduce((sum, p) => sum + p.monthlyPlan, 0),
                    totalAchieved: particulars.reduce((sum, p) => sum + p.totalAchieved, 0),
                    totalRemaining: particulars.reduce((sum, p) => sum + p.remaining, 0),
                    overallPercentage: 0,
                    reportDate: new Date().toISOString(),
                    daysInMonth
                };

                productionReport.overallPercentage = productionReport.totalMonthlyPlan > 0
                    ? (productionReport.totalAchieved / productionReport.totalMonthlyPlan) * 100
                    : 0;

                console.log('✅ Production Report Created:', productionReport);

                // Update data
                const updatedData = currentData.filter(d => d.monthKey !== monthKey);
                updatedData.push(productionReport);
                onDataUpdate(updatedData);

                alert(`✅ SUCCESS!\n\nUploaded Production Data for ${MONTH_NAMES[selectedMonth]} ${selectedYear}\n\nParticulars: ${particulars.length}\nTotal Plan: ${productionReport.totalMonthlyPlan.toLocaleString()}\nTotal Achieved: ${productionReport.totalAchieved.toLocaleString()}\nAchievement: ${productionReport.overallPercentage.toFixed(1)}%\n\nCheck the Production Dashboard to review!`);

                // Reset file input
                e.target.value = '';
            } catch (error) {
                console.error('❌ Production Excel Parse Error:', error);
                setUploadError(`❌ IMPORT FAILED\n\n${error instanceof Error ? error.message : 'Unknown error'}\n\nTips:\n• Ensure Excel has "Product Category" and "Plan" columns\n• Column 1 = Product Name\n• Column 2 = Monthly Plan\n• Column 3+ = Daily Achievement values\n• Check that data rows contain numeric values`);
            } finally {
                setIsUploading(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="flex flex-col items-center space-y-8 animate-in fade-in">
            <div className="text-center space-y-2">
                <h3 className="text-2xl font-black italic">PRODUCTION WEEKLY SYNC</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Production Planning & Achievement Tracking</p>
            </div>

            <div className="flex flex-col items-center gap-6 mb-10">
                <div className="flex items-center gap-6">
                    <div className="flex gap-2">
                        <button onClick={() => handleMonthChange(-1)} className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors text-slate-600">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button onClick={() => handleMonthChange(1)} className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors text-slate-600">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Production Period</p>
                        <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">{MONTH_NAMES[selectedMonth]} {selectedYear}</h3>
                    </div>
                </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-8 rounded-[2.5rem] w-full max-w-md text-center">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 leading-relaxed">
                    Upload production Excel with <strong>Product Category</strong>, <strong>Monthly Plan</strong>, and <strong>Daily Achievement</strong> columns.
                </p>
                <label className="bg-green-600 text-white px-12 py-6 rounded-3xl font-black uppercase text-[10px] cursor-pointer shadow-xl inline-block hover:scale-105 active:scale-95 transition-all">
                    {isUploading ? 'PROCESSING DATA...' : 'SELECT EXCEL FILE'}
                    <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} disabled={isUploading} />
                </label>
            </div>

            {uploadError && (
                <div className="max-w-2xl mx-auto text-left bg-red-50 p-6 rounded-2xl border-2 border-red-200 shadow-lg">
                    <div className="flex items-start gap-3 mb-3">
                        <span className="text-2xl">⚠️</span>
                        <h4 className="text-sm font-black text-red-700 uppercase tracking-wider">Upload Error</h4>
                    </div>
                    <div className="text-red-800 text-xs font-medium whitespace-pre-line leading-relaxed pl-9">
                        {uploadError}
                    </div>
                </div>
            )}
        </div>
    );
};
