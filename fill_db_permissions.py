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

def extract_permissions_map(manifest_path):
    mapping = {}
    with open(manifest_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    def walk(node):
        path = node.get("path")
        perm = node.get("permission")
        if path and perm:
            mapping[path] = perm
            
        for child in node.get("children", []):
            walk(child)
            
    if "menu_config" in data:
        walk(data["menu_config"])
        
    return mapping

async def main():
    base_dir = Path("f:/dev/riveredge/riveredge-backend/src/apps")
    
    mapping = {}
    for f in base_dir.glob("**/manifest.json"):
        mapping.update(extract_permissions_map(f))
        
    conn = await get_db_connection()
    try:
        updated = 0
        for path, perm in mapping.items():
            res = await conn.execute("UPDATE core_menus SET permission_code = $1 WHERE path = $2", perm, path)
            parts = res.split()
            if len(parts) > 1:
                updated += int(parts[1])
                
        logger.info(f"Filled {updated} permission_code fields in core_menus.")
        
        # Then clear cache from DB side or prompt the user directly.
        await conn.execute("DELETE FROM core_permissions WHERE code IS NULL")
        
    finally:
        await conn.close()

asyncio.run(main())
