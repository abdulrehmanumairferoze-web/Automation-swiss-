import React, { useState, useMemo, useCallback } from 'react';
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
import { generateInsight } from '../services/insightService.ts';
import { PRODUCT_MAPPING, TERRITORY_MAPPING, TEAM_COLORS, MONTH_NAMES } from '../config.ts';
import { TradeDashboard } from './TradeDashboard.tsx';


interface DashboardProps {
  data: DepartmentMismatch[];
  onDataUpdate: (data: DepartmentMismatch[]) => void;
  holidaysMap: HolidaysMap;
  financeData: FinanceMismatchReport[];
  productionData: ProductionReport[];
  productionHolidaysMap: ProductionHolidaysMap;
  activeView?: string;
  onRefreshRequested?: (month: number, year: number) => void;
  isSyncing?: boolean;
  syncError?: string | null;
}

export const Dashboard: React.FC<DashboardProps> = ({
  data, holidaysMap, financeData, productionData, productionHolidaysMap, activeView, onRefreshRequested, isSyncing, syncError
}) => {
  const [report, setReport] = useState<SummaryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeSheet, setActiveSheet] = useState<string>('Executive Summary');

  // Sync activeSheet with activeView from sidebar
  React.useEffect(() => {
    if (activeView === 'territory-sales') setActiveSheet('Territory Sales');
    else if (activeView === 'sales-audit') setActiveSheet('Sales');
    else if (activeView === 'trade-ops') setActiveSheet('TRADE');
    else if (activeView === 'finance-dashboard') setActiveSheet('Finance');
    else if (activeView === 'production-dashboard') setActiveSheet('Production');
    else if (activeView === 'dashboard') setActiveSheet('Executive Summary');
  }, [activeView]);

  const [auditView, setAuditView] = useState<'divisions' | 'trend'>('divisions');

  const [dailyReportLoading, setDailyReportLoading] = useState(false);
  const [generatedDailyReport, setGeneratedDailyReport] = useState<DailyReportContent | null>(null);

  const [viewDate, setViewDate] = useState(new Date());
  const selectedMonth = viewDate.getMonth();
  const selectedYear = viewDate.getFullYear();

  // Trigger data refresh when month/year changes
  React.useEffect(() => {
    if (onRefreshRequested) {
      onRefreshRequested(selectedMonth, selectedYear);
    }
  }, [selectedMonth, selectedYear]);

  const monthKey = `${selectedYear}-${selectedMonth}`;

  const [focusedDate, setFocusedDate] = useState<number | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [tradeFY, setTradeFY] = useState<string>("");

  const tradeFYs = useMemo(() =>
    Array.from(new Set(data.filter(d => d.department === 'TRADE').map(d => d.fy))).filter(Boolean).sort()
    , [data]);

  const activeFY = useMemo(() => {
    if (tradeFY) return tradeFY;
    if (tradeFYs.length > 0) return tradeFYs[tradeFYs.length - 1]; // Default to latest data
    const now = new Date();
    const currYear = now.getFullYear();
    const currMonth = now.getMonth();
    const pad = (n: number) => n.toString().padStart(2, '0');
    if (currMonth >= 6) return `FY ${pad(currYear % 100)}-${pad((currYear + 1) % 100)}`;
    return `FY ${pad((currYear - 1) % 100)}-${pad(currYear % 100)}`;
  }, [tradeFY, tradeFYs]);

  const tradeData = useMemo(() => {
    try {
      if (!Array.isArray(data)) return [];
      return data.filter(d => d.department === 'TRADE' && d.fy === activeFY);
    } catch (err) {
      console.error('TRADE Render Failure:', err);
      return [];
    }
  }, [data, activeFY]);

  const tradeSummary = useMemo(() => {
    try {
      return Array.from(new Set(tradeData.map(d => d.team))).map(team => {
        const teamRows = tradeData.filter(d => d.team === team);
        const target = teamRows.reduce((s, r) => s + r.plan, 0);
        const achieved = teamRows.reduce((s, r) => s + r.actual, 0);
        return { name: team, Budget: target, Achievement: achieved };
      });
    } catch (err) {
      console.error('TRADE Summary Error:', err);
      return [];
    }
  }, [tradeData]);

  // Render Log (Requested for debugging)
  console.log('--- DASHBOARD RENDER [%s] ---', activeView);

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

  const getDailyTarget = useCallback((totalPlan: number, day: number) => {
    const isClosingDay = isLastDay(selectedYear, selectedMonth, day);
    const weightOfLastDay = 3.5;
    const totalWeights = (workingDaysCount - 1) + weightOfLastDay;

    if (isClosingDay) {
      return Math.round((totalPlan / totalWeights) * weightOfLastDay);
    }
    return Math.round(totalPlan / totalWeights);
  }, [selectedYear, selectedMonth, workingDaysCount]);

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

  const dynamicTerritoryMapping = useMemo(() => {
    const mapping: Record<string, string[]> = {};
    data.forEach(d => {
      if (d.department === 'Territory Sales' && d.team && d.metric) {
        if (!mapping[d.team]) mapping[d.team] = [];
        if (!mapping[d.team].includes(d.metric)) mapping[d.team].push(d.metric);
      }
    });
    return mapping;
  }, [data]);

  const currentMapping = activeSheet === 'Sales' ? PRODUCT_MAPPING : (activeSheet === 'Territory Sales' ? dynamicTerritoryMapping : (activeSheet === 'TRADE' ? {} : {}));
  const currentDept = activeSheet === 'Sales' ? 'Sales' : (activeSheet === 'TRADE' ? 'TRADE' : 'Territory Sales');

  const groupPerformanceDataForDate = useCallback((day: number) => {
    const dStr = day < 10 ? '0' + day : day;
    const dayPattern = `${MONTH_NAMES[selectedMonth]} ${dStr}, ${selectedYear}`;
    const masterMonthPattern = `MASTER_${MONTH_NAMES[selectedMonth]}_${selectedYear}`;

    let entities: string[] = [];
    if (activeSheet === 'Sales') {
      entities = Object.keys(currentMapping).filter(t => t !== 'Unmapped' && t !== 'Unmapped Team');
    } else if (activeSheet === 'Territory Sales') {
      // In Territory Sales, the "Division" view should show Territories (metrics)
      const territorySet = new Set<string>();
      data.forEach(d => {
        if (d.department === 'Territory Sales' && d.metric) territorySet.add(d.metric);
      });
      entities = Array.from(territorySet).sort();
    } else {
      entities = Object.keys(currentMapping);
    }

    return entities.map(entityName => {
      let totalTarget = 0;
      let totalAchieved = 0;

      if (activeSheet === 'Territory Sales') {
        // Aggregate all targets for this territory in this month
        data.filter(d =>
          d.department === 'Territory Sales' &&
          d.metric === entityName &&
          d.reportDate === masterMonthPattern
        ).forEach(r => {
          totalTarget += getDailyTarget(r.plan, day);
        });

        // Aggregate all achievements for this territory on this specific day
        data.filter(d =>
          d.department === 'Territory Sales' &&
          d.metric === entityName &&
          (d.reportDate === dayPattern || (d.reportDate && d.reportDate.toLowerCase().includes(dayPattern.toLowerCase())))
        ).forEach(r => {
          totalAchieved += r.actual;
        });
      } else {
        const teamMasterRows = data.filter(d =>
          d.department === currentDept && d.team === entityName && d.plan > 0 && d.reportDate === masterMonthPattern
        );
        teamMasterRows.forEach(r => {
          totalTarget += getDailyTarget(r.plan, day);
          const dailyMatch = data.find(d =>
            d.department === currentDept && d.metric === r.metric && d.team === entityName &&
            (d.reportDate === dayPattern || (d.reportDate && d.reportDate.toLowerCase().includes(dayPattern.toLowerCase())))
          );
          totalAchieved += dailyMatch ? dailyMatch.actual : 0;
        });
      }
      return { name: entityName, Target: totalTarget, Achieved: totalAchieved };
    });
  }, [data, currentMapping, selectedMetric, selectedMonth, selectedYear, currentDept, getDailyTarget, activeSheet]);

  // --- TREND DATA (Team-Wise) ---
  const monthlyTrendData = useMemo(() => {
    let entities: string[] = [];
    if (activeSheet === 'Sales') {
      entities = Object.keys(currentMapping).filter(t => t !== 'Unmapped' && t !== 'Unmapped Team');
    } else if (activeSheet === 'Territory Sales') {
      entities = Object.keys(currentMapping).filter(t => t !== 'Unmapped' && t !== 'Unmapped Team');
      // DEBUG: Log what entities were found
      console.log('🔍 Territory Sales Entities Found (Trend):', entities);
    } else {
      return [];
    }

    const reportYear = selectedYear;
    const reportMonth = selectedMonth;
    const daysInMonth = new Date(reportYear, reportMonth + 1, 0).getDate();
    const now = new Date();
    const isCurrentMonth = now.getFullYear() === reportYear && now.getMonth() === reportMonth;
    const todayDay = isCurrentMonth ? now.getDate() : (now > new Date(reportYear, reportMonth) ? daysInMonth + 1 : 0);

    // OPTIMIZATION: FAST LOOKUP INDEX
    // Map<TeamName, Map<ReportDate, { plan: number, actual: number }>>
    const teamDateMap = new Map<string, Map<string, { plan: number, actual: number }>>();

    // Pre-process relevant data only
    data.forEach(d => {
      if (d.department !== currentDept) return;

      if (!teamDateMap.has(d.team!)) {
        teamDateMap.set(d.team!, new Map());
      }
      const teamMap = teamDateMap.get(d.team!)!;

      // ReportDate can be "Master..." or "Month DD, YYYY"
      // We aggregate metrics (summing plan/actual for all products/metrics under this team/date)
      const dateKey = d.reportDate || "UNKNOWN";

      if (!teamMap.has(dateKey)) {
        teamMap.set(dateKey, { plan: 0, actual: 0 });
      }
      const entry = teamMap.get(dateKey)!;
      entry.plan += d.plan;
      entry.actual += d.actual;
    });

    return entities.map(entityName => {
      // 1. Calculate Target (Robust lookup)
      const entityDateMap = teamDateMap.get(entityName);
      const targetKey = Array.from(entityDateMap?.keys() || []).find(k =>
        String(k).toUpperCase().startsWith('MASTER') &&
        String(k).toLowerCase().includes(MONTH_NAMES[reportMonth].toLowerCase()) &&
        String(k).includes(String(reportYear))
      );
      const monthlyTarget = targetKey ? entityDateMap?.get(String(targetKey))?.plan || 0 : 0;

      // 2. Calculate Actuals & Pace
      let currentAchieved = 0;
      let workingDaysSoFar = 0;
      const dailyDataArray: any[] = [];

      const getDayData = (d: number) => {
        const dStr = d < 10 ? '0' + d : '' + d;
        const datePatternLong = `${MONTH_NAMES[reportMonth]} ${dStr}, ${reportYear}`;
        const datePatternShort = `${MONTH_NAMES[reportMonth]} ${d}, ${reportYear}`;

        return (entityDateMap?.get(datePatternLong)?.actual || entityDateMap?.get(datePatternShort)?.actual || 0);
      };

      // 3. Historical Surge Analysis (Keep legacy logic or optimize?)
      // To optimize this, we'd need to index historical months too.
      // For now, let's keep the legacy inner-loop filter for SURGE only (it runs only 2 times per entity, not 30).
      // Or optimize it too if possible. 
      // Actually, let's just leave surge as is for now to minimize risk, or optimize if easy.
      // The surge logic scans 2 previous months.
      let surgeTotal = 0;
      let surgeDaysCount = 0;
      for (let m = 1; m <= 2; m++) {
        let prevMonth = reportMonth - m;
        let prevYear = reportYear;
        if (prevMonth < 0) { prevMonth += 12; prevYear -= 1; }
        const prevDaysInMonth = new Date(prevYear, prevMonth + 1, 0).getDate();

        // Check last 2 days of prev month
        [prevDaysInMonth, prevDaysInMonth - 1].forEach(d => {
          const dStr = d < 10 ? '0' + d : '' + d;
          const pattern = `${MONTH_NAMES[prevMonth]} ${dStr}, ${prevYear}`;
          // We can blindly try to look up in our teamMap if it contains historical data
          // Our entityDateMap contains ALL data for the team, so yes!
          const val = entityDateMap?.get(pattern)?.actual || 0;

          // Month Total for prev month
          // We need to sum all entries that match the month string.
          // This is still a loop over the map keys or raw data.
          // Optimizing this: iterating map keys is faster than iterating all raw rows.
          let monthTotal = 0;
          entityDateMap?.forEach((v, k) => {
            if (k.startsWith(MONTH_NAMES[prevMonth]) && k.includes(String(prevYear)) && !k.includes('MASTER')) {
              monthTotal += v.actual;
            }
          });

          if (monthTotal > 0) {
            surgeTotal += (val / monthTotal);
            surgeDaysCount++;
          }
        });
      }
      const avgSurgeFraction = surgeDaysCount > 0 ? surgeTotal / (surgeDaysCount / 2) : 0;
      const surgeFactor = avgSurgeFraction * 100;

      // 4. Build Daily Data
      for (let day = 1; day <= daysInMonth; day++) {
        const isProjection = day >= todayDay;
        const isHoliday = (holidaysMap[monthKey] || []).includes(day);
        let dailyVal = 0;

        if (!isProjection) {
          dailyVal = getDayData(day);
          currentAchieved += dailyVal;
          if (!isHoliday && dailyVal > 0) workingDaysSoFar++;
        } else {
          if (isHoliday) {
            dailyVal = 0;
          } else {
            const pace = workingDaysSoFar > 0 ? currentAchieved / workingDaysSoFar : 0;
            if (day >= daysInMonth - 1 && surgeFactor > 20) {
              dailyVal = pace * 2.5;
            } else {
              dailyVal = pace;
            }
          }
        }

        dailyDataArray.push({
          day,
          target: isHoliday ? 0 : getDailyTarget(monthlyTarget, day, daysInMonth, holidaysMap[monthKey] || []),
          actual: dailyVal,
          isProjection
        });
      }

      const daysRemaining = Math.max(0, (daysInMonth - todayDay) + 1);
      const insight = generateInsight(
        entityName,
        currentAchieved,
        monthlyTarget,
        daysRemaining,
        workingDaysSoFar > 0 ? currentAchieved / workingDaysSoFar : 0,
        surgeFactor
      );

      return {
        teamName: entityName,
        target: monthlyTarget,
        achieved: currentAchieved,
        dailyData: dailyDataArray,
        insight
      };
    });
  }, [data, currentDept, currentMapping, activeSheet, selectedMonth, selectedYear, holidaysMap, monthKey, getDailyTarget]);

  const divisionalData = useMemo(() => {
    if (!focusedDate) return [];
    return groupPerformanceDataForDate(focusedDate);
  }, [focusedDate, groupPerformanceDataForDate]);

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
      case 'TOLL':
        return (
          <div className="bg-white">
            {syncError && (
              <div className="bg-red-600/10 border-b border-red-600/20 px-10 py-3 flex items-center justify-center gap-3">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-[10px] font-black text-red-500 uppercase tracking-widest italic">Sync Interrupted: {syncError}</span>
              </div>
            )}
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
                        <button onClick={() => setAuditView('trend')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${auditView === 'trend' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Trend</button>
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
                            <BarChart data={divisionalData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
                    <TrendChartView teamTrends={monthlyTrendData} />
                  )}
                </div>
              </div>
            )}
          </div>
        );
      case 'TRADE':
        return (
          <div className="p-10 space-y-10 animate-in fade-in">
            <div className="flex justify-between items-center bg-slate-900 p-8 rounded-[2.5rem] border border-white/10 shadow-2xl">
              <div>
                <h2 className="text-2xl font-black text-white uppercase italic tracking-tight">TRADE PERFORMANCE</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">MONTHLY BUDGET VS SALES</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Financial Year</span>
                <select
                  value={activeFY}
                  onChange={(e) => setTradeFY(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-6 py-2 text-xs font-black text-white hover:bg-white/10 transition-all focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  {tradeFYs.length > 0 ? (
                    tradeFYs.map(fy => <option key={fy} value={fy} className="bg-slate-900">{fy}</option>)
                  ) : (
                    <option value={activeFY} className="bg-slate-900">{activeFY}</option>
                  )}
                </select>
              </div>
            </div>

            {tradeData.length === 0 ? (
              <div className="bg-white p-20 rounded-[3rem] border border-slate-200 shadow-xl text-center space-y-6">
                <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center text-4xl mx-auto shadow-inner animate-pulse">📊</div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">No TRADE Data Found for {activeFY}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] max-w-xs mx-auto leading-relaxed">
                    Upload TRADE Excel via Data Entry or switch the Financial Year selector above if data exists for other periods.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl overflow-hidden min-h-[400px]">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-8 border-b border-slate-100 pb-4">Category Summary</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={tradeSummary}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} />
                      <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 900, fontSize: '10px' }} />
                      <Bar dataKey="Budget" fill="#0f172a" radius={[4, 4, 0, 0]} barSize={40} />
                      <Bar dataKey="Achievement" fill="#dc2626" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl overflow-hidden">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-8 border-b border-slate-100 pb-4">Customer Detail</h3>
                  <div className="overflow-auto max-h-[350px]">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                          <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Budget</th>
                          <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Sales</th>
                          <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {tradeData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-all group">
                            <td className="py-4">
                              <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{row.metric}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{row.team}</p>
                            </td>
                            <td className="py-4 text-right text-xs font-black text-slate-600">{row.plan.toLocaleString()}</td>
                            <td className="py-4 text-right text-xs font-black text-slate-900">{row.actual.toLocaleString()}</td>
                            <td className={`py-4 text-right text-xs font-black ${row.actual >= row.plan ? 'text-green-600' : 'text-red-600'}`}>
                              {row.plan > 0 ? ((row.actual / row.plan) * 100).toFixed(0) : 100}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      case 'TRADE':
        return <TradeDashboard data={data} />;
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
    </div>
  );
};
