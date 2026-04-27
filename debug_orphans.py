import asyncio
import os
import sys

sys.path.append(os.path.join(os.getcwd(), 'src'))
from infra.infrastructure.database.database import get_db_connection

async def main():
    conn = await get_db_connection()
    try:
        tenant_id = 1
        
        # Get installed apps
        rows = await conn.fetch("SELECT application_uuid FROM core_tenant_applications WHERE tenant_id = $1 AND is_active = true", tenant_id)
        active_apps = {str(r["application_uuid"]) for r in rows}
        
        # Get all menus that are visible
        menus = await conn.fetch("SELECT permission_code, application_uuid FROM core_menus WHERE tenant_id = $1 AND is_active = true", tenant_id)
        valid_menus = [m for m in menus if not m["application_uuid"] or str(m["application_uuid"]) in active_apps]
        
        menu_codes = {str(m["permission_code"]).strip() for m in valid_menus if m["permission_code"]}
        
        # Get permissions
        perms = await conn.fetch("SELECT code FROM core_permissions WHERE tenant_id = $1", tenant_id)
        all_perms = {str(p["code"]) for p in perms}
        
        print(f"Active App UUIDs: {len(active_apps)}")
        print(f"Valid Menus: {len(valid_menus)}")
        print(f"Total Permissions: {len(all_perms)}")
        
        def match_menu(p_code, menu_code):
            if p_code == menu_code: return True
            parts = menu_code.split(":")
            if len(parts) >= 3:
                app = parts[0]
                res = ":".join(parts[1:-1])
                prefix = f"{app}:{res}:"
                if p_code.startswith(prefix): return True
            elif len(parts) == 2:
                app = parts[0]
                prefix = f"{app}:{parts[1]}:"
                if p_code.startswith(prefix): return True
            return False

        orphans = []
        for p in all_perms:
            matched = False
            for m in menu_codes:
                if match_menu(p, m):
                    matched = True
                    break
            if not matched:
                orphans.append(p)
                
        orphans.sort()
        print(f"\nOrphans ({len(orphans)}):")
        for o in orphans:
            print(f"- {o}")
            
    finally:
        await conn.close()

asyncio.run(main())
