import os
import time
import logging
import sqlite3
import openpyxl
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright, expect
from sqlalchemy import create_engine, text

# -- CONFIGURATION & LOGGING --
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env.automation")

LOG_FILE = BASE_DIR / "mrep_automation.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# -- CREDENTIALS --
MREP_URL = "https://swiss.mrep.com.pk/Reports/DailySalesTrend"
COMPANY = os.getenv("MREP_COMPANY", "COO")
USERNAME = os.getenv("MREP_USER", "2003")
PASSWORD = os.getenv("MREP_PASSWORD", "2003")
HEADLESS = os.getenv("HEADLESS", "True").lower() == "true"
DOWNLOAD_DIR = BASE_DIR / os.getenv("DOWNLOAD_DIR", "downloads")
DB_TYPE = os.getenv("DB_TYPE", "sqlite")
DB_NAME = os.getenv("DB_NAME", "daily_sales_trend.db")

# Ensure download directory exists
DOWNLOAD_DIR.mkdir(exist_ok=True)

def get_db_engine():
    """Returns a SQLAlchemy engine based on configuration."""
    if DB_TYPE == "sqlite":
        return create_engine(f"sqlite:///{BASE_DIR / DB_NAME}")
    elif DB_TYPE == "mssql":
        server = os.getenv("MSSQL_SERVER", "localhost")
        database = os.getenv("MSSQL_DATABASE", "SwissPharma")
        driver = os.getenv("MSSQL_DRIVER", "ODBC Driver 17 for SQL Server")
        
        # Use pyodbc connection string with Windows Integrated Security
        connection_url = (
            f"mssql+pyodbc://@{server}/{database}"
            f"?driver={driver.replace('{', '').replace('}', '').replace(' ', '+')}&Trusted_Connection=yes&TrustServerCertificate=yes"
        )
        return create_engine(connection_url, fast_executemany=True)
    elif DB_TYPE == "postgres":
        host = os.getenv("DB_HOST", "localhost")
        port = os.getenv("DB_PORT", "5432")
        user = os.getenv("DB_USER", "postgres")
        pw = os.getenv("DB_PASSWORD", "postgres")
        return create_engine(f"postgresql://{user}:{pw}@{host}:{port}/{DB_NAME}")
    else:
        raise ValueError(f"Unsupported DB_TYPE: {DB_TYPE}")

def init_db():
    """Initializes the database schema."""
    logger.info(f"Initializing {DB_TYPE} database...")
    engine = get_db_engine()
    
    # Use standard SQL for portability where possible
    id_col = "id INT PRIMARY KEY IDENTITY(1,1)" if DB_TYPE == "mssql" else "id INTEGER PRIMARY KEY AUTOINCREMENT"
    
    with engine.connect() as conn:
        if DB_TYPE == "mssql":
            conn.execute(text(f"""
                IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='daily_sales_trend' AND xtype='U')
                BEGIN
                    CREATE TABLE daily_sales_trend (
                        {id_col},
                        date VARCHAR(20),
                        territory NVARCHAR(255),
                        code NVARCHAR(50),
                        product NVARCHAR(255),
                        units FLOAT,
                        bonus FLOAT,
                        total_units FLOAT,
                        value FLOAT,
                        created_at DATETIME DEFAULT GETDATE()
                    )
                    CREATE UNIQUE INDEX IX_Sales_Unique ON daily_sales_trend(date, territory, code, product)
                END
            """))
        else:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS daily_sales_trend (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT,
                    territory TEXT,
                    code TEXT,
                    product TEXT,
                    units REAL,
                    bonus REAL,
                    total_units REAL,
                    value REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(date, territory, code, product)
                )
            """))
        conn.commit()
    logger.info("Database initialized.")

def login(page):
    """Logs into the MREP portal."""
    logger.info("Starting login process...")
    page.goto(MREP_URL)
    
    # Fill login form
    # Note: Selectors based on existing services/mrep-sync.cjs logic
    page.locator('input[name*="Company"], input[id*="Company"]').first.fill(COMPANY)
    page.locator('input[name*="Territory"], input[id*="Territory"], input[name*="User"]').first.fill(USERNAME)
    page.locator('input[type="password"]').first.fill(PASSWORD)
    
    # Click Login
    page.locator('button[type="submit"], input[type="submit"], button:has-text("Login")').first.click()
    
    # Wait for navigation/successful load
    page.wait_for_load_state("networkidle")
    logger.info("Login successful.")

def download_report(page):
    """Applies filters and downloads the Excel report."""
    logger.info("Applying filters and initiating download...")
    
    # Example logic based on current year/month
    now = datetime.now()
    current_year = str(now.year)
    current_month = now.strftime("%B")
    
    # Select year and month if needed
    try:
        page.locator('select[name*="year"], select[id*="year"]').first.select_option(label=current_year)
        page.locator('select[name*="month"], select[id*="month"]').first.select_option(label=current_month)
    except Exception as e:
        logger.warning(f"Optional filter selection failed: {e}")

    # Trigger Filter
    page.locator('button:has-text("Filter"), input[value="Filter"]').first.click()
    page.wait_for_load_state("networkidle")

    # Start download listener
    with page.expect_download() as download_info:
        # Trigger Export/Excel button
        export_btn = page.locator('button:has-text("Export"), button:has-text("Download"), a:has-text("Excel")').first
        export_btn.click()
    
    download = download_info.value
    filename = f"mrep_daily_{now.strftime('%Y%m%d_%H%M%S')}.xlsx"
    file_path = DOWNLOAD_DIR / filename
    download.save_as(file_path)
    
    logger.info(f"Report downloaded: {file_path}")
    return file_path

def load_to_database(file_path):
    """Reads Excel using openpyxl and inserts data into the database."""
    logger.info(f"Processing data from {file_path}...")
    
    try:
        workbook = openpyxl.load_workbook(file_path)
    except Exception as e:
        logger.error(f"Failed to load workbook: {e}")
        return

    sheet = workbook.active
    
    # Get headers from first row
    headers = [str(cell.value).strip().lower().replace(" ", "_").replace(".", "_") for cell in sheet[1]]
    logger.info(f"Detected headers: {headers}")

    engine = get_db_engine()
    
    # Process rows starting from the second row
    records_added = 0
    with engine.connect() as conn:
        for row in sheet.iter_rows(min_row=2, values_only=True):
            if not any(row): continue # Skip empty rows
            
            # Map row values to headers
            row_data = dict(zip(headers, row))
            
            try:
                # Basic mapping (adjust based on actual Excel headers)
                product_name = row_data.get('product_name') or row_data.get('product') or row_data.get('products')
                territory = row_data.get('territory') or row_data.get('zone') or row_data.get('all_regions') or 'Unknown'
                code = str(row_data.get('code') or row_data.get('id') or 'N/A')
                
                # Helper to strip currencies and commas
                def clean_numeric(val):
                    if not val: return 0.0
                    if isinstance(val, (int, float)): return float(val)
                    return float(str(val).replace('$', '').replace('€', '').replace(',', '').strip() or 0.0)

                # Skip total rows
                if product_name and 'total' in str(product_name).lower():
                    continue

                record = {
                    'date': row_data.get('date', datetime.now().strftime('%Y-%m-%d')),
                    'territory': territory,
                    'code': code,
                    'product': product_name or 'Unknown',
                    'units': clean_numeric(row_data.get('units') or row_data.get('actual')),
                    'bonus': clean_numeric(row_data.get('bonus')),
                    'total_units': clean_numeric(row_data.get('total_units')),
                    'value': clean_numeric(row_data.get('value'))
                }
                
                if DB_TYPE == "mssql":
                    # MSSQL MERGE pattern (Upsert)
                    conn.execute(text("""
                        MERGE daily_sales_trend AS Target
                        USING (SELECT :date AS date, :territory AS territory, :code AS code, :product AS product) AS Source
                        ON (Target.date = Source.date AND Target.territory = Source.territory AND Target.code = Source.code AND Target.product = Source.product)
                        WHEN MATCHED THEN
                            UPDATE SET units = :units, bonus = :bonus, total_units = :total_units, value = :value
                        WHEN NOT MATCHED THEN
                            INSERT (date, territory, code, product, units, bonus, total_units, value)
                            VALUES (:date, :territory, :code, :product, :units, :bonus, :total_units, :value);
                    """), record)
                else:
                    conn.execute(text("""
                        INSERT INTO daily_sales_trend (date, territory, code, product, units, bonus, total_units, value)
                        VALUES (:date, :territory, :code, :product, :units, :bonus, :total_units, :value)
                        ON CONFLICT(date, territory, code, product) DO UPDATE SET
                        units = EXCLUDED.units,
                        bonus = EXCLUDED.bonus,
                        total_units = EXCLUDED.total_units,
                        value = EXCLUDED.value
                    """), record)
                records_added += 1
            except Exception as e:
                logger.warning(f"Error processing row: {e}")
        
        conn.commit()
    
    logger.info(f"Data sync completed. Added/Updated {records_added} records.")

def main():
    """Main orchestration function with retry logic."""
    logger.info("=== MREP Automation Started ===")
    
    init_db()
    
    retry_count = int(os.getenv("RETRY_ATTEMPTS", "3"))
    for attempt in range(1, retry_count + 1):
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=HEADLESS)
                context = browser.new_context(accept_downloads=True)
                page = context.new_page()
                
                login(page)
                file_path = download_report(page)
                load_to_database(file_path)
                
                browser.close()
                logger.info("=== MREP Automation Success ===")
                return
                
        except Exception as e:
            logger.error(f"Attempt {attempt} failed: {e}")
            if attempt < retry_count:
                logger.info("Retrying in 10 seconds...")
                time.sleep(10)
            else:
                logger.error("All retry attempts exhausted.")
                raise

if __name__ == "__main__":
    main()
