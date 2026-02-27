"""
validate_data.py - Cross-validate Excel source data against PDF processing engine.
Checks for double-counting from 'All' rows and validates aggregated totals.
"""

import pandas as pd
import glob
import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from excel_processor import (
    load_and_clean_data, get_derived_targets, get_variance_data,
    get_executive_summary_data, COL_TEAM, COL_BRAND, COL_PRODUCT,
    COL_ZONE, COL_REGION, COL_SALE_VALUE, COL_SALE_UNIT,
    COL_TARGET_VALUE, COL_TARGET_UNIT, COL_PM_SALE_VALUE, COL_PM_SALE_UNIT
)

def main():
    # 1. Find latest Excel
    files = sorted(glob.glob(os.path.join(BASE_DIR, "downloads", "Territory_Wise_Sale*.xlsx")),
                   key=os.path.getmtime, reverse=True)
    if not files:
        print("ERROR: No Excel files found!")
        return
    
    filepath = files[0]
    print(f"{'='*70}")
    print(f"DATA VALIDATION REPORT")
    print(f"File: {os.path.basename(filepath)}")
    print(f"{'='*70}")
    
    # 2. Load RAW data (no filtering)
    df_raw = pd.read_excel(filepath, engine="openpyxl", header=2)
    print(f"\n[RAW] Total rows after header: {len(df_raw)}")
    
    # 3. Inspect 'All' rows in detail
    col0 = df_raw.iloc[:, 0].astype(str).str.upper()
    col4_zone = df_raw.iloc[:, COL_ZONE].astype(str)
    col5_region = df_raw.iloc[:, COL_REGION].astype(str)
    
    # Check what "All" rows exist
    mask_all_col0 = col0.str.contains("ALL|SUMMARY|TOTAL", na=False)
    mask_all_zone = col4_zone.str.contains("All", case=False, na=False) & ~col4_zone.str.contains("All Zones", case=False, na=False)
    mask_all_region = col5_region.str.contains("All", case=False, na=False) & ~col5_region.str.contains("All Regions", case=False, na=False)
    
    print(f"\n--- 'All/Summary/Total' Row Analysis ---")
    print(f"  Col 0 (Team) with ALL/SUMMARY/TOTAL: {mask_all_col0.sum()} rows")
    print(f"  Col 4 (Zone) with 'All' (excl 'All Zones'): {mask_all_zone.sum()} rows")
    print(f"  Col 5 (Region) with 'All' (excl 'All Regions'): {mask_all_region.sum()} rows")
    
    # Show samples of filtered rows
    if mask_all_col0.sum() > 0:
        print(f"\n  Sample ALL/SUMMARY/TOTAL rows (Col 0):")
        samples = df_raw[mask_all_col0].head(5)
        for _, row in samples.iterrows():
            print(f"    Team={row.iloc[0]}, Brand={row.iloc[1]}, SaleVal={row.iloc[COL_SALE_VALUE]}, Target={row.iloc[COL_TARGET_VALUE]}")
    
    # Unique region values
    region_vals = df_raw.iloc[:, COL_REGION].dropna().unique()
    print(f"\n  Unique Region values ({len(region_vals)}):")
    for rv in sorted(str(v) for v in region_vals)[:20]:
        print(f"    - '{rv}'")
    
    # 4. Load CLEAN data (what the pipeline uses)
    df_clean = load_and_clean_data(filepath)
    print(f"\n[CLEAN] Rows after filtering: {len(df_clean)} (removed {len(df_raw) - len(df_clean)} rows)")
    
    # 5. Manual calculation from CLEAN data
    print(f"\n{'='*70}")
    print(f"FINANCIAL (VALUE) VALIDATION")
    print(f"{'='*70}")
    
    sale_val = pd.to_numeric(df_clean.iloc[:, COL_SALE_VALUE], errors='coerce').fillna(0)
    target_val = pd.to_numeric(df_clean.iloc[:, COL_TARGET_VALUE], errors='coerce').fillna(0)
    pm_val = pd.to_numeric(df_clean.iloc[:, COL_PM_SALE_VALUE], errors='coerce').fillna(0)
    
    # Manual Target Priority
    has_excel_target = target_val > 0
    fallback = pm_val * 1.10
    final_target = target_val.where(has_excel_target, fallback)
    
    print(f"\n  Manual Calculation (from clean data):")
    print(f"    Total Sale Value:      {sale_val.sum():>15,.2f}")
    print(f"    Excel Targets (>0):    {has_excel_target.sum():>5} / {len(has_excel_target)}")
    print(f"    Fallback (PM*110%):    {(~has_excel_target).sum():>5} rows")
    print(f"    Sum of Excel Targets:  {target_val[has_excel_target].sum():>15,.2f}")
    print(f"    Sum of Fallback Tgts:  {fallback[~has_excel_target].sum():>15,.2f}")
    print(f"    Final Target Total:    {final_target.sum():>15,.2f}")
    
    # 6. Engine calculation (via get_derived_targets)
    actuals_eng, targets_eng, mask_eng = get_derived_targets(df_clean, 'financial')
    
    print(f"\n  Engine Calculation (get_derived_targets):")
    print(f"    Total Actuals:         {actuals_eng.sum():>15,.2f}")
    print(f"    Total Targets:         {targets_eng.sum():>15,.2f}")
    print(f"    Excel Target rows:     {mask_eng.sum():>5}")
    
    # 7. Compare
    match_actuals = abs(sale_val.sum() - actuals_eng.sum()) < 0.01
    match_targets = abs(final_target.sum() - targets_eng.sum()) < 0.01
    
    print(f"\n  MATCH CHECK:")
    print(f"    Actuals Match:  {'PASS' if match_actuals else 'FAIL'}")
    print(f"    Targets Match:  {'PASS' if match_targets else 'FAIL'}")
    
    # 8. Per-Team breakdown
    print(f"\n--- Per-Team Breakdown (Financial) ---")
    teams_clean = df_clean.iloc[:, COL_TEAM].astype(str)
    team_summary = pd.DataFrame({
        'Team': teams_clean,
        'Actual': sale_val,
        'Target': final_target,
        'Has_Excel_Tgt': has_excel_target
    })
    team_grouped = team_summary.groupby('Team').agg({
        'Actual': 'sum',
        'Target': 'sum',
        'Has_Excel_Tgt': 'sum'
    }).reset_index()
    
    print(f"  {'Team':<15} {'Actual':>15} {'Target':>15} {'Excel Tgt Rows':>15}")
    print(f"  {'-'*60}")
    for _, row in team_grouped.iterrows():
        print(f"  {row['Team']:<15} {row['Actual']:>15,.2f} {row['Target']:>15,.2f} {int(row['Has_Excel_Tgt']):>15}")
    print(f"  {'-'*60}")
    print(f"  {'TOTAL':<15} {team_grouped['Actual'].sum():>15,.2f} {team_grouped['Target'].sum():>15,.2f} {int(team_grouped['Has_Excel_Tgt'].sum()):>15}")
    
    # 9. Validate Executive Summary matches
    print(f"\n{'='*70}")
    print(f"EXECUTIVE SUMMARY VALIDATION")
    print(f"{'='*70}")
    
    exec_fin = get_executive_summary_data(df_clean, 'financial')
    print(f"\n  Engine Executive Summary (Financial):")
    print(f"    Total Actual:   {exec_fin['total_actual']:>15,.2f}")
    print(f"    Total Target:   {exec_fin['total_target']:>15,.2f}")
    print(f"    Achievement %:  {exec_fin['achievement_pct']:>9.2f}%")
    
    exec_match = abs(exec_fin['total_actual'] - sale_val.sum()) < 0.01
    print(f"\n  Matches Manual Calc: {'PASS' if exec_match else 'FAIL'}")
    
    # 10. UNIT validation
    print(f"\n{'='*70}")
    print(f"UNIT VALIDATION")
    print(f"{'='*70}")
    
    sale_unit = pd.to_numeric(df_clean.iloc[:, COL_SALE_UNIT], errors='coerce').fillna(0)
    target_unit = pd.to_numeric(df_clean.iloc[:, COL_TARGET_UNIT], errors='coerce').fillna(0)
    pm_unit = pd.to_numeric(df_clean.iloc[:, COL_PM_SALE_UNIT], errors='coerce').fillna(0)
    
    has_unit_tgt = target_unit > 0
    fallback_unit = pm_unit * 1.10
    final_unit_tgt = target_unit.where(has_unit_tgt, fallback_unit)
    
    actuals_u, targets_u, mask_u = get_derived_targets(df_clean, 'unit')
    
    print(f"  Manual:  Actual={sale_unit.sum():>12,.0f}  Target={final_unit_tgt.sum():>12,.0f}")
    print(f"  Engine:  Actual={actuals_u.sum():>12,.0f}  Target={targets_u.sum():>12,.0f}")
    print(f"  Match:   {'PASS' if abs(sale_unit.sum() - actuals_u.sum()) < 0.01 else 'FAIL'}")
    
    # 11. Double-counting check
    print(f"\n{'='*70}")
    print(f"DOUBLE-COUNTING CHECK")
    print(f"{'='*70}")
    
    # If we DON'T filter, what's the total?
    raw_sale_val = pd.to_numeric(df_raw.iloc[:, COL_SALE_VALUE], errors='coerce').fillna(0)
    raw_target_val = pd.to_numeric(df_raw.iloc[:, COL_TARGET_VALUE], errors='coerce').fillna(0)
    
    print(f"  RAW Total Sale Value (no filter):    {raw_sale_val.sum():>15,.2f}")
    print(f"  CLEAN Total Sale Value (filtered):   {sale_val.sum():>15,.2f}")
    print(f"  Difference (double-counted amount):  {raw_sale_val.sum() - sale_val.sum():>15,.2f}")
    
    if raw_sale_val.sum() != sale_val.sum():
        inflation_pct = ((raw_sale_val.sum() / sale_val.sum()) - 1) * 100
        print(f"  Inflation if not filtered:           {inflation_pct:.1f}%")
    else:
        print(f"  No inflation detected.")
    
    print(f"\n{'='*70}")
    print(f"VALIDATION COMPLETE")
    print(f"{'='*70}")


if __name__ == "__main__":
    main()
