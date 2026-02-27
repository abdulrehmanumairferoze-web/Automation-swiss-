import pandas as pd
import glob
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))
from excel_processor import (
    load_and_clean_data, COL_TEAM, COL_BRAND, COL_PRODUCT,
    COL_SALE_VALUE, COL_TARGET_VALUE, COL_PM_SALE_VALUE
)

files = sorted(glob.glob(os.path.join("automation", "downloads", "Territory_Wise_Sale*.xlsx")),
               key=os.path.getmtime, reverse=True)
df_clean = load_and_clean_data(files[0])

target_val = pd.to_numeric(df_clean.iloc[:, COL_TARGET_VALUE], errors='coerce').fillna(0)
pm_val = pd.to_numeric(df_clean.iloc[:, COL_PM_SALE_VALUE], errors='coerce').fillna(0)
sale_val = pd.to_numeric(df_clean.iloc[:, COL_SALE_VALUE], errors='coerce').fillna(0)

# Rows with zero Excel target
mask_zero = target_val == 0
zero_rows = df_clean[mask_zero].copy()

print(f"Rows with ZERO Excel Target: {mask_zero.sum()}")
print(f"Their PM Sale Value sum: {pm_val[mask_zero].sum():,.2f}")
print(f"Their Current Sale Value sum: {sale_val[mask_zero].sum():,.2f}")
print(f"Fallback Target (PM*110%): {(pm_val[mask_zero] * 1.10).sum():,.2f}")
print()

print("Per-Team breakdown of zero-target rows:")
teams = df_clean.iloc[:, COL_TEAM].astype(str).str.upper()
for team in ['ACHIEVERS', 'CONCORD', 'DYNAMIC', 'PASSIONATE']:
    team_mask = (teams == team) & mask_zero
    pm_sum = pm_val[team_mask].sum()
    count = team_mask.sum()
    print(f"  {team}: {count} rows, PM sum={pm_sum:,.2f}, Fallback={pm_sum*1.1:,.2f}")

print()
print("Sample zero-target rows:")
for i, (_, r) in enumerate(zero_rows.iterrows()):
    if i >= 15:
        break
    t = r.iloc[COL_TEAM]
    b = r.iloc[COL_BRAND]
    p = r.iloc[COL_PRODUCT]
    sv = sale_val.loc[r.name]
    tv = target_val.loc[r.name]
    pv = pm_val.loc[r.name]
    print(f"  Team={t}, Brand={b}, Product={p}, Sale={sv:,.0f}, Target={tv:,.0f}, PM={pv:,.0f}")
