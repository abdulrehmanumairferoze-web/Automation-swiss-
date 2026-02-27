
import { GoogleGenAI, Type } from "@google/genai";
import { DepartmentMismatch, FinanceMismatchReport, ProductionReport } from "../types.ts";

export interface SummaryResult {
  executiveSummary: string;
  detailedAnalysis: string;
  actions: string[];
  readingTimeMinutes: number;
}

export interface MasterAuditSummary {
  whatsappMessage: string;
}

export interface DailyReportContent {
  executiveSummary: string;
  salesSection: string;
  financeSection: string;
  productionSection: string;
  whatsappMessage: string;
}

const getApiKey = () => {
  // Vite uses import.meta.env
  return (import.meta as any).env?.VITE_API_KEY || (process as any).env?.API_KEY || '';
};

export const summarizeOperations = async (
  currentData: DepartmentMismatch[]
): Promise<SummaryResult> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  // Truncate or sample data if it's too large, but keep enough for a deep analysis
  const relevantData = currentData.filter(d => d.department === 'Sales' || d.department === 'Territory Sales');
  // We send up to 600 items for a richer analysis if available
  const summarizedPayload = relevantData.length > 600
    ? relevantData.slice(0, 600)
    : relevantData;

  const prompt = `
    You are the Chief Operating Officer (COO) at Swiss Pharmaceuticals.
    Analyze the provided sales performance and territory data.
    
    GOAL: Generate a comprehensive executive report that takes exactly 5 MINUTES TO READ.
    TARGET WORD COUNT: 1,000 - 1,200 words.
    
    Structure your response as follows:
    1. Executive Summary (200 words): High-level overview of monthly vs daily performance trajectory.
    2. Regional & Team Deep-Dive (500 words): Analyze Achievers, Passionate, Concord, and Dynamic teams. Identify specific product-level shortfalls and regional variances. Use data trends to explain WHY certain targets are being missed (e.g., seasonal trends, specific product stockouts).
    3. Operational Risk Assessment (300 words): Evaluate the impact of current shortfalls on quarterly goals.
    4. Strategic Board Action Plan: Provide exactly 7 high-impact, specific bullet points.
    
    Formatting: Use Markdown. Use bold text for key figures and product names.
    
    Data to Analyze:
    ${JSON.stringify(summarizedPayload)}
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            executiveSummary: { type: Type.STRING },
            detailedAnalysis: { type: Type.STRING, description: "Detailed Markdown analysis (800+ words)" },
            actions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            readingTimeMinutes: { type: Type.NUMBER, description: "Estimated reading time (should be 5)" }
          },
          required: ["executiveSummary", "detailedAnalysis", "actions", "readingTimeMinutes"]
        }
      }
    });

    const text = response.text || "{}";
    const result = JSON.parse(text) as SummaryResult;
    // Ensure we communicate the 5-minute target in the UI
    result.readingTimeMinutes = 5;
    return result;
  } catch (error) {
    console.error("Gemini Service Error:", error);
    return {
      executiveSummary: "Data synchronization successful, but analysis failed due to API limits.",
      detailedAnalysis: "The dataset provided is extensive. While the raw data is available on the dashboard, the AI-powered deep dive requires a valid API key and smaller batch processing for this volume of records.",
      actions: ["Check API Key configuration", "Reduce data volume by filtering for specific teams", "Contact System Admin"],
      readingTimeMinutes: 1
    };
  }
};

export const generateMasterAuditSummary = async (data: DepartmentMismatch[]): Promise<MasterAuditSummary> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const prompt = `
    Create an urgent WhatsApp alert for the Board of Directors.
    Summarize critical shortfalls from this data in under 150 words.
    Data: ${JSON.stringify(data.filter(d => d.department === 'Sales' && d.status !== 'on-track').slice(0, 30))}
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            whatsappMessage: { type: Type.STRING }
          },
          required: ["whatsappMessage"]
        }
      }
    });
    return JSON.parse(response.text || "{}") as MasterAuditSummary;
  } catch (error) {
    return { whatsappMessage: "Board Alert: Manual audit required. Daily targets for multiple products show critical variance." };
  }
};

export const generateDailyReportContent = async (
  sales: DepartmentMismatch[],
  finance: FinanceMismatchReport[],
  production: ProductionReport[]
): Promise<DailyReportContent> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  // Prepare summarized data chunks to stay within context window
  const salesSummary = sales.filter(d => d.status !== 'on-track').slice(0, 50);
  const financeSummary = finance.slice(0, 2); // Last 2 months or reports
  const productionSummary = production.slice(0, 2);

  const prompt = `
    You are the Chief Strategy Officer at Swiss Pharmaceuticals.
    Generate a Unified Daily Operational Report combining Sales, Finance, and Production data.

    Data Provided:
    Sales Issues (Top 50 Critical): ${JSON.stringify(salesSummary)}
    Finance Reports: ${JSON.stringify(financeSummary)}
    Production Reports: ${JSON.stringify(productionSummary)}

    Output Requirements:
    1. executiveSummary: A powerful 150-word overview of the health of the company today.
    2. salesSection: 200 words. Key highlights of sales performance, focusing on critical gaps.
    3. financeSection: 200 words. Cash flow status, major variances in inflow/outflow.
    4. productionSection: 200 words. Production efficiency, major lags against plan.
    5. whatsappMessage: A format suited for WhatsApp (use emojis 🚨 📉 💰). Start with "*Daily Management Update*". Summarize the biggest red flag and the biggest win. Keep it under 100 words.

    Format sections in simple text (not Markdown) as they will be put into a PDF.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            executiveSummary: { type: Type.STRING },
            salesSection: { type: Type.STRING },
            financeSection: { type: Type.STRING },
            productionSection: { type: Type.STRING },
            whatsappMessage: { type: Type.STRING }
          },
          required: ["executiveSummary", "salesSection", "financeSection", "productionSection", "whatsappMessage"]
        }
      }
    });
    return JSON.parse(response.text || "{}") as DailyReportContent;
  } catch (error) {
    console.error("Gemini Report Generation Error", error);
    return {
      executiveSummary: "Report generation failed. Please check connectivity.",
      salesSection: "Data available in dashboard.",
      financeSection: "Data available in dashboard.",
      productionSection: "Data available in dashboard.",
      whatsappMessage: "⚠️ *System Alert*: Daily Report generation failed. Please check the dashboard manually."
    };
  }
};

export const parseImageToData = async (
  imageBase64: string,
  type: 'daily' | 'master' | 'production' | 'finance' | 'territory-daily' | 'territory-master'
): Promise<any[]> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  // Clean base64 string
  const base64Data = imageBase64.split(',')[1] || imageBase64;

  let prompt = '';

  if (type === 'production') {
    prompt = `
      Extract Production data from this image.
      Return a JSON array where each object has:
      - name: string (Product Name)
      - monthlyPlan: number
      - totalAchieved: number
      - dailyData: array of objects { day: number, achieved: number }
      
      If daily breakdown is not visible, just return totalAchieved and monthlyPlan.
      Ignore rows with "Total" or empty names.
     `;
  } else if (type === 'finance') {
    prompt = `
      Extract Finance/Cash Flow data from this image.
      Identify sections: Inflow and Outflow.
      Return a JSON array of objects with:
      - name: string (Particulars)
      - type: 'inflow' | 'outflow'
      - totalProjected: number
      - totalActual: number
      - weeks: array of objects { weekNumber: number, projected: number, actual: number } (if visible)
     `;
  } else {
    // Sales (Daily/Master)
    prompt = `
      Extract Sales/Target data from this image.
      Return a JSON array of objects with:
      - department: string (default 'Sales')
      - team: string (Achievers, Passionate, Concord, Dynamic - infer if possible)
      - metric: string (Product Name)
      - plan: number (Target)
      - actual: number (Achievement)
      - unit: string (default 'Units')
      
      If it's a daily report, 'actual' is the important number. If master plan, 'plan' is important.
    `;
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/jpeg', data: base64Data } }
        ]
      }],
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text || "[]";
    // Handle potential array wrapping or object wrapping
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : (parsed.data || []);
  } catch (error) {
    console.error("Gemini Vision Parsing Error:", error);
    throw new Error("Failed to extract data from image. Please ensure the image is clear.");
  }
};
