import React, { useState, useMemo, useEffect } from 'react';
import { DepartmentMismatch, HolidaysMap, LocksMap, FinanceMismatchReport, ProductionReport, ProductionHolidaysMap } from '../types.ts';
import * as XLSX from 'xlsx';
import { FinanceEntry } from './FinanceEntry.tsx';
import { ProductionEntry } from './ProductionEntry.tsx';
import { parseImageToData } from '../services/geminiService.ts';
import { MONTH_NAMES, SALES_TEAMS } from '../config.ts';
import { BatchUpload } from './BatchUpload.tsx';
import { Notification, NotificationType } from './Notification.tsx';
import { ConfigEntry } from './ConfigEntry.tsx';
import { AuditCalendar } from './AuditCalendar.tsx';

interface DataEntryProps {
  data: DepartmentMismatch[];
  onDataUpdate: (data: DepartmentMismatch[]) => void;
  financeData: FinanceMismatchReport[];
  onFinanceUpdate: (data: FinanceMismatchReport[]) => void;
  productionData: ProductionReport[];
  onProductionUpdate: (data: ProductionReport[]) => void;
  holidaysMap: HolidaysMap;
  setHolidaysMap: React.Dispatch<React.SetStateAction<HolidaysMap>>;
  productionHolidaysMap: ProductionHolidaysMap;
  setProductionHolidaysMap: React.Dispatch<React.SetStateAction<ProductionHolidaysMap>>;
  locksMap: LocksMap;
  setLocksMap: React.Dispatch<React.SetStateAction<LocksMap>>;
}

export const DataEntry: React.FC<DataEntryProps> = ({
  data,
  onDataUpdate,
  financeData,
  onFinanceUpdate,
  productionData,
  onProductionUpdate,
  holidaysMap,
  setHolidaysMap,
  productionHolidaysMap,
  setProductionHolidaysMap,
  locksMap,
  setLocksMap
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: NotificationType } | null>(null);
  const [activeTab, setActiveTab] = useState<'daily' | 'master' | 'territory-daily' | 'territory-master' | 'production' | 'finance' | 'sales-calendar' | 'production-config' | 'config'>('daily');
  const [activeGroup, setActiveGroup] = useState<'operations' | 'factory' | 'financials' | 'system'>('operations');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDays, setSelectedDays] = useState<number[]>([new Date().getDate()]);

  const selectedMonth = viewDate.getMonth();
  const selectedYear = viewDate.getFullYear();
  const monthKey = `${selectedYear}-${selectedMonth}`;
  const monthName = MONTH_NAMES[selectedMonth];

  const daysInMonth = useMemo(() => new Date(selectedYear, selectedMonth + 1, 0).getDate(), [selectedYear, selectedMonth]);

  const notify = (message: string, type: NotificationType = 'info') => {
    setNotification({ message, type });
  };

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

  useEffect(() => {
    setSelectedDays([1]);
  }, [selectedMonth, selectedYear]);

  const handleMonthChange = (offset: number) => {
    setViewDate(new Date(selectedYear, selectedMonth + offset, 1));
  };

  const handleAdminToggle = () => {
    if (!isAdminMode) {
      const pin = prompt("Enter Admin PIN:");
      if (pin === "786") {
        setIsAdminMode(true);
        notify("Admin Mode Unlocked", "success");
      } else {
        notify("Invalid PIN", "error");
      }
    } else {
      setIsAdminMode(false);
    }
  };

  const handleUpload = async (files: FileList) => {
    setIsUploading(true);
    const allNewEntries: DepartmentMismatch[] = [];
    const processedFiles: string[] = [];
    const errors: string[] = [];

    const readFile = (file: File): Promise<void> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary', cellDates: false });
            const isTerritory = activeTab.includes('territory');
            const isMaster = activeTab.includes('master');
            const targetDept = isTerritory ? 'Territory Sales' : 'Sales';

            const sheetName = wb.SheetNames.find(name => {
              const low = name.toLowerCase();
              if (isTerritory) return low.includes('territory') || low.includes('teritory');
              return low.includes('sales');
            }) || wb.SheetNames[0];

            const ws = wb.Sheets[sheetName];
            const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

            let fileMonth = selectedMonth;
            let fileYear = selectedYear;

            // Robust date column mapping
            const dateColumnMap: Record<number, number> = {};
            if (!isMaster) {
              for (let r = 0; r < Math.min(rows.length, 10); r++) {
                for (let c = 0; c < 100; c++) {
                  let cellVal = String(rows[r][c] || "").trim();
                  if (!isNaN(Number(cellVal)) && cellVal.length > 4 && Number(cellVal) > 40000 && Number(cellVal) < 50000) {
                    const date = XLSX.SSF.parse_date_code(Number(cellVal));
                    if (date) cellVal = `${date.d}/${date.m}/${date.y}`;
                  }
                  if (cellVal.includes('/') && cellVal.split('/').length === 3) {
                    const parts = cellVal.split('/');
                    const d = parseInt(parts[0]);
                    const m = parseInt(parts[1]);
                    const y = parseInt(parts[2]);
                    if (!isNaN(d) && m - 1 === fileMonth && y === fileYear) {
                      dateColumnMap[d] = c;
                    }
                  }
                }
              }
            }

            const targetDays = isMaster ? [0] : Object.keys(dateColumnMap).map(Number);
            if (!isMaster && targetDays.length === 0) {
              errors.push(`${file.name}: No valid date columns found`);
              resolve(); return;
            }

            targetDays.forEach(day => {
              let currentTeam = "";
              let dataColumnIndex = -1;

              if (isMaster) {
                for (let r = 0; r < Math.min(rows.length, 20); r++) {
                  for (let c = 0; c < 30; c++) {
                    const val = String(rows[r][c] || "").trim().toUpperCase();
                    if (val === "TGT" || val === "TARGET" || val === "PLAN") { dataColumnIndex = c; break; }
                  }
                  if (dataColumnIndex !== -1) break;
                }
              } else {
                dataColumnIndex = dateColumnMap[day] ?? -1;
              }

              if (dataColumnIndex === -1) return;

              const dStr = day < 10 ? '0' + day : day;
              const reportDateStr = isMaster ? `MASTER_${MONTH_NAMES[fileMonth]}_${fileYear}` : `${MONTH_NAMES[fileMonth]} ${dStr}, ${fileYear}`;

              rows.forEach((row) => {
                const firstCol = String(row[0] || "").trim();
                const secondCol = String(row[1] || "").trim();
                if (!firstCol) return;

                const teamFound = SALES_TEAMS.find(t => firstCol.toUpperCase() === t);
                if (teamFound) {
                  currentTeam = teamFound.charAt(0) + teamFound.slice(1).toLowerCase();
                  // Only skip if this is a dedicated header row (second column is empty)
                  if (!secondCol) return;
                }

                if (!currentTeam || firstCol.toUpperCase().includes('TOTAL')) return;

                // For territories, the metric is usually in the 3rd column (index 2)
                // Fallback to secondCol (Region) if third column is missing
                const metricName = isTerritory ? (String(row[2] || "").trim() || secondCol) : firstCol;
                if (!metricName) return;

                const rawVal = String(row[dataColumnIndex] || "0").replace(/,/g, "");
                const numericVal = parseFloat(rawVal);

                if (!isNaN(numericVal) && numericVal !== 0) {
                  allNewEntries.push({
                    department: targetDept,
                    team: currentTeam,
                    metric: metricName,
                    plan: isMaster ? numericVal : 0,
                    actual: isMaster ? 0 : numericVal,
                    variance: isMaster ? numericVal * -1 : numericVal,
                    unit: 'Units',
                    status: 'on-track',
                    reportDate: reportDateStr
                  });
                }
              });
            });

            processedFiles.push(file.name);
            resolve();
          } catch (err) {
            errors.push(`${file.name}: Processing failed`);
            resolve();
          }
        };
        reader.readAsBinaryString(file);
      });
    };

    await Promise.all(Array.from(files).map(readFile));

    if (allNewEntries.length > 0) {
      onDataUpdate([...data, ...allNewEntries]);
      notify(`Imported ${allNewEntries.length} entries from ${processedFiles.length} files`, 'success');
    } else {
      notify(errors.length > 0 ? errors[0] : "No valid data found", 'error');
    }
    setIsUploading(false);
  };

  const handleImageUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const base64 = evt.target?.result as string;
        const extractedData = await parseImageToData(base64, activeTab === 'production' ? 'production' : 'daily');
        if (extractedData) {
          notify(`AI Scan: Found ${extractedData.length} records`, 'success');
        }
      };
      reader.readAsDataURL(file);
    } catch (e) {
      notify("AI Vision unavailable", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const menuGroups = [
    { id: 'operations', label: 'Sales Ops', icon: '📊', tabs: ['daily', 'master', 'sales-calendar', 'territory-daily', 'territory-master'] },
    { id: 'factory', label: 'Factory Ops', icon: '🏭', tabs: ['production', 'production-config'] },
    { id: 'financials', label: 'Financials', icon: '💰', tabs: ['finance'] },
    { id: 'system', label: 'System', icon: '⚙️', tabs: ['config'] }
  ];

  const renderContent = () => {
    if (activeTab === 'config') {
      return (
        <ConfigEntry
          isAdminMode={isAdminMode}
          onAdminLogin={(pin) => { setIsAdminMode(true); notify("Admin Access Granted", "success"); }}
          onResetData={() => { if (confirm("Permanently wipe all system data?")) { onDataUpdate([]); onFinanceUpdate([]); onProductionUpdate([]); notify("System Reset Successful", "warning"); } }}
          data={data}
          financeData={financeData}
          productionData={productionData}
          monthName={monthName}
          selectedYear={selectedYear}
          workingDaysCount={workingDaysCount}
        />
      );
    }

    if (activeTab === 'finance') return <FinanceEntry currentData={financeData} onDataUpdate={onFinanceUpdate} />;
    if (activeTab === 'production') return <ProductionEntry currentData={productionData} onDataUpdate={onProductionUpdate} />;

    if (activeTab === 'sales-calendar' || activeTab === 'production-config') {
      const isProduction = activeTab === 'production-config';
      const currentHolidays = isProduction ? productionHolidaysMap : holidaysMap;
      const setHolidays = isProduction ? setProductionHolidaysMap : setHolidaysMap;

      const handleToggleHoliday = (day: number) => {
        setHolidays(prev => {
          const currentHols = prev[monthKey] || [];
          const newHols = currentHols.includes(day)
            ? currentHols.filter(d => d !== day)
            : [...currentHols, day];
          return { ...prev, [monthKey]: newHols };
        });
      };

      return (
        <div className="space-y-8 animate-in fade-in">
          <div className="text-center space-y-2">
            <h3 className="text-xl font-black italic uppercase tracking-widest text-slate-900">
              {isProduction ? 'Production' : 'Sales'} Holiday Configuration
            </h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Select dates to mark as non-operational holidays
            </p>
          </div>
          <AuditCalendar
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            monthKey={monthKey}
            holidaysMap={currentHolidays}
            data={data}
            currentDept={isProduction ? 'Production' : 'Sales'}
            focusedDate={null}
            onDateSelect={handleToggleHoliday}
            onMonthChange={handleMonthChange}
          />
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 italic">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight text-center">
              * Note: Marking a holiday will automatically redistribute targets across remaining working days.
            </p>
          </div>
        </div>
      );
    }

    const isMaster = activeTab.includes('master');
    const title = activeTab.replace('-', ' ').toUpperCase();

    return (
      <div className="space-y-12 animate-in fade-in">
        <div className="flex justify-center items-center gap-8 bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 no-print">
          <button onClick={() => handleMonthChange(-1)} className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm text-slate-400 hover:text-red-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="text-center">
            <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1 leading-none">Operational Period</p>
            <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">{monthName} {selectedYear}</h3>
          </div>
          <button onClick={() => handleMonthChange(1)} className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm text-slate-400 hover:text-red-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        {!isMaster && (
          <div className="space-y-4">
            <div className="flex justify-between items-center px-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Batch Date Detection Enabled</p>
              <button
                onClick={() => {
                  if (selectedDays.length === daysInMonth) setSelectedDays([new Date().getDate()]);
                  else setSelectedDays([...Array(daysInMonth)].map((_, i) => i + 1));
                }}
                className="text-[9px] font-black text-red-600 uppercase tracking-widest hover:underline"
              >
                {selectedDays.length === daysInMonth ? 'DESELECT ALL' : 'SELECT ALL'}
              </button>
            </div>
            <div className="grid grid-cols-7 sm:grid-cols-10 gap-2 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
              {[...Array(daysInMonth)].map((_, i) => {
                const day = i + 1;
                const isSelected = selectedDays.includes(day);
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDays(prev => prev.includes(day) ? (prev.length > 1 ? prev.filter(d => d !== day) : prev) : [...prev, day])}
                    className={`h-10 rounded-xl text-[10px] font-black transition-all ${isSelected ? 'bg-red-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <BatchUpload
          title={`${title} DATA SYNC`}
          description={isMaster ? "Uploading Monthly Projections" : `Syncing Operational Activity for ${selectedDays.length} Units`}
          onUpload={handleUpload}
          onImageUpload={handleImageUpload}
          isUploading={isUploading}
          error={null}
        />
      </div>
    );
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-12 pb-32 pt-8">
      {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}

      <div className="flex flex-col md:flex-row gap-12">
        <aside className="w-full md:w-80 space-y-8 no-print">
          <div className="bg-white p-6 rounded-[3rem] border border-slate-200 shadow-xl space-y-6">
            <div className="px-5 py-4 bg-slate-900 rounded-2xl border border-white/5 shadow-lg">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] leading-none mb-2">CONNECTED AS</p>
              <p className="text-xs font-black text-white italic tracking-wide uppercase">Swiss Administrator</p>
            </div>

            <nav className="space-y-1">
              {menuGroups.map(group => (
                <div key={group.id} className="space-y-1">
                  <button
                    onClick={() => { setActiveGroup(group.id as any); setActiveTab(group.tabs[0] as any); }}
                    className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all ${activeGroup === group.id ? 'bg-red-600 text-white shadow-xl shadow-red-100' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-xl">{group.icon}</span>
                      <span className="text-[10px] font-black uppercase tracking-widest">{group.label}</span>
                    </div>
                    {activeGroup === group.id && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>}
                  </button>

                  {activeGroup === group.id && (
                    <div className="pl-14 pr-4 py-2 space-y-1 animate-in slide-in-from-top-2">
                      {group.tabs.map(tab => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab as any)}
                          className={`w-full text-left py-2 text-[9px] font-black uppercase tracking-widest transition-colors ${activeTab === tab ? 'text-red-600' : 'text-slate-400 hover:text-slate-800'}`}
                        >
                          {tab.replace('-', ' ')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>

            <div className="pt-6 border-t border-slate-100">
              <button onClick={handleAdminToggle} className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-all group">
                <span className="text-xl group-hover:scale-110 transition-transform">{isAdminMode ? '🔓' : '🔒'}</span>
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">{isAdminMode ? 'EXIT ADMIN' : 'SECURITY LOGIN'}</span>
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 bg-white rounded-[4rem] border border-slate-200 shadow-4xl p-12 md:p-20 relative overflow-hidden flex flex-col min-h-[800px]">
          <div className="relative z-10 flex-1 flex flex-col">{renderContent()}</div>
          {/* Ambient Background Elements */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-50/30 rounded-full blur-[100px] -mr-64 -mt-64 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-slate-50/50 rounded-full blur-[100px] -ml-64 -mb-64 pointer-events-none"></div>
        </main>
      </div>
    </div>
  );
};
