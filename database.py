import mysql.connector
from mysql.connector import pooling
from dotenv import load_dotenv
import os

load_dotenv()

db_config = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", 3306)),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "couponshare"),
}

connection_pool = pooling.MySQLConnectionPool(
    pool_name="couponshare_pool",
    pool_size=10,
    **db_config
)

def get_db():
    """FastAPI dependency: yields a pooled connection, always closes it."""
    conn = connection_pool.get_connection()
    try:
        yield conn
    finally:
        conn.close()

def get_cursor(conn):
    return conn.cursor(dictionary=True)
