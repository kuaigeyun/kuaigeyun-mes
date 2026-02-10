
import asyncio
import sys
from pathlib import Path

# Add src to sys.path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from infra.infrastructure.database.database import get_db_connection

async def check():
    try:
        conn = await get_db_connection()
        
        # Check if migration 65 is registered
        rows = await conn.fetch("SELECT version FROM aerich WHERE version LIKE '65_%'")
        print(f"Migration 65 in DB: {rows}")
        
        # Check if the table exists
        table_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'apps_master_data_operation_defect_types'
            )
        """)
        print(f"Table 'apps_master_data_operation_defect_types' exists: {table_exists}")
        
        # Check if core_applications table is missing some columns or if apps are inactive
        try:
            apps = await conn.fetch("SELECT code, is_installed, is_active FROM core_applications WHERE code = 'master-data'")
            print(f"Master Data App Status: {apps}")
        except Exception as app_err:
            print(f"Error checking app status: {app_err}")

        await conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check())
