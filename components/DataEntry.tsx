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
import { saveData, getData, resetDatabase } from '../services/dbService.ts';

interface DataEntryProps {
  data: DepartmentMismatch[];
  onDataUpdate: (data: DepartmentMismatch[]) => void;
  financeData: FinanceMismatchReport[];
  onFinanceUpdate: (data: FinanceMismatchReport[]) => void;
  productionData: ProductionReport[];
  onProductionUpdate: (data: ProductionReport[]) => void;
  holidaysMap: HolidaysMap;
  setHolidaysMap: (map: HolidaysMap) => void;
  productionHolidaysMap: ProductionHolidaysMap;
  setProductionHolidaysMap: (map: ProductionHolidaysMap) => void;
  locksMap: LocksMap;
  setLocksMap: (map: LocksMap) => void;
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
  const [activeTab, setActiveTab] = useState<'daily' | 'master' | 'territory-daily' | 'territory-master' | 'trade-sync' | 'production' | 'finance' | 'sales-calendar' | 'production-config' | 'config'>('daily');
  const [activeGroup, setActiveGroup] = useState<'operations' | 'trade' | 'factory' | 'financials' | 'system'>('operations');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDays, setSelectedDays] = useState<number[]>([new Date().getDate()]);
  const [uploadStatus, setUploadStatus] = useState<string>('');

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

            const isTerritoryTab = activeTab.includes('territory');
            const isMaster = activeTab.includes('master');
            const isTrade = activeTab === 'trade-sync';
            let targetDept = isTerritoryTab ? 'Territory Sales' : (isTrade ? 'TRADE' : 'Sales');

            const sheetName = wb.SheetNames.find(name => {
              const low = name.toLowerCase();
              if (isTrade) return low.includes('trade');
              if (isTerritoryTab) return low.includes('territory') || low.includes('teritory');
              return low.includes('sales');
            }) || wb.SheetNames[0];

            const focusedWs = wb.Sheets[sheetName];
            const rowsToUse: any[][] = XLSX.utils.sheet_to_json(focusedWs, { header: 1, defval: "" });
            const rows = rowsToUse;

            let fileMonth = selectedMonth;
            let fileYear = selectedYear;

            // SPECIAL: Trade Parsing Logic (July-June Horizontal Format)
            if (isTrade) {
              const tradeMonths = [
                { name: 'July', budget: /July Budget/i, sales: /July Sales/i },
                { name: 'August', budget: /Aug(?:ust)? Budget/i, sales: /Aug(?:ust)? Sales/i },
                { name: 'September', budget: /Sept(?:ember)? Budget/i, sales: /Sept(?:ember)? Sales/i },
                { name: 'October', budget: /Oct(?:ober)? Budget/i, sales: /Oct(?:ober)? Sales/i },
                { name: 'November', budget: /Nov(?:ember)? Budget/i, sales: /Nov(?:ember)? Sales/i },
                { name: 'December', budget: /Dec(?:ember)? Budget/i, sales: /Dec(?:ember)? Sales/i },
                { name: 'January', budget: /Jan(?:uary)? Budget/i, sales: /Jan(?:uary)? Sales/i },
                { name: 'February', budget: /Feb(?:ruary)? Budget/i, sales: /Feb(?:ruary)? Sales/i },
                { name: 'March', budget: /Mar(?:ch)? Budget/i, sales: /Mar(?:ch)? Sales/i },
                { name: 'April', budget: /Apr(?:il)? Budget/i, sales: /Apr(?:il)? Sales/i },
                { name: 'May', budget: /May Budget/i, sales: /May Sales/i },
                { name: 'June', budget: /June Budget/i, sales: /June Sales/i }
              ];

              let currentMonthIndices: any[] = [];
              const categoryIdx = 0;
              const customerIdx = 1;

              rows.forEach((row) => {
                const cellB = String(row[customerIdx] || "").trim().toLowerCase();

                // Detection: Is this row a Header for a new quarterly block?
                const isHeader = cellB.includes('customer') || row.filter(c => String(c).toLowerCase().includes('budget')).length >= 2;

                if (isHeader) {
                  currentMonthIndices = tradeMonths.map(m => ({
                    ...m,
                    bIdx: row.findIndex(c => m.budget.test(String(c))),
                    sIdx: row.findIndex(c => m.sales.test(String(c)))
                  })).filter(m => m.bIdx !== -1 || m.sIdx !== -1);
                  return;
                }

                // Process data row only if we found a header block previously
                if (currentMonthIndices.length === 0) return;

                const category = String(row[categoryIdx] || "").trim();
                const customerName = String(row[customerIdx] || "").trim();

                if (!customerName) return;
                const lowName = customerName.toLowerCase();
                const lowCat = category.toLowerCase();

                // Skip non-customer rows
                if (lowName.includes('total') || lowCat.includes('total') ||
                  lowName === 'return' || lowName === 'achievement' || lowName === 'customer') return;

                currentMonthIndices.forEach(m => {
                  let budget = 0;
                  let sales = 0;
                  if (m.bIdx !== -1) budget = parseFloat(String(row[m.bIdx] || "0").replace(/,/g, "")) || 0;
                  if (m.sIdx !== -1) sales = parseFloat(String(row[m.sIdx] || "0").replace(/,/g, "")) || 0;

                  if (budget === 0 && sales === 0) return;

                  const currentYear = new Date().getFullYear();
                  const fy = new Date().getMonth() >= 6
                    ? `FY ${currentYear - 2000}-${currentYear - 1999}`
                    : `FY ${currentYear - 2001}-${currentYear - 2000}`;

                  allNewEntries.push({
                    department: 'TRADE',
                    team: category || 'GENERIC',
                    metric: customerName,
                    plan: budget,
                    actual: sales,
                    variance: sales - budget,
                    unit: 'PKR',
                    status: sales >= budget ? 'on-track' : 'critical',
                    reportDate: m.name,
                    fy: fy
                  });
                });
              });

              processedFiles.push(file.name);
              resolve(); return;
            }

            const headerRow = rowsToUse.find(r => r.some(c => {
              const low = String(c).toLowerCase();
              return low === 'teams' || low === 'team' || low === 'brands' || low === 'all regions' || low === 'products' || low === 'product_name' || low === 'target units' || low === 'row labels';
            })) || rowsToUse[0];

            const teamHeaderIdx = headerRow.findIndex(c => {
              const low = String(c).toLowerCase();
              return low === 'team' || low === 'teams' || low === 'sales force' || low === 'sales force name' || low === 'salesforce' || low === 'sf name';
            });
            const regionHeaderIdx = headerRow.findIndex(c => {
              const low = String(c).toLowerCase();
              return low === 'all regions' || low === 'region' || low === 'division' || low === 'region name';
            });
            const productHeaderIdx = headerRow.findIndex(c => {
              const low = String(c).toLowerCase();
              return low === 'products' || low === 'product_name' || low === 'product name' || low === 'brand' || low === 'brands' || low === 'row labels';
            });
            const territoryHeaderIdx = headerRow.findIndex(c => {
              const low = String(c).toLowerCase();
              return low === 'territory' || low === 'territory name';
            });
            const targetUnitsIdx = headerRow.findIndex(c => String(c).toLowerCase() === 'target units' || String(c).toLowerCase() === 'pm saleunits');
            const monthHeaderIdx = headerRow.findIndex(c => String(c).toLowerCase() === 'month');

            // STRICT VALIDATION: Ensure file content matches the selected tab
            if (!isTerritoryTab && territoryHeaderIdx !== -1) {
              errors.push(`${file.name}: This file contains a "Territory" column. Please upload Territory Sales data in the "Territory" tab.`);
              resolve(); return;
            }
            if (isTerritoryTab && territoryHeaderIdx === -1) {
              errors.push(`${file.name}: This file is missing the required "Territory" column for Territory Sales data.`);
              resolve(); return;
            }

            // Standard department assignment (STRICT)
            const isTerritory = isTerritoryTab;
            targetDept = isTerritoryTab ? 'Territory Sales' : 'Sales';

            // Legacy support mapping
            const teamColIndexFromDaily = teamHeaderIdx;
            const productColIndexFromDaily = productHeaderIdx;
            // Robust date column mapping
            const dateColumnMap: Record<number, number> = {};
            const monthMap: Record<string, number> = {
              'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
              'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
            };

            if (!isMaster) {
              // Priority 1: Check headers for "1-Jan-26" pattern
              headerRow.forEach((cellVal, colIdx) => {
                const str = String(cellVal || "").trim();

                // DD-MMM-YY (e.g., 01-Jan-25)
                const matchMmm = str.match(/^(\d{1,2})[-./]([A-Za-z]{3})[-./](\d{2,4})$/);
                if (matchMmm) {
                  const d = parseInt(matchMmm[1]);
                  const mStr = matchMmm[2].charAt(0).toUpperCase() + matchMmm[2].slice(1).toLowerCase();
                  const m = monthMap[mStr];
                  const rawY = parseInt(matchMmm[3]);
                  const y = rawY < 100 ? 2000 + rawY : rawY;
                  if (!isNaN(d) && m === fileMonth && y === fileYear) {
                    dateColumnMap[d] = colIdx;
                    return;
                  }
                }

                // DD/MM/YYYY (e.g., 01/11/2025 or 01.11.25)
                const matchNum = str.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})$/);
                if (matchNum) {
                  const d = parseInt(matchNum[1]);
                  const m = parseInt(matchNum[2]) - 1;
                  const rawY = parseInt(matchNum[3]);
                  const y = rawY < 100 ? 2000 + rawY : rawY;
                  if (!isNaN(d) && m === fileMonth && y === fileYear) {
                    dateColumnMap[d] = colIdx;
                  }
                }
              });

              // Priority 2: Fallback to existing date-code detection if no header matches
              if (Object.keys(dateColumnMap).length === 0) {
                for (let r = 0; r < Math.min(rows.length, 15); r++) {
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
                      const rawY = parseInt(parts[2]);
                      const y = rawY < 100 ? 2000 + rawY : rawY;
                      if (!isNaN(d) && m - 1 === fileMonth && y === fileYear) {
                        dateColumnMap[d] = c;
                      }
                    }
                  }
                }
              }
            }

            const targetDays = isMaster ? [0] : Object.keys(dateColumnMap).map(Number);
            if (!isMaster && targetDays.length === 0) {
              errors.push(`${file.name}: No valid date columns for ${MONTH_NAMES[fileMonth]} ${fileYear} found`);
              resolve(); return;
            }

            targetDays.forEach(day => {
              let currentTeam = "";
              let dataColumnIndex = -1;

              if (isMaster) {
                for (let r = 0; r < Math.min(rows.length, 25); r++) {
                  for (let c = 0; c < 40; c++) {
                    const val = String(rows[r][c] || "").trim().toUpperCase();
                    if (val === "TGT" || val === "TARGET" || val === "PLAN" || val === "TARGET UNITS") { dataColumnIndex = c; break; }
                  }
                  if (dataColumnIndex !== -1) break;
                }
              } else {
                dataColumnIndex = dateColumnMap[day] ?? -1;
              }

              if (dataColumnIndex === -1) return;

              const dStr = day < 10 ? '0' + day : day;
              const reportDateStr = isMaster ? `MASTER_${MONTH_NAMES[fileMonth]}_${fileYear}` : `${MONTH_NAMES[fileMonth]} ${dStr}, ${fileYear}`;

              rows.forEach((row, idx) => {
                // Skip header row
                if (row === headerRow) return;

                // 1. Detect Team/Sales Force (ACHIEVERS, etc.)
                // In Stacked format, the Team name is often in the same column as the product
                const teamSearchIdx = teamHeaderIdx !== -1 ? teamHeaderIdx : productHeaderIdx;
                const rawTeamVal = String(row[teamSearchIdx] || "").trim();
                const teamFound = SALES_TEAMS.find(t => rawTeamVal.toUpperCase() === t);

                if (teamFound) {
                  currentTeam = teamFound.charAt(0) + teamFound.slice(1).toLowerCase();
                  // For stacked formats, the row containing the Team name typically contains the Team Total
                  // We skip this row so we only import individual product/territory metrics
                  return;
                }

                if (!currentTeam) return;

                // 2. Extract Basic Columns
                const regionVal = regionHeaderIdx !== -1 ? String(row[regionHeaderIdx] || "").trim() : "";
                const territoryVal = territoryHeaderIdx !== -1 ? String(row[territoryHeaderIdx] || "").trim() : "";
                const productVal = productHeaderIdx !== -1 ? String(row[productHeaderIdx] || "").trim() : "";

                // 3. Exclusion Logic
                if (territoryVal.toLowerCase().includes("total") || regionVal.toLowerCase().includes("total") || productVal.toLowerCase().includes("total")) return;

                // 4. Value Extraction
                let rawVal = String(row[dataColumnIndex] || "0").replace(/,/g, "").trim();
                if (rawVal === "-" || rawVal === "—" || rawVal === "") rawVal = "0";
                const numericVal = parseFloat(rawVal);
                if (isNaN(numericVal)) return;

                // 5. Department-Specific Record Creation
                if (isTerritory) {
                  // FORMAT: Teams | REGION | Territory | [Dates or TGT]
                  // Map Team Name to 'team' so it groups like the Sales department
                  // Map Territory + Region to 'metric' so we see the breakdown in the shortfall list
                  const teamName = currentTeam || "Unmapped Team";
                  const detailName = territoryVal ? `${territoryVal}${regionVal ? ` - ${regionVal}` : ''}` : (regionVal || "Unmapped Territory");

                  allNewEntries.push({
                    department: 'Territory Sales',
                    team: teamName,
                    metric: detailName,
                    plan: isMaster ? numericVal : 0,
                    actual: isMaster ? 0 : numericVal,
                    variance: isMaster ? -numericVal : numericVal,
                    unit: 'Units',
                    status: 'on-track',
                    reportDate: reportDateStr
                  });
                } else {
                  // FORMAT: Teams | Brand | [Dates or TGT]
                  // Standard Sales Department Logic (Groups by Team Name)
                  const metricName = productVal || territoryVal || regionVal;
                  if (metricName) {
                    allNewEntries.push({
                      department: 'Sales',
                      team: currentTeam,
                      metric: metricName,
                      plan: isMaster ? numericVal : 0,
                      actual: isMaster ? 0 : numericVal,
                      variance: isMaster ? -numericVal : numericVal,
                      unit: 'Units',
                      status: 'on-track',
                      reportDate: reportDateStr
                    });
                  }
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
      console.log(`📤 DataEntry: Sending ${allNewEntries.length} new records for incremental save`);
      setIsUploading(true);
      try {
        const success = await saveData('operationData', allNewEntries);

        if (success) {
          console.log('✅ Successfully sent to database, refreshing local state...');
          // Wrap refresh in catch for "message channel closed" resilience
          try {
            // Added small delay to ensure DB commit is visible
            await new Promise(r => setTimeout(r, 800));
            const updatedList = await getData('operationData');
            if (updatedList) {
              onDataUpdate(updatedList);
              notify(`Success: Imported ${allNewEntries.length} new records. View updated.`, 'success');
            }
          } catch (refreshErr) {
            console.error('Refresh error (channel closed?):', refreshErr);
            notify("Imported successfully, but dashboard refresh encountered a minor error. Please refresh page manually (F5).", 'warning');
          }
        } else {
          notify("Failed to save data to server.", 'error');
        }
      } catch (saveErr) {
        console.error('Save error:', saveErr);
        notify("Communication error during upload.", 'error');
      } finally {
        setIsUploading(false);
      }
    } else {
      notify(errors.length > 0 ? errors[0] : "No valid data found", 'error');
      setIsUploading(false);
    }
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
    { id: 'trade', label: 'Trade Ops', icon: '🚛', tabs: ['trade-sync'] },
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
          onResetData={async () => {
            if (confirm("WARNING: PERMANENTLY WIPE ALL SYSTEM DATA?\nThis cannot be undone.")) {
              const success = await resetDatabase();
              if (success) {
                onDataUpdate([]); onFinanceUpdate([]); onProductionUpdate([]);
                notify("System Reset Successful - Database Wiped", "warning");
                setTimeout(() => window.location.reload(), 2000);
              } else {
                notify("Failed to reset database", "error");
              }
            }
          }}
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

    if (activeTab === 'trade-sync') {
      return (
        <div className="space-y-12 animate-in fade-in">
          <div className="bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-xl text-center space-y-8">
            <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto text-4xl shadow-inner mb-6">🚛</div>
            <h3 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Trade Department Sync</h3>
            <p className="max-w-md mx-auto text-slate-500 text-[10px] font-black uppercase tracking-widest leading-relaxed">
              Upload the Consolidated Trade Target vs Sales sheet. The system will automatically detect the financial year and sync all 12 months.
            </p>
            <div className="pt-8">
              <BatchUpload
                title="Trade Upload Portal"
                description="Consolidated Target vs Sales"
                onUpload={handleUpload}
                onImageUpload={handleImageUpload}
                isUploading={isUploading}
              />
            </div>
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 text-left">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Required Format:</p>
              <ul className="text-[9px] font-bold text-slate-500 uppercase tracking-wider space-y-2">
                <li>• Customer Name column must be present</li>
                <li>• Pairs of "Month Budget" and "Month Sales" (e.g., July Budget, July Sales)</li>
                <li>• July starts the new Financial Year cycle</li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

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
            <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1 leading-none">OPERATIONAL PERIOD</p>
            <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">
              {`${monthName} ${selectedYear}`}
            </h3>
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
          description={isMaster ? "Syncing Monthly Projections" : `Syncing Operational Activity for ${selectedDays.length} Units`}
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
