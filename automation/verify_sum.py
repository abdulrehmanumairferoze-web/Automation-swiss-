import pandas as pd
import os

def verify():
    file_path = 'downloads/Daily_Sale_Trend20260214.xlsx'
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    df = pd.read_excel(file_path)
    target = '9-Feb-26'
    
    exclude_keywords = ['total', 'all']
    
    def is_raw_data(row):
        # Check specific columns as requested
        cols = ['Zone', 'Team', 'Brand', 'Product_Name', 'All Regions']
        for col in cols:
            if col not in df.columns: continue
            val = str(row[col]).lower()
            if any(key in val for key in exclude_keywords):
                return False
        return True

    mask = df.apply(is_raw_data, axis=1)
    df_final = df[mask]
    
    if target in df_final.columns:
        total_val = df_final[target].sum()
        print(f"VERIFICATION_SUCCESS")
        print(f"Rows After Filter: {len(df_final)}")
        print(f"Total Sum for {target}: {total_val}")
    else:
        print(f"Target column {target} not found")

if __name__ == '__main__':
    verify()
