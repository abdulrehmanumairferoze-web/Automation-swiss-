
import React, { useState } from 'react';
import { FinanceMismatchReport, FinanceCategory, FinanceWeek } from '../types.ts';
import * as XLSX from 'xlsx';

interface FinanceEntryProps {
    currentData: FinanceMismatchReport[];
    onDataUpdate: (data: FinanceMismatchReport[]) => void;
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const FinanceEntry: React.FC<FinanceEntryProps> = ({ currentData, onDataUpdate }) => {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const monthKey = `${selectedYear}-${selectedMonth}`;

    const handleMonthChange = (offset: number) => {
        const newDate = new Date(selectedYear, selectedMonth + offset, 1);
        setSelectedMonth(newDate.getMonth());
        setSelectedYear(newDate.getFullYear());
        setUploadError(null);
    };

    const cleanValue = (val: any): number => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        const str = String(val).replace(/,/g, '').trim();
        if (str === '-' || str === '') return 0;
        // Handle (123) as negative
        if (str.startsWith('(') && str.endsWith(')')) {
            return -1 * parseFloat(str.replace(/[()]/g, ''));
        }
        return parseFloat(str) || 0;
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        setUploadError(null);

        const reportsToMerge: FinanceMismatchReport[] = [];
        const processedFiles: string[] = [];
        const errors: string[] = [];

        const readFile = (file: File): Promise<void> => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    try {
                        const buffer = evt.target?.result as ArrayBuffer;
                        const workbook = XLSX.read(buffer, { type: 'array' });
                        const sheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[sheetName];
                        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

                        // 1. Find Header
                        let headerRowIdx = -1;
                        let dateRowIdx = -1;
                        let particularsColIdx = 0;

                        for (let i = 0; i < Math.min(rows.length, 50); i++) {
                            const rowStr = rows[i].join('|').toLowerCase();
                            if (rowStr.includes('particulars')) {
                                headerRowIdx = i;
                                // Find particulars column
                                for (let c = 0; c < rows[i].length; c++) {
                                    if (String(rows[i][c]).toLowerCase().trim() === 'particulars') {
                                        particularsColIdx = c;
                                        break;
                                    }
                                }

                                if (/\d+.*(?:TO|-).*\d+/i.test(rowStr) || rowStr.includes('week')) dateRowIdx = i;
                                else if (i + 1 < rows.length) {
                                    const nextRowStr = rows[i + 1].join('|').toLowerCase();
                                    if (/\d+.*(?:TO|-).*\d+/i.test(nextRowStr) || nextRowStr.includes('week')) dateRowIdx = i + 1;
                                }
                                if (headerRowIdx !== -1 && dateRowIdx !== -1) break;
                            }
                        }
                        if (headerRowIdx === -1) throw new Error("Missing 'Particulars' header");
                        if (dateRowIdx === -1) dateRowIdx = headerRowIdx;

                        const headers = rows[dateRowIdx].map(h => String(h).trim());

                        // 2. Identify Weeks
                        const weekCols: any[] = [];
                        let currentWeekNum = 1;

                        for (let c = 0; c < headers.length; c++) {
                            const header = headers[c];
                            const isDateRange = /\d+.*(?:TO|-).*\d+/i.test(header);
                            const isWeekLabel = /week/i.test(header) && !/total/i.test(header);
                            if (isDateRange || (isWeekLabel && !header.toLowerCase().includes('received') && !header.toLowerCase().includes('paid'))) {
                                if (c + 1 < headers.length) {
                                    weekCols.push({ weekLabel: header, weekNumber: currentWeekNum++, projectedIdx: c, actualIdx: c + 1 });
                                }
                            }
                        }
                        // Fallback
                        if (weekCols.length === 0) {
                            for (let c = 1; c < headers.length; c++) {
                                const header = headers[c].toLowerCase();
                                if ((header.includes('week') && (header.includes('received') || header.includes('paid'))) || header.includes('actual')) {
                                    weekCols.push({ weekLabel: headers[c - 1] || `Week ${currentWeekNum}`, weekNumber: currentWeekNum++, projectedIdx: c - 1, actualIdx: c });
                                }
                            }
                        }

                        if (weekCols.length === 0) throw new Error("No weekly data columns found");

                        // 3. Find Opening Balance
                        let openingBalRowIdx = -1;
                        for (let i = 0; i < headerRowIdx; i++) {
                            if (rows[i][0] && String(rows[i][0]).toLowerCase().includes('opening bank balance')) {
                                openingBalRowIdx = i;
                                break;
                            }
                        }
                        let openingProjected = 0;
                        let openingActual = 0;
                        if (openingBalRowIdx !== -1) {
                            const row = rows[openingBalRowIdx];
                            const validNums = row.slice(1).map((v: any) => cleanValue(v)).filter((v: number) => !isNaN(v));
                            if (validNums.length >= 2) { openingProjected = validNums[0]; openingActual = validNums[1]; }
                            else if (validNums.length === 1) { openingProjected = validNums[0]; }
                        }

                        // 4. Parse Data
                        let inflowStartIdx = -1;
                        let outflowStartIdx = -1;
                        for (let i = 0; i < rows.length; i++) {
                            const cell = String(rows[i][particularsColIdx] || rows[i][0] || '').toLowerCase().trim();
                            if (cell === 'inflow') inflowStartIdx = i;
                            if (cell === 'outflow') outflowStartIdx = i;
                        }
                        if (inflowStartIdx === -1) inflowStartIdx = dateRowIdx + 1;
                        if (outflowStartIdx === -1) {
                            for (let i = inflowStartIdx + 5; i < rows.length; i++) {
                                const rowStr = rows[i].join('|').toLowerCase();
                                if (rowStr.includes('particulars')) { outflowStartIdx = i; break; }
                            }
                        }

                        const parseSection = (start: number, end: number, type: 'inflow' | 'outflow') => {
                            const categories = [];
                            for (let i = start; i < end; i++) {
                                const row = rows[i];
                                const name = String(row[particularsColIdx] || '').trim();
                                if (!name || name.toLowerCase().includes('particulars') || name.toLowerCase().includes('total') || name.toLowerCase() === 'inflow' || name.toLowerCase() === 'outflow') continue;
                                if (name.length < 2) continue;

                                const categoryWeeks = weekCols.map(wc => {
                                    const proj = cleanValue(String(row[wc.projectedIdx]));
                                    const act = cleanValue(String(row[wc.actualIdx]));
                                    return {
                                        weekLabel: wc.weekLabel,
                                        weekNumber: wc.weekNumber,
                                        projected: proj,
                                        actual: act,
                                        variance: act - proj,
                                        percentage: proj > 0 ? (act / proj) * 100 : 0
                                    };
                                });

                                const totalProj = categoryWeeks.reduce((sum: number, w: any) => sum + w.projected, 0);
                                const totalAct = categoryWeeks.reduce((sum: number, w: any) => sum + w.actual, 0);

                                categories.push({
                                    name,
                                    type,
                                    weeks: categoryWeeks,
                                    totalProjected: totalProj,
                                    totalActual: totalAct,
                                    percentage: totalProj > 0 ? (totalAct / totalProj) * 100 : 0,
                                    remarks: String(row[headers.length] || '')
                                });
                            }
                            return categories;
                        };

                        const inflowEnd = outflowStartIdx !== -1 ? outflowStartIdx : rows.length;
                        const inflowCats = parseSection(inflowStartIdx, inflowEnd, 'inflow');
                        const outflowCats = outflowStartIdx !== -1 ? parseSection(outflowStartIdx, rows.length, 'outflow') : [];

                        reportsToMerge.push({
                            month: `${MONTH_NAMES[selectedMonth]} ${selectedYear}`,
                            monthKey: monthKey,
                            openingBalance: { projected: openingProjected, actual: openingActual },
                            closingBalance: { projected: 0, actual: 0, variance: 0 },
                            inflow: { projected: 0, actual: 0, percentage: 0 },
                            outflow: { projected: 0, actual: 0, percentage: 0 },
                            netPosition: { projected: 0, actual: 0, variance: 0 },
                            inflowCategories: inflowCats as any,
                            outflowCategories: outflowCats as any,
                            reportDate: new Date().toISOString()
                        });

                        processedFiles.push(file.name);
                        resolve();

                    } catch (err) {
                        errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
                        resolve();
                    }
                };
                reader.readAsArrayBuffer(file);
            });
        };

        await Promise.all(Array.from(files).map(readFile));

        if (reportsToMerge.length > 0) {
            // MERGE LOGIC
            const masterReport = { ...reportsToMerge[0] };

            for (let i = 1; i < reportsToMerge.length; i++) {
                const report = reportsToMerge[i];
                // Accumulate Opening Balance (use the max one? or first? usually Opening Balance is same for the month)
                // Let's take the non-zero one if master is zero
                if (masterReport.openingBalance.projected === 0) masterReport.openingBalance = report.openingBalance;

                const mergeCats = (baseCats: FinanceCategory[], newCats: FinanceCategory[]) => {
                    newCats.forEach(newCat => {
                        const existing = baseCats.find(c => c.name === newCat.name);
                        if (existing) {
                            newCat.weeks.forEach(newWeek => {
                                const existWeekIdx = existing.weeks.findIndex(w => w.weekLabel === newWeek.weekLabel);
                                if (existWeekIdx >= 0) existing.weeks[existWeekIdx] = newWeek;
                                else existing.weeks.push(newWeek);
                            });
                            existing.weeks.sort((a, b) => a.weekNumber - b.weekNumber);
                            existing.totalProjected = existing.weeks.reduce((sum, w) => sum + w.projected, 0);
                            existing.totalActual = existing.weeks.reduce((sum, w) => sum + w.actual, 0);
                            existing.percentage = existing.totalProjected > 0 ? (existing.totalActual / existing.totalProjected) * 100 : 0;
                        } else {
                            baseCats.push(newCat);
                        }
                    });
                };
                mergeCats(masterReport.inflowCategories, report.inflowCategories);
                mergeCats(masterReport.outflowCategories, report.outflowCategories);
            }

            // Recalculate Master Totals
            const reCalcTotal = (cats: FinanceCategory[]) => ({
                projected: cats.reduce((sum, c) => sum + c.totalProjected, 0),
                actual: cats.reduce((sum, c) => sum + c.totalActual, 0)
            });

            const totalInflow = reCalcTotal(masterReport.inflowCategories);
            const totalOutflow = reCalcTotal(masterReport.outflowCategories);

            masterReport.inflow = { ...totalInflow, percentage: totalInflow.projected > 0 ? (totalInflow.actual / totalInflow.projected) * 100 : 0 };
            masterReport.outflow = { ...totalOutflow, percentage: totalOutflow.projected > 0 ? (totalOutflow.actual / totalOutflow.projected) * 100 : 0 };

            const op = masterReport.openingBalance;
            const netProj = op.projected + totalInflow.projected - totalOutflow.projected;
            const netAct = op.actual + totalInflow.actual - totalOutflow.actual;

            masterReport.closingBalance = {
                projected: netProj,
                actual: netAct,
                variance: netAct - netProj
            };
            masterReport.netPosition = { // Net Cash Flow for period
                projected: totalInflow.projected - totalOutflow.projected,
                actual: totalInflow.actual - totalOutflow.actual,
                variance: (totalInflow.actual - totalOutflow.actual) - (totalInflow.projected - totalOutflow.projected)
            };

            const updatedData = currentData.filter(d => d.monthKey !== monthKey);
            updatedData.push(masterReport);
            onDataUpdate(updatedData);

            alert(`✅ BATCH MERGE COMPLETE\n\nProcessed: ${processedFiles.join(', ')}\nPer-file errors: ${errors.length}\n\nConsolidated into Period: ${masterReport.month}`);
        } else if (errors.length > 0) {
            setUploadError(errors.join('\n'));
        }

        setIsUploading(false);
    };

    return (
        <div className="flex flex-col items-center space-y-8 animate-in fade-in">
            <div className="text-center space-y-2">
                <h3 className="text-2xl font-black italic">FINANCE WEEKLY PROJECTION</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Cash Flow Management System</p>
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
                        <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Finance Period</p>
                        <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">{MONTH_NAMES[selectedMonth]} {selectedYear}</h3>
                    </div>
                </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-8 rounded-[2.5rem] w-full max-w-md text-center">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 leading-relaxed">
                    Upload weekly finance Excel.<br />Must include <strong>Opening Balance</strong> and weekly <strong>Projection/Actual</strong> columns.
                </p>
                <label className="bg-purple-600 text-white px-12 py-6 rounded-3xl font-black uppercase text-[10px] cursor-pointer shadow-xl inline-block hover:scale-105 active:scale-95 transition-all">
                    {isUploading ? 'PROCESSING BATCH...' : 'SELECT WEEKLY FILES'}
                    <input type="file" className="hidden" accept=".xlsx, .xls" multiple onChange={handleFileUpload} disabled={isUploading} />
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
