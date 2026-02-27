
import { DepartmentMismatch, HolidaysMap, LocksMap } from '../types.ts';

const API_BASE = '/api';

// Remote logging helper
const remoteLog = async (level: 'info' | 'error', message: string, details?: any) => {
  try {
    await fetch(`${API_BASE}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, message, details })
    });
  } catch (e) {
    console.warn('Failed to send remote log', e);
  }
};

export const saveData = async (key: string, value: any) => {
  let endpoint = `${API_BASE}/config`;
  if (key === 'operationData') endpoint = `${API_BASE}/operationData`;
  else if (key === 'financeData') endpoint = `${API_BASE}/finance`;
  else if (key === 'productionData') endpoint = `${API_BASE}/production`;

  try {
    // For finance and production, we need to send as {key, value}
    // For operationData, we send the array directly
    const body = key === 'operationData'
      ? value
      : { key, value: JSON.stringify(value) }; // Convert to JSON string for JSONB columns

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (response.ok) {
      console.log('Successfully sent to database'); // Requested log
      remoteLog('info', `Successfully saved data for key: ${key}`);
      return true;
    } else {
      remoteLog('error', `Failed to save data for key: ${key}`, { status: response.status });
      return false;
    }
  } catch (e: any) {
    remoteLog('error', `Exception while saving data for key: ${key}`, e.message);
    return false;
  }
};

export const getData = async (key: string, params?: Record<string, any>): Promise<any> => {
  let endpoint = `${API_BASE}/config?key=${key}`;
  if (key === 'operationData') {
    endpoint = `${API_BASE}/operationData`;
    if (params) {
      const queryParams = new URLSearchParams(params).toString();
      endpoint += `?${queryParams}`;
    }
  }
  else if (key === 'financeData') endpoint = `${API_BASE}/finance?key=${key}`;
  else if (key === 'productionData') endpoint = `${API_BASE}/production?key=${key}`;

  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      remoteLog('error', `DB Fetch Failed for key: ${key}`, { status: response.status });
      throw new Error(`DB Fetch Failed: ${response.status}`);
    }
    const data = await response.json();
    remoteLog('info', `Successfully fetched data for key: ${key}`, { count: Array.isArray(data) ? data.length : 'Object' });
    return data;
  } catch (e: any) {
    remoteLog('error', `Exception while fetching data for key: ${key}`, e.message);
    throw e;
  }
};

export const initDB = async () => true;

// New: Upload MREP File
export const uploadMREPFile = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${API_BASE}/upload/mrep`, {
      method: 'POST',
      body: formData, // No Content-Type header needed, fetch sets it for FormData
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Upload Failed: ${errText}`);
    }

    const result = await response.json();
    remoteLog('info', `MREP Upload Success: ${result.inserted} inserted, ${result.updated} updated`);
    return result;

  } catch (e: any) {
    remoteLog('error', 'Exception during MREP upload', e.message);
    throw e;
  }
};

export const resetDatabase = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/reset`, {
      method: 'DELETE',
    });
    const result = await response.json();
    if (result.success) {
      remoteLog('info', 'Database Reset Successful - All data wiped');
      return true;
    }
    return false;
  } catch (err: any) {
    remoteLog('error', 'Database Reset Error', err.message);
    return false;
  }
};
