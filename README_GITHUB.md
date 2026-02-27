# GitHub Actions Setup for MREP Automation

This package contains the lean source code and GitHub Actions workflow needed to run your MREP reports automatically every day.

## 1. Create your GitHub Repository
1. Go to [github.com/new](https://github.com/new).
2. Name it `Swiss-dash`.
3. Keep it **Public** or **Private** (recommended).
4. Do **NOT** initialize with README or license.

## 2. Push Code to GitHub
Run these commands in your terminal (PowerShell or Command Prompt) inside the project folder:

```powershell
# Remove old git data if any
Remove-Item -Recurse -Force .git -ErrorAction SilentlyContinue

# Initialize fresh and push
git init
git add .
git commit -m "feat: Initial setup for MREP Automation"
git branch -M main
git remote add origin https://github.com/abdulrehmanumairferoze-web/Swiss-dash.git
git push -u origin main --force
```

## 3. Configure Secrets (CRITICAL)
Your automation needs credentials to log in. Go to your repository on GitHub:
1. **Settings** > **Secrets and variables** > **Actions**
2. Click **New repository secret** for each of these:
   - `MREP_COMPANY`: (e.g., COO)
   - `MREP_USERNAME`: (Your user ID)
   - `MREP_PASSWORD`: (Your password)

## 4. Verify & Run
1. Go to the **Actions** tab on GitHub.
2. Select **MREP Automation Report**.
3. Click **Run workflow** > **Run workflow**.

## 5. View Results
Once the run is complete:
1. Click on the run name.
2. Scroll down to **Artifacts**.
3. Download `mrep-automation-results` to see:
   - **Screenshots** (debug_post_login.png, etc.)
   - **Logs** (mrep_target_achievement.log)
   - **Reports** (The exported .xlsx file)
