import pandas as pd
import os

def debug_achievers():
    latest_file = os.path.join('downloads', [f for f in os.listdir('downloads') if f.endswith('.xlsx')][0])
    df = pd.read_excel(latest_file)
    target = '10-Feb-26'
    
    achievers = df[df['Team'].str.contains('ACHIEVERS', na=False, case=False)]
    active = achievers[achievers[target] > 0]
    
    with open('achievers_active_10feb.txt', 'w') as f:
        f.write(active[['Zone', 'Team', 'Brand', 'Product_Name', 'All Regions', target]].to_string())
    print(f"Saved active ACHIEVERS to achievers_active_10feb.txt")

if __name__ == '__main__':
    debug_achievers()
