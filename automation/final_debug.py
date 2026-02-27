import pandas as pd
import os

def final_debug():
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

    df['is_raw'] = df.apply(is_raw_data, axis=1)
    df_raw = df[df['is_raw']].copy()
    
    achievers_raw = df_raw[df_raw['Team'].str.contains('ACHIEVERS', na=False, case=False)]
    
    print(f"--- ACHIEVERS (Raw Rows with sales on {target}) ---")
    active_achievers = achievers_raw[achievers_raw[target] > 0]
    print(active_achievers[cols_to_check + [target]])
    print(f"\nSUM of these rows: {active_achievers[target].sum()}")
    
    # Are there duplicate rows?
    print(f"\nDuplicates in ACHIEVERS: {active_achievers.duplicated(subset=cols_to_check + [target]).sum()}")
    
    # Search for value 37 in the entire team
    potential_37 = achievers_raw[achievers_raw[target] == 37]
    if not potential_37.empty:
        print("\nFound rows with exactly 37:")
        print(potential_37[cols_to_check + [target]])

if __name__ == '__main__':
    final_debug()
