import pandas as pd
import os

def debug_data():
    file_path = 'downloads/Daily_Sale_Trend20260214.xlsx'
    df = pd.read_excel(file_path)
    target = '9-Feb-26'
    
    exclude_keywords = ['total', 'all']
    cols_to_check = ['Zone', 'Team', 'Brand', 'Product_Name', 'All Regions']
    
    def is_raw_data(row):
        for col in cols_to_check:
            if col not in df.columns: continue
            val = str(row[col]).lower()
            if any(key in val for key in exclude_keywords):
                return False
        return True

    mask = df.apply(is_raw_data, axis=1)
    df_final = df[mask]
    
    # Let's see rows that contribute the most
    print("TOP 20 CONTRIBUTING ROWS AFTER FILTER:")
    top_rows = df_final.sort_values(target, ascending=False).head(20)
    print(top_rows[cols_to_check + [target]])
    
    # Check for a specific Team mentioned by user: ACHIEVERS
    print("\nACHIEVERS TEAM DATA (Filtered):")
    achievers = df_final[df_final['Team'].str.contains('ACHIEVERS', na=False, case=False)]
    print(achievers[cols_to_check + [target]])
    print(f"Total for ACHIEVERS (Filtered): {achievers[target].sum()}")

if __name__ == '__main__':
    debug_data()
