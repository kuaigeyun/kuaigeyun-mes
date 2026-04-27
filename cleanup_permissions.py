import asyncio
import json
import logging
from pathlib import Path
import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'src'))

from core.database import async_session_maker
from core.models.role import Permission, RolePermission
from sqlalchemy import select, delete

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def main():
    # 1. Load all valid permissions from ALL manifest files
    apps_dir = Path("f:/dev/riveredge/riveredge-backend/src/apps")
    valid_codes = set()
    
    # Manually ensure core permission codes are included
    core_codes = {
        "system.user:create", "system.user:read", "system.user:update", "system.user:delete",
        "system.role:create", "system.role:read", "system.role:update", "system.role:delete", "system.role:assign",
        "system.permission:read",
        "system.menu:create", "system.menu:read", "system.menu:update", "system.menu:delete",
        "system.policy:create", "system.policy:read", "system.policy:update", "system.policy:delete",
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
    async with async_session_maker() as session:
        # get all db permissions
        result = await session.execute(select(Permission))
        db_perms = result.scalars().all()
        
        orphans = [p for p in db_perms if p.code not in valid_codes]
        
        if not orphans:
            logger.info("No DB orphans found.")
            return

        logger.info(f"Found {len(orphans)} DB orphan permissions to delete.")
        
        orphan_uuids = [p.uuid for p in orphans]
        
        # We must first delete any role-permission bindings to avoid foreign key or integrity issues
        await session.execute(
            delete(RolePermission).where(RolePermission.permission_uuid.in_(orphan_uuids))
        )
        
        # Then delete the permissions
        await session.execute(
            delete(Permission).where(Permission.uuid.in_(orphan_uuids))
        )
        
        await session.commit()
        logger.info(f"Deleted {len(orphans)} zombie permissions successfully.")

asyncio.run(main())
