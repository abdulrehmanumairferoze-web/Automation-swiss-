
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout.tsx';
import { Dashboard } from './components/Dashboard.tsx';
import { DataEntry } from './components/DataEntry.tsx';
import { DepartmentMismatch, HolidaysMap, LocksMap, FinanceMismatchReport, ProductionReport, ProductionHolidaysMap } from './types.ts';
import { saveData, getData } from './services/dbService.ts';

const INITIAL_DATA: DepartmentMismatch[] = [
  { department: 'Production', metric: 'Sample Tablet Compression', plan: 5000000, actual: 4200000, variance: -800000, unit: 'Tabs', status: 'critical', reasoning: 'Initial system load. Use Data Entry to upload Excel files.' },
];

const App: React.FC = () => {
  const [view, setView] = useState<'dashboard' | 'data-entry'>('dashboard');
  const [isReady, setIsReady] = useState(false);

  // Persistent state for operational data
  const [operationData, setOperationData] = useState<DepartmentMismatch[]>([]);
  const [holidaysMap, setHolidaysMap] = useState<HolidaysMap>({});
  const [locksMap, setLocksMap] = useState<LocksMap>({});
  const [financeData, setFinanceData] = useState<FinanceMismatchReport[]>([]);
  const [productionData, setProductionData] = useState<ProductionReport[]>([]);
  const [productionHolidaysMap, setProductionHolidaysMap] = useState<ProductionHolidaysMap>({});

  // Initial Load from IndexedDB
  useEffect(() => {
    const loadPersistedData = async () => {
      try {
        const savedOps = await getData('operationData');
        const savedHols = await getData('holidaysMap');
        const savedLocks = await getData('locksMap');
        const savedFinance = await getData('financeData');
        const savedProduction = await getData('productionData');
        const savedProductionHols = await getData('productionHolidaysMap');

        if (savedOps) setOperationData(savedOps);
        else setOperationData(INITIAL_DATA);

        if (savedHols) setHolidaysMap(savedHols);
        if (savedLocks) setLocksMap(savedLocks);
        if (savedFinance) setFinanceData(savedFinance);
        if (savedProduction) setProductionData(savedProduction);
        if (savedProductionHols) setProductionHolidaysMap(savedProductionHols);
      } catch (e) {
        console.error("DB Load Error", e);
        setOperationData(INITIAL_DATA);
      } finally {
        setIsReady(true);
      }
    };
    loadPersistedData();
  }, []);

  // Persistent Save to IndexedDB
  useEffect(() => {
    if (isReady) saveData('operationData', operationData);
  }, [operationData, isReady]);

  useEffect(() => {
    if (isReady) saveData('holidaysMap', holidaysMap);
  }, [holidaysMap, isReady]);

  useEffect(() => {
    if (isReady) saveData('locksMap', locksMap);
  }, [locksMap, isReady]);

  useEffect(() => {
    if (isReady) saveData('financeData', financeData);
  }, [financeData, isReady]);

  useEffect(() => {
    if (isReady) saveData('productionData', productionData);
  }, [productionData, isReady]);

  useEffect(() => {
    if (isReady) saveData('productionHolidaysMap', productionHolidaysMap);
  }, [productionHolidaysMap, isReady]);

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

  return (
    <Layout currentView={view} onViewChange={setView}>
      {view === 'dashboard' ? (
        <Dashboard
          data={operationData}
          onDataUpdate={setOperationData}
          holidaysMap={holidaysMap}
          financeData={financeData}
          productionData={productionData}
          productionHolidaysMap={productionHolidaysMap}
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
