import React from 'react';
import { MONTH_NAMES } from '../config.ts';

interface AuditCalendarProps {
    selectedYear: number;
    selectedMonth: number;
    monthKey: string;
    holidaysMap: any;
    data: any[];
    currentDept: string;
    focusedDate: number | null;
    onDateSelect: (day: number) => void;
    onMonthChange: (offset: number) => void;
}

export const AuditCalendar: React.FC<AuditCalendarProps> = ({
    selectedYear,
    selectedMonth,
    monthKey,
    holidaysMap,
    data,
    currentDept,
    focusedDate,
    onDateSelect,
    onMonthChange
}) => {
    const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const daysArray: (number | null)[] = [...Array(firstDay).fill(null)];
    for (let i = 1; i <= daysInMonth; i++) daysArray.push(i);

    let monthHolidays = holidaysMap[monthKey] || [];

    return (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-6">
                    <div className="flex gap-2 no-print">
                        <button onClick={() => onMonthChange(-1)} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-600 shadow-sm">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button onClick={() => onMonthChange(1)} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-600 shadow-sm">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">{MONTH_NAMES[selectedMonth]} {selectedYear}</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Operational Pulse Monitoring</p>
                    </div>
                </div>
            </div>

            <div className="p-8">
                <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map(d => (
                        <div key={d} className="bg-slate-50 py-4 text-center text-[10px] font-black text-slate-400 tracking-widest">{d}</div>
                    ))}
                    {daysArray.map((day, idx) => {
                        const isSunday = day && new Date(selectedYear, selectedMonth, day).getDay() === 0;
                        const isHoliday = day && monthHolidays.includes(day);
                        const dStr = day ? (day < 10 ? '0' + day : '' + day) : '';
                        const dayPattern = day ? `${MONTH_NAMES[selectedMonth]} ${dStr}, ${selectedYear}` : '';
                        const hasData = day && data.some(d => d.department === currentDept && d.reportDate && d.reportDate.toLowerCase().includes(dayPattern.toLowerCase()));

                        return (
                            <button
                                key={idx}
                                disabled={!day}
                                onClick={() => day && onDateSelect(day)}
                                className={`h-28 p-4 text-left relative transition-all ${!day ? 'bg-slate-50/50' : isHoliday ? 'bg-red-50/50 text-red-600' : 'bg-white hover:bg-slate-50'} ${focusedDate === day ? 'ring-4 ring-inset ring-red-600 z-10' : ''}`}
                            >
                                <span className={`text-sm font-black ${isHoliday ? 'text-red-600' : 'text-slate-800'}`}>{day || ''}</span>
                                {isHoliday && <span className="block text-[8px] font-bold text-red-400 uppercase tracking-tighter mt-1">{isSunday ? 'OFF (SUN)' : 'HOLIDAY'}</span>}
                                {hasData && !isHoliday && (
                                    <div className="absolute bottom-4 left-4 right-4 flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm shadow-green-200"></div>
                                        <span className="text-[8px] font-black text-green-600 uppercase tracking-tighter">SYNCED</span>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
