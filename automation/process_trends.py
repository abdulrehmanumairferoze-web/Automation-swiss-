
import pandas as pd
import json
import os

BASE_DIR = r"D:\Downloads\copy-of-copy-of--swiss-dashboard\automation"
FILE_VAL = os.path.join(BASE_DIR, "downloads", "Daily_Sale_Trend20260217 (2).xlsx")
FILE_UNI = os.path.join(BASE_DIR, "downloads", "Daily_Sale_Trend20260217 (3).xlsx")

def calculate_factors(filepath):
    df = pd.read_excel(filepath, engine="openpyxl")
    
    # Filter "All Regions" column
    # Ignore "All" and "Total"
    if 'All Regions' in df.columns:
        df = df[~df['All Regions'].astype(str).str.upper().str.contains("ALL|TOTAL", na=False)]
    
    # Date columns are 1-Jan-26 to 31-Jan-26 (31 days)
    date_cols = [f"{i}-Jan-26" for i in range(1, 32)]
    # Safety check if they exist
    date_cols = [c for c in date_cols if c in df.columns]
    
    # last 5 days: 27, 28, 29, 30, 31
    surge_days = [f"{i}-Jan-26" for i in range(27, 32)]
    surge_days = [c for c in surge_days if c in df.columns]
    
    # normal days: 1 to 26
    normal_days = [f"{i}-Jan-26" for i in range(1, 27)]
    normal_days = [c for c in normal_days if c in df.columns]
    
    def get_factor(group_df):
        normal_avg = group_df[normal_days].sum().sum() / len(normal_days) if normal_days else 0
        surge_avg = group_df[surge_days].sum().sum() / len(surge_days) if surge_days else 0
        
        if normal_avg <= 0:
            return 1.0
        return surge_avg / normal_avg

    # Calculate by Team and Brand (Normalization to uppercase for matching)
    brand_factors = {str(k).strip().upper(): v for k, v in df.groupby('Brand').apply(get_factor).to_dict().items()}
    team_factors = {str(k).strip().upper(): v for k, v in df.groupby('Team').apply(get_factor).to_dict().items()}
    
    return {"Brand": brand_factors, "Team": team_factors, "Product": {}, "Region": {}}

def process():
    print("Processing Value Trends...")
    val_factors = calculate_factors(FILE_VAL)
    print("Processing Unit Trends...")
    uni_factors = calculate_factors(FILE_UNI)
    
    # Save separately
    with open(os.path.join(BASE_DIR, "smart_surge_factors_financial.json"), "w") as f:
        json.dump(val_factors, f, indent=4)
    
    with open(os.path.join(BASE_DIR, "smart_surge_factors_unit.json"), "w") as f:
        json.dump(uni_factors, f, indent=4)
    
    print("Trend processing complete. Factors saved.")

if __name__ == "__main__":
    process()
