import React from 'react';
import { DepartmentMismatch } from '../types.ts';
import { MONTH_NAMES } from '../config.ts';
import { getAutomationConfig } from '../services/automationService.ts';

interface ShortfallListProps {
    // ... (rest of the imports/interfaces are assumed same, but I'll provide the specific component logic)
    currentDept: string;
    focusedDate: number;
    selectedMonth: number;
    selectedYear: number;
    data: DepartmentMismatch[];
    currentMapping: Record<string, string[]>;
    getDailyTarget: (plan: number, day: number) => number;
    isLastDayOfMonth: boolean;
    searchTerm: string;
    selectedMetric: string | null;
    onMetricSelect: (metric: string) => void;
}

export const ShortfallList: React.FC<ShortfallListProps> = ({
    currentDept,
    focusedDate,
    selectedMonth,
    selectedYear,
    data,
    currentMapping,
    getDailyTarget,
    isLastDayOfMonth,
    searchTerm,
    selectedMetric,
    onMetricSelect
}) => {
    const dStr = focusedDate < 10 ? '0' + focusedDate : focusedDate;
    const dayPattern = `${MONTH_NAMES[selectedMonth]} ${dStr}, ${selectedYear}`;
    const masterMonthPattern = `MASTER_${MONTH_NAMES[selectedMonth]}_${selectedYear}`;
    const hasDailyReport = data.some(d => d.department === currentDept && d.reportDate && d.reportDate.toLowerCase().includes(dayPattern.toLowerCase()));

    if (!hasDailyReport) {
        return (
            <div className="p-32 text-center bg-slate-900/40">
                <div className="w-20 h-20 bg-amber-900/20 text-amber-500 rounded-full flex items-center justify-center text-4xl mx-auto mb-8 shadow-inner animate-pulse">📅</div>
                <h4 className="text-xl font-black text-amber-500 uppercase italic tracking-tight">Daily Achievement is Not Available</h4>
                <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em] mt-4 max-w-sm mx-auto leading-relaxed">No synchronization record was found for {dayPattern}.</p>
            </div>
        );
    }

    return (
        <div className="max-h-[600px] overflow-auto scrollbar-thin">
            {Object.keys(currentMapping).map(team => {
                const masterRows = data.filter(d =>
                    d.department === currentDept &&
                    d.team === team &&
                    d.plan > 0 &&
                    d.reportDate === masterMonthPattern
                );

                if (masterRows.length === 0) return null;

                const shortfallRows = masterRows.filter(r => {
                    const dailyMatch = data.find(d => d.department === currentDept && d.metric === r.metric && d.reportDate?.toLowerCase().includes(dayPattern.toLowerCase()));
                    const achieved = dailyMatch ? dailyMatch.actual : 0;
                    const dailyTarget = getDailyTarget(r.plan, focusedDate);

                    // Filter by search term
                    const matchesSearch = r.metric.toLowerCase().includes(searchTerm.toLowerCase());
                    return (dailyTarget - achieved) > 0 && matchesSearch;
                });

                if (shortfallRows.length === 0) return null;

                return (
                    <div key={team} className="p-10 border-b border-white/5 last:border-0">
                        <h4 className="text-white font-black uppercase mb-8 flex items-center gap-4 tracking-tighter italic">
                            <span className="w-1.5 h-6 bg-red-600 rounded-full shadow-lg shadow-red-900"></span> {team} {isLastDayOfMonth ? 'FINAL DAY' : ''} SHORTFALL
                        </h4>
                        <table className="w-full text-left border-collapse">
                            <thead className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/10">
                                <tr>
                                    <th className="pb-6 px-4">{currentDept === 'Sales' ? 'PRODUCT NAME' : 'TERRITORY'}</th>
                                    <th className="pb-6 px-4 text-right">TREND TARGET</th>
                                    <th className="pb-6 px-4 text-right">ACHIEVED</th>
                                    <th className="pb-6 px-4 text-right">GAP</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {shortfallRows.map((r, i) => {
                                    const dailyTarget = getDailyTarget(r.plan, focusedDate);
                                    const dailyMatch = data.find(d => d.department === currentDept && d.metric === r.metric && d.reportDate?.toLowerCase().includes(dayPattern.toLowerCase()));
                                    const achieved = dailyMatch ? dailyMatch.actual : 0;
                                    const shortfall = dailyTarget - achieved;
                                    const isSelected = selectedMetric === r.metric;

                                    const config = getAutomationConfig();
                                    const isCritical = shortfall >= config.shortfallCriticalThreshold;
                                    const isWarning = shortfall >= config.shortfallWarningThreshold && shortfall < config.shortfallCriticalThreshold;

                                    const gapColorClass = isCritical ? 'text-red-500' : isWarning ? 'text-yellow-500' : 'text-orange-500';
                                    const borderClass = isCritical ? 'border-red-600' : isWarning ? 'border-yellow-600' : 'border-orange-600';
                                    const bgClass = isCritical ? 'bg-red-600/20' : isWarning ? 'bg-yellow-600/20' : 'bg-orange-600/20';

                                    return (
                                        <tr
                                            key={i}
                                            onClick={() => onMetricSelect(r.metric)}
                                            className={`group cursor-pointer transition-all ${isSelected ? `${bgClass} border-l-4 ${borderClass}` : 'hover:bg-white/5'}`}
                                        >
                                            <td className="py-5 px-4">
                                                <div className="flex flex-col">
                                                    <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-300'} group-hover:text-white`}>{r.metric}</span>
                                                    {isSelected && <span className={`text-[8px] font-black ${gapColorClass} uppercase tracking-widest mt-1`}>Drill-down active</span>}
                                                </div>
                                            </td>
                                            <td className="py-5 px-4 text-right text-slate-500 font-mono text-[10px]">{dailyTarget.toLocaleString()}</td>
                                            <td className="py-5 px-4 text-right font-mono font-black text-base text-white/40">{achieved.toLocaleString()}</td>
                                            <td className={`py-5 px-4 text-right font-mono font-black text-lg ${gapColorClass}`}>-{shortfall.toLocaleString()}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                );
            })}
        </div>
    );
};
