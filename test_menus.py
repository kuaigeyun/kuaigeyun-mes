import asyncio
import os
import sys

sys.path.append(os.path.join(os.getcwd(), 'src'))
from core.database import init_db
from core.services.system.menu_service import MenuService

async def main():
    await init_db()
    
    tenant_id = 1
    trees = await MenuService.get_menu_tree(tenant_id=tenant_id, use_cache=False)
    
    def print_tree(nodes, depth=0):
        for n in nodes:
            print("  " * depth + f"- {n.name} [{n.permission_code}]")
            print_tree(n.children, depth + 1)
            
    print_tree(trees)

asyncio.run(main())
