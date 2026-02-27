import pandas as pd
import os

def check():
    latest_file = os.path.join('downloads', [f for f in os.listdir('downloads') if f.endswith('.xlsx')][0])
    df = pd.read_excel(latest_file)
    target = '9-Feb-26'
    
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
    
    achievers = df_final[df_final['Team'].str.contains('ACHIEVERS', na=False, case=False)]
    print(f"ACHIEVERS Sum for {target}: {achievers[target].sum()}")
    
    # Check some rows
    print("\nTop ACHIEVERS rows for 9-Feb:")
    print(achievers.sort_values(target, ascending=False).head(10)[cols_to_check + [target]])

if __name__ == '__main__':
    check()
