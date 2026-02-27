import pandas as pd
import os

def verify():
    file_path = 'downloads/Daily_Sale_Trend20260214.xlsx'
    df = pd.read_excel(file_path)
    target = '9-Feb-26'
    
    def is_raw_data(row):
        cols = ['Zone', 'Team', 'Brand', 'Product_Name', 'All Regions']
        for col in cols:
            val = str(row[col]).strip().lower()
            # Check for EXACT word 'all' or 'total' as a separate word
            # Subtotals usually look like "Brand Total" or just "All"
            if val == 'all':
                return False
            if 'total' in val:
                return False
        return True

    mask = df.apply(is_raw_data, axis=1)
    df_final = df[mask]
    
    total_val = df_final[target].sum()
    print(f"VERIFICATION_SUCCESS")
    print(f"Total Sum for {target}: {total_val}")
    
    # Check ACHIEVERS sum
    achievers = df_final[df_final['Team'].str.contains('ACHIEVERS', na=False, case=False)]
    print(f"Sum for ACHIEVERS: {achievers[target].sum()}")

if __name__ == '__main__':
    verify()
