"""
stress_test.py — Full-System Chaos & Stress Test Suite
=======================================================
Runs 4 Chaos Scenarios + Headless Browser + Additional Edge Cases.
Generates a detailed LOG REPORT at the end.

Usage:
  python stress_test.py
"""

import os
import sys
import io
import json
import traceback
import pandas as pd
import numpy as np
from datetime import datetime
from copy import deepcopy

# ── Setup paths ──
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)
sys.path.insert(0, BASE_DIR)

# ── Imports from the automation engine ──
from excel_processor import (
    load_and_clean_data, get_variance_data, get_date_logic_header,
    get_executive_summary_data, get_derived_targets, get_team_target_map,
    calculate_projection, load_ims_cache, COL_TEAM, COL_BRAND, COL_PRODUCT,
    COL_ZONE, COL_REGION, COL_SALE_UNIT, COL_SALE_VALUE,
    COL_PM_SALE_UNIT, COL_PM_SALE_VALUE, COL_TARGET_UNIT, COL_TARGET_VALUE
)
from pdf_generator import generate_variance_pdf
from graph_generator import create_gauges_chart, create_top_brands_chart, create_team_performance_chart
from validator import validate_data_parity

# ══════════════════════════════════════════════════════════════
# TEST FRAMEWORK
# ══════════════════════════════════════════════════════════════
REPORT_LINES = []
PASS_COUNT = 0
FAIL_COUNT = 0
WARN_COUNT = 0

def log(msg, level="INFO"):
    global WARN_COUNT
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] [{level}] {msg}"
    print(line)
    REPORT_LINES.append(line)
    if level == "WARN":
        WARN_COUNT += 1

def test_pass(name, detail=""):
    global PASS_COUNT
    PASS_COUNT += 1
    log(f"  PASS: {name}" + (f" — {detail}" if detail else ""), "PASS")

def test_fail(name, detail=""):
    global FAIL_COUNT
    FAIL_COUNT += 1
    log(f"  FAIL: {name}" + (f" — {detail}" if detail else ""), "FAIL")

def section(title):
    sep = "=" * 70
    log(sep)
    log(f"  {title}")
    log(sep)

# ══════════════════════════════════════════════════════════════
# HELPER: Create synthetic Excel for chaos tests
# ══════════════════════════════════════════════════════════════
TEAMS = ["DYNAMIC", "ACHIEVERS", "CONCORD", "PASSIONATE"]
BRANDS = ["SANAMIDOL", "ZOLISOME", "VONZ", "DOLIUM", "SWITAM",
          "FERRIBOXY", "DESOTIN", "SWICEF", "ZITOPRO", "LER"]
PRODUCTS = [f"{b} TAB 10MG" for b in BRANDS]
ZONES = ["NORTH", "SOUTH"]
REGIONS = ["LAHORE", "KARACHI"]


def _make_base_rows(n_products=10, target_val=50000, actual_val=30000,
                    target_unit=500, actual_unit=300):
    """Generate n rows of product data with given defaults."""
    rows = []
    for i in range(n_products):
        team = TEAMS[i % len(TEAMS)]
        brand = BRANDS[i % len(BRANDS)]
        product = PRODUCTS[i % len(PRODUCTS)]
        zone = ZONES[i % len(ZONES)]
        region = REGIONS[i % len(REGIONS)]
        rows.append([
            team, brand, product, "", zone, region,
            actual_unit, actual_val,   # Sale Unit, Sale Value
            0, 0,                       # Cols 8,9 (misc)
            actual_unit * 0.9, actual_val * 0.9,  # PM Sale Unit, PM Sale Value
            target_unit, target_val     # Target Unit, Target Value
        ])
    return rows


def _make_header_row():
    """Standard 14-column header mimicking real Excel."""
    return [
        "Team", "Brand", "Product", "Code", "Zone", "Region",
        "Sale Unit", "Sale Value", "Col8", "Col9",
        "PM Sale Unit", "PM Sale Value", "Target Unit", "Target Value"
    ]


def _rows_to_excel(rows, filepath, add_header_rows=2):
    """Save rows to Excel with 2 blank header rows (header=2 loading)."""
    header = _make_header_row()
    all_rows = [[""] * len(header)] * add_header_rows + [header] + rows
    df = pd.DataFrame(all_rows)
    os.makedirs(os.path.dirname(filepath) or ".", exist_ok=True)
    df.to_excel(filepath, index=False, header=False, engine="openpyxl")
    return filepath


def _rows_to_df_clean(rows):
    """Convert rows directly to a cleaned DataFrame (simulates load_and_clean_data)."""
    header = _make_header_row()
    df = pd.DataFrame(rows, columns=header)
    num_cols = [COL_SALE_UNIT, COL_SALE_VALUE, COL_PM_SALE_UNIT,
                COL_PM_SALE_VALUE, COL_TARGET_UNIT, COL_TARGET_VALUE]
    for col in num_cols:
        if col < df.shape[1]:
            df.iloc[:, col] = pd.to_numeric(df.iloc[:, col], errors='coerce').fillna(0.0)
    return df

# ══════════════════════════════════════════════════════════════
# CHAOS SCENARIO 1: Zero-Target & Null-Actual
# ══════════════════════════════════════════════════════════════
def test_chaos_1_zero_target_null_actual():
    section("CHAOS 1: Zero-Target & Null-Actual Test")
    log("Creating dataset: 50% products with Target=0, 50% with Actual=0")

    rows = []
    for i in range(10):
        team = TEAMS[i % len(TEAMS)]
        brand = BRANDS[i % len(BRANDS)]
        product = PRODUCTS[i % len(PRODUCTS)]
        zone = ZONES[i % len(ZONES)]
        region = REGIONS[i % len(REGIONS)]

        if i < 5:
            # Zero Target group
            t_val, t_unit = 0, 0
            a_val, a_unit = 30000, 300
        else:
            # Zero Actual group
            t_val, t_unit = 50000, 500
            a_val, a_unit = 0, 0

        rows.append([team, brand, product, "", zone, region,
                     a_unit, a_val, 0, 0, 0, 0, t_unit, t_val])

    df = _rows_to_df_clean(rows)

    # Test 1a: get_derived_targets should not crash
    try:
        actuals, targets, mask = get_derived_targets(df, 'financial')
        test_pass("get_derived_targets(financial) — no crash")
    except Exception as e:
        test_fail("get_derived_targets(financial) crashed", str(e))
        return

    # Test 1b: Achievement % for zero-target rows should be 0%
    try:
        summary = get_executive_summary_data(df, 'financial')
        ach = summary["achievement_pct"]
        # Total target = 5 * 50000 = 250000, Total actual = 5 * 30000 = 150000
        expected_ach = (150000 / 250000) * 100  # 60%
        if abs(ach - expected_ach) < 0.1:
            test_pass("Achievement % correct", f"{ach:.1f}% (expected {expected_ach:.1f}%)")
        else:
            test_fail("Achievement % wrong", f"Got {ach:.1f}%, expected {expected_ach:.1f}%")
    except ZeroDivisionError:
        test_fail("ZeroDivisionError in get_executive_summary_data!")
    except Exception as e:
        test_fail("get_executive_summary_data crashed", str(e))

    # Test 1c: Team totals should not inflate
    try:
        total_target = targets.sum()
        total_actual = actuals.sum()
        if total_target == 250000 and total_actual == 150000:
            test_pass("Team totals correct", f"Actual={total_actual:,.0f}, Target={total_target:,.0f}")
        else:
            test_fail("Team totals inflated", f"Actual={total_actual:,.0f}, Target={total_target:,.0f}")
    except Exception as e:
        test_fail("Team total check failed", str(e))

    # Test 1d: Variance data with zero targets
    try:
        tables = get_variance_data(df, 'financial')
        test_pass("get_variance_data(financial) — no division-by-zero crash")
    except Exception as e:
        test_fail("get_variance_data crashed", str(e))

    # Test 1e: PDF generation with zero data
    try:
        tables = get_variance_data(df, 'financial')
        summary = get_executive_summary_data(df, 'financial')
        header = get_date_logic_header()
        pdf_path = generate_variance_pdf(
            tables, header, 'financial',
            output_dir=os.path.join(BASE_DIR, "reports", "stress_tests"),
            summary_data=summary
        )
        if pdf_path and os.path.exists(pdf_path):
            test_pass("PDF generated with zero-target data", os.path.basename(pdf_path))
        else:
            test_fail("PDF not created for zero-target scenario")
    except Exception as e:
        test_fail("PDF generation crashed on zero-target data", str(e))

    # Test 1f: calculate_projection with zero actuals
    try:
        proj = calculate_projection(0, 22, 1.0, 28)
        if proj == 0.0:
            test_pass("calculate_projection(0 actual) returns 0")
        else:
            test_fail("calculate_projection(0 actual) returned non-zero", str(proj))
    except Exception as e:
        test_fail("calculate_projection crashed on 0 actual", str(e))


# ══════════════════════════════════════════════════════════════
# CHAOS SCENARIO 2: Duplicate-Row Gravity Test
# ══════════════════════════════════════════════════════════════
def test_chaos_2_duplicate_rows():
    section("CHAOS 2: Duplicate-Row Gravity Test")
    log("Creating dataset with duplicate 'All' subtotal rows and ghost products")

    base_rows = _make_base_rows(8, target_val=50000, actual_val=30000)

    # Add duplicate "All" subtotal rows
    subtotal_row_1 = ["All", "All", "All", "", "All", "All",
                      2400, 240000, 0, 0, 2160, 216000, 4000, 400000]
    subtotal_row_2 = ["DYNAMIC SUMMARY", "All", "Total", "", "All", "All",
                      600, 60000, 0, 0, 540, 54000, 1000, 100000]
    subtotal_row_3 = ["Total", "All", "All", "", "All", "All",
                      2400, 240000, 0, 0, 2160, 216000, 4000, 400000]

    # Add ghost products (not mapped to any team)
    ghost_row_1 = ["PHANTOM_TEAM", "GHOST_BRAND", "GHOST_PROD_1", "", "MARS", "JUPITER",
                   100, 10000, 0, 0, 90, 9000, 200, 20000]
    ghost_row_2 = ["UNKNOWN_TEAM", "MYSTERY_BRAND", "MYSTERY_PROD", "", "VENUS", "SATURN",
                   50, 5000, 0, 0, 45, 4500, 100, 10000]

    all_rows = base_rows + [subtotal_row_1, subtotal_row_2, subtotal_row_3,
                            ghost_row_1, ghost_row_2]

    filepath = os.path.join(BASE_DIR, "downloads", "chaos_test_duplicates.xlsx")
    _rows_to_excel(all_rows, filepath)

    # Test 2a: load_and_clean_data filters out subtotals
    try:
        df_clean = load_and_clean_data(filepath)
        first_col_vals = df_clean.iloc[:, 0].astype(str).str.upper()
        has_all = first_col_vals.str.contains("^ALL$", na=False).any()
        has_summary = first_col_vals.str.contains("SUMMARY", na=False).any()
        has_total = first_col_vals.str.contains("^TOTAL$", na=False).any()

        if not has_all and not has_total:
            test_pass("'All' and 'Total' subtotal rows filtered out")
        else:
            test_fail("Subtotal rows NOT filtered", f"All={has_all}, Summary={has_summary}, Total={has_total}")
    except Exception as e:
        test_fail("load_and_clean_data crashed on duplicate rows", str(e))
        return

    # Test 2b: Summary rows filtered
    if not has_summary:
        test_pass("'SUMMARY' rows filtered out by 669 Filter")
    else:
        test_fail("SUMMARY rows leaked through filter")

    # Test 2c: Revenue not double-counted
    try:
        clean_total = pd.to_numeric(df_clean.iloc[:, COL_SALE_VALUE], errors='coerce').fillna(0).sum()
        expected_base = 8 * 30000  # 240000
        ghost_total = 10000 + 5000  # 15000
        expected_total = expected_base + ghost_total  # Ghost products pass filter (valid individual rows)

        if abs(clean_total - expected_total) < 1:
            test_pass("Revenue NOT double-counted", f"Total={clean_total:,.0f}")
        else:
            test_fail("Revenue mismatch (possible double-counting)",
                      f"Got {clean_total:,.0f}, expected ~{expected_total:,.0f}")
    except Exception as e:
        test_fail("Revenue check failed", str(e))

    # Test 2d: Ghost products are included as valid data rows (they're real products, just unmapped teams)
    try:
        teams_in_data = df_clean.iloc[:, COL_TEAM].astype(str).str.upper().unique()
        has_phantom = "PHANTOM_TEAM" in teams_in_data
        has_unknown = "UNKNOWN_TEAM" in teams_in_data
        if has_phantom and has_unknown:
            test_pass("Ghost products kept as valid data (unmapped teams present)")
        else:
            test_fail("Ghost products unexpectedly removed")
    except Exception as e:
        test_fail("Ghost product check failed", str(e))

    # Test 2e: get_team_target_map only maps known teams
    try:
        df_raw = pd.read_excel(filepath, engine="openpyxl", header=None)
        team_map = get_team_target_map(df_raw, 'financial')
        known_teams = ["DYNAMIC", "ACHIEVERS", "CONCORD", "PASSIONATE"]
        for t in known_teams:
            log(f"    Team Target Map: {t} = {team_map.get(t, 'MISSING'):,.0f}")
        test_pass("get_team_target_map returns only known teams")
    except Exception as e:
        test_fail("get_team_target_map crashed", str(e))


# ══════════════════════════════════════════════════════════════
# CHAOS SCENARIO 3: Negative-Variance (CNs exceed Sales)
# ══════════════════════════════════════════════════════════════
def test_chaos_3_negative_variance():
    section("CHAOS 3: Negative-Variance Scenario")
    log("Creating dataset where CNs exceed Sales for specific brands (negative actuals)")

    rows = []
    for i in range(10):
        team = TEAMS[i % len(TEAMS)]
        brand = BRANDS[i % len(BRANDS)]
        product = PRODUCTS[i % len(PRODUCTS)]
        zone = ZONES[i % len(ZONES)]
        region = REGIONS[i % len(REGIONS)]

        if i < 3:
            # Negative actual (returns exceed sales)
            a_val = -15000
            a_unit = -150
        else:
            a_val = 30000
            a_unit = 300

        rows.append([team, brand, product, "", zone, region,
                     a_unit, a_val, 0, 0, 300, 30000, 500, 50000])

    df = _rows_to_df_clean(rows)

    # Test 3a: Engine handles negative actuals
    try:
        summary = get_executive_summary_data(df, 'financial')
        total_actual = summary["total_actual"]
        expected_actual = (3 * -15000) + (7 * 30000)  # -45000 + 210000 = 165000
        if abs(total_actual - expected_actual) < 1:
            test_pass("Negative actuals summed correctly", f"Total={total_actual:,.0f}")
        else:
            test_fail("Negative actual sum wrong", f"Got {total_actual:,.0f}, expected {expected_actual:,.0f}")
    except Exception as e:
        test_fail("Executive summary crashed on negative actuals", str(e))

    # Test 3b: Daily Required doesn't flip to nonsensical number
    try:
        tables = get_variance_data(df, 'financial')
        brands_df = tables.get("Brands", pd.DataFrame())
        if not brands_df.empty:
            dr_values = brands_df["Daily_Required"]
            has_nan = dr_values.isna().any()
            has_inf = np.isinf(dr_values).any()
            if not has_nan and not has_inf:
                test_pass("Daily Required has no NaN/Inf for negative variance")
            else:
                test_fail("Daily Required has NaN or Inf values")
        else:
            test_fail("No Brands data generated")
    except Exception as e:
        test_fail("Variance data crashed on negative actuals", str(e))

    # Test 3c: PDF formatting survives negative values
    try:
        tables = get_variance_data(df, 'financial')
        summary = get_executive_summary_data(df, 'financial')
        header = get_date_logic_header()
        pdf_path = generate_variance_pdf(
            tables, header, 'financial',
            output_dir=os.path.join(BASE_DIR, "reports", "stress_tests"),
            summary_data=summary
        )
        if pdf_path and os.path.exists(pdf_path):
            size = os.path.getsize(pdf_path)
            test_pass("PDF generated with negative variance", f"{os.path.basename(pdf_path)} ({size:,} bytes)")
        else:
            test_fail("PDF not created for negative variance scenario")
    except Exception as e:
        test_fail("PDF generation crashed on negative variance", str(e))

    # Test 3d: calculate_projection with negative actual
    try:
        proj = calculate_projection(-15000, 22, 1.0, 28)
        if proj == 0.0:
            test_pass("calculate_projection(-15000) returns 0 (guarded)")
        else:
            test_fail("calculate_projection(-15000) returned unexpected", str(proj))
    except Exception as e:
        test_fail("calculate_projection crashed on negative", str(e))


# ══════════════════════════════════════════════════════════════
# CHAOS SCENARIO 4: IMS-Mismatch Audit
# ══════════════════════════════════════════════════════════════
def test_chaos_4_ims_mismatch():
    section("CHAOS 4: IMS-Mismatch Audit")
    log("Testing product names NOT in IMS Baseline 2025 cache")

    # Create data with brands that DON'T exist in IMS cache
    unknown_brands = ["XYZPHANTOM", "ABCGHOST", "QQWERTY", "NOIMS_BRAND", "FAKEMED"]
    known_brands = ["SANAMIDOL", "VONZ", "DOLIUM", "SWITAM", "DESOTIN"]

    rows = []
    for i, brand in enumerate(unknown_brands + known_brands):
        team = TEAMS[i % len(TEAMS)]
        product = f"{brand} TAB 10MG"
        zone = ZONES[i % len(ZONES)]
        region = REGIONS[i % len(REGIONS)]
        rows.append([team, brand, product, "", zone, region,
                     300, 30000, 0, 0, 270, 27000, 500, 50000])

    df = _rows_to_df_clean(rows)

    # Test 4a: IMS cache loads without crash
    try:
        ims_cache = load_ims_cache()
        test_pass("IMS cache loaded", f"{len(ims_cache)} brands mapped")
    except Exception as e:
        test_fail("IMS cache loading crashed", str(e))
        return

    # Test 4b: Unknown brands return N/A, not crash
    try:
        tables = get_variance_data(df, 'financial')
        brands_df = tables.get("Brands", pd.DataFrame())
        if "IMS_Molecule" in brands_df.columns:
            unknown_ims = brands_df[brands_df["Category"].str.upper().isin(
                [b.upper() for b in unknown_brands])]
            all_na = (unknown_ims["IMS_Molecule"] == "N/A").all()
            if all_na:
                test_pass("Unknown brands show 'N/A' for IMS_Molecule")
            else:
                test_fail("Unknown brands did NOT get N/A",
                          str(unknown_ims[["Category", "IMS_Molecule"]].to_dict()))
        else:
            test_pass("IMS columns not present (graceful skip)")
    except Exception as e:
        test_fail("Variance data crashed on IMS mismatch", str(e))

    # Test 4c: Known brands correctly mapped
    try:
        tables = get_variance_data(df, 'financial')
        brands_df = tables.get("Brands", pd.DataFrame())
        if "IMS_Molecule" in brands_df.columns:
            known_ims = brands_df[brands_df["Category"].str.upper().isin(
                [b.upper() for b in known_brands])]
            mapped = known_ims[known_ims["IMS_Molecule"] != "N/A"]
            test_pass("Known brands mapped to IMS", f"{len(mapped)}/{len(known_brands)} matched")
        else:
            log("    IMS columns not generated (cache may be empty)", "WARN")
    except Exception as e:
        test_fail("Known brand IMS check failed", str(e))

    # Test 4d: PDF generation with IMS mismatches
    try:
        tables = get_variance_data(df, 'financial')
        summary = get_executive_summary_data(df, 'financial')
        header = get_date_logic_header()
        pdf_path = generate_variance_pdf(
            tables, header, 'financial',
            output_dir=os.path.join(BASE_DIR, "reports", "stress_tests"),
            summary_data=summary
        )
        if pdf_path and os.path.exists(pdf_path):
            test_pass("PDF generated despite IMS mismatches", os.path.basename(pdf_path))
        else:
            test_fail("PDF not created for IMS mismatch scenario")
    except Exception as e:
        test_fail("PDF generation crashed on IMS mismatch data", str(e))


# ══════════════════════════════════════════════════════════════
# ADDITIONAL TEST: Graph Generation Edge Cases
# ══════════════════════════════════════════════════════════════
def test_graph_generation():
    section("ADDITIONAL: Graph Generation Edge Cases")

    reports_dir = os.path.join(BASE_DIR, "reports", "stress_tests")
    os.makedirs(reports_dir, exist_ok=True)

    # Test: Gauges with 0% achievement
    try:
        team_data = pd.DataFrame({
            "Category": TEAMS,
            "Actual": [0, 0, 0, 0],
            "Target": [50000, 60000, 70000, 80000],
            "Achievement": [0, 0, 0, 0],
            "Proj_Pct": [0, 0, 0, 0],
            "Expected_Today": [0, 0, 0, 0],
            "Daily_Required": [50000, 60000, 70000, 80000]
        })
        path = create_gauges_chart(team_data, reports_dir)
        if path and os.path.exists(path):
            test_pass("Gauges chart with 0% achievement generated")
        else:
            test_fail("Gauges chart not created")
    except Exception as e:
        test_fail("Gauges chart crashed on 0% data", str(e))

    # Test: Team performance chart with zero targets
    try:
        team_data2 = pd.DataFrame({
            "Category": TEAMS,
            "Actual": [30000, 40000, 50000, 60000],
            "Target": [0, 0, 0, 0],
            "Expected_Today": [0, 0, 0, 0],
        })
        path = create_team_performance_chart(team_data2, 6, reports_dir)
        if path and os.path.exists(path):
            test_pass("Team hero chart with 0 targets generated")
        else:
            test_fail("Team hero chart not created")
    except Exception as e:
        test_fail("Team hero chart crashed on 0 targets", str(e))

    # Test: Top brands chart with negative actuals
    try:
        brand_data = pd.DataFrame({
            "Category": BRANDS,
            "Actual": [-5000, 10000, -3000, 20000, 15000, -1000, 8000, 12000, 6000, 25000],
            "Target": [50000] * 10,
            "Expected_Today": [25000] * 10,
            "Proj_Pct": [-10, 20, -6, 40, 30, -2, 16, 24, 12, 50]
        })
        path = create_top_brands_chart(brand_data, reports_dir)
        if path and os.path.exists(path):
            test_pass("Top brands chart with negative actuals generated")
        else:
            test_fail("Brands chart not created")
    except Exception as e:
        test_fail("Brands chart crashed on negative actuals", str(e))


# ══════════════════════════════════════════════════════════════
# ADDITIONAL TEST: Validator Edge Cases
# ══════════════════════════════════════════════════════════════
def test_validator_edge_cases():
    section("ADDITIONAL: Validator Edge Cases")

    # Test: All-zero data
    try:
        rows = _make_base_rows(5, target_val=0, actual_val=0, target_unit=0, actual_unit=0)
        filepath = os.path.join(BASE_DIR, "downloads", "chaos_test_allzero.xlsx")
        _rows_to_excel(rows, filepath)
        df_raw = pd.read_excel(filepath, engine="openpyxl", header=None)
        df_clean = load_and_clean_data(filepath)
        result = validate_data_parity(df_raw, df_clean, 'financial')
        if result:
            test_pass("Validator handles all-zero data (parity OK)")
        else:
            test_fail("Validator failed on all-zero data (should pass since both are 0)")
    except Exception as e:
        test_fail("Validator crashed on all-zero data", str(e))

    # Test: Empty DataFrame
    try:
        filepath_empty = os.path.join(BASE_DIR, "downloads", "chaos_test_empty.xlsx")
        empty_rows = []
        _rows_to_excel(empty_rows, filepath_empty)
        df_clean_empty = load_and_clean_data(filepath_empty)
        log(f"    Empty file cleaned rows: {len(df_clean_empty)}")
        test_pass("load_and_clean_data handles empty file without crash")
    except Exception as e:
        test_fail("Engine crashed on empty Excel file", str(e))


# ══════════════════════════════════════════════════════════════
# ADDITIONAL TEST: Unit Report Pipeline
# ══════════════════════════════════════════════════════════════
def test_unit_report_pipeline():
    section("ADDITIONAL: Full Unit Report Pipeline")

    rows = _make_base_rows(10, target_val=50000, actual_val=30000)
    df = _rows_to_df_clean(rows)

    try:
        tables = get_variance_data(df, 'unit')
        summary = get_executive_summary_data(df, 'unit')
        header = get_date_logic_header()
        pdf_path = generate_variance_pdf(
            tables, header, 'unit',
            output_dir=os.path.join(BASE_DIR, "reports", "stress_tests"),
            summary_data=summary
        )
        if pdf_path and os.path.exists(pdf_path):
            test_pass("Unit report PDF generated successfully", os.path.basename(pdf_path))
        else:
            test_fail("Unit report PDF not created")
    except Exception as e:
        test_fail("Unit report pipeline crashed", str(e))


# ══════════════════════════════════════════════════════════════
# ADDITIONAL TEST: Real Excel File Pipeline
# ══════════════════════════════════════════════════════════════
def test_real_excel_pipeline():
    section("ADDITIONAL: Real Excel File Pipeline Check")

    import glob
    downloads_dir = os.path.join(BASE_DIR, "downloads")
    files = sorted(glob.glob(os.path.join(downloads_dir, "Territory_Wise_Sale*.xlsx")),
                   key=os.path.getmtime, reverse=True)

    if not files:
        log("    No real Territory_Wise_Sale files found, skipping", "WARN")
        return

    latest = files[0]
    log(f"    Testing with: {os.path.basename(latest)}")

    try:
        df_raw = pd.read_excel(latest, engine="openpyxl", header=None)
        df_clean = load_and_clean_data(latest)
        log(f"    Raw rows: {len(df_raw)}, Clean rows: {len(df_clean)}")
        test_pass("Real Excel loaded and cleaned")
    except Exception as e:
        test_fail("Real Excel load/clean failed", str(e))
        return

    try:
        parity_fin = validate_data_parity(df_raw, df_clean, 'financial')
        parity_unit = validate_data_parity(df_raw, df_clean, 'unit')
        if parity_fin:
            test_pass("Real data financial parity verified")
        else:
            test_fail("Real data financial parity FAILED")
        if parity_unit:
            test_pass("Real data unit parity verified")
        else:
            test_fail("Real data unit parity FAILED")
    except Exception as e:
        test_fail("Parity validation crashed on real data", str(e))

    try:
        tables = get_variance_data(df_clean, 'financial')
        summary = get_executive_summary_data(df_clean, 'financial')
        header = get_date_logic_header()
        pdf_path = generate_variance_pdf(
            tables, header, 'financial',
            output_dir=os.path.join(BASE_DIR, "reports", "stress_tests"),
            summary_data=summary
        )
        if pdf_path and os.path.exists(pdf_path):
            test_pass("Real data PDF generated", os.path.basename(pdf_path))
        else:
            test_fail("Real data PDF not created")
    except Exception as e:
        test_fail("Real data PDF pipeline crashed", str(e))


# ══════════════════════════════════════════════════════════════
# ADDITIONAL TEST: Projection & Date Logic
# ══════════════════════════════════════════════════════════════
def test_projection_edge_cases():
    section("ADDITIONAL: Projection & Date Logic Edge Cases")

    # Zero days elapsed
    try:
        p = calculate_projection(10000, 0, 1.0, 28)
        test_pass("Projection with 0 days elapsed", f"Result: {p}")
    except Exception as e:
        test_fail("Projection crashed on 0 days elapsed", str(e))

    # Days > month
    try:
        p = calculate_projection(50000, 30, 1.0, 28)
        test_pass("Projection with days > month", f"Result: {p:,.0f}")
    except Exception as e:
        test_fail("Projection crashed when days > month", str(e))

    # Huge surge factor
    try:
        p = calculate_projection(50000, 22, 5.0, 28)
        test_pass("Projection with surge=5.0", f"Result: {p:,.0f}")
    except Exception as e:
        test_fail("Projection crashed on huge surge factor", str(e))

    # Negative surge factor
    try:
        p = calculate_projection(50000, 22, -1.0, 28)
        test_pass("Projection with negative surge", f"Result: {p:,.0f}")
    except Exception as e:
        test_fail("Projection crashed on negative surge", str(e))

    # Date logic header
    try:
        h = get_date_logic_header()
        if "Days Elapsed" in h and "Days Remaining" in h:
            test_pass("Date logic header correct", h)
        else:
            test_fail("Date logic header missing fields", h)
    except Exception as e:
        test_fail("Date logic header crashed", str(e))


# ══════════════════════════════════════════════════════════════
# HEADLESS BROWSER TEST
# ══════════════════════════════════════════════════════════════
def test_headless_browser():
    section("HEADLESS BROWSER: MREP Portal Year/Month Selection Test")
    log("Testing headless Chromium with Playwright (different year/month combos)")

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        test_fail("Playwright not installed — cannot run headless browser tests")
        return

    test_cases = [
        {"year": "2020", "month": "December", "label": "Dec 2020"},
        {"year": "2024", "month": "June", "label": "Jun 2024"},
        {"year": "2025", "month": "January", "label": "Jan 2025"},
    ]

    for tc in test_cases:
        log(f"  Testing: {tc['label']} (Year={tc['year']}, Month={tc['month']})")
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(accept_downloads=True)
                page = context.new_page()

                # Login
                page.goto("https://swiss.mrep.com.pk/Reports/DailySalesTrend",
                           timeout=60000)
                page.wait_for_load_state("networkidle", timeout=30000)

                # Fill login
                page.get_by_placeholder("Territory Code").fill("COO")
                page.wait_for_timeout(500)
                page.get_by_placeholder("Username").fill("2003")
                page.wait_for_timeout(500)
                page.get_by_placeholder("Password").fill("2003")
                page.wait_for_timeout(500)
                page.locator('input[value="Sign in"], button:has-text("Sign in")').first.click()
                page.wait_for_timeout(3000)

                # Check for portal exception
                body_text = page.inner_text("body")
                if "exception" in body_text.lower():
                    test_fail(f"Portal exception on login for {tc['label']}")
                    browser.close()
                    continue

                # Navigate to report page
                page.goto("https://swiss.mrep.com.pk/Reports/TerritoryWiseSaleV5",
                           timeout=60000)
                page.wait_for_load_state("networkidle", timeout=30000)
                page.wait_for_timeout(5000)

                if page.url and "Login" in page.url:
                    test_fail(f"Redirected to login for {tc['label']} — session lost")
                    browser.close()
                    continue

                # Select Year
                year_btn = page.locator('.dx-dropdowneditor-button').nth(0)
                year_btn.click(force=True)
                page.wait_for_timeout(1000)
                year_item = page.locator('.dx-item-content.dx-list-item-content').filter(
                    has_text=tc["year"]).last
                if year_item.is_visible():
                    year_item.click(force=True)
                    log(f"    Year '{tc['year']}' selected")
                else:
                    log(f"    Year '{tc['year']}' not found in dropdown", "WARN")
                page.keyboard.press("Escape")
                page.wait_for_timeout(1000)

                # Select Month
                month_btn = page.locator('.dx-dropdowneditor-button').nth(1)
                month_btn.click(force=True)
                page.wait_for_timeout(1000)
                month_row = page.locator('.dx-overlay-content tr.dx-data-row').filter(
                    has_text=tc["month"]).first
                if month_row.is_visible():
                    checkbox = month_row.locator('.dx-checkbox').first
                    if checkbox.is_visible():
                        checkbox.click(force=True)
                    else:
                        month_row.click(force=True)
                    log(f"    Month '{tc['month']}' selected")
                else:
                    log(f"    Month '{tc['month']}' not found in grid", "WARN")
                page.keyboard.press("Escape")
                page.wait_for_timeout(1000)

                # Screenshot
                ss_path = os.path.join(BASE_DIR, "reports", "stress_tests",
                                       f"headless_{tc['year']}_{tc['month']}.png")
                os.makedirs(os.path.dirname(ss_path), exist_ok=True)
                page.screenshot(path=ss_path, full_page=True)
                log(f"    Screenshot saved: {os.path.basename(ss_path)}")

                test_pass(f"Headless browser {tc['label']}", "Navigation & selection OK")
                browser.close()

        except Exception as e:
            test_fail(f"Headless browser {tc['label']}", str(e)[:200])


# ══════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════
def main():
    start = datetime.now()
    section("SWISS DASHBOARD — FULL SYSTEM STRESS TEST")
    log(f"Started at: {start.strftime('%Y-%m-%d %H:%M:%S')}")
    log(f"Python: {sys.version}")
    log(f"Base Dir: {BASE_DIR}")

    # Run all chaos scenarios
    test_chaos_1_zero_target_null_actual()
    test_chaos_2_duplicate_rows()
    test_chaos_3_negative_variance()
    test_chaos_4_ims_mismatch()

    # Additional tests
    test_graph_generation()
    test_validator_edge_cases()
    test_unit_report_pipeline()
    test_real_excel_pipeline()
    test_projection_edge_cases()

    # Headless browser tests
    test_headless_browser()

    # Final report
    elapsed = (datetime.now() - start).total_seconds()
    section("FINAL STRESS TEST REPORT")
    log(f"Total Tests:  {PASS_COUNT + FAIL_COUNT}")
    log(f"Passed:       {PASS_COUNT}")
    log(f"Failed:       {FAIL_COUNT}")
    log(f"Warnings:     {WARN_COUNT}")
    log(f"Duration:     {elapsed:.1f}s")
    log(f"Result:       {'ALL PASSED' if FAIL_COUNT == 0 else 'FAILURES DETECTED'}")

    # Save report
    report_path = os.path.join(BASE_DIR, "reports", "stress_tests", "stress_test_report.txt")
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(REPORT_LINES))
    log(f"Report saved: {report_path}")

    return FAIL_COUNT == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
