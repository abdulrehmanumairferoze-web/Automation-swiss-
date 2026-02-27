import sys
import logging
from db_connector import get_db_connection

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

def test():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT @@VERSION")
        row = cursor.fetchone()
        logging.info("SQL Server Version:")
        logging.info(row[0])
        conn.close()
        logging.info("Connection test completed successfully.")
    except Exception as e:
        logging.error(f"Connection test failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    test()
