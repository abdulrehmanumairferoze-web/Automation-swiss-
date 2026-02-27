import pandas as pd
import os

def check_date_specificity():
    latest_file = os.path.join('downloads', [f for f in os.listdir('downloads') if f.endswith('.xlsx')][0])
    df = pd.read_excel(latest_file)
    
    # Let's pick a row that had data on Feb 9th
    # For example: Pentallin Syp. IVY in Jacobabad
    row = df[(df['All Regions'] == 'Jacobabad') & (df['Product_Name'] == 'Pentallin Syp. IVY')].iloc[0]
    
    print(f"--- DATA FOR PRODUCT: {row['Product_Name']} IN {row['All Regions']} ---")
    print(f"Target Column Feb 9:  {row['9-Feb-26']}")
    print(f"Target Column Feb 10: {row['10-Feb-26']}")
    print(f"Target Column Feb 11: {row['11-Feb-26']}")
    print(f"Grand Total Column:   {row['Total']}")
    
    print("\n--- CODE LOGIC CHECK ---")
    from datetime import datetime, timedelta
    today = datetime(2026, 2, 15) # Simulating today
    target_date_obj = today - timedelta(days=5)
    target_col = target_date_obj.strftime("%#d-%b-%y")
    print(f"If Today is Feb 15, Target Date (Today-5) is: {target_date_obj.strftime('%d-%b-%Y')}")
    print(f"Code precisely looks for column: '{target_col}'")
    
    val = row[target_col]
    print(f"Value picked by code: {val}")

if __name__ == '__main__':
    check_date_specificity()
