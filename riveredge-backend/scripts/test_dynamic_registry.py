import asyncio
import os
import sys
from pathlib import Path
from tortoise import Tortoise

# Add project root to path
current_dir = Path(__file__).resolve().parent
backend_dir = current_dir.parent / "src"
sys.path.append(str(backend_dir))

from core.services.application.application_registry_service import ApplicationRegistryService
from core.services.application.application_catalog_service import ApplicationCatalogService
from infra.infrastructure.database.database import get_db_connection

async def test_catalog():
    print("\nTesting ApplicationCatalogService...")
    apps = ApplicationCatalogService.get_available_apps()
    print(f"Found {len(apps)} available apps in catalog:")
    for app in apps:
        print(f"  - {app.get('name')} ({app.get('code')})")
        
    master_data = ApplicationCatalogService.get_app_manifest("master-data")
    if master_data:
        print(f"✅ Found master-data manifest")
    else:
        print(f"❌ Failed to find master-data manifest")

async def init_db():
    # Initialize Tortoise for the test
    # We need to load the config. using a simplified config for test if possible
    # or just use the real one if env vars are set.
    # Assuming local dev env
    
    # We can't easily init full Tortoise without proper config, 
    # but ApplicationRegistryService uses 'default' connection.
    
    # Let's mock the DB connection or use the real one if available.
    # For this script, let's try to use the real DB but we need the config.
    pass

async def test_registry():
    print("Testing ApplicationRegistryService...")
    
    # Mocking the _discover_installed_apps to simulate duplicate apps across tenants
    original_discover = ApplicationRegistryService._discover_installed_apps
    
    async def mock_discover():
        print("Mock discover called")
        return [
            {
                "code": "master_data",
                "name": "Master Data",
                "route_path": "/apps/master-data",
                "is_active": True
            },
            {
                "code": "master_data", # Duplicate!
                "name": "Master Data (Tenant 2)",
                "route_path": "/apps/master-data",
                "is_active": True
            },
             {
                "code": "kuaizhizao", 
                "name": "Kuai Zhi Zao",
                "route_path": "/apps/kuaizhizao",
                "is_active": True
            }
        ]
    
    ApplicationRegistryService._discover_installed_apps = mock_discover
    
    # We also need to mock _register_app_models and _register_app_routes 
    # to avoid actual import errors if files don't exist, 
    # OR we just let it try and see if it handles duplicates in the *process*.
    
    # The logic in _register_app_routes iterates and registers.
    # If duplicates exist in the list returned by _discover, it will try to register twice.
    
    try:
        await ApplicationRegistryService.initialize()
        
        routes = ApplicationRegistryService.get_registered_routes()
        print(f"Registered routes keys: {list(routes.keys())}")
        
        # Check if master_data is registered once or if it caused issues
        # The current implementation of _register_app_routes loops over the list.
        # It calls route_manager.register_app_routes.
        # route_manager.register_app_routes checks conflicts.
        
    except Exception as e:
        print(f"Test failed with error: {e}")
    finally:
        ApplicationRegistryService._discover_installed_apps = original_discover

if __name__ == "__main__":
    asyncio.run(test_catalog())
    asyncio.run(test_registry())
