import React from 'react';
import { ResponsiveContainer, ComposedChart, Bar, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceLine, Cell } from 'recharts';
import { TEAM_COLORS } from '../config.ts';

interface TrendChartViewProps {
    trendData: any[];
    currentMapping: Record<string, string[]>;
}



interface TrendChartViewProps {
    teamTrends: {
        teamName: string;
        target: number;
        achieved: number;
        dailyData: any[]; // { day, target, actual, isProjection }
        insight: { text: string; tone: 'positive' | 'neutral' | 'warning' };
    }[];
}

export const TrendChartView: React.FC<TrendChartViewProps> = ({ teamTrends }) => {
    return (
        <div className="p-10 animate-in fade-in slide-in-from-right-4 space-y-20">
            <div className="flex justify-between items-end border-b border-white/10 pb-8">
                <div>
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-2">Operational Achievement Trajectory</h4>
                    <p className="text-white font-black uppercase italic text-2xl tracking-tighter">Divisional Closing Trends</p>
                </div>
                <div className="flex gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-white"></div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Actual Sales</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-md bg-white/10 border border-dashed border-white/40"></div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ghost Projection</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-1 bg-[#1e293b] rounded-full"></div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Target Pace</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-16">
                {teamTrends.map((team, idx) => {
                    // Calculate quick stats for header
                    const percent = team.target > 0 ? (team.achieved / team.target) * 100 : 0;
                    const isWarning = team.insight.tone === 'warning';
                    const toneColor = isWarning ? 'text-red-500' : (team.insight.tone === 'positive' ? 'text-green-500' : 'text-blue-400');
                    const toneBg = isWarning ? 'bg-red-500/10 border-red-500/20' : (team.insight.tone === 'positive' ? 'bg-green-500/10 border-green-500/20' : 'bg-blue-500/10 border-blue-500/20');

                    return (
                        <div key={team.teamName} className="bg-slate-900/50 p-8 rounded-[3rem] border border-white/5 shadow-2xl relative overflow-hidden group">
                            {/* Team Header */}
                            <div className="flex justify-between items-start mb-8 px-4">
                                <div>
                                    <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase mb-1">{team.teamName}</h3>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                        Target: {team.target.toLocaleString()} | Achieved: <span className="text-white">{team.achieved.toLocaleString()}</span>
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className={`text-4xl font-black italic tracking-tighter ${percent >= 100 ? 'text-green-500' : 'text-white'}`}>
                                        {percent.toFixed(1)}%
                                    </p>
                                </div>
                            </div>

                            {/* Chart */}
                            <div className="h-[350px] w-full mb-8">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={team.dailyData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.4} />
                                        <XAxis dataKey="day" stroke="#64748b" fontSize={10} fontWeight="900" tickLine={false} axisLine={false} interval={0} />
                                        <YAxis
                                            stroke="#64748b"
                                            fontSize={10}
                                            fontWeight="900"
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(val) => {
                                                const maxVal = Math.max(...team.dailyData.map((d: any) => Math.max(d.actual, d.target)));
                                                if (maxVal < 1000) return val;
                                                return `${(val / 1000).toFixed(1)}k`;
                                            }}
                                        />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}
                                            itemStyle={{ color: '#fff' }}
                                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                            labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                                        />
                                        <Bar dataKey="actual" name="Sales" radius={[4, 4, 0, 0]} barSize={20}>
                                            {team.dailyData.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={entry.isProjection ? 'transparent' : (TEAM_COLORS[team.teamName] || '#fff')}
                                                    stroke={entry.isProjection ? '#fff' : 'none'}
                                                    strokeDasharray={entry.isProjection ? '4 4' : '0'}
                                                    strokeOpacity={entry.isProjection ? 0.3 : 1}
                                                    fillOpacity={entry.isProjection ? 0 : 1}
                                                />
                                            ))}
                                        </Bar>
                                        <Line type="monotone" dataKey="target" name="Daily Target" stroke="#475569" strokeWidth={2} dot={false} strokeDasharray="4 4" opacity={0.5} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Insight Text Component */}
                            <div className={`p-6 rounded-2xl border ${toneBg} flex items-start gap-4 mx-4`}>
                                <div className={`text-2xl ${toneColor}`}>
                                    {isWarning ? '⚠️' : (team.insight.tone === 'positive' ? '🚀' : '💡')}
                                </div>
                                <div>
                                    <p className={`text-sm font-bold ${toneColor} leading-relaxed`}>
                                        {team.insight.text}
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


