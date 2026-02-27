# Territory Sales - Browser Console Check Instructions

## What to Do:

1. **Refresh your browser** (Ctrl+Shift+R)
2. **Open DevTools** (Press F12)
3. **Go to Console tab**
4. **Navigate to Territory Sales tab**
5. **Click on any date** (e.g., November 1)
6. **Copy ALL the console output** that appears
7. **Share it with me**

## What I'm Looking For:

The console will show:
```
🔍 === TERRITORY SALES CHART DEBUG ===
Date clicked: November 01, 2025
Entities extracted: X [...]
Looking for MASTER pattern: MASTER_November_2025
MASTER records found: X
Daily records found: X
Chart data calculated: [...]
=== END DEBUG ===
```

This will tell me EXACTLY what's wrong:
- If entities = 0: No territories extracted
- If MASTER records = 0: No targets in database
- If daily records = 0: No actual data for that date
- If chart data all zeros: Calculation logic issue

## DO THIS NOW and share the console output.
