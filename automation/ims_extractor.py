import openpyxl
import json
import os
import time

IMS_PATH = r"D:\Downloads\copy-of-copy-of--swiss-dashboard\automation\downloads\Complete IMS Dec-25.xlsx"
OUTPUT_CACHE = r"D:\Downloads\copy-of-copy-of--swiss-dashboard\automation\ims_data_cache.json"

MOLECULE_KEYWORDS_TO_SKIP = ['MG', 'ML', 'ORAL', 'VIAL', 'CAPS', 'TABS', 'ORDINARY', 'TOTAL', 'MARKET', 'LIQUID', 'INJECTABLE', 'SYRUP', 'SUSP']

def build_ims_data(force=False):
    # 1. Check if cache exists to save time (user request)
    if not force and os.path.exists(OUTPUT_CACHE):
        print(f"📦 Loading IMS data from CACHE (Instant)...")
        try:
            with open(OUTPUT_CACHE, "r") as f:
                return json.load(f)
        except:
            print("⚠️ Cache corrupt, re-extracting...")

    if not os.path.exists(IMS_PATH):
        print(f"IMS file not found: {IMS_PATH}")
        return {}
    
    start_time = time.time()
    print(f"🚀 Starting Dual-Metric IMS Extraction (Value & Units)...")
    
    # Indices based on Feb '25 column (0-based)
    v_idx = 92 # Feb '25 Value
    u_idx = 95 # Feb '25 Unit
    vg_idx = 94 # Value Growth
    ug_idx = 97 # Unit Growth
    
    wb = openpyxl.load_workbook(IMS_PATH, read_only=True, data_only=True)
    sheet = wb.active
    
    molecules = {}
    current_molecule = "UNKNOWN"
    
    row_count = 0
    rows = sheet.iter_rows(min_row=3, values_only=True)
    
    for row in rows:
        row_count += 1
        name_raw = row[0]
        manu_raw = row[1]
        
        if not name_raw: continue
        
        name = str(name_raw).strip().upper()
        manu = str(manu_raw).strip().upper() if manu_raw else ""
        
        if name == 'NONE' or name == 'NAN' or not name: continue
        
        is_manu_empty = not manu or manu == 'NAN' or manu == 'NONE' or manu == ''
        
        if is_manu_empty:
            if not any(k in name for k in MOLECULE_KEYWORDS_TO_SKIP):
                current_molecule = name
                molecules[current_molecule] = {
                    "market_value": float(row[v_idx]) if row[v_idx] is not None else 0,
                    "market_units": float(row[u_idx]) if row[u_idx] is not None else 0,
                    "market_growth_val": float(row[vg_idx]) if row[vg_idx] is not None else 0,
                    "market_growth_uni": float(row[ug_idx]) if row[ug_idx] is not None else 0,
                    "brands": []
                }
        else:
            if current_molecule != "UNKNOWN":
                molecules[current_molecule]["brands"].append({
                    "name": name,
                    "manu": manu,
                    "value": float(row[v_idx]) if row[v_idx] is not None else 0,
                    "units": float(row[u_idx]) if row[u_idx] is not None else 0,
                    "is_swiss": 'SWISS' in manu
                })
        
        if row_count % 30000 == 0:
            print(f"  ...Processed {row_count} rows ({time.time() - start_time:.1f}s)")

    # Mapping & Ranking
    internal_map = {}
    for mol, data in molecules.items():
        if not data["brands"]: continue
        
        # Sort for Value Rank
        data["brands"].sort(key=lambda x: x["value"], reverse=True)
        for i, b in enumerate(data["brands"]):
            b["rank_val"] = i + 1
            
        # Sort for Unit Rank
        data["brands"].sort(key=lambda x: x["units"], reverse=True)
        for i, b in enumerate(data["brands"]):
            b["rank_uni"] = i + 1
            
            if b["is_swiss"]:
                brand_key = b["name"].split(' ')[0]
                internal_map[brand_key] = {
                    "ims_molecule": mol,
                    "market_value": data["market_value"],
                    "market_units": data["market_units"],
                    "market_growth_val": data["market_growth_val"],
                    "market_growth_uni": data["market_growth_uni"],
                    "rank_val": b["rank_val"],
                    "rank_uni": b["rank_uni"],
                    "total_competitors": len(data["brands"]),
                    "brand_ims_value": b["value"],
                    "brand_ims_units": b["units"]
                }
    
    print(f"✅ Dual-Metric Extraction Complete! Time: {time.time() - start_time:.1f}s")
    with open(OUTPUT_CACHE, "w") as f:
        json.dump(internal_map, f)
        
    return internal_map

if __name__ == "__main__":
    import sys
    force_rebuild = "--force" in sys.argv
    res = build_ims_data(force=force_rebuild)
    print(f"📊 Ready. Found {len(res)} Swiss brands mapped.")
