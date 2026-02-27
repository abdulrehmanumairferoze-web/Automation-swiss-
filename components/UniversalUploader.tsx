import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { saveData, getData } from '../services/dbService.ts';
import { MONTH_NAMES } from '../config.ts';
import { parseSalesExcel, parseFinanceExcel, parseProductionExcel } from '../services/data-parsers.ts';

interface UniversalUploaderProps {
    onSalesUpdate: (data: any[]) => void;
    onFinanceUpdate: (data: any[]) => void;
    onProductionUpdate: (data: any[]) => void;
}

export const UniversalUploader: React.FC<UniversalUploaderProps> = ({
    onSalesUpdate,
    onFinanceUpdate,
    onProductionUpdate
}) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState<{ message: string; type: 'info' | 'success' | 'error' | 'warning' } | null>(null);

    const detectAndProcessFile = async (file: File) => {
        setIsProcessing(true);
        setStatus({ message: `Analyzing ${file.name}...`, type: 'info' });

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const bstr = e.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary', cellDates: false });
                const sheetName = wb.SheetNames[0];
                const ws = wb.Sheets[sheetName];
                const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

                if (rows.length === 0) throw new Error("File is empty");

                // --- DETECTION LOGIC ---
                const rowStrings = rows.slice(0, 20).map(r => r.join('|').toLowerCase());
                const allContent = rowStrings.join('\n');

                // 1. Detect Production
                if (allContent.includes('product category') && (allContent.includes('plan') || allContent.includes('achievement'))) {
                    const report = parseProductionExcel(rows, currentMonth, currentYear);
                    const currentProd = await getData('productionData') || [];
                    const updated = [...currentProd.filter((d: any) => d.monthKey !== report.monthKey), report];
                    if (await saveData('productionData', updated)) {
                        onProductionUpdate(updated);
                        setStatus({ message: `✅ Production Data Integrated: ${report.particulars.length} items.`, type: 'success' });
                    }
                    return;
                }

                // 2. Detect Finance
                if (allContent.includes('particulars') && (allContent.includes('inflow') || allContent.includes('outflow') || allContent.includes('opening bank balance'))) {
                    const report = parseFinanceExcel(rows, currentMonth, currentYear);
                    const currentFin = await getData('financeData') || [];
                    const updated = [...currentFin.filter((d: any) => d.monthKey !== report.monthKey), report];
                    if (await saveData('financeData', updated)) {
                        onFinanceUpdate(updated);
                        setStatus({ message: `✅ Finance Projections Integrated for ${report.month}.`, type: 'success' });
                    }
                    return;
                }

                // 3. Detect Sales (Master or Daily)
                const hasSalesHeaders = allContent.includes('target units') || allContent.includes('teams') || allContent.includes('brands') || allContent.includes('all regions') || allContent.includes('product_name');
                const hasDateHeaders = rowStrings.some(s => /\d{1,2}[-./][A-Za-z]{3}[-./]\d{2}/.test(s) || /\d{1,2}\/\d{1,2}\/\d{4}/.test(s));

                if (hasSalesHeaders || hasDateHeaders) {
                    const isMaster = allContent.includes('target units') || allContent.includes('plan');
                    const entries = parseSalesExcel(rows, currentMonth, currentYear, isMaster, false);
                    if (entries.length > 0) {
                        if (await saveData('operationData', entries)) {
                            await new Promise(r => setTimeout(r, 500));
                            const updated = await getData('operationData');
                            onSalesUpdate(updated);
                            setStatus({ message: `✅ Sales Data Integrated: ${entries.length} records.`, type: 'success' });
                        }
                    } else throw new Error("No valid Sales data found.");
                    return;
                }

                throw new Error("Could not detect department format.");

            } catch (err: any) {
                setStatus({ message: err.message, type: 'error' });
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="px-4 py-6">
            <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files[0]) detectAndProcessFile(e.dataTransfer.files[0]);
                }}
                className={`relative border-2 border-dashed rounded-3xl p-6 text-center transition-all ${isProcessing ? 'border-green-500 bg-green-50/50' : 'border-slate-200 hover:border-green-400 hover:bg-slate-50'
                    }`}
            >
                <div className="space-y-3">
                    <div className="text-3xl">{isProcessing ? '⚡' : '📥'}</div>
                    <div className="flex flex-col">
                        <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight">Drop Data File</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Universal Pipeline</span>
                    </div>
                    <input
                        type="file"
                        className="hidden"
                        id="universal-drop"
                        onChange={(e) => e.target.files?.[0] && detectAndProcessFile(e.target.files[0])}
                    />
                    <label htmlFor="universal-drop" className="block text-[8px] font-black text-green-600 cursor-pointer hover:underline mt-2">
                        OR SELECT EXCEL
                    </label>
                </div>

                {isProcessing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-3xl">
                        <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
            </div>

            {status && (
                <div className={`mt-4 p-3 rounded-xl text-[10px] font-bold leading-tight animate-in fade-in slide-in-from-top-2 ${status.type === 'success' ? 'bg-green-100 text-green-700' :
                    status.type === 'error' ? 'bg-red-100 text-red-700' :
                        status.type === 'warning' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                    {status.message}
                    <button onClick={() => setStatus(null)} className="float-right opacity-50">×</button>
                </div>
            )}
        </div>
    );
};
