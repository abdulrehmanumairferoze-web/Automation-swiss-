import pandas as pd

def debug_north1():
    df = pd.read_excel('downloads/Daily_Sale_Trend20260214.xlsx')
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

    north_1 = df[df['Zone'].str.contains('North-1', na=False, case=False)]
    raw = north_1[north_1.apply(is_raw_data, axis=1)]
    
    with open('north1_debug.txt', 'w') as f:
        f.write(f"RAW ROWS FOR North-1 on {target}:\n")
        f.write(raw[['Team', 'Brand', 'Product_Name', 'All Regions', target]].to_string())
        f.write(f"\nSUM OF RAW ROWS: {raw[target].sum()}")

if __name__ == '__main__':
    debug_north1()
