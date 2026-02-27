import pandas as pd
import os

def debug():
    df = pd.read_excel('downloads/Daily_Sale_Trend20260215.xlsx')
    target = '9-Feb-26'
    
    exclude_keywords = ['total', 'all']
    cols_to_check = ['Zone', 'Team', 'Brand', 'Product_Name', 'All Regions']

    def is_raw_data(row):
        for col in cols_to_check:
            val = str(row.get(col, "")).lower()
            if any(key in val for key in exclude_keywords):
                return False
        return True

    df['is_raw'] = df.apply(is_raw_data, axis=1)
    df_raw = df[df['is_raw']]
    
    achievers = df_raw[df_raw['Team'].str.contains('ACHIEVERS', na=False, case=False)]
    achievers_active = achievers[achievers[target] > 0]
    
    print(f"Total Rows for ACHIEVERS: {len(achievers_active)}")
    print(f"Sum for ACHIEVERS: {achievers_active[target].sum()}")
    print("\nSum by Brand:")
    print(achievers_active.groupby('Brand')[target].sum())
    print("\nSample Data (Top 20):")
    print(achievers_active.sort_values(target, ascending=False).head(20)[cols_to_check + [target]])

if __name__ == '__main__':
    debug()
