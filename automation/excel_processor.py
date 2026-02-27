"""
excel_processor.py
Fetches Excel from MREP portal via Playwright automation, then processes
Target vs Achievement data for Variance Reports.
"""

import os
import glob
import logging
import subprocess
import json
import pandas as pd
from datetime import datetime

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MREP_SCRIPT = os.path.join(BASE_DIR, "mrep_target_achievement.cjs")
DOWNLOADS_DIR = os.path.join(BASE_DIR, "downloads")

# -- CONSTANTS FOR COLUMNS (0-based) --
COL_TEAM = 0
COL_BRAND = 1
COL_PRODUCT = 2
COL_ZONE = 4
COL_REGION = 5

COL_SALE_UNIT = 6    # User Col 7
COL_SALE_VALUE = 7   # User Col 8
COL_PM_SALE_UNIT = 10 # Previous Month Sale Units
COL_PM_SALE_VALUE = 11 # Previous Month Sale Value
COL_TARGET_UNIT = 12 # User Col 13
COL_TARGET_VALUE = 13 # User Col 14

def fetch_via_mrep() -> str:
    """Run MREP automation and return path to downloaded Excel."""
    os.makedirs(DOWNLOADS_DIR, exist_ok=True)
    existing_files = set(glob.glob(os.path.join(DOWNLOADS_DIR, "*.xlsx")))

    logger.info(f"📥 Running MREP automation: {MREP_SCRIPT}")
    try:
        subprocess.run(["node", "-v"], capture_output=True, shell=True)
        result = subprocess.run(
            ["node", MREP_SCRIPT],
            cwd=BASE_DIR,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=600,
        )
        if result.returncode != 0:
            logger.error(f"MREP stderr:\n{result.stderr[-1000:]}")
            raise RuntimeError(f"MREP script exited with code {result.returncode}")
    except subprocess.TimeoutExpired:
        raise RuntimeError("MREP automation timed out")

    # Find new file
    current_files = set(glob.glob(os.path.join(DOWNLOADS_DIR, "*.xlsx")))
    new_files = current_files - existing_files
    if new_files:
        filepath = max(new_files, key=os.path.getmtime)
        return filepath
    return find_latest_excel()

def find_latest_excel(directory: str = None) -> str:
    search_dir = directory or DOWNLOADS_DIR
    files = glob.glob(os.path.join(search_dir, "*.xlsx"))
    if not files:
        raise FileNotFoundError(f"No .xlsx files found in {search_dir}")
    return max(files, key=os.path.getmtime)

def load_and_clean_data(filepath: str) -> pd.DataFrame:
    """
    Load Excel and apply strict exclusions.
    Exclude first column containing "All", "Summary", or "Total".
    Handles nulls as 0.00.
    """
    try:
        df = pd.read_excel(filepath, engine="openpyxl", header=2)
    except:
        df = pd.read_excel(filepath, engine="openpyxl", header=0)

    # Convert all numeric targets/actuals early and handle nulls
    num_cols = [COL_SALE_UNIT, COL_SALE_VALUE, COL_PM_SALE_UNIT, COL_PM_SALE_VALUE, COL_TARGET_UNIT, COL_TARGET_VALUE]
    for col in num_cols:
        if col < df.shape[1]:
            df.iloc[:, col] = pd.to_numeric(df.iloc[:, col], errors='coerce').fillna(0.00)

    # ── Strict Extraction Rule ──
    # Exclude rows where first column contains "All", "Summary", or "Total"
    first_col_vals = df.iloc[:, 0].astype(str).str.upper()
    mask_clean = ~first_col_vals.str.contains("ALL|SUMMARY|TOTAL", na=False)
    
    # Also exclude Region filter if any
    if df.shape[1] > COL_REGION:
        region_vals = df.iloc[:, COL_REGION].astype(str)
        mask_region = ~region_vals.str.contains("All", case=False, na=False)
        mask_clean = mask_clean & mask_region

    df_clean = df[mask_clean].copy()
    return df_clean

def get_team_target_map(df_raw: pd.DataFrame, report_type='financial'):
    """
    Extract targets from 'Summary' rows to fix mapping bugs.
    Maps targets to DYNAMIC, ACHIEVERS, CONCORD, PASSIONATE.
    """
    tgt_idx = COL_TARGET_VALUE if report_type == 'financial' else COL_TARGET_UNIT
    
    first_col = df_raw.iloc[:, 0].astype(str).str.upper()
    # Find rows where first column contains team name AND 'SUMMARY' or 'TOTAL'
    target_map = {}
    teams = ["DYNAMIC", "ACHIEVERS", "CONCORD", "PASSIONATE"]
    
    for team in teams:
        # Look for rows like "DYNAMIC SUMMARY" or "DYNAMIC TOTAL"
        mask = first_col.str.contains(team) & first_col.str.contains("SUMMARY|TOTAL")
        if mask.any():
            val = pd.to_numeric(df_raw[mask].iloc[:, tgt_idx], errors='coerce').fillna(0).sum()
            target_map[team] = val
        else:
            target_map[team] = 0
            
    return target_map

def load_smart_factors(report_type='financial'):
    """Load pre-calculated surge factors from JSON."""
    if report_type == 'financial':
        json_path = os.path.join(BASE_DIR, "smart_surge_factors_financial.json")
    else:
        json_path = os.path.join(BASE_DIR, "smart_surge_factors_unit.json")
        
    if not os.path.exists(json_path):
        json_path = os.path.join(BASE_DIR, "smart_surge_factors.json") # Fallback
        
    if os.path.exists(json_path):
        try:
            with open(json_path, "r") as f:
                return json.load(f)
        except:
            return None
    return None

def load_ims_cache():
    """Load cached IMS data for mapping."""
    cache_path = os.path.join(BASE_DIR, "ims_data_cache.json")
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r") as f:
                return json.load(f)
        except:
            return {}
    return {}

def get_smart_surge_factor(name, level, factors):
    """
    Retrieve surge factor for a given name and level.
    Level: 'Product', 'Brand', 'Team', 'Region'
    """
    if not factors:
        return 1.0
        
    name_clean = str(name).strip().upper()
    
    # Map label to JSON key
    level_map = {
        'Products': 'Product',
        'Brands': 'Brand',
        'Teams': 'Team',
        'Regions': 'Region'
    }
    key = level_map.get(level, level)
    
    # 1. Direct Level Check
    if key in factors and name_clean in factors[key]:
        return factors[key][name_clean]
        
    # 2. Hierarchy Fallback (if level is Product, try Brand etc.)
    # Note: For simplicity in the current grouping structure, we prioritize the current level factor.
    # If not found, return 1.0 (no surge)
    return 1.0

def calculate_projection(actual, days_elapsed, surge_factor, days_in_month=28):
    """
    Smart Projection Formula:
    A = Daily Avg
    B = Normal Growth (until Day 23)
    C = Historical Surge (Day 24 to End)
    """
    if actual <= 0 or days_elapsed <= 0:
        return 0.0
        
    daily_avg = actual / days_elapsed
    
    normal_end_day = 23
    surge_start_day = 24
    
    if days_elapsed <= normal_end_day:
        normal_days = normal_end_day - days_elapsed
        surge_days = days_in_month - normal_end_day
    else:
        normal_days = 0
        surge_days = max(0, days_in_month - days_elapsed)
        
    projection = actual + (daily_avg * normal_days) + (daily_avg * surge_days * surge_factor)
    return projection

def get_derived_targets(df: pd.DataFrame, report_type='financial'):
    """
    Target Priority: Use Excel 'Target Value/Units' columns directly.
    If Excel target is 0/empty, target stays 0 (no fallback).
    Returns: (Actuals, Targets, Has_Excel_Target_Mask)
    """
    if report_type == 'financial':
        actual_idx = COL_SALE_VALUE
        target_idx = COL_TARGET_VALUE
    else:
        actual_idx = COL_SALE_UNIT
        target_idx = COL_TARGET_UNIT

    actuals = pd.to_numeric(df.iloc[:, actual_idx], errors='coerce').fillna(0)
    excel_targets = pd.to_numeric(df.iloc[:, target_idx], errors='coerce').fillna(0)

    # Trust Excel targets as sole source — no PM*110% fallback
    has_excel_target = excel_targets > 0
    
    return actuals, excel_targets, has_excel_target

def get_executive_summary_data(df: pd.DataFrame, report_type: str = 'financial') -> dict:
    """
    Generate high-level totals and rankings for the Executive Summary (Page 1).
    report_type: 'financial' (Value) or 'unit' (Unit)
    """
    summary = {}
    factors = load_smart_factors(report_type)

    # Apply Target Hierarchy
    actuals, targets, has_excel_mask = get_derived_targets(df, report_type)
    summary["is_software_target"] = has_excel_mask.any() # Flag for '*' symbol (has Excel-based target)
    
    # ── Section 1: Overall Performance ──
    total_actual = actuals.sum()
    total_target = targets.sum()
    difference = total_actual - total_target
    
    if total_target > 0:
        achievement_pct = (total_actual / total_target) * 100
    else:
        achievement_pct = 0.0

    summary["total_actual"] = total_actual
    summary["total_target"] = total_target
    summary["difference"] = difference
    summary["achievement_pct"] = achievement_pct
    
    # ── Section 2: Performance Status ──
    if achievement_pct >= 95:
        summary["status"] = "On Track"
        summary["status_color"] = "#228B22" # Forest Green
    elif achievement_pct >= 85:
        summary["status"] = "Slightly Behind Plan"
        summary["status_color"] = "#FF9800" # Orange
    else:
        summary["status"] = "Critical Attention Required"
        summary["status_color"] = "#D32F2F" # Red

    # ── Helper for rankings ──
    def get_ranked_category(col_index, cat_name):
        days_in_month = 28 # Feb 2026 specialization
        now = datetime.now()
        days_elapsed = now.day

        temp = pd.DataFrame({
            "Category": df.iloc[:, col_index].astype(str),
            "Actual": actuals,
            "Target": targets
        })
        grouped = temp.groupby("Category")[["Actual", "Target"]].sum().reset_index()
        grouped["Difference"] = grouped["Actual"] - (grouped["Target"] * (days_elapsed / days_in_month))
        # Add Expected_Today (Pro-Rata)
        grouped["Expected_Today"] = grouped["Target"] * (days_elapsed / days_in_month)
        
        # Smart Projection for ranking if needed
        def smart_proj_row(row):
            sf = get_smart_surge_factor(row["Category"], cat_name, factors)
            return calculate_projection(row["Actual"], days_elapsed, sf, days_in_month)
            
        grouped["Smart_Proj"] = grouped.apply(smart_proj_row, axis=1)
        grouped["Proj_Pct"] = (grouped["Smart_Proj"] / grouped["Target"] * 100).fillna(0)
        
        # Absolute Daily Required Calculation
        days_rem = max(1, 28 - days_elapsed)
        grouped["Daily_Required"] = (grouped["Target"] - grouped["Actual"]).clip(lower=0) / days_rem

        # Avoid division by zero
        grouped["Achievement"] = grouped.apply(
            lambda x: (x["Actual"] / x["Target"] * 100) if x["Target"] > 0 else 0, axis=1
        )
        return grouped

    # ── Section 3 & 4: Teams (Requested 4 specific teams) ──
    # Fallback to grouped
    teams_df = get_ranked_category(COL_TEAM, "Teams")
    team_data = teams_df.set_index("Category")

    requested_teams = ["DYNAMIC", "ACHIEVERS", "CONCORD", "PASSIONATE"]
    
    # Calculate Team Stats with mapped targets
    team_rows = []
    days_in_month = 28 
    days_elapsed = datetime.now().day

    for team in requested_teams:
        team_key = team # Category column uses original case usually but let's be safe
        # Find row in grouped data
        row_mask = teams_df["Category"].str.upper().str.strip() == team
        if not row_mask.any():
            continue
            
        row = teams_df[row_mask].iloc[0]
        team_actual = row["Actual"]
        team_target = row["Target"]
        
        # Pro-Rata
        team_pace = (team_target / days_in_month) * days_elapsed
        team_diff = team_actual - team_pace
        team_ach = (team_actual / team_target * 100) if team_target > 0 else 0
        
        # Smart Projection
        sf = get_smart_surge_factor(team, 'Teams', factors)
        team_proj = calculate_projection(team_actual, days_elapsed, sf, days_in_month)
        team_proj_pct = (team_proj / team_target * 100) if team_target > 0 else 0
        
        # Growth Rate
        def internal_calc_growth(act, tgt):
            if act <= 0: return 100.0
            daily_avg = act / max(1, days_elapsed)
            rem_tgt = tgt - act
            if rem_tgt <= 0: return -100.0
            
            # Days remaining (Feb 28)
            days_rem = max(1, 28 - days_elapsed)
            daily_req = rem_tgt / days_rem
            return ( (daily_req / daily_avg) - 1 ) * 100

        team_growth = internal_calc_growth(team_actual, team_target)
        
        # Absolute Daily Required
        days_rem = max(1, 28 - days_elapsed)
        team_daily_req = max(0, team_target - team_actual) / days_rem

        team_rows.append({
            "Category": team,
            "Actual": team_actual,
            "Target": team_target,
            "Expected_Today": team_pace,
            "Difference": team_diff,
            "Achievement": team_ach,
            "Proj_Pct": round(team_proj_pct, 1),
            "Req_Growth": round(team_growth, 1),
            "Daily_Required": team_daily_req
        })
    
    teams_filtered = pd.DataFrame(team_rows)
    summary["top_teams"] = teams_filtered.sort_values("Achievement", ascending=False)
    summary["all_teams"] = teams_filtered 
    
    # ── Section 5: Top 5 Underperforming Brands ──
    brands_df = get_ranked_category(COL_BRAND, "Brands")
    # Sort by Difference ascending (most negative first) where Difference < 0
    underperformers = brands_df[brands_df["Difference"] < 0].sort_values("Difference", ascending=True).head(5)
    summary["underperforming_brands"] = underperformers
    
    # ── Section 6: Strategic Insights ──
    insights = []
    
    if difference < 0:
        insights.append(f"Company is trailing the target by {abs(difference):,.0f}, requiring immediate gap-closure initiatives.")
    else:
        insights.append(f"Company is exceeding the target by {difference:,.0f}, maintaining a strong growth trajectory.")

    if not underperformers.empty:
        worst_brand = underperformers.iloc[0]["Category"]
        worst_gap = underperformers.iloc[0]["Difference"]
        insights.append(f"Major shortfall detected in {best_formatting(worst_brand)}, contributing {abs(worst_gap):,.0f} to the deficit.")
        
    top_team = summary["top_teams"].iloc[0]["Category"]
    bot_team = summary["top_teams"].iloc[-1]["Category"] 
    insights.append(f"Team {best_formatting(top_team)} leads with highest efficiency, whilst {best_formatting(bot_team)} requires structural review.")
    
    summary["insights"] = insights
    
    # ── Section 7: Executive Commentary ──
    commentary = ""
    if not summary["top_teams"].empty:
        top_team = summary["top_teams"].iloc[0]["Category"]
        if not underperformers.empty:
            worst_brand = underperformers.iloc[0]["Category"]
            total_neg = underperformers["Difference"].abs().sum() if not underperformers.empty else 1
            worst_gap = underperformers.iloc[0]["Difference"]
            contrib = (abs(worst_gap) / total_neg * 100) if total_neg > 0 else 0
            commentary = f"{top_team.title()} Team is leading in performance, but {worst_brand.title()} gaps are driving {contrib:.0f}% of the top brand shortfalls."
        else:
            commentary = f"{top_team.title()} Team is leading in performance across the portfolio."
    summary["executive_commentary"] = commentary

    summary["days_remaining"] = 28 - days_elapsed
    return summary

def best_formatting(text):
    return str(text).title().strip()

def get_variance_data(df: pd.DataFrame, report_type: str) -> dict:
    """
    Generate grouped data tables for the report with smart predictive metrics.
    """
    factors = load_smart_factors(report_type)
    now = datetime.now()
    days_in_month = 28 # Feb 2026 specialization
    days_elapsed = now.day
    effective_days = max(1, days_elapsed)

    # Apply Target Hierarchy (Excel Target → PM*110% fallback)
    actuals, targets, has_excel_mask = get_derived_targets(df, report_type)
    
    cat_map = {
        "Teams": COL_TEAM,
        "Brands": COL_BRAND,
        "Products": COL_PRODUCT,
        "Zones": COL_ZONE,
        "Regions": COL_REGION
    }

    tables = {}
    for label, idx in cat_map.items():
        temp = pd.DataFrame({
            "Category": df.iloc[:, idx].astype(str),
            "Actual": actuals,
            "Target": targets,
            "Is_SW": has_excel_mask
        })
        
        # For targets, we aggregate. We need to know if the aggregated target is software-derived.
        # Actually, if even one component is software-derived, it's mixed, but let's say 
        # the majority or just track the flag.
        grouped = temp.groupby("Category").agg({
            "Actual": "sum",
            "Target": "sum",
            "Is_SW": "any" # If any row had a software target
        }).reset_index()
        
        # Smart Projections
        def apply_smart_proj(row):
            sf = get_smart_surge_factor(row["Category"], label, factors)
            return calculate_projection(row["Actual"], days_elapsed, sf, days_in_month)

        grouped["Projected"] = grouped.apply(apply_smart_proj, axis=1)
        grouped["Proj_Pct"] = (grouped["Projected"] / grouped["Target"] * 100).fillna(0)
        
        # Add aliases for PDF Generator
        if report_type == 'financial':
            grouped["Proj_Val"] = grouped["Projected"]
        else:
            grouped["Proj_Uni"] = grouped["Projected"]
        
        # ── IMS Data Integration (only for Brands) ──
        if label == "Brands":
            ims_cache = load_ims_cache()
            def apply_ims_metrics(row):
                brand_name = str(row["Category"]).upper().strip()
                if brand_name in ims_cache:
                    ims_data = ims_cache[brand_name]
                    
                    if report_type == 'financial':
                        market_total = ims_data["market_value"]
                        brand_baseline = ims_data["brand_ims_value"]
                        rank = ims_data["rank_val"]
                        growth_mkt = ims_data["market_growth_val"]
                    else:
                        market_total = ims_data["market_units"]
                        brand_baseline = ims_data["brand_ims_units"]
                        rank = ims_data["rank_uni"]
                        growth_mkt = ims_data["market_growth_uni"]

                    # Market Share (Feb 2026 Internal Actual / Feb 2025 IMS Market Total)
                    share = (row["Actual"] / market_total * 100) if market_total > 0 else 0
                    
                    # Uncaptured Potential (Market Total - Swiss Actual) - The "White Space"
                    potential = max(0, market_total - row["Actual"])
                    
                    # Evolution Index (EI) = (Brand Growth / Market Growth)
                    brand_growth = (row["Actual"] / brand_baseline) - 1 if brand_baseline > 0 else 0
                    mkt_growth_pct = growth_mkt / 100 
                    ei = ((1 + brand_growth) / (1 + mkt_growth_pct) * 100) if (1 + mkt_growth_pct) > 0 else 0
                    
                    return pd.Series({
                        "IMS_Molecule": ims_data["ims_molecule"],
                        "IMS_Rank": rank,
                        "IMS_Total_Competitors": ims_data["total_competitors"],
                        "IMS_Share": share,
                        "IMS_EI": ei,
                        "IMS_Market_Total": market_total,
                        "IMS_Potential": potential
                    })
                return pd.Series({
                    "IMS_Molecule": "N/A",
                    "IMS_Rank": 0,
                    "IMS_Total_Competitors": 0,
                    "IMS_Share": 0,
                    "IMS_EI": 0,
                    "IMS_Market_Total": 0,
                    "IMS_Potential": 0
                })
            
            ims_metrics = grouped.apply(apply_ims_metrics, axis=1)
            grouped = pd.concat([grouped, ims_metrics], axis=1)

        # Metrics: Growth % and Absolute Daily Required
        days_rem = max(1, days_in_month - days_elapsed)
        def calc_metrics(row):
            act = row["Actual"]
            tgt = row["Target"]
            rem_tgt = max(0, tgt - act)
            daily_req = rem_tgt / days_rem
            
            if act <= 0: 
                growth = 100.0
            else:
                daily_avg = act / effective_days
                if rem_tgt <= 0: 
                    growth = -100.0
                else:
                    growth = ((daily_req / daily_avg) - 1) * 100
            
            return pd.Series({"Req_Growth": growth, "Daily_Required": daily_req})

        metrics_df = grouped.apply(calc_metrics, axis=1)
        grouped = pd.concat([grouped, metrics_df], axis=1)
        grouped["Difference"] = grouped["Actual"] - (grouped["Target"] * (days_elapsed / days_in_month))
        grouped["Risk_Score"] = grouped["Proj_Pct"] 
        
        # Rounding
        cols = ["Projected", "Proj_Pct", "Req_Growth", "Actual", "Target", "Difference"]
        for c in cols:
            if c in grouped.columns:
                grouped[c] = grouped[c].round(1 if 'Pct' in c or 'Growth' in c else 0)

        # Sort by Proj_Pct
        grouped = grouped.sort_values("Proj_Pct", ascending=True)
        tables[label] = grouped

    return tables

def get_date_logic_header() -> str:
    """Calculate Days Elapsed and Remaining for header."""
    now = datetime.now()
    days_in_month = 28 # Feb 2026
    days_elapsed = now.day
    days_remaining = days_in_month - days_elapsed
    return f"{now.strftime('%b %Y')} report. Days Elapsed: {days_elapsed}. Days Remaining: {days_remaining}."

