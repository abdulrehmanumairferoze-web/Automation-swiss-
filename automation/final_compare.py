import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))
import pandas as pd
import glob
from excel_processor import *

files = sorted(glob.glob(os.path.join("automation", "downloads", "Territory_Wise_Sale*.xlsx")),
               key=os.path.getmtime, reverse=True)
df_raw = pd.read_excel(files[0], engine="openpyxl", header=2)
df_clean = load_and_clean_data(files[0])

# MREP Summary Rows (ground truth from Excel)
col0 = df_raw.iloc[:, 0].astype(str).str.upper()
mrep_act = {}
mrep_tgt = {}
for team in ["ACHIEVERS", "CONCORD", "DYNAMIC", "PASSIONATE"]:
    mask = col0.str.contains(team) & col0.str.contains("TOTAL")
    if mask.any():
        mrep_act[team] = pd.to_numeric(df_raw[mask].iloc[:, COL_SALE_VALUE], errors="coerce").fillna(0).sum()
        mrep_tgt[team] = pd.to_numeric(df_raw[mask].iloc[:, COL_TARGET_VALUE], errors="coerce").fillna(0).sum()

# Engine (after fix)
actuals, targets, msk = get_derived_targets(df_clean, "financial")
teams_col = df_clean.iloc[:, COL_TEAM].astype(str).str.upper()

print("=" * 110)
print("FINAL DATA ACCURACY COMPARISON: MREP Summary vs Engine (Post-Fix)")
print("=" * 110)
print(f"{'TEAM':<15} | {'MREP_ACTUAL':>14} | {'ENGINE_ACTUAL':>14} | {'MREP_TARGET':>14} | {'ENGINE_TARGET':>14} | {'ACT':>4} | {'TGT':>4}")
print("-" * 110)

total_ma = total_ea = total_mt = total_et = 0
for team in ["ACHIEVERS", "CONCORD", "DYNAMIC", "PASSIONATE"]:
    m_a = mrep_act.get(team, 0)
    e_a = actuals[teams_col == team].sum()
    m_t = mrep_tgt.get(team, 0)
    e_t = targets[teams_col == team].sum()
    a_ok = "PASS" if abs(m_a - e_a) < 1 else "FAIL"
    t_ok = "PASS" if abs(m_t - e_t) < 1 else "FAIL"
    total_ma += m_a; total_ea += e_a; total_mt += m_t; total_et += e_t
    print(f"{team:<15} | {m_a:>14,.2f} | {e_a:>14,.2f} | {m_t:>14,.2f} | {e_t:>14,.2f} | {a_ok:>4} | {t_ok:>4}")

print("-" * 110)
a_ok = "PASS" if abs(total_ma - total_ea) < 1 else "FAIL"
t_ok = "PASS" if abs(total_mt - total_et) < 1 else "FAIL"
print(f"{'TOTAL':<15} | {total_ma:>14,.2f} | {total_ea:>14,.2f} | {total_mt:>14,.2f} | {total_et:>14,.2f} | {a_ok:>4} | {t_ok:>4}")
print("=" * 110)

if a_ok == "PASS" and t_ok == "PASS":
    print("ALL CHECKS PASSED - Data matches Excel exactly.")
else:
    print("WARNING: Some checks failed!")
