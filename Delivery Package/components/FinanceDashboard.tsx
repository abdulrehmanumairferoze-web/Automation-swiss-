
import React, { useState, useMemo } from 'react';
import { FinanceMismatchReport, FinanceCategory, FinanceWeek } from '../types';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LineChart,
    Line,
    Cell
} from 'recharts';

interface FinanceDashboardProps {
    financeData: FinanceMismatchReport[];
}

export const FinanceDashboard: React.FC<FinanceDashboardProps> = ({ financeData }) => {
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const currentFinanceData = useMemo(() => {
        if (!financeData) return null;
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

    const SummaryCard = ({ title, projected, actual, color }: { title: string, projected?: number, actual?: number, color: string }) => {
        const p = projected || 0;
        const a = actual || 0;
        const variance = a - p;
        const percentage = p !== 0 ? (a / p) * 100 : 0;

        return (
            <div className={`p-6 rounded-[2rem] bg-white border border-slate-100 shadow-xl relative overflow-hidden group hover:scale-[1.02] transition-all`}>
                <div className={`absolute top-0 right-0 w-32 h-32 bg-${color}-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-50`}></div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 z-10 relative">{title}</h3>

                <div className="space-y-4 mb-6 relative z-10">
                    <div>
                        <div className="flex justify-between items-baseline mb-1">
                            <p className="text-[10px] uppercase font-bold text-slate-400">Actual</p>
                            <p className={`text-xl font-black text-${color}-600 break-all`}>{formatCurrency(a)}</p>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div className={`h-full bg-${color}-500 rounded-full`} style={{ width: `${Math.min(percentage, 100)}%` }}></div>
                        </div>
                    </div>

                    <div className="flex justify-between items-baseline pt-2">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Projected</p>
                        <p className="text-sm font-bold text-slate-500">{formatCurrency(p)}</p>
                    </div>
                </div>

                <div className="relative z-10 pt-4 border-t border-slate-100 flex justify-between items-center">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 mb-0.5">VARIANCE</p>
                        <p className={`text-xs font-black ${variance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {variance > 0 ? '+' : ''}{formatCurrency(variance)}
                        </p>
                    </div>
                    <div className={`px-3 py-1.5 rounded-lg bg-${percentage >= 100 ? 'green' : 'amber'}-100 text-${percentage >= 100 ? 'green' : 'amber'}-700`}>
                        <p className="text-xs font-black">{percentage.toFixed(1)}%</p>
                    </div>
                </div>
            </div>
        );
    };

    const DetailTable = ({ title, categories, color }: { title: string, categories?: FinanceCategory[], color: string }) => {
        if (!categories || categories.length === 0) return null;

        // Get max weeks to build columns dynamically
        const maxWeeks = Math.max(...categories.map(c => c.weeks ? c.weeks.length : 0), 0);
        if (maxWeeks === 0) return null;

        const weekIndexes = Array.from({ length: maxWeeks }, (_, i) => i);

        return (
            <div className="mt-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
                <div className={`bg-${color}-50/50 p-6 border-b border-${color}-100 flex justify-between items-center`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-8 bg-${color}-500 rounded-full`}></div>
                        <h3 className={`text-xl font-black text-${color}-900 uppercase italic`}>{title}</h3>
                    </div>
                    <span className={`px-4 py-2 bg-${color}-100 text-${color}-700 rounded-xl text-xs font-black uppercase`}>
                        {categories.length} Categories
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="p-4 text-left font-black text-slate-400 uppercase tracking-wider min-w-[220px] sticky left-0 bg-slate-50 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Particulars</th>
                                {weekIndexes.map(idx => (
                                    <th key={idx} className="p-3 text-center font-black text-slate-400 uppercase tracking-wider min-w-[130px]">
                                        <div className="text-[10px] leading-tight mb-2">{categories[0]?.weeks?.[idx]?.weekLabel || `Week ${idx + 1}`}</div>
                                        <div className="flex justify-between text-[8px] text-slate-300 px-2 bg-slate-100 rounded-md py-1">
                                            <span>PROJ</span>
                                            <span>ACT</span>
                                        </div>
                                    </th>
                                ))}
                                <th className="p-4 text-right font-black text-slate-400 uppercase tracking-wider min-w-[110px]">Total Proj</th>
                                <th className="p-4 text-right font-black text-slate-400 uppercase tracking-wider min-w-[110px]">Total Act</th>
                                <th className="p-4 text-center font-black text-slate-400 uppercase tracking-wider w-[80px]">%</th>
                                <th className="p-4 text-left font-black text-slate-400 uppercase tracking-wider min-w-[150px]">Remarks</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {categories
                                .filter(cat => cat.totalActual < cat.totalProjected)
                                .map((cat, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                        <td className="p-4 font-bold text-slate-700 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] max-w-[220px] truncate" title={cat.name}>
                                            {cat.name}
                                        </td>
                                        {weekIndexes.map(wIdx => {
                                            const week = cat.weeks?.[wIdx];
                                            if (!week) return <td key={wIdx} className="p-3 text-center text-slate-300">-</td>;

                                            const isPositive = week.actual >= week.projected;
                                            const bgClass =
                                                week.actual === 0 && week.projected === 0 ? '' :
                                                    isPositive ? 'bg-green-50/30' : 'bg-red-50/30';

                                            return (
                                                <td key={wIdx} className={`p-2 ${bgClass}`}>
                                                    <div className="grid grid-cols-2 gap-1.5 px-1">
                                                        <div className="text-right text-slate-400 font-medium text-[10px]">
                                                            {week.projected > 0 ? formatCurrency(week.projected) : '-'}
                                                        </div>
                                                        <div className={`text-right font-bold text-[10px] ${isPositive ? 'text-slate-700' : 'text-red-600'}`}>
                                                            {week.actual > 0 ? formatCurrency(week.actual) : '-'}
                                                        </div>
                                                    </div>
                                                </td>
                                            );
                                        })}
                                        <td className="p-4 text-right font-medium text-slate-500 text-[11px]">{formatCurrency(cat.totalProjected)}</td>
                                        <td className={`p-4 text-right font-black text-[11px] ${cat.totalActual >= cat.totalProjected ? `text-${color}-600` : 'text-red-500'}`}>
                                            {formatCurrency(cat.totalActual)}
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`px-2 py-1 rounded-lg text-[9px] font-black ${cat.percentage >= 100 ? 'bg-green-100 text-green-700' :
                                                cat.percentage >= 80 ? 'bg-amber-100 text-amber-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                {cat.percentage.toFixed(0)}%
                                            </span>
                                        </td>
                                        <td className="p-4 text-left text-[10px] text-slate-500 max-w-[150px] truncate" title={cat.remarks}>
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
        <div className="p-8 pb-32 space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <h2 className="text-4xl font-black italic text-slate-900 tracking-tighter">FINANCE REPORT</h2>
                    <p className="text-slate-400 font-bold tracking-widest text-xs uppercase mt-1">Cash Flow & Variance Analysis</p>
                </div>

                <div className="flex items-center gap-6 bg-white p-2 pr-6 rounded-3xl shadow-xl border border-slate-100">
                    <div className="flex gap-1">
                        <button onClick={() => handleMonthChange(-1)} className="w-10 h-10 rounded-2xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-colors">
                            <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <div className="px-6 flex flex-col justify-center text-center w-32">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Period</span>
                            <span className="text-sm font-black text-slate-800 uppercase">{monthName} {selectedYear}</span>
                        </div>
                        <button onClick={() => handleMonthChange(1)} className="w-10 h-10 rounded-2xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-colors">
                            <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                </div>
            </div>

            {!currentFinanceData ? (
                <div className="flex flex-col items-center justify-center h-96 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                    <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-6">
                        <span className="text-4xl">📊</span>
                    </div>
                    <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest">No Data Found</h3>
                    <p className="text-slate-400 text-sm mt-2">Upload finance data for {monthName} {selectedYear}</p>
                </div>
            ) : (
                <>
                    {/* Status Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <SummaryCard
                            title="Opening Balance"
                            projected={currentFinanceData.openingBalance?.projected}
                            actual={currentFinanceData.openingBalance?.actual}
                            color="blue"
                        />
                        <SummaryCard
                            title="Total Inflow"
                            projected={currentFinanceData.inflow?.projected}
                            actual={currentFinanceData.inflow?.actual}
                            color="green"
                        />
                        <SummaryCard
                            title="Total Outflow"
                            projected={currentFinanceData.outflow?.projected}
                            actual={currentFinanceData.outflow?.actual}
                            color="purple"
                        />
                        <SummaryCard
                            title="Closing Balance"
                            projected={currentFinanceData.closingBalance?.projected}
                            actual={currentFinanceData.closingBalance?.actual}
                            color="amber"
                        />
                    </div>

                    {/* Projection vs Actual Chart */}
                    <div className="mt-8 bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-xl shadow-lg">📈</div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Totals Verification</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Projected vs Actual Comparison</p>
                            </div>
                        </div>

                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={[
                                        {
                                            name: 'Inflow',
                                            Projected: currentFinanceData.inflow.projected,
                                            Actual: currentFinanceData.inflow.actual,
                                        },
                                        {
                                            name: 'Outflow',
                                            Projected: currentFinanceData.outflow.projected,
                                            Actual: currentFinanceData.outflow.actual,
                                        }
                                    ]}
                                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                    barSize={60}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis
                                        dataKey="name"
                                        stroke="#64748b"
                                        fontSize={12}
                                        fontWeight="bold"
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        stroke="#64748b"
                                        fontSize={11}
                                        fontWeight="bold"
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
                                    />
                                    <Tooltip
                                        cursor={{ fill: '#f1f5f9' }}
                                        contentStyle={{
                                            backgroundColor: '#1e293b',
                                            borderRadius: '12px',
                                            border: 'none',
                                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                        }}
                                        labelStyle={{ color: '#94a3b8', fontWeight: 'bold', marginBottom: '8px' }}
                                        itemStyle={{ fontWeight: 'bold', fontSize: '12px', padding: '2px 0' }}
                                        formatter={(value: any) => [`PKR ${new Intl.NumberFormat('en-PK').format(value)}`, '']}
                                    />
                                    <Legend
                                        wrapperStyle={{ paddingTop: '20px' }}
                                        iconType="circle"
                                        formatter={(value) => <span className="text-xs font-black text-slate-500 uppercase ml-2">{value}</span>}
                                    />
                                    <Bar dataKey="Projected" fill="#cbd5e1" radius={[8, 8, 8, 8]} name="Projected" />
                                    <Bar
                                        dataKey="Actual"
                                        radius={[8, 8, 8, 8]}
                                        name="Actual"
                                    >
                                        {
                                            [
                                                { name: 'Inflow', Projected: 1, Actual: 1 }, // Dummy for mapping
                                                { name: 'Outflow', Projected: 1, Actual: 1 }
                                            ].map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#8b5cf6'} />
                                            ))
                                        }
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Inflow Section */}
                    <DetailTable
                        title="Weekly Inflow Analysis"
                        categories={currentFinanceData.inflowCategories}
                        color="green"
                    />

                    {/* Outflow Section */}
                    <DetailTable
                        title="Weekly Outflow Analysis"
                        categories={currentFinanceData.outflowCategories}
                        color="purple"
                    />
                </>
            )}
        </div>
    );
};
