import asyncio
import json
import logging
from pathlib import Path
import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'src'))

from core.database import async_session_maker
from core.models.application import Application
from core.services.system.menu_service import MenuService
from core.services.authorization.permission_sync_service import PermissionSyncService
from infra.infrastructure.database.database import get_db_connection

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def main():
    tenant_id = 1  # assuming default tenant id is 1
    
    apps_dir = Path("f:/dev/riveredge/riveredge-backend/src/apps")
    kuaizhizao_manifest = apps_dir / "kuaizhizao" / "manifest.json"
    
    with open(kuaizhizao_manifest, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    async with async_session_maker() as session:
        result = await session.execute(Application.filter(code="kuaizhizao").limit(1).sql())
        # The tortoise models are weird via SQLAlchemy, I'll use asyncpg
    
    conn = await get_db_connection()
    try:
        app = await conn.fetchrow("SELECT uuid FROM core_applications WHERE code = 'kuaizhizao' LIMIT 1")
        if not app:
            logger.error("App kuaizhizao not found")
            return
            
        app_uuid = str(app["uuid"])
        logger.info(f"Syncing menus for kuaizhizao (uuid={app_uuid})...")
        
        # 1. Sync menus from manifest
        count = await MenuService.sync_menus_from_application_config(
            tenant_id=tenant_id,
            application_uuid=app_uuid,
            menu_config=data.get("menu_config", {}),
            is_active=True
        )
        logger.info(f"Menus synced. Processed logic.")
        
        # 2. Resync permissions
        res = await PermissionSyncService.ensure_permissions(tenant_id=tenant_id, force=True)
        logger.info(f"Permissions re-synced: {res}")
        
    finally:
        await conn.close()

asyncio.run(main())
