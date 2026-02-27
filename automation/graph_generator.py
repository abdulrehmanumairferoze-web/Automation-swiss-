"""
graph_generator.py
Generates visual analytics for the PDF report:
- 4 Circular Gauges for Teams
- Horizontal Bar Chart for Top 10 Brands
"""

import os
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

# Apply Emerald Theme
EMERALD = "#50C878"
FOREST = "#228B22"
CORAL = "#F08080"
NAVY = "#1a237e"
WHITE = "#ffffff"
GRAY = "#e0e0e0"

def create_gauges_chart(team_df, output_dir="reports"):
    """
    Create 4 circular gauges for the specified teams.
    Outputs a single image containing 4 subplots.
    """
    targets = ["DYNAMIC", "ACHIEVERS", "CONCORD", "PASSIONATE"]
    
    # Create output dir
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Filter relevant teams
    # Ensure team names match exactly or normalize
    team_df['Category'] = team_df['Category'].str.upper().str.strip()
    df = team_df[team_df['Category'].isin(targets)].copy()

    # Setup 1 row of 4 columns
    fig, axes = plt.subplots(1, 4, figsize=(12, 3))
    
    # Flatten axes just in case
    if not isinstance(axes, np.ndarray):
        axes = [axes]
    
    for i, team in enumerate(targets):
        ax = axes[i]
        
        # Get data for this team
        row = df[df['Category'] == team]
        
        pct_val = 0
        if not row.empty:
            actual = row['Actual'].values[0]
            target = row['Target'].values[0]
            if target > 0:
                pct_val = (actual / target) * 100
        
        # Donut Chart
        vis_pct = min(pct_val, 100)
        remaining = 100 - vis_pct
        
        colors = [EMERALD, GRAY]
        ax.pie([vis_pct, remaining], 
               colors=colors, 
               startangle=90, 
               counterclock=False, 
               wedgeprops=dict(width=0.3, edgecolor='white'))
        
        ax.text(0, 0, f"{pct_val:.1f}%", ha='center', va='center', fontsize=14, fontweight='bold', color=NAVY)
        ax.set_title(team, y=-0.1, fontsize=10, fontweight='bold', color=FOREST)

    plt.tight_layout()
    filepath = os.path.join(output_dir, "gauges_chart.png")
    plt.savefig(filepath, dpi=300, bbox_inches='tight')
    plt.close()
    return filepath


def create_team_performance_chart(team_df, days_remaining, output_dir="reports"):
    """
    One large Grouped Bar Graph for Page 1 Hero Visual.
    Teams: DYNAMIC, ACHIEVERS, CONCORD, PASSIONATE
    Bars: Emerald Green for Actual
    Marker: Red Vertical Dash for Target-to-Date (Pace)
    Legend: Includes 'Required Daily Catch-up'
    """
    targets = ["DYNAMIC", "ACHIEVERS", "CONCORD", "PASSIONATE"]
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    team_df['Category'] = team_df['Category'].str.upper().str.strip()
    # Ensure they are in fixed order
    df_list = []
    for t in targets:
        row = team_df[team_df['Category'] == t]
        if row.empty:
            df_list.append(pd.DataFrame({"Category": [t], "Actual": [0], "Target": [0], "Expected_Today": [0]}))
        else:
            df_list.append(row)
    df = pd.concat(df_list)

    categories = df['Category']
    actuals = df['Actual']
    pace = df['Expected_Today']
    full_target = df['Target']

    # Calculate Catch-up: (Full Target - Actual) / Days Remaining
    # Only if Actual < Full Target
    catch_up = (full_target - actuals) / max(1, days_remaining)
    catch_up = catch_up.apply(lambda x: max(0, x))

    fig, ax = plt.subplots(figsize=(10, 6))
    
    # Bars for Actuals
    x_pos = np.arange(len(categories))
    ax.bar(x_pos, actuals, color=EMERALD, edgecolor=FOREST, width=0.5, label='Actual Units', zorder=2)

    # Markers for Pace (Target-to-date)
    # Using scatter with custom vertical line markers
    ax.scatter(x_pos, pace, marker='_', color='red', s=1500, linewidth=4, zorder=3, label='Target-to-Date (Pace)')

    # Styling
    ax.set_title("DIVISIONAL PERFORMANCE: ACTUAL VS TARGET PACE", fontsize=16, fontweight='bold', color=NAVY, pad=20)
    ax.set_xticks(x_pos)
    ax.set_xticklabels(categories, fontsize=12, fontweight='black', color=FOREST)
    
    # Add Catch-up text above bars or in legend?
    # User: "Place the 'Required Daily Catch-up' number inside the legend or next to the bars."
    # Let's put it on top of the bars if it's > 0
    for i, val in enumerate(catch_up):
        if val > 0:
            ax.text(i, actuals.iloc[i] + (max(actuals)*0.02), f"Catch-up:\n{val:,.0f}/day", 
                    ha='center', va='bottom', fontsize=9, fontweight='bold', color='red')

    # Grid & Spines
    ax.grid(axis='y', linestyle='--', alpha=0.3, zorder=0)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color(GRAY)
    ax.spines['bottom'].set_color(GRAY)

    ax.legend(loc='upper right', frameon=True, fontsize=10)

    plt.tight_layout()
    filepath = os.path.join(output_dir, "team_hero_chart.png")
    plt.savefig(filepath, dpi=300, bbox_inches='tight')
    plt.close()
    return filepath


def create_top_brands_chart(brand_df, output_dir="reports"):
    """
    Horizontal Bar Chart: Top 10 Brands by Actual Sales.
    Includes 'Expected Today' marker line.
    """
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Sort descending by Actual and take top 10
    top10 = brand_df.sort_values("Actual", ascending=True).tail(10) # Tail because barh plots bottom-up
    
    # If using 'Expected_Today' column
    # Ensure it exists
    if "Expected_Today" not in top10.columns:
        # Fallback if logic is missing upstream (should be there)
        top10["Expected_Today"] = 0

    categories = top10['Category']
    actuals = top10['Actual']
    expected = top10['Expected_Today']
    
    fig, ax = plt.subplots(figsize=(10, 6))
    
    # Horizontal Bar
    bars = ax.barh(categories, actuals, color=EMERALD, edgecolor=FOREST, height=0.6, zorder=2)
    
    # Expected Marker (Vertical line segment at the expected value)
    # y positions correspond to 0, 1, 2...
    y_pos = np.arange(len(categories))
    
    # Plot red vertical bars for expected
    ax.scatter(expected, y_pos, marker='|', color='red', s=100, linewidth=3, zorder=3, label='Pro-Rata Target')

    # Styling
    ax.set_xlabel('Achievement', fontsize=10, fontweight='bold', color=NAVY)
    ax.set_title('Top 10 Brands: Actual vs Pro-Rata Target', fontsize=14, fontweight='bold', color=NAVY)
    
    # Grid
    ax.grid(axis='x', linestyle='--', alpha=0.5, zorder=0)
    
    # Spines
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color(FOREST)
    ax.spines['bottom'].set_color(FOREST)
    
    ax.legend(loc='lower right')
    
    plt.tight_layout()
    filepath = os.path.join(output_dir, "brands_chart.png")
    plt.savefig(filepath, dpi=300, bbox_inches='tight')
    plt.close()
    return filepath
