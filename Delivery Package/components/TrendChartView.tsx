import React from 'react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceLine, Line } from 'recharts';
import { TEAM_COLORS } from '../config.ts';

interface TrendChartViewProps {
    trendData: any[];
    currentMapping: Record<string, string[]>;
}

export const TrendChartView: React.FC<TrendChartViewProps> = ({ trendData, currentMapping }) => {
    return (
        <div className="p-10 animate-in fade-in slide-in-from-right-4">
            <div className="mb-12 flex justify-between items-end">
                <div>
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-2">Operational Achievement Trajectory</h4>
                    <p className="text-white font-black uppercase italic text-2xl tracking-tighter">Divisional Closing Trends</p>
                </div>
                <div className="flex gap-4">
                    {Object.entries(TEAM_COLORS).map(([team, color]) => (
                        <div key={team} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{team}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="h-[450px] w-full bg-slate-900/50 p-8 rounded-3xl border border-white/5 mb-10">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="day" stroke="#475569" fontSize={11} fontWeight="bold" tickLine={false} axisLine={false} label={{ value: 'DAY OF MONTH', position: 'bottom', offset: 0, fill: '#475569', fontSize: 9, fontWeight: 900, letterSpacing: '0.1em' }} />
                        <YAxis stroke="#475569" fontSize={11} fontWeight="bold" tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', fontSize: '11px', fontWeight: 'bold' }} itemStyle={{ color: '#fff' }} />
                        <Legend wrapperStyle={{ paddingTop: '30px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                        <ReferenceLine y={0} stroke="#1e293b" />
                        <Line type="monotone" dataKey="Target" name="AGGREGATE TARGET" stroke="#1e293b" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                        {Object.keys(currentMapping).map(team => (
                            <Line key={team} type="monotone" dataKey={team} name={`${team.toUpperCase()}`} stroke={TEAM_COLORS[team]} strokeWidth={3} dot={{ r: 3, fill: TEAM_COLORS[team], strokeWidth: 1, stroke: '#0b1120' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                        ))}
                        <Line type="monotone" dataKey="TotalAchievement" name="TOTAL GROUP" stroke="#ffffff" strokeWidth={4} strokeDasharray="3 3" dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/5 border border-white/10 p-8 rounded-3xl"><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Master Target</p><p className="text-3xl font-black text-white italic tracking-tighter">{trendData.reduce((sum, d) => sum + d.Target, 0).toLocaleString()}</p></div>
                <div className="bg-white/5 border border-white/10 p-8 rounded-3xl"><p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-4">Total Realized</p><p className="text-3xl font-black text-white italic tracking-tighter">{trendData.reduce((sum, d) => sum + d.TotalAchievement, 0).toLocaleString()}</p></div>
                <div className="bg-green-600 p-8 rounded-3xl shadow-xl shadow-green-900/20"><p className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-4">Final Yield %</p><p className="text-4xl font-black text-white italic tracking-tighter">{(() => { const t = trendData.reduce((sum, d) => sum + d.Target, 0); const a = trendData.reduce((sum, d) => sum + d.TotalAchievement, 0); return t > 0 ? ((a / t) * 100).toFixed(1) : "0.0"; })()}%</p></div>
            </div>
        </div>
    );
};
