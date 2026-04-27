import asyncio
import logging
import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'src'))

from core.services.system.menu_service import MenuService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def main():
    tenant_id = 1
    logger.info("Clearing menu cache...")
    await MenuService._clear_menu_cache(tenant_id)
    logger.info("Cache cleared.")

asyncio.run(main())
