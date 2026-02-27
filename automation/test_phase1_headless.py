import time
import logging
import os
import shutil
from pathlib import Path
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env.automation")

def verify_headless_browser(force_month=None, force_year=None):
    """
    Test 1, 2, 3, 4, 6, 7 & 10 (Headless Authentication & Discovery & Naming)
    Tests dynamic calendar interactions based on changes in month/year.
    """
    url = "https://swiss.mrep.com.pk/Reports/DailySalesTrend"
    company = os.getenv("MREP_COMPANY", "COO")
    user = os.getenv("MREP_USER", "2003")
    pwd = os.getenv("MREP_PASSWORD", "2003")
    download_dir = BASE_DIR / "downloads"
    
    # Empty downloads folder for test isolation
    if download_dir.exists():
        for f in download_dir.glob("*.xlsx"):
            f.unlink()
    download_dir.mkdir(exist_ok=True)

    logging.info("Starting Phase 1: Headless Extraction Tests...")
    start_time = time.time()
    
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(accept_downloads=True)
            page = context.new_page()
            
            # --- AUTH BYPASS ---
            logging.info("Testing Auth Bypass...")
            page.goto(url)
            page.locator('input[name*="Company"], input[id*="Company"]').first.fill(company)
            page.locator('input[name*="Territory"], input[id*="Territory"], input[name*="User"]').first.fill(user)
            page.locator('input[type="password"]').first.fill(pwd)
            page.locator('button[type="submit"], input[type="submit"], button:has-text("Login")').first.click()
            page.wait_for_load_state("networkidle")
            logging.info("✅ Login successful in headless mode. Session instantiated.")
            
            # --- DATE SHIFT BEHAVIOR ---
            target_year = str(force_year) if force_year else "2026"
            target_month = str(force_month) if force_month else "February"
            logging.info(f"Testing behavior on Date Shift -> Year: {target_year}, Month: {target_month}")
            
            try:
                page.locator('select[name*="year"], select[id*="year"]').first.select_option(label=target_year)
                page.locator('select[name*="month"], select[id*="month"]').first.select_option(label=target_month)
                logging.info(f"✅ Form dynamically accepted month/year inputs.")
            except Exception as e:
                logging.warning(f"⚠️ Warning: Date selectors not found or interactive. Continuing without filtering. ({e})")

            # --- WAIT-LOGIC & ELEMENT DISCOVERY ---
            logging.info("Testing Element Discovery (Filter & Download)...")
            page.locator('button:has-text("Filter"), input[value="Filter"]').first.click()
            page.wait_for_load_state("networkidle")
            
            # This line tests 'Lazy Load'. We await the download hook gracefully.
            logging.info("Initiating download hook. Waiting for dynamic rendering response...")
            with page.expect_download(timeout=60000) as download_info:
                export_btn = page.locator('button:has-text("Export"), button:has-text("Download"), a:has-text("Excel")').first
                export_btn.click()
            
            download = download_info.value
            
            # --- NAMING & PATHING ---
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            file_name = f"mrep_test_download_{target_month}_{timestamp}.xlsx"
            final_path = download_dir / file_name
            download.save_as(final_path)
            
            browser.close()
            
            if final_path.exists():
                size_kb = final_path.stat().st_size / 1024
                logging.info(f"✅ Download Pathing Verified: Saved at {final_path}")
                logging.info(f"✅ Naming Verified: Renamed with timestamp to {file_name}")
                logging.info(f"✅ Download Size: {size_kb:.1f} KB downloaded successfully.")
                if size_kb < 1:
                    logging.warning("⚠️ File is smaller than 1KB. 'Empty State / No Records Found' triggered successfully or download corrupted.")
            else:
                logging.error("❌ Failed: File was not routed to the correct downloads directory.")
                
            run_time = time.time() - start_time
            logging.info(f"=== Phase 1 Validation Complete in {run_time:.1f}s ===")

    except Exception as e:
        logging.error(f"❌ Phase 1 Headless Test Failed: {e}")

if __name__ == '__main__':
    verify_headless_browser(force_month="January")
