import asyncio
import os
import sys

sys.path.append(os.path.join(os.getcwd(), 'src'))
from infra.infrastructure.database.database import get_db_connection

async def main():
    conn = await get_db_connection()
    try:
        tenant_id = 1
        
        # 1. Fetch apps
        apps = await conn.fetch("SELECT uuid, code FROM core_applications WHERE is_installed = true AND deleted_at IS NULL")
        app_map = {str(a["uuid"]): a["code"] for a in apps}
        print(f"Installed Apps: {[a['code'] for a in apps]}")
        
        if "kuaiai" not in [a["code"] for a in apps]:
            print("ERROR: kuaiai is not installed!")
        
        # 2. Fetch menus
        menus = await conn.fetch("SELECT id, name, permission_code, path, application_uuid, parent_id FROM core_menus WHERE tenant_id = $1 AND deleted_at IS NULL", tenant_id)
        kuaiai_menus = [m for m in menus if m["application_uuid"] and app_map.get(str(m["application_uuid"])) == "kuaiai"]
        print(f"\nKUAIAIMenus: {len(kuaiai_menus)}")
        for m in kuaiai_menus:
            print(f" - {m['name']} (ID: {m['id']}, Parent: {m['parent_id']}): path={m['path']}, perm={m['permission_code']}")
            
        kuaireport_menus = [m for m in menus if m["application_uuid"] and app_map.get(str(m["application_uuid"])) == "kuaireport"]
        print(f"\nKUAIREPORT Menus: {len(kuaireport_menus)}")
        for m in kuaireport_menus:
            print(f" - {m['name']} (ID: {m['id']}, Parent: {m['parent_id']}): path={m['path']}, perm={m['permission_code']}")
            
        # 3. Fetch permissions
        perms = await conn.fetch("SELECT code FROM core_permissions WHERE tenant_id = $1 AND code LIKE 'kuaiai:%'", tenant_id)
        print(f"\nKUAIAI Permissions: {[p['code'] for p in perms]}")
        
    finally:
        await conn.close()

asyncio.run(main())
