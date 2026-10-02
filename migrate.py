"""One-off migration for existing databases.

Fresh installs get the full schema from schema.sql; this widens
coupons.discount_type on databases created before bogo/free_shipping existed.

Usage: python migrate.py
"""
import mysql.connector
from dotenv import load_dotenv
import os

load_dotenv()

MIGRATIONS = [
    (
        "Add bogo/free_shipping discount types",
        "ALTER TABLE coupons MODIFY discount_type "
        "ENUM('percent','flat','bogo','free_shipping') DEFAULT 'percent'",
    ),
]


def migrate():
    conn = mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", 3306)),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "couponshare"),
    )
    cur = conn.cursor()
    for label, sql in MIGRATIONS:
        try:
            cur.execute(sql)
            conn.commit()
            print(f"OK  - {label}")
        except mysql.connector.Error as e:
            if e.errno == 1060:  # duplicate column
                print(f"SKIP - {label} (already applied)")
            else:
                raise
    cur.close()
    conn.close()


if __name__ == "__main__":
    migrate()
