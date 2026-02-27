"""
pdf_generator.py
Generates specialized Variance Report PDFs (Financial & Units) with Visual Analytics.
Theme: Emerald Green (#50C878)
"""

import os
import logging
import pandas as pd
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, inch
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, 
    PageBreak, HRFlowable, BaseDocTemplate, Frame, PageTemplate, KeepTogether,
    Flowable
)
from reportlab.graphics.shapes import Drawing, Rect, Line, String, Group
from reportlab.graphics import renderPDF

SALMON = colors.HexColor("#FFB6B2") # Soft Salmon for Hero Card
OFF_WHITE = colors.HexColor("#FAFAFA")
E0E0E0 = colors.HexColor("#E0E0E0")

logger = logging.getLogger(__name__)

# ── BRANDING COLORS ──
EMERALD = colors.HexColor("#50C878") # Requested Emerald Green
SALMON_DANGER = colors.HexColor("#FF7675") # New Salmon Danger
AMBER_WARN = colors.HexColor("#FFD93D")    # Muted Amber
FAINT_RED = colors.HexColor("#FFF5F5")     # Faint Red Row Tint
LIGHT_NEUTRAL = colors.HexColor("#F8F9FA") # Light Grey Zebra
WHITE = colors.white
DARK_GRAY = colors.HexColor("#333333")
MEDIUM_GRAY = colors.HexColor("#666666")
BORDER_LIGHT = colors.HexColor("#E0E0E0")

LOGO_PATH = os.path.join(os.path.dirname(__file__), "assets", "logo.png")

# ── CUSTOM FLOWABLES ──

class HeroMetricCard(Flowable):
    """Impact Card: Rounded white box with a soft shadow at the top right."""
    def __init__(self, label, value, width=60*mm, height=30*mm, color=WHITE, small=False):
        Flowable.__init__(self)
        self.label = label
        self.value = value
        self.width = width
        self.height = height
        self.bg_color = color
        self.small = small

    def draw(self):
        self.canv.saveState()
        # Draw Shadow (Subtle offset)
        self.canv.setFillColor(colors.Color(0, 0, 0, alpha=0.05))
        self.canv.roundRect(1.5*mm, -1.5*mm, self.width, self.height, 6, fill=1, stroke=0)
        
        # Draw Card Body
        self.canv.setFillColor(self.bg_color)
        self.canv.setStrokeColor(BORDER_LIGHT)
        self.canv.roundRect(0, 0, self.width, self.height, 6, fill=1, stroke=1)
        
        # Label
        label_size = 8 if self.small else 9
        self.canv.setFont("Helvetica", label_size)
        self.canv.setFillColor(MEDIUM_GRAY)
        self.canv.drawString(5*mm, self.height - (8 if self.small else 10)*mm, self.label.upper())
        
        # Accent Line
        self.canv.setFillColor(EMERALD)
        line_w = 8 if self.small else 10
        self.canv.rect(5*mm, self.height - (10 if self.small else 13)*mm, line_w*mm, 1.5*mm, stroke=0, fill=1)
        
        # Value (Auto-shrink if too long)
        val_size = 15 if self.small else 20
        
        # Approximate width check (roughly size * 0.6 per char for Bold)
        val_str = str(self.value)
        if len(val_str) > 10:
            val_size = val_size * (10 / len(val_str))
            
        self.canv.setFont("Helvetica-Bold", val_size)
        self.canv.setFillColor(DARK_GRAY)
        self.canv.drawString(5*mm, 6*mm if self.small else 7*mm, val_str)
        self.canv.restoreState()

class StackedProjectionChart(Flowable):
    """
    Actual (Solid) + Projection (Ghost) + Target (Needle).
    Visual Goal: See if 'Ghost Bar' touches the 'Needle'.
    """
    def __init__(self, actual_pct, proj_pct, needle_at=100.0, width=50*mm, height=6*mm):
        Flowable.__init__(self)
        self.actual = min(1.2, actual_pct / 100.0)
        self.proj = min(1.2, proj_pct / 100.0)
        self.needle = needle_at / 100.0
        self.width = width
        self.height = height

    def draw(self):
        self.canv.saveState()
        
        # Internal Padding to avoid edge clipping for labels
        side_p = 4*mm
        inner_w = self.width - (2 * side_p)
        
        # Scale: 0 to 120%
        scale_max = 1.2
        
        # 0. Axis Background (Very subtle)
        self.canv.setFillColor(colors.HexColor("#F8F9FA"))
        self.canv.roundRect(side_p, 0, inner_w, self.height, 2, stroke=0, fill=1)
        
        # 1. Projected / Ghost Bar (Light Emerald)
        p_width = (self.proj / scale_max) * inner_w
        self.canv.setFillColor(colors.HexColor("#D1FAE5")) # Light Emerald
        self.canv.roundRect(side_p, 0, p_width, self.height, 2, stroke=0, fill=1)
        
        # 2. Actual Bar (Dark Emerald)
        a_width = (self.actual / scale_max) * inner_w
        self.canv.setFillColor(colors.HexColor("#10B981")) # Dark Emerald
        self.canv.roundRect(side_p, 0, a_width, self.height, 2, stroke=0, fill=1)
        
        # 3. Target Needle (Black Line)
        needle_x = side_p + ((self.needle / scale_max) * inner_w)
        self.canv.setStrokeColor(colors.black)
        self.canv.setLineWidth(1.5)
        self.canv.line(needle_x, -1*mm, needle_x, self.height + 1*mm)
        
        # 4. MINI AXIS & TICK LABELS
        self.canv.setStrokeColor(colors.Color(0.8, 0.8, 0.8))
        self.canv.setLineWidth(0.5)
        self.canv.setFont("Helvetica", 5)
        self.canv.setFillColor(MEDIUM_GRAY)
        
        ticks = [0, 0.5, 1.0, 1.2]
        labels = ["0%", "50%", "100%", "120%"]
        for t, l in zip(ticks, labels):
            tx = side_p + ((t / scale_max) * inner_w)
            self.canv.line(tx, -0.5*mm, tx, -1.5*mm) # tick
            self.canv.drawCentredString(tx, -3.5*mm, l)
            
        self.canv.restoreState()

def _get_styles():
    styles = getSampleStyleSheet()
    
    # Diamond Tier Typography
    styles.add(ParagraphStyle(
        "ReportTitle",
        parent=styles["Title"],
        fontSize=26,
        textColor=DARK_GRAY,
        spaceAfter=5,
        alignment=TA_LEFT,
        fontName="Helvetica-Bold",
    ))
    
    styles.add(ParagraphStyle(
        "ExecutiveCommentary",
        parent=styles["Normal"],
        fontSize=11,
        textColor=DARK_GRAY,
        leading=16, # 1.6 spacing
        spaceAfter=20,
        alignment=TA_LEFT,
        fontName="Helvetica-Oblique"
    ))
    
    styles.add(ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontSize=8,
        fontName="Helvetica-Bold",
        textColor=colors.grey,
        alignment=TA_LEFT,
        textTransform='uppercase', # Simulating Uppercase
        wordWrap='LTR',
    ))

    # Standard Data
    styles["Normal"].fontSize = 10
    styles["Normal"].fontName = "Helvetica"
    styles["Normal"].leading = 14

    return styles

class FooterCanvas(object):
    """Canvas used for drawing headers/footers on every page."""
    def __init__(self, summary_data=None):
        self.summary_data = summary_data
        
    def __call__(self, canvas, doc):
        canvas.saveState()
        
        # ── Header Logic ──
        # Logo Top Left
        if os.path.exists(LOGO_PATH):
            canvas.drawImage(LOGO_PATH, 10*mm, A4[1] - 25*mm, width=40*mm, height=15*mm, mask='auto', preserveAspectRatio=True)
        
        # Header Line
        canvas.setStrokeColor(EMERALD)
        canvas.setLineWidth(1.5)
        canvas.line(10*mm, A4[1] - 30*mm, A4[0] - 10*mm, A4[1] - 30*mm)

        # ── Footer Logic ──
        # Footer Line
        canvas.setStrokeColor(BORDER_LIGHT)
        canvas.setLineWidth(0.5)
        canvas.line(10*mm, 15*mm, A4[0] - 10*mm, 15*mm)
        
        # Footer Text & Legend
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
        page_num = doc.page
        
        canvas.setFont('Helvetica', 7.5)
        canvas.setFillColor(DARK_GRAY)
        
        # Legend on the left
        legend = "* Target sourced from uploaded Excel/Master Sheet. Rows without targets are excluded from target totals."
        canvas.drawString(10*mm, 10*mm, legend)
        
        # Executive Insights (Antigravity Gap-Analyzer Skill)
        if self.summary_data and "executive_commentary" in self.summary_data:
            insight = "Executive Insight: " + self.summary_data["executive_commentary"]
            # Truncate if too long for footer
            if len(insight) > 130: insight = insight[:127] + "..."
            canvas.setFont('Helvetica-Oblique', 7)
            canvas.setFillColor(EMERALD)
            canvas.drawString(10*mm, 6*mm, insight)
            canvas.setFillColor(DARK_GRAY) # reset
        
        # Confidentiality & Page on the right
        footer_right = f"Confidential | Generated on {timestamp} | Page {page_num}"
        canvas.drawRightString(A4[0] - 10*mm, 10*mm, footer_right)
        
        canvas.restoreState()

def generate_ims_executive_block(story, tables, styles, report_type):
    """PART 1 - PAGE 1 ADDITION (Modular)"""
    if "Brands" not in tables: return
    
    df = tables["Brands"]
    if "IMS_Market_Total" not in df.columns: return
    
    # Filter to IMS matches
    ims_df = df[df["IMS_Market_Total"] > 0].copy()
    if ims_df.empty: return
    
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_LIGHT, spaceBefore=5*mm, spaceAfter=5*mm))
    story.append(Paragraph("MARKET INTELLIGENCE SNAPSHOT <font size=8 color='#666666'>(IMS Baseline 2025)</font>", styles["TableHeader"]))
    story.append(Spacer(1, 4*mm))
    
    # 📊 Metrics
    # IMPORTANT: We need unique molecule totals to avoid double counting if multiple brands match one molecule
    # But usually brand_ims_value/units is what we want for uncaptured potential.
    # Total Market Size = Sum of unique market totals for all matched brands.
    # To be safe, we'll group by IMS_Molecule
    molecule_stats = ims_df.groupby("IMS_Molecule").first().reset_index()
    total_mkt = molecule_stats["IMS_Market_Total"].sum()
    swiss_act = ims_df["Actual"].sum()
    share = (swiss_act / total_mkt * 100) if total_mkt > 0 else 0
    gap = ims_df["IMS_Potential"].sum()
    
    suffix = "" if report_type == 'financial' else " U"
    
    # Larger Cards Row
    card_w = 46*mm # Slightly wider to avoid overlap
    cards_table = Table([[
        HeroMetricCard("IMS Market Size", f"{total_mkt:,.0f}{suffix}", width=card_w, height=30*mm, small=False),
        HeroMetricCard("Swiss Actual", f"{swiss_act:,.0f}{suffix}", width=card_w, height=30*mm, small=False),
        HeroMetricCard("Market Share %", f"{share:.1f}%", width=card_w, height=30*mm, small=False),
        HeroMetricCard("Opportunity Gap", f"{gap:,.0f}{suffix}", width=card_w, height=30*mm, color=FAINT_RED, small=False)
    ]], colWidths=[card_w+1*mm]*4)
    cards_table.setStyle(TableStyle([
        ('LEFTPADDING', (0,0), (-1,-1), 0), 
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('ALIGN', (0,0), (-1,-1), 'CENTER')
    ]))
    story.append(cards_table)
    story.append(Spacer(1, 10*mm))
    
    # 📊 Top 3 Table (REMOVED PER USER REQUEST)
    # story.append(Paragraph("TOP 3 OPPORTUNITY BRANDS", styles["TableHeader"]))
    # ...

def generate_ims_detail_section(story, tables, styles, report_type):
    """PART 2 - NEW SECTION AT END (Modular)"""
    if "Brands" not in tables: return
    df = tables["Brands"]
    if "IMS_Market_Total" not in df.columns: return
    
    ims_df = df[df["IMS_Market_Total"] > 0].copy()
    if ims_df.empty: return
    
    story.append(PageBreak())
    story.append(Paragraph("MARKET POSITIONING & OPPORTUNITY ANALYSIS", styles["ReportTitle"]))
    story.append(Paragraph("IMS Baseline 2025 Dataset", styles["Normal"]))
    story.append(Spacer(1, 10*mm))
    
    headers = ["BRAND", "IMS MARKET TOTAL", "SWISS ACTUAL", "SHARE %", "RANK", "OPP. GAP", "3% POTENTIAL"]
    col_widths = [35*mm, 30*mm, 25*mm, 20*mm, 20*mm, 25*mm, 25*mm]
    
    t_data = [headers]
    for _, row in ims_df.iterrows():
        pot_3pct = row["IMS_Market_Total"] * 0.03 # 3% Potential
        rank_str = f"#{row['IMS_Rank']:.0f}/{row['IMS_Total_Competitors']:.0f}"
        
        t_data.append([
            str(row["Category"]).title()[:15],
            f"{row['IMS_Market_Total']:,.0f}",
            f"{row['Actual']:,.0f}",
            f"{row['IMS_Share']:.1f}%",
            rank_str,
            f"{row['IMS_Potential']:,.0f}",
            f"{pot_3pct:,.0f}"
        ])
    
    t = Table(t_data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'), ('FONTSIZE', (0,0), (-1,-1), 8),
        ('TEXTCOLOR', (0,0), (-1,0), MEDIUM_GRAY), ('LINEBELOW', (0,0), (-1,0), 1, BORDER_LIGHT),
        ('ALIGN', (1,0), (-1,-1), 'RIGHT'), ('ALIGN', (4,1), (4,-1), 'CENTER'),
        ('TOPPADDING', (0,0), (-1,-1), 6), ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('BACKGROUND', (0,0), (-1,0), LIGHT_NEUTRAL),
    ]))
    story.append(t)

def generate_variance_pdf(tables: dict, header_text: str, report_type: str, 
                          gauges_path=None, brand_chart_path=None, hero_chart_path=None,
                          output_dir="reports", summary_data=None) -> str:
    """
    Diamond Tier Executive Report Generator.
    """
    os.makedirs(output_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_label = "Financial" if report_type == "financial" else "Unit"
    filename = f"{file_label}_Variance_{timestamp}.pdf"
    filepath = os.path.join(output_dir, filename)

    doc = BaseDocTemplate(
        filepath,
        pagesize=A4,
        leftMargin=15*mm, rightMargin=15*mm,
        topMargin=35*mm, bottomMargin=20*mm
    )
    
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height - 10*mm, id='normal')
    template = PageTemplate(id='base', frames=frame, onPage=FooterCanvas(summary_data=summary_data))
    doc.addPageTemplates([template])
    
    styles = _get_styles()
    story = []

    if report_type == "financial":
        title_text = "Sales Value Variance Report"
        hero_label = "Total Revenue Gap"
        suffix = ""
    else:
        title_text = "Unit Quantity Variance Report"
        hero_label = "Total Volume Gap"
        suffix = " Units"
    
    is_sw_overall = summary_data.get("is_software_target", False) if summary_data else False

    # ══════════════════════════════════════════════════════════════════════════
    # PAGE 1: DIAMOND TIER EXECUTIVE DASHBOARD
    # ══════════════════════════════════════════════════════════════════════════
    if summary_data:
        # ── HEADER: IMPACT CARD & COMMENTARY (FIXED GRID 12 cols) ──
        # Commentary 8 cols, Hero Card 4 cols
        gap_val = summary_data.get("difference", 0)
        gap_str = f"{abs(gap_val):,.0f}{suffix}"
        commentary = summary_data.get("executive_commentary", "Automated focus analysis pending...")

        # Update Hero Label if software target
        if is_sw_overall:
            hero_label_sw = hero_label + " *"
        else:
            hero_label_sw = hero_label
            
        header_table = Table([
            [
                [
                    Paragraph(f"<font color='{EMERALD.hexval()}'><b>SWISS DASHBOARD</b></font>", styles["TableHeader"]),
                    Paragraph(title_text, styles["ReportTitle"]),
                    Paragraph(header_text.upper(), styles["TableHeader"]),
                    Spacer(1, 4*mm),
                    Paragraph(commentary, styles["ExecutiveCommentary"]),
                ],
                HeroMetricCard(hero_label_sw, gap_str, width=65*mm, height=32*mm)
            ]
        ], colWidths=[115*mm, 65*mm])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ]))
        story.append(header_table)
        story.append(Spacer(1, 12*mm))

        # ── SECTION 1: PERFORMANCE PACE (HORIZONTAL BULLET) ──
        story.append(Paragraph("Divisional Performance & Pace", styles["TableHeader"]))
        story.append(Spacer(1, 4*mm))
        
        team_df = summary_data.get("all_teams", pd.DataFrame())
        if not team_df.empty:
            # Grid: Team(40), Actual(28), Ach(20), Req. Growth(25), Chart(65)
            t_data = [["DIVISION", "ACTUAL", "ACH %", "DAILY REQUIRED", "PACING & PROJECTION"]]
            
            for _, row in team_df.iterrows():
                ach = row['Achievement']
                proj_pct = row['Proj_Pct']
                # Daily Required Format: Black
                dr_val = row['Daily_Required']
                dr_str = f"{dr_val:,.0f}"
                
                t_data.append([
                    row['Category'].title()[:20], 
                    f"{row['Actual']:,.0f}",
                    f"{ach:.1f}%",
                    dr_str,
                    StackedProjectionChart(ach, proj_pct, width=65*mm)
                ])
            
            team_tab = Table(t_data, colWidths=[40*mm, 30*mm, 20*mm, 30*mm, 65*mm])
            team_tab.setStyle(TableStyle([
                ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                ('FONTSIZE', (0,0), (-1,0), 8),
                ('TEXTCOLOR', (0,0), (-1,0), MEDIUM_GRAY),
                ('LINEBELOW', (0,0), (-1,0), 1, BORDER_LIGHT),
                ('BOTTOMPADDING', (0,0), (-1,-1), 10),
                ('TOPPADDING', (0,0), (-1,-1), 10),
                ('ALIGN', (1,0), (3,-1), 'RIGHT'),
                ('ALIGN', (-1,1), (-1,-1), 'CENTER'),
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ]))
            
            # Isolated Container with Integrated Header
            header_para = Paragraph("DIVISIONAL PERFORMANCE & PACE", styles["TableHeader"])
            container_data = [[header_para], [team_tab]]
            
            card_wrap = Table(container_data, colWidths=[180*mm])
            card_wrap.setStyle(TableStyle([
                ('BOX', (0,0), (-1,-1), 1, BORDER_LIGHT),
                ('BACKGROUND', (0,0), (-1,-1), WHITE),
                ('TOPPADDING', (0,0), (-1,0), 6),
                ('BOTTOMPADDING', (0,0), (-1,0), 0),
                ('LEFTPADDING', (0,0), (-1,-1), 10),
                ('RIGHTPADDING', (0,0), (-1,-1), 10),
            ]))
            story.append(card_wrap)
            story.append(Spacer(1, 15*mm))

        # ── Modular Addition: IMS Executive Block ──
        # generate_ims_executive_block(story, tables, styles, report_type)

    # ══════════════════════════════════════════════════════════════════════════
    # PAGE 2+: FULL DIVISIONAL ANALYTICS WITH DUAL PROJECTIONS
    # ══════════════════════════════════════════════════════════════════════════
    
    story.append(PageBreak())
    main_header = Paragraph("Full Divisional Analytics", styles["ReportTitle"])
    story.append(main_header)
    story.append(Spacer(1, 6*mm))

    cats = ["Teams", "Brands", "Products", "Zones", "Regions"]
    for cat in cats:
        if cat in tables:
            df = tables[cat]
            if df.empty: continue
            
            section_title_text = f"{cat.upper()} PERFORMANCE BREAKDOWN"
            section_header = Paragraph(section_title_text, styles["TableHeader"])
            
            # Conditional Headers and Data based on Report Type
            if report_type == 'financial':
                headers = ["NAME", "ACTUAL", "TARGET", "PROJ. VAL", "DAILY REQUIRED", "PROJ %"]
                col_widths = [55*mm, 25*mm, 25*mm, 30*mm, 25*mm, 20*mm]
            else:
                headers = ["NAME", "ACTUAL", "TARGET", "PROJ. UNIT", "DAILY REQUIRED", "PROJ %"]
                col_widths = [55*mm, 25*mm, 25*mm, 30*mm, 25*mm, 20*mm]
            
            # Show only underperformers (<= 80%) for Brands, Products, Zones, Regions
            # Keep all Teams for context unless requested otherwise
            if cat == "Teams":
                rows_to_display = df.sort_values("Proj_Pct", ascending=True)
            else:
                rows_to_display = df[df["Proj_Pct"] <= 80].sort_values("Proj_Pct", ascending=True)
            
            if rows_to_display.empty:
                continue
            
            t_data = [headers]
            row_styles = []
            for i, (_, row) in enumerate(rows_to_display.iterrows()):
                curr_idx = i + 1
                proj_pct = row["Proj_Pct"]
                daily_req = row["Daily_Required"]
                
                dr_str = f"{daily_req:,.0f}"
                
                pill_content = f"{proj_pct:.1f}%"
                if proj_pct < 30:
                    label, bg, txt = "MAJOR RISK", SALMON_DANGER, WHITE
                    pill_para = Paragraph(f"<b>{proj_pct:.1f}%</b>", ParagraphStyle("P", parent=styles["Normal"], textColor=txt, alignment=TA_CENTER, fontSize=8))
                    pill_box = Table([[pill_para]], colWidths=[18*mm])
                    pill_box.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,-1), bg), ('ROUNDRECT', (0,0), (-1,-1), 18, 1, bg), ('ALIGN', (0,0), (-1,-1), 'CENTER'), ('VALIGN', (0,0), (-1,-1), 'MIDDLE')]))
                    pill_content = pill_box
                elif proj_pct <= 80:
                    label, bg, txt = "MINOR RISK", AMBER_WARN, colors.black
                    pill_para = Paragraph(f"<b>{proj_pct:.1f}%</b>", ParagraphStyle("P", parent=styles["Normal"], textColor=txt, alignment=TA_CENTER, fontSize=8))
                    pill_box = Table([[pill_para]], colWidths=[18*mm])
                    pill_box.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,-1), bg), ('ROUNDRECT', (0,0), (-1,-1), 18, 1, bg), ('ALIGN', (0,0), (-1,-1), 'CENTER'), ('VALIGN', (0,0), (-1,-1), 'MIDDLE')]))
                    pill_content = pill_box

                # Check for software target flag
                is_sw_row = row.get("Is_SW", False)
                target_str = f"{row['Target']:,.0f}"
                if is_sw_row:
                    target_str += " *"

                row_cells = [
                    str(row["Category"]).title()[:28],
                    f"{row['Actual']:,.0f}",
                    target_str
                ]
                
                if report_type == 'financial':
                    row_cells.append(f"{row['Proj_Val']:,.0f}")
                else:
                    row_cells.append(f"{row['Proj_Uni']:,.0f}")
                
                row_cells.append(dr_str)
                row_cells.append(pill_content)
                t_data.append(row_cells)
                
                if proj_pct < 30:
                    row_styles.append(('BACKGROUND', (0, curr_idx), (-1, curr_idx), FAINT_RED))
                elif curr_idx % 2 == 0:
                    row_styles.append(('BACKGROUND', (0, curr_idx), (-1, curr_idx), LIGHT_NEUTRAL))

            t = Table(t_data, colWidths=col_widths, repeatRows=1)
            t.setStyle(TableStyle([
                ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'), ('FONTSIZE', (0,0), (-1,0), 8),
                ('TEXTCOLOR', (0,0), (-1,0), MEDIUM_GRAY), ('LINEBELOW', (0,0), (-1,0), 1, BORDER_LIGHT), 
                ('FONTNAME', (0,1), (-1,-1), 'Helvetica'), ('FONTSIZE', (0,1), (-1,-1), 9),
                ('ALIGN', (1,0), (-3,-1), 'RIGHT'), ('ALIGN', (-2,1), (-1,-1), 'CENTER'),
                ('TOPPADDING', (0,0), (-1,-1), 8), ('BOTTOMPADDING', (0,0), (-1,-1), 8),
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ] + row_styles))
            
            # Direct Append for Page Breaking support
            # We cannot wrap large multi-page tables in a single container cell as it prevents page breaking.
            
            # Apply grouping style directly to the table
            t.setStyle(TableStyle([
                ('BOX', (0,0), (-1,-1), 1, BORDER_LIGHT),
                ('BACKGROUND', (0,0), (-1,-1), WHITE),
            ]))
            
            # Smart KeepTogether: Prevents orphaned rows but avoids PDF crash if table is massive (>25 rows)
            if len(t_data) <= 25:
                story.append(KeepTogether([
                    section_header,
                    Spacer(1, 3*mm),
                    t
                ]))
            else:
                section_header.keepWithNext = True
                story.append(section_header)
                story.append(Spacer(1, 3*mm))
                story.append(t)
                
            story.append(Spacer(1, 10*mm))

    # ── Modular Addition: IMS Detailed Section ──
    # generate_ims_detail_section(story, tables, styles, report_type)

    try:
        doc.build(story)
        logger.info(f"✅ Generated Diamond Tier PDF: {filepath}")
        return filepath
    except Exception as e:
        logger.error(f"Failed to generate PDF: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return None
