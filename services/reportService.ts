import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DailyReportContent } from './geminiService';
import { DepartmentMismatch, FinanceMismatchReport, ProductionReport } from '../types';

const COLORS = {
    primary: [34, 197, 94] as [number, number, number],
    secondary: [15, 23, 42] as [number, number, number],
    success: [22, 163, 74] as [number, number, number],
    danger: [220, 38, 38] as [number, number, number],
    warning: [234, 179, 8] as [number, number, number],
    light: [248, 250, 252] as [number, number, number],
    text: [51, 65, 85] as [number, number, number],
    grid: [226, 232, 240] as [number, number, number],
};

export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
};

const safeNum = (val: any) => {
    const n = Number(val);
    return isNaN(n) ? 0 : n;
};

// Helper to load image as DataURL for jspdf
const loadLogoAsDataURL = (): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => {
            console.warn("Logo failed to load, falling back to placeholder.");
            resolve(''); // Return empty string to trigger fallback
        };
        img.src = '/logo.png';
    });
};

const aggregateDeptData = (data: DepartmentMismatch[] = [], dept: string, dayNum: number, workingDaysCount: number = 26) => {
    const weightOfLastDay = 3.5;
    const totalWeights = (workingDaysCount - 1) + weightOfLastDay;

    if (!Array.isArray(data)) return [];

    const allMetrics = [...new Set(data.filter(d => d && d.department === dept).map(d => d.metric))];

    return allMetrics.map(metric => {
        const master = data.find(d => d && d.department === dept && d.metric === metric && d.reportDate?.startsWith('MASTER_'));
        const rawPlan = master ? safeNum(master.plan) : 0;
        const dailyPlan = Math.round(rawPlan / totalWeights);

        const dailyEntry = data
            .filter(d => d && d.department === dept && d.metric === metric && !d.reportDate?.startsWith('MASTER_'))
            .sort((a, b) => (b.reportDate || '').localeCompare(a.reportDate || ''))[0];

        return {
            team: master?.team || dailyEntry?.team || 'Unknown',
            metric: metric || 'Unnamed Metric',
            plan: dailyPlan,
            actual: dailyEntry ? safeNum(dailyEntry.actual) : 0
        };
    }).filter(d => d.plan > 0 || d.actual > 0);
};

const drawBarChart = (doc: jsPDF, title: string, data: { label: string, value: number, target: number }[], y: number) => {
    try {
        const margin = 20;
        const chartWidth = 170;
        const chartHeight = 45;
        const barSpacing = 10;
        const barWidth = (chartWidth / Math.max(data.length, 1)) - barSpacing;

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...COLORS.secondary);
        doc.text(title.toUpperCase(), margin, y);

        const chartY = y + 8;
        const maxValue = Math.max(...data.map(d => Math.max(safeNum(d.value), safeNum(d.target))), 100);
        const scaleFactor = 1.15;
        const upperLimit = maxValue * scaleFactor;

        doc.setDrawColor(...COLORS.grid);
        doc.setLineWidth(0.1);
        const steps = 4;
        for (let s = 0; s <= steps; s++) {
            const gridVal = (maxValue / steps) * s;
            const gridY = chartY + chartHeight - (gridVal / upperLimit) * chartHeight;
            doc.line(margin, gridY, margin + chartWidth, gridY);
            doc.setFontSize(5);
            doc.setTextColor(148, 163, 184);
            doc.text(Math.round(gridVal).toLocaleString(), margin - 2, gridY, { align: 'right' });
        }

        data.forEach((d, i) => {
            const x = margin + i * (barWidth + barSpacing);
            const valH = (safeNum(d.value) / upperLimit) * chartHeight;
            const tgtH = (safeNum(d.target) / upperLimit) * chartHeight;
            const bottomY = chartY + chartHeight;

            doc.setFillColor(248, 250, 252);
            doc.rect(x, chartY, barWidth, chartHeight, 'F');

            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.3);
            const targetLineY = bottomY - tgtH;
            doc.line(x, targetLineY, x + barWidth, targetLineY);

            const isSuccessful = safeNum(d.value) >= safeNum(d.target);
            const barColor = isSuccessful ? COLORS.success : COLORS.danger;
            doc.setFillColor(...barColor);
            doc.rect(x + barWidth * 0.1, bottomY - Math.max(0, valH), barWidth * 0.8, Math.max(1, valH), 'F');

            doc.setFontSize(6);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...barColor);
            doc.text(safeNum(d.value).toLocaleString(), x + barWidth / 2, bottomY - valH - 2, { align: 'center' });

            doc.setFontSize(4);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(148, 163, 184);
            doc.text(`Tgt: ${safeNum(d.target).toLocaleString()}`, x + barWidth / 2, targetLineY - 1, { align: 'center' });

            doc.setFontSize(6);
            doc.setTextColor(...COLORS.text);
            const labelStr = String(d.label || '');
            const cleanLabel = labelStr.length > 12 ? labelStr.substring(0, 10) + '..' : labelStr;
            doc.text(cleanLabel, x + barWidth / 2, bottomY + 4, { align: 'center', angle: -20 });
        });

        return chartY + chartHeight + 20;
    } catch (err) {
        console.error("Chart Drawing Error", err);
        doc.text("Chart rendering skipped due to data variance.", 20, y + 10);
        return y + 20;
    }
};

const addHeader = (doc: jsPDF, title: string, logoData?: string) => {
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 0, 210, 42, 'F');

    if (logoData) {
        // Company Logo
        doc.addImage(logoData, 'PNG', 15, 8, 25, 25);
    } else {
        // Swiss Cross Icon Placeholder
        doc.setFillColor(255, 255, 255);
        doc.rect(20, 12, 8, 8, 'F');
        doc.setDrawColor(...COLORS.primary);
        doc.setLineWidth(1.5);
        doc.line(24, 14, 24, 18);
        doc.line(22, 16, 26, 16);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("SWISS OPERATIONAL HUB", 45, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(String(title || '').toUpperCase(), 45, 28);

    doc.setFontSize(8);
    doc.text(new Date().toUTCString(), 190, 20, { align: 'right' });

    doc.setDrawColor(22, 163, 74);
    doc.setLineWidth(0.5);
    doc.line(0, 42, 210, 42);
};

const addFooter = (doc: jsPDF) => {
    const pageCount = (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Swiss Confidential Strategy Report • Page ${i} of ${pageCount}`, 105, 288, { align: 'center' });
    }
};

const generateInternalPDF = async (
    content: DailyReportContent,
    salesData: DepartmentMismatch[] = [],
    finance: FinanceMismatchReport[] = [],
    production: ProductionReport[] = [],
    workingDaysCount: number = 26
): Promise<jsPDF> => {
    const doc = new jsPDF();
    const dayNum = new Date().getDate();
    const aggregatedSales = aggregateDeptData(salesData, 'Sales', dayNum, workingDaysCount);
    const aggregatedTerritory = aggregateDeptData(salesData, 'Territory Sales', dayNum, workingDaysCount);
    const logoData = await loadLogoAsDataURL();

    addHeader(doc, "Executive Intelligence Overview", logoData);
    let y = 55;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.secondary);
    doc.text("Tactical Summary", 20, y);
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.text);
    doc.setFont("helvetica", "normal");
    const summaryLines = doc.splitTextToSize(String(content?.executiveSummary || 'Summary unavailable'), 170);
    doc.text(summaryLines, 20, y);
    y += summaryLines.length * 6 + 12;

    const teams = ['Achievers', 'Passionate', 'Concord', 'Dynamic'];
    const teamSalesData = teams.map(t => {
        const rows = aggregatedSales.filter(d => d.team === t);
        return {
            label: t,
            value: rows.reduce((a, b) => a + b.actual, 0),
            target: Math.round(rows.reduce((a, b) => a + b.plan, 0))
        };
    });
    y = drawBarChart(doc, "Field Sales: Target vs. Execution", teamSalesData, y);

    y = drawBarChart(doc, "Field Sales: Target vs. Execution", teamSalesData, y);

    // --- NEW: Team Trend & Insight Section ---
    doc.addPage();
    addHeader(doc, "Team Trend Trajectory", logoData);
    y = 55;

    // We need to reconstruct the daily trend data here or pass it in.
    // For simplicity in this service, we will re-calculate the aggregates per team similar to the dashboard logic
    // but simplified for the PDF Report.
    // Ideally, we should pass the calculated trend data, but changing the function signature might break other callers?
    // Let's re-calc briefly.

    const uniqueTeams = Array.from(new Set(salesData.filter(d => d.team !== 'Unmapped').map(d => d.team)));

    uniqueTeams.forEach((team, teamIdx) => {
        if (y > 220) { doc.addPage(); addHeader(doc, "Team Trend Trajectory (Cont.)", logoData); y = 55; }

        const teamRows = salesData.filter(d => d.team === team && !d.reportDate?.startsWith('MASTER'));
        const teamMaster = salesData.find(d => d.team === team && d.reportDate?.startsWith('MASTER'));
        const monthlyTarget = teamMaster ? safeNum(teamMaster.plan) : 0;
        const achieved = teamRows.reduce((sum, r) => sum + r.actual, 0);

        // Draw Team Header
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...COLORS.secondary);
        doc.text(`${team.toUpperCase()}`, 20, y);

        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Target: ${monthlyTarget.toLocaleString()} | Achieved: ${achieved.toLocaleString()}`, 20, y + 5);

        // Simple Mini-Chart (Placeholder for full trend due to PDF complexity)
        // We will just show the text insight here for now as drawing complex daily charts in jsPDF is heavy.
        // Actually, let's draw a simple progress bar.

        const pct = monthlyTarget > 0 ? achieved / monthlyTarget : 0;
        const barW = 100;
        const barH = 4;

        doc.setFillColor(226, 232, 240);
        doc.rect(20, y + 10, barW, barH, 'F'); // bg

        doc.setFillColor(pct >= 1 ? 34 : 220, pct >= 1 ? 197 : 38, pct >= 1 ? 94 : 38); // green or red
        doc.rect(20, y + 10, Math.min(barW, barW * pct), barH, 'F'); // fg

        doc.setFontSize(10);
        doc.setTextColor(pct >= 1 ? 22 : 220, pct >= 1 ? 163 : 38, pct >= 1 ? 74 : 38);
        doc.text(`${(pct * 100).toFixed(1)}%`, 20 + barW + 5, y + 13);

        // Insight Text (Simulated as we don't have the exact text prop here easily without big refactor)
        // We will generate a static insight based on simple math
        const remainingDays = workingDaysCount - (teamRows.length / 2); // approx
        const required = monthlyTarget - achieved;
        const reqStr = required <= 0 ? "Target Achieved" : `Needs ${required.toLocaleString()} more`;

        doc.setFontSize(9);
        doc.setTextColor(...COLORS.text);
        doc.setFont("helvetica", "italic");
        doc.text(`Insight: ${reqStr}. Current pace suggests ${pct > 0.9 ? 'strong finish' : 'acceleration needed'}.`, 20, y + 22);

        y += 40;
    });

    const currentProd = production && production[0];
    if (currentProd && currentProd.particulars) {
        const prodChartData = currentProd.particulars.slice(0, 6).map(p => ({
            label: p.name,
            value: safeNum(p.totalAchieved),
            target: Math.round(safeNum(p.monthlyPlan) / workingDaysCount)
        }));
        y = drawBarChart(doc, "Production Efficiency Matrix", prodChartData, y);
    }

    doc.addPage();
    addHeader(doc, "Analytical Performance Breakdown", logoData);
    y = 52;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.danger);
    doc.text("Strategic Sales Shortfalls", 20, y);
    const salesTable = aggregatedSales
        .filter(d => d.actual < d.plan)
        .sort((a, b) => (b.plan - b.actual) - (a.plan - a.actual))
        .slice(0, 15)
        .map(d => [d.team, d.metric, d.plan.toLocaleString(), d.actual.toLocaleString(), (d.actual - d.plan).toLocaleString(), ((d.actual / (d.plan || 1)) * 100).toFixed(1) + '%']);

    autoTable(doc, {
        startY: y + 5,
        head: [['Force', 'Product SKU', 'Daily Tgt', 'Achieved', 'Variance', '%']],
        body: salesTable,
        theme: 'striped',
        headStyles: { fillColor: COLORS.primary, fontSize: 8 },
        styles: { fontSize: 7 }
    });

    const lastSalesY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : y + 20;
    y = lastSalesY + 15;
    if (y > 220) { doc.addPage(); y = 52; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.secondary);
    doc.text("Territorial Achievement Audit", 20, y);
    const territoryTable = aggregatedTerritory
        .sort((a, b) => (b.plan - b.actual) - (a.plan - a.actual))
        .slice(0, 15)
        .map(d => [d.team, d.metric, d.plan.toLocaleString(), d.actual.toLocaleString(), (d.actual - d.plan).toLocaleString(), ((d.actual / (d.plan || 1)) * 100).toFixed(1) + '%']);

    autoTable(doc, {
        startY: y + 5,
        head: [['Force', 'Region/Territory', 'Daily Tgt', 'Achieved', 'Variance', '%']],
        body: territoryTable,
        theme: 'grid',
        headStyles: { fillColor: COLORS.secondary, fontSize: 8 },
        styles: { fontSize: 7 }
    });

    doc.addPage();
    addHeader(doc, "Financial & Supply Chain Audit", logoData);
    y = 52;
    const currentFin = finance && finance[0];
    if (currentFin) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...COLORS.success);
        doc.text("Liquidity & Cash Flow Statement", 20, y);
        const finSummary = [
            ['Capital Inflow', safeNum(currentFin.inflow?.projected).toLocaleString(), safeNum(currentFin.inflow?.actual).toLocaleString(), safeNum(currentFin.inflow?.percentage).toFixed(1) + '%'],
            ['Capital Outflow', safeNum(currentFin.outflow?.projected).toLocaleString(), safeNum(currentFin.outflow?.actual).toLocaleString(), safeNum(currentFin.outflow?.percentage).toFixed(1) + '%'],
            ['Net Operational Liquidity', safeNum(currentFin.netPosition?.projected).toLocaleString(), safeNum(currentFin.netPosition?.actual).toLocaleString(), safeNum(currentFin.netPosition?.variance).toLocaleString()]
        ];
        autoTable(doc, {
            startY: y + 5,
            head: [['Operational Metric', 'Projected', 'Realized', 'Performance']],
            body: finSummary,
            theme: 'plain',
            headStyles: { fillColor: COLORS.success, fontSize: 9 },
            styles: { fontSize: 9, fontStyle: 'bold' }
        });
        const lastFinY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : y + 20;
        y = lastFinY + 15;
    }

    if (currentProd && currentProd.particulars) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...COLORS.warning);
        doc.text("Production Line Performance Log", 20, y);
        const prodRows = currentProd.particulars.slice(0, 20).map(p => [
            p.name,
            safeNum(p.monthlyPlan).toLocaleString(),
            safeNum(p.totalAchieved).toLocaleString(),
            safeNum(p.mtdPercentage).toFixed(1) + '%',
            p.remarks || 'Standard Operation'
        ]);
        autoTable(doc, {
            startY: y + 5,
            head: [['Line Item', 'Monthly Goal', 'Achieved', 'Efficiency', 'Field Remarks']],
            body: prodRows,
            headStyles: { fillColor: COLORS.warning, fontSize: 8 },
            styles: { fontSize: 7 }
        });
    }

    addFooter(doc);
    return doc;
};

export const generateDailyPDF = async (
    content: DailyReportContent,
    sales: DepartmentMismatch[],
    finance: FinanceMismatchReport[],
    production: ProductionReport[],
    workingDaysCount: number = 26
) => {
    try {
        const doc = await generateInternalPDF(content, sales, finance, production, workingDaysCount);
        doc.save(`Swiss_Intelligence_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
        console.error("PDF Final Render Error", err);
        throw new Error("PDF layout failed. Try refreshing data.");
    }
};

export const generateReportFile = async (
    content: DailyReportContent,
    sales: DepartmentMismatch[],
    finance: FinanceMismatchReport[],
    production: ProductionReport[],
    workingDaysCount: number = 26
): Promise<File> => {
    const doc = await generateInternalPDF(content, sales, finance, production, workingDaysCount);
    const blob = doc.output('blob');
    return new File([blob], `Swiss_Hub_Report_${new Date().toISOString().slice(0, 10)}.pdf`, { type: 'application/pdf' });
};

export const generateWhatsAppLink = (message: string) => {
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
};
