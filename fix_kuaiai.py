import asyncio
import json
import logging
from pathlib import Path
import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'src'))

from infra.infrastructure.database.database import get_db_connection

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def update_manifest(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    if data["menu_config"].get("permission") == "kuaiai:view":
        data["menu_config"]["permission"] = "kuaiai:workspace:view"
        
    perms = data.get("permissions", [])
    if "kuaiai:view" in perms:
        perms.remove("kuaiai:view")
        if "kuaiai:workspace:view" not in perms:
            perms.append("kuaiai:workspace:view")
    data["permissions"] = perms
    
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

async def main():
    # Update files
    logger.info("Updating manifests...")
    update_manifest("f:/dev/riveredge/riveredge-frontend/src/apps/kuaiai/manifest.json")
    update_manifest("f:/dev/riveredge/riveredge-backend/src/apps/kuaiai/manifest.json")
    
    # Update Database
    conn = await get_db_connection()
    try:
        # Patch core_menus that might have kuaiai:view
        res = await conn.execute("UPDATE core_menus SET permission_code = 'kuaiai:workspace:view' WHERE permission_code = 'kuaiai:view'")
        logger.info(f"Updated core_menus: {res}")
        
        # We need to delete old orphaned core_permissions for kuaiai:data:* and kuaiai:view
        rows = await conn.fetch("SELECT id FROM core_permissions WHERE code LIKE 'kuaiai:%' AND code != 'kuaiai:workspace:view'")
        ids = [str(r["id"]) for r in rows]
        if ids:
            ids_str = ",".join(ids)
            await conn.execute(f"DELETE FROM core_role_permissions WHERE permission_id IN ({ids_str})")
            await conn.execute(f"DELETE FROM core_permissions WHERE id IN ({ids_str})")
            logger.info(f"Deleted {len(ids)} old kuaiai permissions.")
            
    finally:
        await conn.close()

asyncio.run(main())
