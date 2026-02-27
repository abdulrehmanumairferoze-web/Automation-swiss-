import React, { useState, useMemo } from 'react';
import { DepartmentMismatch, HolidaysMap, FinanceMismatchReport, ProductionReport, ProductionHolidaysMap } from '../types.ts';
import { summarizeOperations, SummaryResult, generateDailyReportContent, DailyReportContent } from '../services/geminiService.ts';
import { generateDailyPDF, generateReportFile, fileToBase64 } from '../services/reportService.ts';
import { triggerAutomation, getAutomationConfig } from '../services/automationService.ts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { FinanceDashboard } from './FinanceDashboard.tsx';
import { ProductionDashboard } from './ProductionDashboard.tsx';
import { AuditCalendar } from './AuditCalendar.tsx';
import { ShortfallList } from './ShortfallList.tsx';
import { ExecutiveSummaryView } from './ExecutiveSummaryView.tsx';
import { TrendChartView } from './TrendChartView.tsx';
import { PRODUCT_MAPPING, TERRITORY_MAPPING, TEAM_COLORS, MONTH_NAMES } from '../config.ts';

interface DashboardProps {
  data: DepartmentMismatch[];
  onDataUpdate: (data: DepartmentMismatch[]) => void;
  holidaysMap: HolidaysMap;
  financeData: FinanceMismatchReport[];
  productionData: ProductionReport[];
  productionHolidaysMap: ProductionHolidaysMap;
}

export const Dashboard: React.FC<DashboardProps> = ({ data, holidaysMap, financeData, productionData, productionHolidaysMap }) => {
  const [report, setReport] = useState<SummaryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeSheet, setActiveSheet] = useState<string>('Executive Summary');
  const [auditView, setAuditView] = useState<'divisions' | 'trend'>('divisions');

  const [dailyReportLoading, setDailyReportLoading] = useState(false);
  const [generatedDailyReport, setGeneratedDailyReport] = useState<DailyReportContent | null>(null);

  const [viewDate, setViewDate] = useState(new Date());
  const selectedMonth = viewDate.getMonth();
  const selectedYear = viewDate.getFullYear();
  const monthKey = `${selectedYear}-${selectedMonth}`;

  const [focusedDate, setFocusedDate] = useState<number | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const isLastDay = (year: number, month: number, day: number) => {
    const nextDay = new Date(year, month, day + 1);
    return nextDay.getMonth() !== month;
  };

  const isLastDayOfMonth = focusedDate ? isLastDay(selectedYear, selectedMonth, focusedDate) : false;

  const workingDaysCount = useMemo(() => {
    let hols = holidaysMap[monthKey] || [];
    let count = 0;
    const date = new Date(selectedYear, selectedMonth, 1);
    while (date.getMonth() === selectedMonth) {
      const dayNum = date.getDate();
      if (!hols.includes(dayNum)) count++;
      date.setDate(date.getDate() + 1);
    }
    return count || 26;
  }, [selectedMonth, selectedYear, holidaysMap, monthKey]);

  const getDailyTarget = (totalPlan: number, day: number) => {
    const isClosingDay = isLastDay(selectedYear, selectedMonth, day);
    const weightOfLastDay = 3.5;
    const totalWeights = (workingDaysCount - 1) + weightOfLastDay;

    if (isClosingDay) {
      return Math.round((totalPlan / totalWeights) * weightOfLastDay);
    }
    return Math.round(totalPlan / totalWeights);
  };

  const handleMonthChange = (offset: number) => {
    setViewDate(new Date(selectedYear, selectedMonth + offset, 1));
    setFocusedDate(null);
    setSelectedMetric(null);
    setSearchTerm("");
    setAuditView('divisions');
  };

  const handleGenerateDailyReport = async () => {
    setDailyReportLoading(true);
    try {
      const content = await generateDailyReportContent(data, financeData, productionData);
      setGeneratedDailyReport(content);

      const pdfFile = await generateReportFile(content, data, financeData, productionData, workingDaysCount);

      // Auto-trigger background automation if enabled
      const config = getAutomationConfig();
      if (config.botEnabled) {
        if (!config.webhookUrl || !config.targetPhone) {
          alert("WhatsApp Bot is enabled but Webhook URL or Target Phone is missing in Config.");
        } else {
          const base64 = await fileToBase64(pdfFile);
          const success = await triggerAutomation(content.whatsappMessage, 'report', {
            base64,
            filename: pdfFile.name,
            mimetype: 'application/pdf'
          });
          if (success) {
            console.log("WhatsApp Bot message sent successfully.");
          } else {
            alert("WhatsApp Bot failed to send report. Please check if your bot server (whatsapp-bot.cjs) is running on port 3000.");
          }
        }
      }

      // Still provide manual download
      const url = URL.createObjectURL(pdfFile);
      const a = document.createElement('a');
      a.href = url;
      a.download = pdfFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

    } catch (e) {
      console.error(e);
      alert("Failed to generate report: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setDailyReportLoading(false);
    }
  };

  const currentMapping = activeSheet === 'Sales' ? PRODUCT_MAPPING : TERRITORY_MAPPING;
  const currentDept = activeSheet === 'Sales' ? 'Sales' : 'Territory Sales';

  const groupPerformanceDataForDate = (day: number) => {
    const dStr = day < 10 ? '0' + day : day;
    const dayPattern = `${MONTH_NAMES[selectedMonth]} ${dStr}, ${selectedYear}`;
    const masterMonthPattern = `MASTER_${MONTH_NAMES[selectedMonth]}_${selectedYear}`;

    return Object.keys(currentMapping).map(team => {
      let totalTarget = 0;
      let totalAchieved = 0;

      if (selectedMetric) {
        const metricRow = data.find(d =>
          d.department === currentDept &&
          d.team === team &&
          d.metric === selectedMetric &&
          d.reportDate === masterMonthPattern
        );
        if (metricRow) {
          totalTarget = getDailyTarget(metricRow.plan, day);
          const dailyMatch = data.find(d =>
            d.department === currentDept &&
            d.metric === selectedMetric &&
            d.team === team &&
            d.reportDate?.toLowerCase().includes(dayPattern.toLowerCase())
          );
          totalAchieved = dailyMatch ? dailyMatch.actual : 0;
        }
      } else {
        const teamMasterRows = data.filter(d =>
          d.department === currentDept &&
          d.team === team &&
          d.plan > 0 &&
          d.reportDate === masterMonthPattern
        );

        teamMasterRows.forEach(r => {
          const dailyTarget = getDailyTarget(r.plan, day);
          const dailyMatch = data.find(d => d.department === currentDept && d.metric === r.metric && d.reportDate?.toLowerCase().includes(dayPattern.toLowerCase()));
          totalTarget += dailyTarget;
          totalAchieved += dailyMatch ? dailyMatch.actual : 0;
        });
      }

      return { name: team, Target: totalTarget, Achieved: totalAchieved };
    });
  };

  const getMonthlyTrend = () => {
    const trend = [];
    const masterMonthPattern = `MASTER_${MONTH_NAMES[selectedMonth]}_${selectedYear}`;
    const totalMonthlyTarget = data
      .filter(d => d.department === currentDept && d.plan > 0 && d.reportDate === masterMonthPattern)
      .reduce((sum, item) => sum + item.plan, 0);

    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const dStr = day < 10 ? '0' + day : '' + day;
      const dayPattern = `${MONTH_NAMES[selectedMonth]} ${dStr}, ${selectedYear}`;
      const dayHolidays = holidaysMap[monthKey] || [];
      const isHoliday = dayHolidays.includes(day);

      const teamData: Record<string, number> = {};
      let dailyTarget = 0;

      if (selectedMetric) {
        Object.keys(currentMapping).forEach(team => {
          const master = data.find(d => d.department === currentDept && d.team === team && d.metric === selectedMetric && d.reportDate === masterMonthPattern);
          if (master) {
            dailyTarget += isHoliday ? 0 : getDailyTarget(master.plan, day);
            teamData[team] = data
              .filter(d => d.department === currentDept && d.team === team && d.metric === selectedMetric && d.reportDate?.toLowerCase().includes(dayPattern.toLowerCase()))
              .reduce((sum, item) => sum + item.actual, 0);
          } else {
            teamData[team] = 0;
          }
        });
      } else {
        dailyTarget = isHoliday ? 0 : getDailyTarget(totalMonthlyTarget, day);
        Object.keys(currentMapping).forEach(team => {
          teamData[team] = data
            .filter(d => d.department === currentDept && d.team === team && d.reportDate?.toLowerCase().includes(dayPattern.toLowerCase()))
            .reduce((sum, item) => sum + item.actual, 0);
        });
      }

      trend.push({
        day: day,
        Target: dailyTarget,
        TotalAchievement: Object.values(teamData).reduce((a, b) => a + b, 0),
        ...teamData
      });
    }
    return trend;
  };

  const renderSheetContent = () => {
    switch (activeSheet) {
      case 'Executive Summary':
        return (
          <ExecutiveSummaryView
            loading={loading}
            report={report}
            dailyReportLoading={dailyReportLoading}
            generatedDailyReport={generatedDailyReport}
            onGenerateBoardReport={async () => { setLoading(true); try { setReport(await summarizeOperations(data)); } finally { setLoading(false); } }}
            onGenerateDailyReport={handleGenerateDailyReport}
            onCloseDailyReport={() => setGeneratedDailyReport(null)}
            dataCount={data.filter(d => d.department === 'Sales').length}
          />
        );
      case 'Sales':
      case 'Territory Sales':
        return (
          <div className="bg-white">
            <AuditCalendar
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              monthKey={monthKey}
              holidaysMap={holidaysMap}
              data={data}
              currentDept={currentDept}
              focusedDate={focusedDate}
              onDateSelect={setFocusedDate}
              onMonthChange={handleMonthChange}
            />

            {focusedDate && (
              <div className="px-10 pb-20 animate-in fade-in slide-in-from-bottom-5">
                <div className="bg-[#0b1120] rounded-[3rem] overflow-hidden shadow-4xl border border-white/5">
                  <div className="p-10 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-slate-900 to-slate-800">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center text-xl shadow-xl">📊</div>
                      <div>
                        <h3 className="text-xl font-black text-white uppercase italic tracking-tight">
                          {selectedMetric ? selectedMetric : currentDept} AUDIT - {MONTH_NAMES[selectedMonth]} {focusedDate}, {selectedYear}
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {selectedMetric ? 'SPECIFIC METRIC PERFORMANCE' : 'WEIGHTED PERFORMANCE MATRIX'}
                        </p>
                      </div>
                    </div>

                    <div className="flex-1 max-w-xs mx-8 no-print">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder={`Search ${currentDept}...`}
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all"
                        />
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      {selectedMetric && (
                        <button
                          onClick={() => setSelectedMetric(null)}
                          className="bg-white/10 text-white text-[10px] font-black uppercase tracking-widest px-6 py-2 rounded-xl border border-white/10 hover:bg-white/20 transition-all no-print"
                        >
                          Reset Filter
                        </button>
                      )}
                      <div className="flex bg-white/5 rounded-xl p-1 border border-white/10 no-print">
                        <button onClick={() => setAuditView('divisions')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${auditView === 'divisions' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Divisions</button>
                        {isLastDayOfMonth && (
                          <button onClick={() => setAuditView('trend')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${auditView === 'trend' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Trend</button>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setFocusedDate(null);
                          setSelectedMetric(null);
                          setSearchTerm("");
                        }}
                        className="text-white/40 hover:text-white text-xs font-black uppercase tracking-widest px-6 py-3 border border-white/10 rounded-xl transition-all hover:bg-white/5 shadow-xl"
                      >
                        EXIT
                      </button>
                    </div>
                  </div>

                  {auditView === 'divisions' ? (
                    <>
                      <div className="p-10 bg-slate-900/40 border-b border-white/5">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-8">Group Performance Aggregates</h4>
                        <div className="h-[320px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={groupPerformanceDataForDate(focusedDate)} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                              <XAxis dataKey="name" stroke="#475569" fontSize={11} fontWeight="bold" tickLine={false} axisLine={false} />
                              <YAxis stroke="#475569" fontSize={11} fontWeight="bold" tickLine={false} axisLine={false} />
                              <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', fontSize: '11px', fontWeight: 'bold' }} itemStyle={{ color: '#fff' }} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                              <Legend wrapperStyle={{ paddingTop: '25px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }} />
                              <Bar dataKey="Target" name="TARGET" fill="#1e293b" radius={[6, 6, 0, 0]} barSize={45} />
                              <Bar dataKey="Achieved" name="ACTUAL" fill="#dc2626" radius={[6, 6, 0, 0]} barSize={45} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <ShortfallList
                        currentDept={currentDept}
                        focusedDate={focusedDate}
                        selectedMonth={selectedMonth}
                        selectedYear={selectedYear}
                        data={data}
                        currentMapping={currentMapping}
                        getDailyTarget={getDailyTarget}
                        isLastDayOfMonth={isLastDayOfMonth}
                        selectedMetric={selectedMetric}
                        onMetricSelect={setSelectedMetric}
                        searchTerm={searchTerm}
                      />
                    </>
                  ) : (
                    <TrendChartView trendData={getMonthlyTrend()} currentMapping={currentMapping} />
                  )}
                </div>
              </div>
            )}
          </div>
        );
      case 'Finance':
        return <FinanceDashboard financeData={financeData} />;
      case 'Production':
        return <ProductionDashboard data={productionData} holidaysMap={productionHolidaysMap} />;
      default:
        return <div className="p-32 text-center text-slate-300 font-black uppercase italic tracking-[0.4em]">Section under board review</div>;
    }
  };

  const sheets = ['Executive Summary', 'Sales', 'Territory Sales', 'Production', 'Finance'];

  return (
    <div className="bg-white rounded-[3rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col min-h-[900px]">
      <div className="flex-1 overflow-auto">{loading || dailyReportLoading ? <div className="p-40 text-center animate-pulse font-black uppercase text-slate-300 tracking-[0.5em]">Swiss Pipeline Active...</div> : renderSheetContent()}</div>
      <div className="bg-slate-50 border-t border-slate-200 flex items-center h-24 no-print px-4">
        {sheets.map((sheet) => (
          <button key={sheet} onClick={() => { setActiveSheet(sheet); setFocusedDate(null); }} className={`flex-1 text-[10px] font-black uppercase tracking-[0.2em] h-16 rounded-xl transition-all mx-1 ${activeSheet === sheet ? 'bg-white text-green-700 shadow-md border border-slate-200' : 'text-slate-400 hover:bg-slate-100'}`}>{sheet}</button>
        ))}
      </div>
    </div>
  );
};
