
import React, { useState, useMemo } from 'react';
import { ProductionReport, ProductionHolidaysMap } from '../types.ts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

interface ProductionDashboardProps {
    data: ProductionReport[];
    holidaysMap: ProductionHolidaysMap;
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const ProductionDashboard: React.FC<ProductionDashboardProps> = ({ data, holidaysMap }) => {
    const [viewDate, setViewDate] = useState(new Date());
    const [focusedDate, setFocusedDate] = useState<number | null>(null);
    const [auditView, setAuditView] = useState<'daily' | 'trend'>('daily');

    const selectedMonth = viewDate.getMonth();
    const selectedYear = viewDate.getFullYear();
    const monthKey = `${selectedYear}-${selectedMonth}`;
    const currentMonthName = MONTH_NAMES[selectedMonth];

    const currentProductionData = data.find(d => d.monthKey === monthKey);

    const handleMonthChange = (offset: number) => {
        setViewDate(new Date(selectedYear, selectedMonth + offset, 1));
        setFocusedDate(null);
        setAuditView('daily');
    };

    const isLastDay = (year: number, month: number, day: number) => {
        const nextDay = new Date(year, month, day + 1);
        return nextDay.getMonth() !== month;
    };

    const isLastDayOfMonth = useMemo(() => {
        if (!focusedDate) return false;
        return isLastDay(selectedYear, selectedMonth, focusedDate);
    }, [focusedDate, selectedMonth, selectedYear]);

    // Calendar rendering
    const renderCalendar = () => {
        const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();
        const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        const daysArray: (number | null)[] = [...Array(firstDay).fill(null)];
        for (let i = 1; i <= daysInMonth; i++) daysArray.push(i);

        const monthHolidays = holidaysMap[monthKey] || [];

        const hasData = currentProductionData !== undefined;

        return (
            <div className="p-10">
                <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
                    {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map(d => (
                        <div key={d} className="bg-slate-50 py-4 text-center text-[10px] font-black text-slate-400 tracking-widest">{d}</div>
                    ))}
                    {daysArray.map((day, idx) => {
                        const isSunday = day && new Date(selectedYear, selectedMonth, day).getDay() === 0;
                        const isHoliday = day && monthHolidays.includes(day);
                        const dayHasData = day && hasData && currentProductionData.particulars.some(p =>
                            p.dailyData[day - 1]?.achieved > 0
                        );

                        return (
                            <button
                                key={idx}
                                disabled={!day}
                                onClick={() => { setFocusedDate(day); setAuditView('daily'); }}
                                className={`h-32 p-4 text-left relative transition-all ${!day ? 'bg-slate-50/50' : isHoliday ? 'bg-red-50/80 text-red-600' : 'bg-white hover:bg-slate-50 hover:shadow-inner'} ${focusedDate === day ? 'ring-4 ring-inset ring-green-600 z-10' : ''}`}
                            >
                                <span className={`text-sm font-black ${isHoliday ? 'text-red-600' : 'text-slate-800'}`}>{day || ''}</span>
                                {isHoliday && <span className="block text-[8px] font-bold text-red-400 uppercase tracking-tighter mt-1">{isSunday ? 'OFF (SUN)' : 'HOLIDAY'}</span>}
                                {dayHasData && !isHoliday && (
                                    <div className="absolute bottom-4 left-4 right-4 flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm shadow-green-200 animate-pulse"></div>
                                        <span className="text-[9px] font-black text-green-600 uppercase tracking-tighter">DATA SYNCED</span>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    // Daily performance chart
    const getDailyChartData = (day: number) => {
        if (!currentProductionData) return [];

        return currentProductionData.particulars.map(p => {
            const dayData = p.dailyData[day - 1];
            return {
                name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
                Planned: Math.round(dayData?.planned || 0),
                Achieved: Math.round(dayData?.achieved || 0)
            };
        });
    };

    // Monthly trend data
    const getMonthlyTrendData = () => {
        if (!currentProductionData) return [];

        const daysInMonth = currentProductionData.daysInMonth;
        const trendData = [];

        for (let day = 1; day <= daysInMonth; day++) {
            let totalPlanned = 0;
            let totalAchieved = 0;

            currentProductionData.particulars.forEach(p => {
                const dayData = p.dailyData[day - 1];
                totalPlanned += dayData?.planned || 0;
                totalAchieved += dayData?.achieved || 0;
            });

            trendData.push({
                day,
                Planned: Math.round(totalPlanned),
                Achieved: Math.round(totalAchieved)
            });
        }

        return trendData;
    };

    return (
        <div className="bg-white">
            {/* Header */}
            <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                <div className="flex items-center gap-6">
                    <div className="flex gap-2 no-print">
                        <button onClick={() => handleMonthChange(-1)} className="w-10 h-10 rounded-xl bg-slate-200/50 flex items-center justify-center hover:bg-slate-200 transition-colors text-slate-600">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button onClick={() => handleMonthChange(1)} className="w-10 h-10 rounded-xl bg-slate-200/50 flex items-center justify-center hover:bg-slate-200 transition-colors text-slate-600">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">{currentMonthName} {selectedYear}</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Production Performance Dashboard</p>
                    </div>
                </div>
            </div>

            {/* Calendar */}
            {renderCalendar()}

            {/* No Data Message */}
            {!currentProductionData && (
                <div className="p-32 text-center">
                    <div className="w-24 h-24 bg-green-900/20 text-green-500 rounded-full flex items-center justify-center text-5xl mx-auto mb-8 shadow-inner animate-pulse">📊</div>
                    <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">No Production Data Available</h4>
                    <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em] mt-4 max-w-sm mx-auto leading-relaxed">
                        Upload production data for {currentMonthName} {selectedYear} via Data Entry → Production
                    </p>
                </div>
            )}

            {/* Focused Day Details */}
            {focusedDate && currentProductionData && (
                <div className="px-10 pb-20 animate-in fade-in slide-in-from-bottom-5">
                    <div className="bg-[#0b1120] rounded-[3rem] overflow-hidden shadow-4xl border border-white/5">
                        <div className="p-10 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-slate-900 to-slate-800">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center text-xl shadow-xl">📊</div>
                                <div>
                                    <h3 className="text-xl font-black text-white uppercase italic tracking-tight">PRODUCTION AUDIT - {currentMonthName} {focusedDate}, {selectedYear}</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Daily Plan vs Achievement Analysis</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                {isLastDayOfMonth && (
                                    <div className="flex bg-white/5 rounded-xl p-1 border border-white/10 no-print">
                                        <button
                                            onClick={() => setAuditView('daily')}
                                            className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${auditView === 'daily' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            Daily View
                                        </button>
                                        <button
                                            onClick={() => setAuditView('trend')}
                                            className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${auditView === 'trend' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            Monthly Trend
                                        </button>
                                    </div>
                                )}
                                <button onClick={() => setFocusedDate(null)} className="text-white/40 hover:text-white text-xs font-black uppercase tracking-widest px-6 py-3 border border-white/10 rounded-xl transition-all hover:bg-white/5 shadow-xl">EXIT REPORT</button>
                            </div>
                        </div>

                        {auditView === 'daily' ? (
                            <>
                                {/* Daily Chart */}
                                <div className="p-10 bg-slate-900/40 border-b border-white/5">
                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-8">Daily Performance Breakdown</h4>
                                    <div className="h-[320px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={getDailyChartData(focusedDate)} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                                <XAxis dataKey="name" stroke="#475569" fontSize={11} fontWeight="bold" tickLine={false} axisLine={false} />
                                                <YAxis stroke="#475569" fontSize={11} fontWeight="bold" tickLine={false} axisLine={false} />
                                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', fontSize: '11px', fontWeight: 'bold' }} itemStyle={{ color: '#fff' }} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                                <Legend wrapperStyle={{ paddingTop: '25px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                                                <Bar dataKey="Planned" name="DAILY PLAN" fill="#1e293b" radius={[6, 6, 0, 0]} barSize={45} />
                                                <Bar dataKey="Achieved" name="ACTUAL ACHIEVED" fill="#16a34a" radius={[6, 6, 0, 0]} barSize={45} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Particulars Table */}
                                <div className="max-h-[600px] overflow-auto scrollbar-thin">
                                    <div className="p-10">
                                        <h4 className="text-white font-black uppercase mb-8 flex items-center gap-4 tracking-tighter italic">
                                            <span className="w-2 h-8 bg-green-600 rounded-full shadow-lg shadow-green-900"></span> PRODUCTION PARTICULARS
                                        </h4>
                                        <table className="w-full text-left border-collapse">
                                            <thead className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/10">
                                                <tr>
                                                    <th className="pb-6 px-4">PARTICULAR</th>
                                                    <th className="pb-6 px-4 text-right">DAILY PLAN</th>
                                                    <th className="pb-6 px-4 text-right">ACHIEVED</th>
                                                    <th className="pb-6 px-4 text-right">VARIANCE</th>
                                                    <th className="pb-6 px-4 text-right">%</th>
                                                    <th className="pb-6 px-4 text-left">REMARKS</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {currentProductionData.particulars
                                                    .filter(particular => {
                                                        const dayData = particular.dailyData[focusedDate - 1];
                                                        return (dayData?.achieved || 0) < (dayData?.planned || 0);
                                                    })
                                                    .map((particular, i) => {
                                                        const dayData = particular.dailyData[focusedDate - 1];
                                                        const variance = dayData.variance;
                                                        const isShortfall = variance < 0;

                                                        return (
                                                            <tr key={i} className={`group ${isShortfall ? 'bg-red-900/40 border-l-4 border-red-600' : 'bg-green-900/20 border-l-4 border-green-600'} transition-all`}>
                                                                <td className="py-6 px-4 text-sm text-slate-300 font-bold group-hover:text-white transition-colors">{particular.name}</td>
                                                                <td className="py-6 px-4 text-right text-slate-500 font-mono text-xs">{Math.round(dayData.planned).toLocaleString()}</td>
                                                                <td className="py-6 px-4 text-right font-mono font-black text-lg text-white/40">{Math.round(dayData.achieved).toLocaleString()}</td>
                                                                <td className={`py-6 px-4 text-right font-mono font-black text-xl ${isShortfall ? 'text-red-500' : 'text-green-500'}`}>
                                                                    {isShortfall ? '-' : '+'}{Math.abs(Math.round(variance)).toLocaleString()}
                                                                </td>
                                                                <td className={`py-6 px-4 text-right font-mono font-black text-lg ${dayData.percentage >= 100 ? 'text-green-400' : dayData.percentage >= 80 ? 'text-amber-400' : 'text-red-400'}`}>
                                                                    {dayData.percentage.toFixed(1)}%
                                                                </td>
                                                                <td className="py-6 px-4 text-left text-xs text-slate-500 max-w-[150px] truncate" title={particular.remarks}>
                                                                    {particular.remarks || '-'}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        ) : (
                            /* Monthly Trend View */
                            <div className="p-10 animate-in fade-in slide-in-from-right-4">
                                <div className="mb-12">
                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-2">Monthly Production Trajectory</h4>
                                    <p className="text-white font-black uppercase italic text-2xl tracking-tighter">Complete Month Analysis</p>
                                </div>
                                <div className="h-[450px] w-full bg-slate-900/50 p-8 rounded-[2rem] border border-white/5 mb-10">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={getMonthlyTrendData()} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                            <XAxis dataKey="day" stroke="#475569" fontSize={11} fontWeight="bold" tickLine={false} axisLine={false} label={{ value: 'DAY OF MONTH', position: 'bottom', offset: 0, fill: '#475569', fontSize: 9, fontWeight: 900, letterSpacing: '0.1em' }} />
                                            <YAxis stroke="#475569" fontSize={11} fontWeight="bold" tickLine={false} axisLine={false} />
                                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', fontSize: '11px', fontWeight: 'bold' }} itemStyle={{ color: '#fff' }} />
                                            <Legend wrapperStyle={{ paddingTop: '30px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                                            <Line type="monotone" dataKey="Planned" name="DAILY PLAN" stroke="#1e293b" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                                            <Line type="monotone" dataKey="Achieved" name="ACTUAL PRODUCTION" stroke="#16a34a" strokeWidth={3} dot={{ r: 3, fill: '#16a34a', strokeWidth: 1, stroke: '#0b1120' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="bg-white/5 border border-white/10 p-8 rounded-[2rem]">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Total Plan</p>
                                        <p className="text-3xl font-black text-white italic tracking-tighter">{currentProductionData.totalMonthlyPlan.toLocaleString()}</p>
                                    </div>
                                    <div className="bg-white/5 border border-white/10 p-8 rounded-[2rem]">
                                        <p className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-4">Total Achieved</p>
                                        <p className="text-3xl font-black text-white italic tracking-tighter">{currentProductionData.totalAchieved.toLocaleString()}</p>
                                    </div>
                                    <div className="bg-green-600 p-8 rounded-[2rem] shadow-xl shadow-green-900/20">
                                        <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-4">Achievement %</p>
                                        <p className="text-4xl font-black text-white italic tracking-tighter">{currentProductionData.overallPercentage.toFixed(1)}%</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
