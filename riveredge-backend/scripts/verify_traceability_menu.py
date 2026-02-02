import sys
import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv
import asyncpg

# Add project root to sys.path
project_root = Path(__file__).resolve().parent.parent / "src"
sys.path.append(str(project_root))

# Load .env
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

async def main():
    db_user = os.getenv("DB_USER", "postgres")
    db_password = os.getenv("DB_PASSWORD", "postgres")
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "5432")
    db_name = os.getenv("DB_NAME", "riveredge")
    
    db_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

    print(f"Connecting to database...")
    try:
        conn = await asyncpg.connect(db_url)
        
        # Check for Traceability Management menu
        query = """
            SELECT name, path, permission_code, is_active 
            FROM core_menus 
            WHERE path = '/apps/kuaizhizao/quality-management/traceability'
            AND deleted_at IS NULL
        """
        row = await conn.fetchrow(query)
        
        if row:
            print("✅ Traceability Management menu found!")
            print(f"Name: {row['name']}")
            print(f"Path: {row['path']}")
            print(f"Permission: {row['permission_code']}")
            print(f"Active: {row['is_active']}")
        else:
            print("❌ Traceability Management menu NOT found in database.")
            
            # Check if parent exists
            # manifest.json uses "title": "质量管理"
            parent_query = """
                SELECT id, name, path FROM core_menus 
                WHERE (name = '质量管理' OR name = 'Quality Management')
                AND deleted_at IS NULL
            """
            parent = await conn.fetchrow(parent_query)
            if parent:
                print(f"Parent menu '质量管理' found with ID: {parent['id']}")
            else:
                 print("Parent menu '质量管理' NOT found.")

        # Check permission
        perm_code = 'kuaizhizao:traceability:view'
        perm_query = "SELECT id, name FROM core_permissions WHERE code = $1"
        perm = await conn.fetchrow(perm_query, perm_code)
        if perm:
            print(f"✅ Permission '{perm_code}' found in database. ID: {perm['id']}")
            
            # Check if admin role has this permission
            # Assuming admin role ID is 1 or name is 'Super Admin' or 'Admin'
            # Adjust table names as per actual schema. likely core_roles and core_role_permissions
            
            role_perm_query = """
                SELECT r.name 
                FROM core_roles r
                JOIN core_role_permissions rp ON r.id = rp.role_id
                WHERE rp.permission_id = $1
            """
            roles = await conn.fetch(role_perm_query, perm['id'])
            if roles:
                print(f"Permission assigned to roles: {[r['name'] for r in roles]}")
            else:
                print("⚠️ Permission exists but is NOT assigned to any role (including Admin).")
        else:
            print(f"❌ Permission '{perm_code}' NOT found in database.")

        await conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
