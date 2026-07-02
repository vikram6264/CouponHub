import mysql.connector
from dotenv import load_dotenv
import os

load_dotenv()

def init_db():
    print("Connecting to database server...")
    conn = mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", 3306)),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", "")
    )
    cursor = conn.cursor()
    
    print("Reading schema.sql...")
    with open("schema.sql", "r") as f:
        sql_script = f.read()
        
    print("Executing schema queries...")
    for statement in sql_script.split(';'):
        if statement.strip():
            cursor.execute(statement)
            
    conn.commit()
    cursor.close()
    conn.close()
    print("Database initialized successfully.")

if __name__ == "__main__":
    init_db()
