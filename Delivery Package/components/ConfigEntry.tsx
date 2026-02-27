import React from 'react';
import { MONTH_NAMES } from '../config.ts';
import { ReportScheduler } from './ReportScheduler.tsx';
import { getAutomationConfig, saveAutomationConfig, AutomationConfig } from '../services/automationService.ts';
import { useState, useEffect } from 'react';

interface ConfigEntryProps {
    isAdminMode: boolean;
    onAdminLogin: (pin: string) => void;
    onResetData: () => void;
    data: any[];
    financeData: any[];
    productionData: any[];
    monthName: string;
    selectedYear: number;
    workingDaysCount: number;
}

export const ConfigEntry: React.FC<ConfigEntryProps> = ({
    isAdminMode,
    onAdminLogin,
    onResetData,
    data,
    financeData,
    productionData,
    monthName,
    selectedYear,
    workingDaysCount
}) => {
    const [config, setConfig] = useState<AutomationConfig>(getAutomationConfig());

    const updateConfig = (updates: Partial<AutomationConfig>) => {
        const newConfig = { ...config, ...updates };
        setConfig(newConfig);
        saveAutomationConfig(newConfig);
    };
    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center space-y-3">
                <h3 className="text-2xl font-black italic text-slate-900 uppercase tracking-tight">System Configuration</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Operational Controls & Security</p>
            </div>

            <div className="bg-slate-50 rounded-[3rem] p-8 md:p-12 border border-slate-200 space-y-12">
                <ReportScheduler
                    salesData={data.filter(d => !d.department?.toLowerCase().includes('territory') && d.department !== 'Production')}
                    financeData={financeData}
                    productionData={productionData}
                    territoryData={data.filter(d => d.department?.toLowerCase().includes('territory')) as any}
                    workingDaysCount={workingDaysCount}
                />

                <div className="grid md:grid-cols-2 gap-6 md:gap-8">
                    <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between min-h-[300px]">
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center text-lg">🔐</div>
                                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Administrator Portal</h4>
                            </div>
                            <p className="text-xs text-slate-500 font-medium mb-8 leading-relaxed max-w-xs">Elevate privileges to unlock destructive actions and system-wide overrides.</p>
                        </div>

                        <div className="flex items-center gap-4">
                            {!isAdminMode ? (
                                <input
                                    type="password"
                                    placeholder="PROTECTION PIN"
                                    className="bg-slate-50 border-none rounded-2xl px-6 py-4 text-xs font-black tracking-widest w-full focus:ring-4 focus:ring-slate-100 transition-all uppercase placeholder:text-slate-300"
                                    onChange={(e) => {
                                        if (e.target.value === '1234') onAdminLogin(e.target.value);
                                    }}
                                />
                            ) : (
                                <div className="flex-1 bg-green-50 text-green-700 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-green-100 flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                    ADMINISTRATOR ACCESS ACTIVE
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={`bg-red-50 p-8 md:p-10 rounded-[2.5rem] border border-red-100 relative overflow-hidden transition-all min-h-[300px] ${!isAdminMode ? 'opacity-50 grayscale' : 'shadow-xl shadow-red-100'}`}>
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-red-600 text-white rounded-xl flex items-center justify-center text-lg">⚠️</div>
                                <h4 className="text-sm font-black text-red-900 uppercase tracking-widest font-black">Emergency Reset</h4>
                            </div>
                            <p className="text-xs text-red-700/70 font-bold mb-8 leading-relaxed max-w-xs uppercase tracking-tighter">
                                Permanently purge all operational data from the secure database.
                            </p>
                            <button
                                disabled={!isAdminMode}
                                onClick={onResetData}
                                className="bg-red-600 text-white px-8 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-red-200 hover:bg-red-700 active:scale-95 transition-all w-full disabled:opacity-50"
                            >
                                FACTORY DATA WIPE
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 text-white p-10 rounded-[3rem] border border-white/5 space-y-8 shadow-2xl">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-green-500/20">🤖</div>
                        <div>
                            <h4 className="text-lg font-black italic uppercase tracking-wider">AI WhatsApp Gateway</h4>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Autonomous Reporting & Bot Integration</p>
                        </div>
                        <div className="ml-auto flex items-center gap-3">
                            <span className={`text-[10px] font-black px-4 py-1.5 rounded-full ${config.botEnabled ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                                {config.botEnabled ? 'GATEWAY ACTIVE' : 'GATEWAY STANDBY'}
                            </span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={config.botEnabled} onChange={(e) => updateConfig({ botEnabled: e.target.checked })} className="sr-only peer" />
                                <div className="w-14 h-7 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-green-600 after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                            </label>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8 pt-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Bot Webhook Endpoint</label>
                            <input
                                type="text"
                                value={config.webhookUrl}
                                onChange={(e) => updateConfig({ webhookUrl: e.target.value })}
                                placeholder="http://localhost:3000/webhook"
                                className="w-full bg-slate-800/50 border border-white/5 rounded-2xl px-6 py-4 text-xs font-mono text-green-400 focus:ring-2 focus:ring-green-500/50 transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Target WhatsApp Number</label>
                            <input
                                type="text"
                                value={config.targetPhone}
                                onChange={(e) => updateConfig({ targetPhone: e.target.value })}
                                placeholder="923001234567"
                                className="w-full bg-slate-800/50 border border-white/5 rounded-2xl px-6 py-4 text-xs font-mono text-white focus:ring-2 focus:ring-slate-700 transition-all"
                            />
                        </div>
                    </div>

                    <div className="pt-8 border-t border-white/5">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center text-lg shadow-lg shadow-red-500/20">🎨</div>
                            <div>
                                <h4 className="text-sm font-black italic uppercase tracking-wider text-white">Shortfall Color Coding</h4>
                                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Visual performance thresholds for Sales OPS</p>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-red-500 uppercase tracking-widest ml-4">Critical Threshold (Red)</label>
                                <div className="relative">
                                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-red-500/50 font-black text-xs">&gt;</span>
                                    <input
                                        type="number"
                                        value={config.shortfallCriticalThreshold}
                                        onChange={(e) => updateConfig({ shortfallCriticalThreshold: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-slate-800/50 border border-white/5 rounded-2xl px-12 py-4 text-xs font-mono text-red-400 focus:ring-2 focus:ring-red-500/50 transition-all"
                                    />
                                </div>
                                <p className="text-[8px] text-slate-600 font-bold uppercase tracking-tighter ml-4">Highlight gaps above this value in red</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-yellow-500 uppercase tracking-widest ml-4">Warning Threshold (Yellow)</label>
                                <div className="relative">
                                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-yellow-500/50 font-black text-xs">&gt;</span>
                                    <input
                                        type="number"
                                        value={config.shortfallWarningThreshold}
                                        onChange={(e) => updateConfig({ shortfallWarningThreshold: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-slate-800/50 border border-white/5 rounded-2xl px-12 py-4 text-xs font-mono text-yellow-400 focus:ring-2 focus:ring-yellow-500/50 transition-all"
                                    />
                                </div>
                                <p className="text-[8px] text-slate-600 font-bold uppercase tracking-tighter ml-4">Highlight gaps above this value in yellow</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
