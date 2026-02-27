import React, { useEffect, useState } from 'react';
import { generateReportFile, fileToBase64 } from '../services/reportService';
import { generateDailyReportContent } from '../services/geminiService';
import { triggerAutomation, getAutomationConfig } from '../services/automationService';
// Import types
import { DepartmentMismatch, FinanceMismatchReport, ProductionReport } from '../types';

interface ReportSchedulerProps {
    salesData: DepartmentMismatch[];
    financeData: FinanceMismatchReport[];
    productionData: ProductionReport[];
    territoryData: DepartmentMismatch[];
    workingDaysCount: number;
}

export const ReportScheduler: React.FC<ReportSchedulerProps> = ({ salesData, financeData, productionData, territoryData, workingDaysCount }) => {
    const [enabled, setEnabled] = useState(false);
    const [scheduleTime, setScheduleTime] = useState("18:00");
    const [lastRunDate, setLastRunDate] = useState<string | null>(null);

    // Request Notification Permission on Enable
    useEffect(() => {
        if (enabled && Notification.permission !== 'granted') {
            Notification.requestPermission();
        }
    }, [enabled]);

    // Timer Logic
    useEffect(() => {
        if (!enabled) return;

        const checkTime = () => {
            const now = new Date();
            const currentTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            const today = now.toLocaleDateString();

            if (currentTime === scheduleTime && lastRunDate !== today) {
                console.log("Automated trigger activated for", today);
                triggerReport(today);
            }
        };

        const interval = setInterval(checkTime, 60000); // Check every minute
        return () => clearInterval(interval);
    }, [enabled, scheduleTime, lastRunDate, salesData, financeData, productionData, territoryData]);

    const triggerReport = async (today: string) => {
        setLastRunDate(today);

        // 1. Send Notification
        if (Notification.permission === 'granted') {
            const notif = new Notification("📊 Daily Report Ready!", {
                body: "Click to generate and share the PDF report for today.",
                icon: "/vite.svg" // Fallback icon
            });

            notif.onclick = () => {
                window.focus();
                handleGenerateAndShare();
                notif.close();
            };
        } else {
            console.log("Permission not granted. Running silent background automation.");
            handleGenerateAndShare();
        }
    };

    const handleGenerateAndShare = async () => {
        try {
            // Generate Data
            const analysis = await generateDailyReportContent(salesData, financeData, productionData);
            const pdfFile = await generateReportFile(analysis, salesData, financeData, productionData, workingDaysCount);

            // Trigger Share
            if (navigator.share && navigator.canShare({ files: [pdfFile] })) {
                await navigator.share({
                    title: `Swiss Report - ${new Date().toLocaleDateString()}`,
                    text: analysis.whatsappMessage,
                    files: [pdfFile]
                });
            } else {
                // Fallback for Desktop (download and open Link)
                const url = URL.createObjectURL(pdfFile);
                const a = document.createElement('a');
                a.href = url;
                a.download = pdfFile.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                window.open('https://wa.me/?text=' + encodeURIComponent(analysis.whatsappMessage), '_blank');
            }

            // 4. Background WhatsApp Automation (Silent)
            const config = getAutomationConfig();
            if (config.botEnabled && config.webhookUrl) {
                const base64 = await fileToBase64(pdfFile);
                await triggerAutomation(analysis.whatsappMessage, 'report', {
                    base64,
                    filename: pdfFile.name,
                    mimetype: 'application/pdf'
                });
                console.log("WhatsApp Webhook triggered with PDF successfully.");
            }
        } catch (error) {
            console.error("Automation Error:", error);
        }
    };

    return (
        <div className="bg-slate-800 text-white p-6 rounded-3xl shadow-xl border border-slate-700 mt-8">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">🤖</span>
                    <div>
                        <h4 className="font-bold text-lg">Report Automation</h4>
                        <p className="text-xs text-slate-400">Schedule daily WhatsApp reminders</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase px-3 py-1 rounded-full ${enabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                        {enabled ? 'ACTIVE' : 'DISABLED'}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                    </label>
                </div>
            </div>

            {enabled && (
                <div className="flex items-center gap-4 bg-slate-900/50 p-4 rounded-xl animate-in fade-in slide-in-from-top-2">
                    <label className="text-xs font-bold text-slate-300 uppercase">Send Time:</label>
                    <input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="bg-slate-800 text-white text-sm font-mono border-slate-600 rounded-lg focus:ring-green-500 focus:border-green-500"
                    />
                    <button
                        onClick={handleGenerateAndShare}
                        className="ml-auto text-[10px] bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg transition-colors font-bold uppercase"
                    >
                        Test Now
                    </button>
                </div>
            )}
        </div>
    );
};
