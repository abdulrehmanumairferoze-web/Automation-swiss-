import React, { useState, useMemo } from 'react';
import { FinanceMismatchReport, FinanceCategory } from '../types';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

interface FinanceDashboardProps {
    financeData: FinanceMismatchReport[];
}

export const FinanceDashboard: React.FC<FinanceDashboardProps> = ({ financeData }) => {
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const currentFinanceData = useMemo(() => {
        if (!financeData || !Array.isArray(financeData)) return null;
        const monthKey = `${selectedYear}-${selectedMonth}`;
        return financeData.find(d => d.monthKey === monthKey);
    }, [financeData, selectedMonth, selectedYear]);

    const monthName = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][selectedMonth];

    const handleMonthChange = (offset: number) => {
        const newDate = new Date(selectedYear, selectedMonth + offset, 1);
        setSelectedMonth(newDate.getMonth());
        setSelectedYear(newDate.getFullYear());
    };

    const formatCurrency = (val: number | undefined | null) => {
        if (val === undefined || val === null) return '-';
        return new Intl.NumberFormat('en-PK', {
            style: 'decimal',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(val);
    };

    const formatShortCurrency = (val: number) => {
        if(val >= 10000000) return `${(val / 10000000).toFixed(1)}Cr`;
        if(val >= 100000) return `${(val / 100000).toFixed(1)}L`;
        if(val >= 1000) return `${(val / 1000).toFixed(1)}K`;
        return val.toString();
    }

    const SummaryCard = ({ title, projected, actual, colorTheme }: { title: string, projected?: number, actual?: number, colorTheme: 'blue' | 'emerald' | 'purple' | 'amber' }) => {
        const p = projected || 0;
        const a = actual || 0;
        const variance = a - p;
        const percentage = p !== 0 ? (a / p) * 100 : 0;

        const themeMap = {
            blue: 'text-blue-500 bg-blue-500',
            emerald: 'text-emerald-500 bg-emerald-500',
            purple: 'text-purple-500 bg-purple-500',
            amber: 'text-amber-500 bg-amber-500'
        };

        const themeBgLight = {
            blue: 'bg-blue-500/10 text-blue-400',
            emerald: 'bg-emerald-500/10 text-emerald-400',
            purple: 'bg-purple-500/10 text-purple-400',
            amber: 'bg-amber-500/10 text-amber-400'
        };

        return (
            <div className="p-6 rounded-[2rem] bg-[#1e293b]/40 backdrop-blur-3xl border border-white/5 shadow-2xl relative overflow-hidden group hover:bg-[#1e293b]/60 transition-all">
                <div className={`absolute top-0 right-0 w-32 h-32 ${themeMap[colorTheme].split(' ')[1]}/20 rounded-full blur-3xl -mr-16 -mt-16 opacity-50`}></div>
                
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 z-10 relative">{title}</h3>

                <div className="space-y-4 mb-6 relative z-10">
                    <div>
                        <div className="flex justify-between items-baseline mb-2">
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Actual</p>
                            <p className={`text-2xl font-black ${themeMap[colorTheme].split(' ')[0]} tabular-nums`}>{formatCurrency(a)}</p>
                        </div>
                        <div className="w-full bg-[#0f172a] h-1.5 rounded-full overflow-hidden">
                            <div className={`h-full ${themeMap[colorTheme].split(' ')[1]} rounded-full transition-all duration-1000`} style={{ width: `${Math.min(percentage, 100)}%` }}></div>
                        </div>
                    </div>

                    <div className="flex justify-between items-baseline pt-2">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Projected</p>
                        <p className="text-sm font-bold text-slate-300 tabular-nums">{formatCurrency(p)}</p>
                    </div>
                </div>

                <div className="relative z-10 pt-4 border-t border-white/5 flex justify-between items-center">
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Variance</p>
                        <p className={`text-xs font-black tabular-nums ${variance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {variance > 0 ? '+' : ''}{formatCurrency(variance)}
                        </p>
                    </div>
                    <div className={`px-3 py-1.5 rounded-xl ${percentage >= 100 ? themeBgLight.emerald : themeBgLight.amber}`}>
                        <p className="text-xs font-black tabular-nums">{percentage.toFixed(1)}%</p>
                    </div>
                </div>
            </div>
        );
    };

    const DetailTable = ({ title, categories, colorTheme }: { title: string, categories?: FinanceCategory[], colorTheme: 'emerald' | 'purple' }) => {
        if (!categories || categories.length === 0) return null;

        const maxWeeks = Math.max(...categories.map(c => c.weeks ? c.weeks.length : 0), 0);
        if (maxWeeks === 0) return null;
        
        const weekIndexes = Array.from({ length: maxWeeks }, (_, i) => i);

        return (
            <div className="mt-8 bg-[#1e293b]/40 backdrop-blur-3xl rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#0f172a]/40">
                    <div className="flex items-center gap-4">
                        <div className={`w-3 h-8 ${colorTheme === 'emerald' ? 'bg-emerald-500' : 'bg-purple-500'} rounded-full shadow-[0_0_15px_${colorTheme === 'emerald' ? 'rgba(16,185,129,0.5)' : 'rgba(168,85,247,0.5)'}]`}></div>
                        <h3 className={`text-xl font-black ${colorTheme === 'emerald' ? 'text-emerald-400' : 'text-purple-400'} uppercase italic tracking-tight`}>{title}</h3>
                    </div>
                    <span className="px-4 py-2 bg-white/5 border border-white/10 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest">
                        {categories.length} Categories
                    </span>
                </div>

                <div className="overflow-x-auto scrollbar-thin">
                    <table className="w-full text-xs text-left">
                        <thead>
                            <tr className="border-b border-white/5 bg-[#0a0f1d]/60">
                                <th className="p-5 font-black text-slate-500 uppercase tracking-widest min-w-[220px] sticky left-0 bg-[#0a0f1d] z-20">Particulars</th>
                                {weekIndexes.map(idx => (
                                    <th key={idx} className="p-4 text-center font-black text-slate-500 uppercase tracking-widest min-w-[140px]">
                                        <div className="text-[10px] mb-2">{categories[0]?.weeks?.[idx]?.weekLabel || `Week ${idx + 1}`}</div>
                                        <div className="flex justify-between text-[8px] text-slate-400 bg-white/5 px-2 py-1 rounded-md">
                                            <span>PROJ</span>
                                            <span>ACT</span>
                                        </div>
                                    </th>
                                ))}
                                <th className="p-5 text-right font-black text-slate-500 uppercase tracking-widest min-w-[110px]">Total Proj</th>
                                <th className="p-5 text-right font-black text-slate-500 uppercase tracking-widest min-w-[110px]">Total Act</th>
                                <th className="p-5 text-center font-black text-slate-500 uppercase tracking-widest w-[80px]">%</th>
                                <th className="p-5 font-black text-slate-500 uppercase tracking-widest min-w-[150px]">Remarks</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {categories
                                .filter(cat => cat.totalActual < cat.totalProjected)
                                .map((cat, idx) => (
                                    <tr key={idx} className="hover:bg-white/5 transition-colors group">
                                        <td className="p-5 font-bold text-slate-200 sticky left-0 bg-[#0f172a] group-hover:bg-[#1e293b] z-10 truncate border-r border-white/5" title={cat.name}>
                                            {cat.name}
                                        </td>
                                        {weekIndexes.map(wIdx => {
                                            const week = cat.weeks?.[wIdx];
                                            if (!week) return <td key={wIdx} className="p-4 text-center text-slate-500">-</td>;

                                            const isPositive = week.actual >= week.projected;
                                            const bgClass =
                                                week.actual === 0 && week.projected === 0 ? '' :
                                                    isPositive ? 'bg-emerald-500/10' : 'bg-rose-500/10';

                                            return (
                                                <td key={wIdx} className={`p-3 ${bgClass}`}>
                                                    <div className="grid grid-cols-2 gap-2 px-1">
                                                        <div className="text-right text-slate-400 font-medium text-[10px] tabular-nums">
                                                            {week.projected > 0 ? formatShortCurrency(week.projected) : '-'}
                                                        </div>
                                                        <div className={`text-right font-bold text-[10px] tabular-nums ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            {week.actual > 0 ? formatShortCurrency(week.actual) : '-'}
                                                        </div>
                                                    </div>
                                                </td>
                                            );
                                        })}
                                        <td className="p-5 text-right font-medium text-slate-400 text-[11px] tabular-nums">{formatCurrency(cat.totalProjected)}</td>
                                        <td className={`p-5 text-right font-black text-[11px] tabular-nums ${cat.totalActual >= cat.totalProjected ? `text-${colorTheme}-400` : 'text-rose-400'}`}>
                                            {formatCurrency(cat.totalActual)}
                                        </td>
                                        <td className="p-5 text-center">
                                            <span className={`px-2 py-1 rounded-lg text-[9px] font-black ${
                                                cat.percentage >= 100 ? 'bg-emerald-500/20 text-emerald-400' :
                                                cat.percentage >= 80 ? 'bg-amber-500/20 text-amber-400' :
                                                'bg-rose-500/20 text-rose-400'
                                            }`}>
                                                {cat.percentage.toFixed(0)}%
                                            </span>
                                        </td>
                                        <td className="p-5 text-left text-[10px] text-slate-400 truncate max-w-[150px]" title={cat.remarks || ''}>
                                            {cat.remarks || '-'}
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="p-8 pb-32 space-y-10 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 className="text-3xl md:text-5xl font-black italic text-white tracking-tighter mix-blend-lighten">FINANCE LOGISTICS</h2>
                    <p className="text-emerald-500 font-bold tracking-[0.3em] text-[10px] uppercase mt-2">Cash Flow & Variance Telemetry</p>
                </div>

                <div className="flex items-center gap-2 bg-[#1e293b]/60 backdrop-blur-xl p-2 pr-6 rounded-[2rem] shadow-2xl border border-white/5">
                    <button onClick={() => handleMonthChange(-1)} className="w-12 h-12 rounded-[1.5rem] bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all">
                        <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div className="px-6 flex flex-col justify-center text-center min-w-[140px]">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Reporting Period</span>
                        <span className="text-sm font-black text-white uppercase">{monthName} {selectedYear}</span>
                    </div>
                    <button onClick={() => handleMonthChange(1)} className="w-12 h-12 rounded-[1.5rem] bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all">
                        <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>
            </div>

            {!currentFinanceData ? (
                <div className="flex flex-col items-center justify-center h-96 bg-[#1e293b]/20 backdrop-blur-md rounded-[3rem] border border-dashed border-white/10">
                    <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-3xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                    </div>
                    <h3 className="text-xl font-black text-white uppercase tracking-widest">No Telemetry Signal</h3>
                    <p className="text-slate-500 text-xs mt-2 uppercase tracking-widest font-bold">Upload finance packet for {monthName} {selectedYear}</p>
                </div>
            ) : (
                <>
                    {/* Status Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <SummaryCard title="Opening Balance" projected={currentFinanceData.openingBalance?.projected} actual={currentFinanceData.openingBalance?.actual} colorTheme="blue" />
                        <SummaryCard title="Total Inflow" projected={currentFinanceData.inflow?.projected} actual={currentFinanceData.inflow?.actual} colorTheme="emerald" />
                        <SummaryCard title="Total Outflow" projected={currentFinanceData.outflow?.projected} actual={currentFinanceData.outflow?.actual} colorTheme="purple" />
                        <SummaryCard title="Closing Balance" projected={currentFinanceData.closingBalance?.projected} actual={currentFinanceData.closingBalance?.actual} colorTheme="amber" />
                    </div>

                    {/* Projection vs Actual Chart */}
                    <div className="mt-8 bg-[#1e293b]/40 backdrop-blur-3xl p-8 rounded-[2.5rem] shadow-2xl border border-white/5">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center shadow-lg border border-emerald-500/20">
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-tight">System Totals Verification</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Projected vs Actual Comparison</p>
                            </div>
                        </div>

                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={[
                                        { name: 'Inflow Dashboard', Projected: currentFinanceData.inflow.projected, Actual: currentFinanceData.inflow.actual },
                                        { name: 'Outflow Analysis', Projected: currentFinanceData.outflow.projected, Actual: currentFinanceData.outflow.actual }
                                    ]}
                                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                    barSize={40}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} fontWeight="bold" tickLine={false} axisLine={false} />
                                    <YAxis stroke="#475569" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                                        contentStyle={{ backgroundColor: 'rgba(3, 7, 18, 0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
                                        labelStyle={{ color: '#94a3b8', fontWeight: '900', marginBottom: '8px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                                        itemStyle={{ fontWeight: 'bold', fontSize: '12px', padding: '4px 0' }}
                                        formatter={(value: any) => [`PKR ${new Intl.NumberFormat('en-PK').format(value)}`, '']}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" formatter={(value) => <span className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">{value}</span>} />
                                    <Bar dataKey="Projected" fill="#334155" radius={[6, 6, 0, 0]} name="Projected" />
                                    <Bar dataKey="Actual" radius={[6, 6, 0, 0]} name="Actual">
                                        {[ { name: 'Inflow', Projected: 1, Actual: 1 }, { name: 'Outflow', Projected: 1, Actual: 1 } ].map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#a855f7'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <DetailTable title="Capital Inflows" categories={currentFinanceData.inflowCategories} colorTheme="emerald" />
                    <DetailTable title="Capital Outflows" categories={currentFinanceData.outflowCategories} colorTheme="purple" />
                </>
            )}
        </div>
    );
};
