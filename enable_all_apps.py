import asyncio
import os
import sys

sys.path.append(os.path.join(os.getcwd(), 'src'))
from infra.infrastructure.database.database import get_db_connection

async def main():
    conn = await get_db_connection()
    try:
        tenant_id = 1
        
        # Enable everything except placeholders maybe? No, enable everything!
        await conn.execute("UPDATE core_applications SET is_installed = true, is_active = true WHERE tenant_id = $1", tenant_id)
        
        # Verify
        apps = await conn.fetch("SELECT code, is_installed, is_active FROM core_applications WHERE tenant_id = $1", tenant_id)
        for a in apps:
            print(f"{a['code']}: installed={a['is_installed']} active={a['is_active']}")
            
    finally:
        await conn.close()

asyncio.run(main())
