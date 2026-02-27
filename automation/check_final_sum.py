import pandas as pd
import os

def check():
    files = [f for f in os.listdir('downloads') if f.endswith('.xlsx')]
    if not files:
        print("No files found")
        return
    
    latest_file = os.path.join('downloads', max(files))
    print(f"Checking file: {latest_file}")
    
    df = pd.read_excel(latest_file)
    target = '10-Feb-26'
    
    exclude_keywords = ['total', 'all']
    cols_to_check = ['Zone', 'Team', 'Brand', 'Product_Name', 'All Regions']

    def is_raw_data(row):
        for col in cols_to_check:
            val = str(row.get(col, "")).lower()
            if any(key in val for key in exclude_keywords):
                return False
        return True

    mask = df.apply(is_raw_data, axis=1)
    df_final = df[mask]
    
    print(f"Target: {target}")
    print(f"Raw Data Rows: {len(df_final)}")
    print(f"Grand Total Achievement: {df_final[target].sum()}")

    print("\nTeam-wise Achievement:")
    print(df_final.groupby('Team')[target].sum().sort_values(ascending=False).head(10))

if __name__ == '__main__':
    check()
