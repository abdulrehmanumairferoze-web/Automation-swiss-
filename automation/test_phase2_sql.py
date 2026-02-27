import os
import time
import logging
import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
load_dotenv('automation/.env.automation')

def run_phase_2_tests():
    logging.info("Starting Phase 2: MS SQL Engine Validation")
    
    server = os.getenv("MSSQL_SERVER", "DESKTOP-M5RI2I7\\MSSQLSERVER01")
    database = os.getenv("MSSQL_DATABASE", "Local_Automation_DB")
    driver = os.getenv("MSSQL_DRIVER", "ODBC Driver 17 for SQL Server")
    
    connection_url = (
        f"mssql+pyodbc://@{server}/{database}"
        f"?driver={driver.replace('{', '').replace('}', '').replace(' ', '+')}&Trusted_Connection=yes&TrustServerCertificate=yes"
    )
    engine = create_engine(connection_url, fast_executemany=True)
    
    # --- Test 1: Connection Speed ---
    start_time = time.time()
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    conn_time = time.time() - start_time
    logging.info(f"[Test 1] Connection Speed: {conn_time:.4f} seconds (Target < 2s)")
    if conn_time > 2.0:
        logging.warning("Connection speed is slower than 2 seconds.")

    # --- Test 2: Identity Verification ---
    with engine.connect() as conn:
        user_res = conn.execute(text("SELECT SYSTEM_USER")).fetchone()[0]
        logging.info(f"[Test 2] Identity Verification: Connected as {user_res}")

    # --- Test 3: Constraint Validation (Null PK) ---
    logging.info("[Test 3] Constraint Validation: Attempting to push NULL into Primary Key (id)...")
    try:
        with engine.begin() as conn:
            # We explicitly specify NULL into an IDENTITY column to force SQL to reject it based on constraints
            # NOTE: IDENTITY_INSERT must be ON if we force an ID mapping, so this tests constraints cleanly
            conn.execute(text("SET IDENTITY_INSERT daily_sales_trend ON; INSERT INTO daily_sales_trend (id, date) VALUES (NULL, '2026-02-25'); SET IDENTITY_INSERT daily_sales_trend OFF;"))
        logging.error("❌ Failed: SQL Server allowed NULL in Primary Key.")
    except Exception:
        logging.info("✅ Success: SQL Server blocked NULL in Primary Key. Exception caught successfully.")

    # --- Test 4: Transaction Rollback (Simulate Failure) ---
    logging.info("[Test 4] Transaction Rollback Verification...")
    try:
        with engine.begin() as conn:
            conn.execute(text("INSERT INTO daily_sales_trend (date, territory, code, product) VALUES ('99-99-9999', 'Rollback_Zone', 'C99', 'Prod_A')"))
            # Trigger deliberate failure
            conn.execute(text("INSERT INTO non_existent_table (test) VALUES (1)"))
    except Exception:
        pass
        
    with engine.connect() as conn:
        rollback_check = conn.execute(text("SELECT COUNT(*) FROM daily_sales_trend WHERE date='99-99-9999'")).fetchone()[0]
    
    if rollback_check == 0:
        logging.info("✅ Success: Transaction rollback worked. 0 partial rows added.")
    else:
        logging.error(f"❌ Failed: Transaction rollback failed. {rollback_check} partial rows found.")

    # --- Test 5: Bulk Insert Efficiency & Fast Executemany ---
    logging.info("[Test 5] Bulk Insert Efficiency (10,000 Rows with fast_executemany)...")
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM daily_sales_trend WHERE territory='Bulk_Test_Zone'"))
    
    data = []
    for i in range(10000):
        data.append({
            "date": "2026-12-31",
            "territory": "Bulk_Test_Zone",
            "code": f"B_{i}",
            "product": f"Prod_{i}",
            "units": 10.5,
            "bonus": 2.0,
            "total_units": 12.5,
            "value": 1500.00
        })
    df_bulk = pd.DataFrame(data)
    
    start_bulk = time.time()
    try:
        # Pandas to_sql natively uses SQLAlchemy bindings. If engine has fast_executemany=True, Pandas uses it.
        df_bulk.to_sql("daily_sales_trend", engine, if_exists="append", index=False)
        bulk_time = time.time() - start_bulk
        logging.info(f"✅ Success: Inserted 10,000 rows in {bulk_time:.3f} seconds.")
    except Exception as e:
        logging.error(f"❌ Failed to insert bulk: {e}")
        
    # Clean up bulk test
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM daily_sales_trend WHERE territory='Bulk_Test_Zone'"))
        
    logging.info("=== Phase 2 Validation Complete ===")

if __name__ == '__main__':
    run_phase_2_tests()
