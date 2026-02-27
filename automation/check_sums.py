import pandas as pd

def check_zones():
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

    df['is_raw'] = df.apply(is_raw_data, axis=1)
    raw_df = df[df['is_raw']]
    
    print("SUMS BY ZONE (User Filter):")
    print(raw_df.groupby('Zone')[target].sum())
    
    print("\nTOTAL SUM (User Filter):")
    print(raw_df[target].sum())

    print("\nSUMS BY TEAM (User Filter):")
    print(raw_df.groupby('Team')[target].sum())

if __name__ == '__main__':
    check_zones()
