import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from auth import hash_password
from database import connection_pool

conn = connection_pool.get_connection()
cur = conn.cursor()

# Admin Account
admin_email = "admin@couponshare.com"
admin_password = "admin123"
admin_hashed = hash_password(admin_password)

# Regular User Account
user_email = "user@couponshare.com"
user_password = "user123"
user_hashed = hash_password(user_password)

accounts = [
    ("Admin Vikram", admin_email, admin_hashed, 1),
    ("User Vikram", user_email, user_hashed, 0)
]

for name, email, hashed, is_admin in accounts:
    try:
        cur.execute("INSERT INTO users (name, email, password_hash, is_admin) VALUES (%s, %s, %s, %s)",
                    (name, email, hashed, is_admin))
        conn.commit()
        print(f"Created: {email}")
    except Exception as e:
        cur.execute("UPDATE users SET password_hash = %s, is_admin = %s WHERE email = %s",
                    (hashed, is_admin, email))
        conn.commit()
        print(f"Updated: {email}")

cur.close()
conn.close()
