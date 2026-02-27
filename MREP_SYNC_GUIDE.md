# MREP Automation Sync - Quick Start Guide

## 🎯 What This Does

Automatically collects Daily Achievement data from MREP portal and syncs it to your Swiss Dashboard database.

## 📋 Prerequisites

**IMPORTANT**: You need to install Playwright first. Run this command:

```powershell
# Run PowerShell as Administrator and execute:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Then install dependencies:
npm install
npx playwright install chromium
```

## 🚀 Usage

### Option 1: API Endpoint (Recommended)

Trigger sync via HTTP request:

```bash
# Using curl
curl -X POST http://localhost:5173/api/sync/mrep

# Using PowerShell
Invoke-WebRequest -Uri "http://localhost:5173/api/sync/mrep" -Method POST
```

### Option 2: Direct Script Execution

Run the sync script directly:

```bash
node services/mrep-sync.cjs
```

## 🧪 Testing

### Test MREP Login
```bash
node services/mrep-sync.cjs --test-login
```

### Test Excel Parser
```bash
node services/mrep-parser.cjs --test-file path/to/sample.xlsx
```

## 📊 What Gets Synced

- **ZONE** → `team` field (territory identifier)
- **PRODUCT_NAME** → `metric` field
- **Daily columns** → `actual` values
- **Department** → Set to "Territory Sales"

## ⚙️ Configuration

Edit `services/mrep-sync.cjs` to adjust:

- Login credentials (currently: Company=COO, User=2003, Pass=2003)
- Headless mode (set `headless: true` for production)
- Download directory
- Timeout values

## 🔍 Verification

After sync, check your database:

```sql
SELECT * FROM operation_data 
WHERE department = 'Territory Sales' 
ORDER BY created_at DESC 
LIMIT 20;
```

## ⚠️ Important Notes

1. **No Impact on Existing App**: This feature is completely isolated and won't affect current functionality
2. **Conflict Handling**: Running sync twice for the same date will UPDATE existing records (not duplicate)
3. **Browser Automation**: First run will download Chromium browser (~100MB)
4. **Selectors**: If MREP portal UI changes, you may need to update element selectors in `mrep-sync.cjs`

## 🐛 Troubleshooting

**PowerShell script execution error?**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Playwright not found?**
```bash
npm install playwright
npx playwright install chromium
```

**Login fails?**
- Check credentials in `services/mrep-sync.cjs`
- Run with `--test-login` to debug
- Verify MREP portal is accessible

**Drag-and-drop fails?**
- Script automatically falls back to manual mouse coordinates
- Check browser console for errors
- Adjust selectors if MREP UI changed

## 📁 Files Created

- `services/mrep-sync.cjs` - Playwright automation
- `services/mrep-parser.cjs` - Excel parser
- `mrep-downloads/` - Downloaded Excel files (auto-created)
- New API endpoint: `POST /api/sync/mrep`
