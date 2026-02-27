
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout.tsx';
import { Dashboard } from './components/Dashboard.tsx';
import { DataEntry } from './components/DataEntry.tsx';
import { DepartmentMismatch, HolidaysMap, LocksMap, FinanceMismatchReport, ProductionReport, ProductionHolidaysMap } from './types.ts';
import { saveData, getData } from './services/dbService.ts';
import { MONTH_NAMES } from './config.ts';

const INITIAL_DATA: DepartmentMismatch[] = [
  { department: 'Production', metric: 'Sample Tablet Compression', plan: 5000000, actual: 4200000, variance: -800000, unit: 'Tabs', status: 'critical', reasoning: 'Initial system load. Use Data Entry to upload Excel files.' },
];

const App: React.FC = () => {
  const [view, setView] = useState<'dashboard' | 'sales-audit' | 'territory-sales' | 'trade-ops' | 'production-dashboard' | 'finance-dashboard' | 'data-entry'>('dashboard');
  const [isReady, setIsReady] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Persistent state for operational data
  const [operationData, setOperationData] = useState<DepartmentMismatch[]>([]);
  const [holidaysMap, setHolidaysMap] = useState<HolidaysMap>({});
  const [locksMap, setLocksMap] = useState<LocksMap>({});
  const [financeData, setFinanceData] = useState<FinanceMismatchReport[]>([]);
  const [productionData, setProductionData] = useState<ProductionReport[]>([]);
  const [productionHolidaysMap, setProductionHolidaysMap] = useState<ProductionHolidaysMap>({});

  // Data Loading function
  const loadFilteredData = async (month?: number, year?: number) => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const now = new Date();
      const targetMonth = month ?? now.getMonth();
      const targetYear = year ?? now.getFullYear();
      const targetMonthName = MONTH_NAMES[targetMonth];

      const savedOps = await getData('operationData', { year: targetYear, month: targetMonthName });
      const tradeOps = await getData('operationData', { department: 'TRADE' });
      const savedHols = await getData('holidaysMap');
      const savedLocks = await getData('locksMap');
      const savedFinance = await getData('financeData');
      const savedProduction = await getData('productionData');
      const savedProductionHols = await getData('productionHolidaysMap');

      const combinedOps = [
        ...(Array.isArray(savedOps) ? savedOps : []),
        ...(Array.isArray(tradeOps) ? tradeOps : [])
      ];

      setOperationData(combinedOps.length > 0 ? combinedOps : INITIAL_DATA);

      if (savedHols) setHolidaysMap(savedHols);
      if (savedLocks) setLocksMap(savedLocks);
      if (Array.isArray(savedFinance)) setFinanceData(savedFinance);
      if (Array.isArray(savedProduction)) setProductionData(savedProduction);
      if (savedProductionHols) setProductionHolidaysMap(savedProductionHols);

      setDataLoaded(true);
      console.log(`✅ Swiss Dashboard: Data synced for ${targetMonthName} ${targetYear}`);
    } catch (e: any) {
      console.error("❌ Swiss Dashboard: Sync failed.", e);
      setSyncError(e.message || "Connection failed");
    } finally {
      setIsSyncing(false);
      setIsReady(true);
    }
  };

  // Initial Load from Database
  useEffect(() => {
    loadFilteredData();
  }, []);

  // Persistent Save to IndexedDB (Only if dataLoaded is true)
  // DISABLED auto-save for operationData to prevent PayloadTooLarge errors with 500k+ records.
  // Saving is now handled incrementally by individual components.
  /*
  useEffect(() => {
    if (isReady && dataLoaded) {
      console.log(`💾 App: Saving ${operationData.length} operation records to database`);
      saveData('operationData', operationData);
    }
  }, [operationData, isReady, dataLoaded]);
  */

  useEffect(() => {
    if (isReady && dataLoaded) saveData('holidaysMap', holidaysMap);
  }, [holidaysMap, isReady, dataLoaded]);

  useEffect(() => {
    if (isReady && dataLoaded) saveData('locksMap', locksMap);
  }, [locksMap, isReady, dataLoaded]);

  useEffect(() => {
    if (isReady && dataLoaded) saveData('financeData', financeData);
  }, [financeData, isReady, dataLoaded]);

  useEffect(() => {
    if (isReady && dataLoaded) saveData('productionData', productionData);
  }, [productionData, isReady, dataLoaded]);

  useEffect(() => {
    if (isReady && dataLoaded) saveData('productionHolidaysMap', productionHolidaysMap);
  }, [productionHolidaysMap, isReady, dataLoaded]);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-white font-black uppercase tracking-[0.3em] text-[10px]">Waking Swiss Intelligence...</p>
        </div>
      </div>
    );
  }

  if (!dataLoaded) {
    return (
      <div className="min-h-screen bg-red-950 flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-black/40 backdrop-blur-3xl border border-red-500/30 p-12 rounded-[3rem] text-center space-y-8 shadow-2xl">
          <div className="text-6xl">🔒</div>
          <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">System Locked</h1>
          <p className="text-red-200 text-[10px] font-black uppercase tracking-widest leading-relaxed">
            Connection Failed
          </p>
          <button onClick={() => window.location.reload()} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em]">
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <Layout
      currentView={view}
      onViewChange={setView}
      onSalesUpdate={setOperationData}
      onFinanceUpdate={setFinanceData}
      onProductionUpdate={setProductionData}
      isSyncing={isSyncing}
      syncError={syncError}
    >
      {view === 'dashboard' || view === 'sales-audit' || view === 'territory-sales' || view === 'trade-ops' || view === 'finance-dashboard' || view === 'production-dashboard' ? (
        <Dashboard
          data={operationData}
          onDataUpdate={setOperationData}
          holidaysMap={holidaysMap}
          financeData={financeData}
          productionData={productionData}
          productionHolidaysMap={productionHolidaysMap}
          activeView={view}
          onRefreshRequested={loadFilteredData}
          isSyncing={isSyncing}
          syncError={syncError}
        />
      ) : (
        <DataEntry
          data={operationData}
          onDataUpdate={setOperationData}
          financeData={financeData}
          onFinanceUpdate={setFinanceData}
          productionData={productionData}
          onProductionUpdate={setProductionData}
          holidaysMap={holidaysMap}
          setHolidaysMap={setHolidaysMap}
          productionHolidaysMap={productionHolidaysMap}
          setProductionHolidaysMap={setProductionHolidaysMap}
          locksMap={locksMap}
          setLocksMap={setLocksMap}
        />
      )}
    </Layout>
  );
};

export default App;
