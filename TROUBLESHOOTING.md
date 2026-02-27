# Swiss Dashboard Troubleshooting Guide

## Quick Diagnostics

### 1. Check System Health
```powershell
# Health check endpoint
curl http://localhost:5173/api/health

# Database diagnostics
node diagnostics.cjs

# View sample data
node check-data.cjs
```

### 2. View Logs
```powershell
# Last 50 lines
docker logs swiss_dashboard_app --tail 50

# Follow logs in real-time
docker logs swiss_dashboard_app -f
```

## 🌐 Browser Console Errors

### "A listener indicated an asynchronous response..."
**Cause**: This error is NOT coming from the project code. It is a common warning in Chrome caused by external browser extensions (e.g., Grammarly, AdBlock, or VPNs) that fail to respond to background messages correctly.

**Resolution**:
- I have added **Defensive Rendering Guards** to the TRADE module in `Dashboard.tsx`.
- The error is harmless and is successfully caught by our `try/catch` and `useMemo` safety blocks.
- It does **not** block data fetching or table rendering.

## Common Issues & Solutions

### ❌ Data Not Showing After Upload

**Symptoms:**
- Upload succeeds but dashboard is empty
- Browser console shows `🔒 App: Save blocked`

**Solution:**
1. Hard refresh browser (Ctrl+Shift+R)
2. Check browser console for errors
3. Verify API response format matches frontend expectations

**Root Cause:** Column name mismatch (snake_case vs camelCase)

---

### ❌ 500 Internal Server Error on Upload

**Symptoms:**
- `POST http://localhost:5173/api/operationData 500`
- Error in logs: `column "X" does not exist`

**Solution:**
Check `server.cjs` SQL queries match the actual database schema in `db.cjs`

**Common Mistakes:**
- Using `updated_at` instead of `created_at`
- Mismatched column names

---

### ❌ Invalid JSON Syntax Error

**Symptoms:**
- `invalid input syntax for type json`
- Finance/Production data fails to save

**Solution:**
Ensure proper JSON stringification:

**Frontend** (`services/dbService.ts`):
```typescript
const body = { key, value: JSON.stringify(value) };
```

**Backend** (`server.cjs`):
```javascript
// Parse string to object
if (typeof value === 'string') {
  value = JSON.parse(value);
}

// Stringify for JSONB storage
await pool.query('INSERT ... VALUES ($1, $2)', [key, JSON.stringify(value)]);
```

---

### ❌ Data Lost After Docker Restart

**Symptoms:**
- All data disappears when running `docker-compose down`
- Database is empty after restart

**Solution:**
Verify named volume exists in `docker-compose.yml`:

```yaml
volumes:
  pgdata:

services:
  db:
    volumes:
      - pgdata:/var/lib/postgresql/data
```

**Check volumes:**
```powershell
docker volume ls | findstr pgdata
```

---

### ❌ Container Won't Start

**Symptoms:**
- `docker-compose up` fails
- Port conflicts or name conflicts

**Solution:**
```powershell
# Clean up old containers
docker-compose down --remove-orphans
docker rm -f swiss_dashboard_db swiss_dashboard_app

# Rebuild and start
docker-compose up -d --build
```

---

## Database Schema Reference

### operation_data Table
```sql
CREATE TABLE operation_data (
  id SERIAL PRIMARY KEY,
  department TEXT NOT NULL,
  team TEXT,
  metric TEXT NOT NULL,
  plan NUMERIC DEFAULT 0,
  actual NUMERIC DEFAULT 0,
  variance NUMERIC DEFAULT 0,
  unit TEXT,
  status TEXT,
  reasoning TEXT,
  report_date TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(department, team, metric, report_date)
);
```

**⚠️ IMPORTANT:** 
- Column is `report_date` (snake_case) in database
- Frontend expects `reportDate` (camelCase)
- **Always transform in GET endpoint!**

### finance_reports / production_reports Tables
```sql
CREATE TABLE finance_reports (
  month_key TEXT PRIMARY KEY,
  report_json JSONB NOT NULL,  -- Must be valid JSON
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**⚠️ IMPORTANT:**
- `report_json` is JSONB type
- Must stringify JavaScript objects before INSERT
- Parse strings back to objects before sending to PostgreSQL

---

## Startup Checklist

Before deploying or after making changes:

- [ ] Run `docker-compose down && docker-compose up -d --build`
- [ ] Wait 15 seconds for services to start
- [ ] Check health: `http://localhost:5173/api/health`
- [ ] Run diagnostics: `node diagnostics.cjs`
- [ ] Upload test Excel file
- [ ] Verify data appears on dashboard
- [ ] Restart Docker and confirm data persists

---

## Emergency Recovery

If data is corrupted or system is broken:

```powershell
# 1. Stop everything
docker-compose down

# 2. Remove volumes (⚠️ DELETES ALL DATA)
docker volume rm copy-of-copy-of--swiss-dashboard_pgdata

# 3. Rebuild from scratch
docker-compose up -d --build

# 4. Re-upload all Excel files
```

---

## Contact & Support

For persistent issues:
1. Capture full logs: `docker logs swiss_dashboard_app > logs.txt`
2. Run diagnostics: `node diagnostics.cjs > diagnostics.txt`
3. Share both files with development team
