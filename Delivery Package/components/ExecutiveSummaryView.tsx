import React from 'react';
import { SummaryResult, DailyReportContent } from '../services/geminiService.ts';
import { generateWhatsAppLink } from '../services/reportService.ts';

interface ExecutiveSummaryViewProps {
    loading: boolean;
    report: SummaryResult | null;
    dailyReportLoading: boolean;
    generatedDailyReport: DailyReportContent | null;
    onGenerateBoardReport: () => void;
    onGenerateDailyReport: () => void;
    onCloseDailyReport: () => void;
    dataCount: number;
}

export const ExecutiveSummaryView: React.FC<ExecutiveSummaryViewProps> = ({
    loading,
    report,
    dailyReportLoading,
    generatedDailyReport,
    onGenerateBoardReport,
    onGenerateDailyReport,
    onCloseDailyReport,
    dataCount
}) => {
    return (
        <div className="py-16 text-center px-6 md:px-10 flex flex-col items-center">
            <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mb-8 p-3 shadow-xl border border-slate-100">
                <div className="w-full h-full flex flex-col items-center justify-center">
                    <svg viewBox="0 0 100 100" className="w-16 h-16">
                        <path
                            d="M 50 5 A 45 45 0 1 1 5 50"
                            fill="none"
                            stroke="#007a33"
                            strokeWidth="10"
                            strokeLinecap="round"
                        />
                        <path
                            d="M 30 40 C 40 30 60 30 70 40 C 80 50 20 60 30 70 C 40 80 65 80 75 70"
                            fill="none"
                            stroke="#007a33"
                            strokeWidth="12"
                            strokeLinecap="round"
                        />
                    </svg>
                    <div className="flex flex-col items-center -mt-1">
                        <span className="text-[12px] font-black tracking-tighter text-slate-800 leading-none">SWISS</span>
                        <span className="text-[3px] font-bold text-slate-500 uppercase tracking-[0.1em] scale-[0.8]">Pharmaceuticals (Pvt) Ltd</span>
                    </div>
                </div>
            </div>
            <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">Swiss Intelligence Audit</h3>
            <p className="text-slate-400 font-bold max-w-sm mt-2 mb-10 uppercase text-[10px] tracking-widest leading-relaxed">
                High-fidelity operational analysis optimized for board-level decision making.
            </p>

            <div className="flex gap-4 mb-10">
                <button
                    disabled={loading}
                    onClick={onGenerateBoardReport}
                    className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                >
                    {loading ? 'ANALYZING AGGREGATES...' : 'GENERATE BOARD REPORT'}
                </button>

                <button
                    disabled={dailyReportLoading}
                    onClick={onGenerateDailyReport}
                    className="bg-green-600 text-white px-12 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-3"
                >
                    {dailyReportLoading ? 'PREPARING PDF...' : <span>WHATSAPP SALES PDF 📱</span>}
                </button>
            </div>

            {generatedDailyReport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-6" onClick={onCloseDailyReport}>
                    <div className="bg-white rounded-3xl p-10 max-w-md w-full shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">✅</div>
                            <h4 className="text-xl font-black text-slate-900 uppercase italic">Report Synchronized</h4>
                            <p className="text-xs text-slate-500 mt-2 font-medium">The daily PDF report has been generated and downloaded.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">MANUAL OPTIONS</p>

                                <button
                                    onClick={onGenerateDailyReport}
                                    className="block w-full bg-slate-900 text-white font-bold py-4 rounded-xl text-center hover:bg-slate-800 transition-all shadow-md text-xs uppercase tracking-widest"
                                >
                                    📥 Download PDF Report
                                </button>

                                <a href={generateWhatsAppLink(generatedDailyReport.whatsappMessage)} target="_blank" rel="noopener noreferrer" className="block w-full bg-[#25D366] text-white font-bold py-4 rounded-xl text-center hover:bg-[#128C7E] transition-all shadow-md text-xs uppercase tracking-widest">
                                    📱 Share via WhatsApp
                                </a>
                            </div>
                        </div>

                        <button onClick={onCloseDailyReport} className="mt-8 w-full py-2 text-xs font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest">Close Overlay</button>
                    </div>
                </div>
            )}

            {report && (
                <div className="mt-12 text-left max-w-5xl w-full mx-auto p-10 md:p-14 bg-[#0b1120] rounded-[3rem] text-white shadow-3xl border border-white/5 animate-in slide-in-from-bottom-5">
                    <div className="flex justify-between items-start mb-10 border-b border-white/10 pb-8">
                        <div>
                            <h4 className="text-[10px] font-black text-green-500 uppercase tracking-[0.4em] mb-3">Executive Summary</h4>
                            <p className="text-xl md:text-2xl font-bold italic leading-relaxed text-slate-100">"{report.executiveSummary}"</p>
                        </div>
                        <div className="bg-white/5 px-6 py-4 rounded-2xl border border-white/10 hidden sm:block">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Audit Insight</p>
                            <p className="text-lg font-black text-white text-center">~{report.readingTimeMinutes} MIN</p>
                        </div>
                    </div>
                    <div className="grid lg:grid-cols-5 gap-12">
                        <div className="lg:col-span-3 space-y-6">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-l-2 border-green-600 pl-4">Detailed Intelligence:</p>
                            <div className="text-sm md:text-base text-slate-300 leading-relaxed space-y-4 prose prose-invert max-w-none">
                                {report.detailedAnalysis.split('\n').map((para, i) => para.trim() ? <p key={i}>{para}</p> : null)}
                            </div>
                        </div>
                        <div className="lg:col-span-2 space-y-8">
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 border-l-2 border-green-600 pl-4">Strategic Actions:</p>
                                <div className="space-y-4">
                                    {report.actions.map((a, i) => (
                                        <div key={i} className="flex gap-4 items-start bg-white/5 p-5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                                            <span className="w-8 h-8 rounded-xl bg-green-700 text-[10px] flex shrink-0 items-center justify-center font-black">{i + 1}</span>
                                            <span className="text-xs font-bold uppercase tracking-tight text-slate-200 pt-1.5">{a}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-green-600/10 border border-green-600/20 p-6 rounded-2xl">
                                <p className="text-[10px] font-black text-green-400 uppercase tracking-widest mb-1">Compliance Audit</p>
                                <p className="text-[10px] text-slate-400 font-medium">Analyzing {dataCount} operational line-items.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
