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

async def main():
    # 1. Load all valid permissions from ALL manifest files
    apps_dir = Path("f:/dev/riveredge/riveredge-backend/src/apps")
    valid_codes = set()
    
    core_codes = {
        "system.user:create", "system.user:read", "system.user:update", "system.user:delete",
        "system.role:create", "system.role:read", "system.role:update", "system.role:delete", "system.role:assign",
        "system.permission:read",
        "system.menu:create", "system.menu:read", "system.menu:update", "system.menu:delete",
        "system.policy:create", "system.policy:read", "system.policy:update", "system.policy:delete",
        "system.tenant:read", "system.tenant:create", "system.tenant:update", "system.tenant:delete",
        "system.app_config:read", "system.app_config:update", "system.operation_log:read", 
        "system.dictionary:read", "system.dictionary:create", "system.dictionary:update", "system.dictionary:delete",
        "system.code_rule:read", "system.code_rule:create", "system.code_rule:update", "system.code_rule:delete",
    }
    valid_codes.update(core_codes)
    
    for manifest_file in apps_dir.glob("*/manifest.json"):
        with open(manifest_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Add explicit permissions
            for code in data.get("permissions", []):
                valid_codes.add(code)
            # Also get data scope versions since they are generated dynamically
            generated_codes = set()
            for code in valid_codes:
                if ":" in code:
                    left, action = code.rsplit(":", 1)
                    if action.lower() in ("read", "view", "list", "query"):
                        generated_codes.add(f"{left}:data:all")
                        generated_codes.add(f"{left}:data:department")
                        generated_codes.add(f"{left}:data:self")
            valid_codes.update(generated_codes)

    # 2. Cleanup Database
    conn = await get_db_connection()
    try:
        # get all db permissions
        rows = await conn.fetch("SELECT id, code FROM core_permissions")
        
        orphan_ids = [str(row["id"]) for row in rows if str(row["code"]) not in valid_codes]
        
        if not orphan_ids:
            logger.info("No DB orphans found.")
            return

        logger.info(f"Found {len(orphan_ids)} DB orphan permissions to delete.")
        
        chunck_size = 500
        for i in range(0, len(orphan_ids), chunck_size):
            chunk = orphan_ids[i:i+chunck_size]
            ids_str = ",".join(chunk)
            await conn.execute(f"DELETE FROM core_role_permissions WHERE permission_id IN ({ids_str})")
            await conn.execute(f"DELETE FROM core_permissions WHERE id IN ({ids_str})")
        
        logger.info(f"Deleted {len(orphan_ids)} zombie permissions successfully.")
    finally:
        await conn.close()

asyncio.run(main())
