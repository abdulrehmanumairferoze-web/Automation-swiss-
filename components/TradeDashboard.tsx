import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DepartmentMismatch } from '../types.ts';

interface TradeDashboardProps {
    data: DepartmentMismatch[];
}

export const TradeDashboard: React.FC<TradeDashboardProps> = ({ data }) => {
    const tradeMonths = ["July", "August", "September", "October", "November", "December", "January", "February", "March", "April", "May", "June"];

    // Financial Year Detection Logic
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const inferredFY = currentMonth >= 6
        ? `FY ${currentYear - 2000}-${currentYear - 1999}`
        : `FY ${currentYear - 2001}-${currentYear - 2000}`;

    const [selectedFY, setSelectedFY] = useState(inferredFY);

    // Initialize with current financial month
    const initialMonthIdx = currentMonth >= 6 ? currentMonth - 6 : currentMonth + 6;
    const [selectedMonth, setSelectedMonth] = useState(tradeMonths[initialMonthIdx]);
    const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);

    // Filter all data to just the TRADE department
    const tradeData = useMemo(() => data.filter(d => d.department === 'TRADE'), [data]);

    // Extract all unique FYs present in the data for the dropdown
    const availableFYs = useMemo(() => {
        const fys = new Set<string>();
        tradeData.forEach(d => { if (d.fy) fys.add(d.fy); });
        if (fys.size === 0) return [inferredFY]; // Fallback to current if empty
        return Array.from(fys).sort((a, b) => b.localeCompare(a)); // Newest first
    }, [tradeData, inferredFY]);

    // Combined filter: Department == TRADE && FY == selectedFY
    const fyData = useMemo(() => tradeData.filter(d => d.fy === selectedFY), [tradeData, selectedFY]);

    // Aggregate data for the selected month (All Customers View)
    const monthlySummary = useMemo(() => {
        const monthData = fyData.filter(d => d.reportDate === selectedMonth);
        const summaryMap = new Map<string, { plan: number, actual: number, category: string }>();

        monthData.forEach(d => {
            const existing = summaryMap.get(d.metric) || { plan: 0, actual: 0, category: d.team };
            summaryMap.set(d.metric, {
                plan: existing.plan + Number(d.plan),
                actual: existing.actual + Number(d.actual),
                category: d.team || existing.category
            });
        });

        return Array.from(summaryMap.entries()).map(([name, vals]) => ({
            name,
            category: vals.category,
            Plan: vals.plan,
            Actual: vals.actual,
            Shortfall: Math.max(0, vals.plan - vals.actual)
        })).sort((a, b) => b.Plan - a.Plan);
    }, [fyData, selectedMonth]);

    // Aggregate 12-month trend for a specific customer (Drill-down View)
    const customerTrend = useMemo(() => {
        if (!selectedCustomer) return [];
        return tradeMonths.map(m => {
            const d = fyData.find(item => item.metric === selectedCustomer && item.reportDate === m);
            return {
                name: m,
                Plan: d ? Number(d.plan) : 0,
                Actual: d ? Number(d.actual) : 0,
                Shortfall: d ? Math.max(0, Number(d.plan) - Number(d.actual)) : 0
            };
        });
    }, [fyData, selectedCustomer, tradeMonths]);

    const totals = useMemo(() => {
        return monthlySummary.reduce((acc, curr) => ({
            plan: acc.plan + curr.Plan,
            actual: acc.actual + curr.Actual,
            shortfall: acc.shortfall + curr.Shortfall
        }), { plan: 0, actual: 0, shortfall: 0 });
    }, [monthlySummary]);

    const hasData = fyData.length > 0;

    if (!hasData) {
        return (
            <div className="space-y-8 animate-in fade-in duration-500">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl gap-4">
                    <div className="space-y-1">
                        <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Trade Performance</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monthly Budget vs Sales</p>
                    </div>
                    <div className="flex items-center gap-6">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Financial Year</span>
                        <div className="relative">
                            <select
                                value={selectedFY}
                                onChange={(e) => setSelectedFY(e.target.value)}
                                className="bg-white/10 border border-white/20 rounded-2xl px-6 py-3 text-xs font-black uppercase tracking-widest text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer pr-12"
                            >
                                {availableFYs.map(fy => <option key={fy} value={fy} className="bg-slate-900">{fy}</option>)}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/50">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-24 rounded-[4rem] border border-slate-100 shadow-xl text-center space-y-10">
                    <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-5xl">📊</div>
                    <div className="space-y-4">
                        <h3 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">No Trade Data Found for {selectedFY}</h3>
                        <p className="max-w-md mx-auto text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-relaxed">
                            Upload Trade Excel via Data Entry or switch the Financial Year selector above if data exists for other periods.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header & Controls */}
            <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                        <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Trade Performance</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Customer Achievement Matrix</p>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-4">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Financial Year</span>
                            <div className="relative">
                                <select
                                    value={selectedFY}
                                    onChange={(e) => setSelectedFY(e.target.value)}
                                    className="bg-white/10 border border-white/20 rounded-2xl px-6 py-3 text-xs font-black uppercase tracking-widest text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer pr-12"
                                >
                                    {availableFYs.map(fy => <option key={fy} value={fy} className="bg-slate-900">{fy}</option>)}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/50">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Month Selector Ribbon */}
                <div className="flex flex-wrap gap-2 pt-4 border-t border-white/5">
                    {tradeMonths.map((m) => (
                        <button
                            key={m}
                            onClick={() => setSelectedMonth(m)}
                            className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${selectedMonth === m
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                                    : 'bg-white/5 text-slate-500 hover:bg-white/10'
                                }`}
                        >
                            {m}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chart Section */}
            <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-2xl relative min-h-[550px]">
                <div className="flex justify-between items-center mb-16 border-b border-slate-50 pb-10">
                    <div>
                        <h3 className="text-lg font-black text-slate-900 uppercase italic tracking-tighter mb-2">
                            {selectedCustomer ? `Annual Trend: ${selectedCustomer}` : `Trade Overview: ${selectedMonth} ${selectedFY.replace('FY ', '20')}`}
                        </h3>
                        <div className="flex items-center gap-3">
                            <span className="flex gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-slate-200"></span>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Plan</span>
                            </span>
                            <span className="flex gap-1.5 ml-2">
                                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Actual</span>
                            </span>
                        </div>
                    </div>
                    {selectedCustomer && (
                        <button
                            onClick={() => setSelectedCustomer(null)}
                            className="px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95"
                        >
                            ← Back to Overview
                        </button>
                    )}
                </div>

                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={selectedCustomer ? customerTrend : monthlySummary} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 9, fontBold: 900, fill: '#94a3b8' }}
                                dy={15}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 9, fontBold: 900, fill: '#94a3b8' }}
                                tickFormatter={(val) => val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : `${(val / 1000).toFixed(0)}k`}
                            />
                            <Tooltip
                                cursor={{ fill: '#f1f5f9', radius: 10 }}
                                contentStyle={{ borderRadius: '2rem', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '2rem' }}
                                itemStyle={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase' }}
                                labelStyle={{ marginBottom: '1rem', fontSize: '10px', fontWeight: 900, color: '#64748b', letterSpacing: '0.1em' }}
                                formatter={(value: any) => [`PKR ${Number(value).toLocaleString()}`, '']}
                            />
                            <Bar dataKey="Plan" fill="#e2e8f0" radius={[8, 8, 0, 0]} barSize={selectedCustomer ? 40 : 25} />
                            <Bar dataKey="Actual" fill="#2563eb" radius={[8, 8, 0, 0]} barSize={selectedCustomer ? 40 : 25} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Table Section */}
            <div className="bg-white rounded-[4rem] border border-slate-100 shadow-2xl overflow-hidden">
                <div className="p-12 border-b border-slate-50 flex justify-between items-center">
                    <div className="space-y-1">
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] leading-none">Customer Achievement Matrix</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Interactive Data: Select a row to analyze trends</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="px-6 py-3 bg-blue-50 text-blue-700 rounded-2xl text-[10px] font-black uppercase">
                            AVG ACH: {totals.plan > 0 ? ((totals.actual / totals.plan) * 100).toFixed(1) : 0}%
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/30">
                                <th className="px-12 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Customer Name</th>
                                <th className="px-12 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Target (PKR)</th>
                                <th className="px-12 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actual (PKR)</th>
                                <th className="px-12 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Variance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {monthlySummary.map((row, idx) => (
                                <tr
                                    key={idx}
                                    onClick={() => {
                                        setSelectedCustomer(row.name);
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className={`hover:bg-blue-50/50 transition-all cursor-pointer group ${selectedCustomer === row.name ? 'bg-blue-50' : ''}`}
                                >
                                    <td className="px-12 py-8">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{row.category}</span>
                                            <span className="text-xs font-black text-slate-900 uppercase tracking-tight group-hover:text-blue-600 transition-colors">{row.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-12 py-8 text-right text-xs font-black text-slate-400">
                                        {row.Plan.toLocaleString()}
                                    </td>
                                    <td className="px-12 py-8 text-right text-xs font-black text-slate-900">
                                        {row.Actual.toLocaleString()}
                                    </td>
                                    <td className="px-12 py-8 text-right">
                                        <div className="flex items-center justify-end gap-3">
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg ${row.Actual >= row.Plan ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                                {row.Actual >= row.Plan
                                                    ? `+${row.Plan > 0 ? ((row.Actual / row.Plan - 1) * 100).toFixed(0) : '100'}%`
                                                    : `-${(row.Shortfall).toLocaleString()}`
                                                }
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {/* Total Row */}
                            <tr className="bg-slate-900 text-white">
                                <td className="px-12 py-10 text-xs font-black uppercase italic tracking-widest text-blue-400">GRAND TOTAL PERFORMANCE</td>
                                <td className="px-12 py-10 text-right text-xs font-black">{totals.plan.toLocaleString()}</td>
                                <td className="px-12 py-10 text-right text-xs font-black">{totals.actual.toLocaleString()}</td>
                                <td className="px-12 py-10 text-right">
                                    <div className="flex flex-col items-end">
                                        <span className={`text-xs font-black ${totals.actual >= totals.plan ? 'text-green-400' : 'text-red-400'}`}>
                                            {totals.actual >= totals.plan ? 'SURPLUS' : `-${totals.shortfall.toLocaleString()}`}
                                        </span>
                                        <span className="text-[8px] font-bold text-slate-500 uppercase mt-1">Global Variance</span>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
