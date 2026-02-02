import sys
import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv
import asyncpg

# Load .env
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

async def main():
    db_user = os.getenv("DB_USER", "postgres")
    db_password = os.getenv("DB_PASSWORD", "postgres")
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "5432")
    db_name = os.getenv("DB_NAME", "riveredge")
    
    db_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

    try:
        conn = await asyncpg.connect(db_url)
        cols = await conn.fetch("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'core_permissions'")
        print("core_permissions columns:")
        for c in cols:
            print(f"{c['column_name']} ({c['data_type']})")
            
        print("-" * 20)
        roles = await conn.fetch("SELECT id, name, code FROM core_roles WHERE tenant_id = 1")
        print("Roles:")
        for r in roles:
            print(f"ID: {r['id']}, Name: {r['name']}, Code: {r.get('code', 'N/A')}")
            
        await conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
