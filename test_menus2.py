import asyncio
import os
import sys

sys.path.append(os.path.join(os.getcwd(), 'src'))
from infra.infrastructure.database.database import get_db_connection

async def main():
    conn = await get_db_connection()
    try:
        tenant_id = 1
        rows = await conn.fetch("SELECT name, path, permission_code, application_uuid FROM core_menus WHERE tenant_id = $1 ORDER BY sort_order", tenant_id)
        
        # also fetch active apps
        apps = await conn.fetch("SELECT uuid, code FROM core_applications WHERE is_active = true")
        active_apps = {str(a["uuid"]): a["code"] for a in apps}
        
        for r in rows:
            app_id = str(r["application_uuid"]) if r["application_uuid"] else "system"
            if app_id != "system" and app_id not in active_apps:
                continue
                
            app_name = active_apps.get(app_id, "system")
            if app_name in ("kuaizhizao", "kuaireport", "kuaiai"):
                print(f"[{app_name}] {r['name']} | {r['path']} | Permission: {r['permission_code']}")
                
    finally:
        await conn.close()

asyncio.run(main())
