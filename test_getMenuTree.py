import asyncio
import os
import sys

sys.path.append(os.path.join(os.getcwd(), 'src'))
from infra.infrastructure.database.database import get_db_connection
from core.services.system.menu_service import MenuService

async def main():
    conn = await get_db_connection()
    try:
        tenant_id = 1
        # Fetch the visible apps logic
        from core.services.application.application_service import ApplicationService
        visible_apps = await ApplicationService.get_installed_applications(tenant_id=tenant_id)
        visible_app_uuids = {str(a["uuid"]) for a in visible_apps}
        print(f"Visible App UUIDs: {len(visible_app_uuids)}")
        
        all_menus = await conn.fetch("SELECT id, name, application_uuid FROM core_menus WHERE tenant_id = $1", tenant_id)
        filtered = [m for m in all_menus if not m["application_uuid"] or str(m["application_uuid"]) in visible_app_uuids]
        print(f"Total menus: {len(all_menus)}, Filtered menus: {len(filtered)}")
        
        apps = await conn.fetch("SELECT uuid, code FROM core_applications")
        app_map = {str(a["uuid"]): a["code"] for a in apps}
        
        filtered_apps = {app_map.get(str(m["application_uuid"])) for m in filtered if m["application_uuid"]}
        print(f"Apps remaining after filter: {filtered_apps}")
        
    finally:
        await conn.close()

asyncio.run(main())
