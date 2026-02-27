import pyodbc
import logging
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env.automation'))

logger = logging.getLogger(__name__)

# Database Connector Configuration
# Target System: Microsoft SQL Server (Local Instance)
# Protocol Settings: Network Library: dbmssocn (TCP/IP), Static Instance Resolution, Port: 1433

DB_SERVER = os.environ.get("MSSQL_SERVER", "DESKTOP-M5RI2I7\\MSSQLSERVER01")
DB_NAME = os.environ.get("MSSQL_DATABASE", "Local_Automation_DB")
DB_DRIVER = os.environ.get("MSSQL_DRIVER", "{ODBC Driver 17 for SQL Server}")
DB_TRUSTED = os.environ.get("MSSQL_TRUSTED_CONNECTION", "yes")
DB_ENCRYPT = os.environ.get("MSSQL_ENCRYPT", "no")
DB_TRUST_CERT = os.environ.get("MSSQL_TRUST_CERTIFICATE", "yes")
DB_NETWORK_LIB = os.environ.get("MSSQL_NETWORK_LIBRARY", "dbmssocn")

CONNECTION_STRING = (
    f"Driver={DB_DRIVER};"
    f"Server={DB_SERVER};"
    f"Database={DB_NAME};"
    f"Trusted_Connection={DB_TRUSTED};"
    f"Encrypt={DB_ENCRYPT};"
    f"TrustServerCertificate={DB_TRUST_CERT};"
)



def get_db_connection():
    """
    Establish connection to Microsoft SQL Server with Windows Integrated Security.
    Identity: Inherits service-level credentials from the host machine DESKTOP-M5RI2I7.
    User/Password: Null (Omitted to force Trusted Connection).
    """
    try:
        logger.info(f"Attempting to connect to MS SQL database: {DB_NAME} on {DB_SERVER}...")
        conn = pyodbc.connect(CONNECTION_STRING)
        logger.info("✅ SUCCESS: Connected to Local_Automation_DB using Windows Authentication.")
        return conn
    except pyodbc.Error as err:
        logger.error(f"❌ FAILURE: Database connection error. {err}")
        raise
