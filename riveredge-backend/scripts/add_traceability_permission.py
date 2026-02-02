import sys
import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv
import asyncpg
import uuid
from datetime import datetime

# Load .env
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

async def main():
    db_user = os.getenv("DB_USER", "postgres")
    db_password = os.getenv("DB_PASSWORD", "postgres")
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "5432")
    db_name = os.getenv("DB_NAME", "riveredge")
    
    db_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

    try:
        conn = await asyncpg.connect(db_url)
        
        tenant_id = 1 # Default tenant
        perm_code = 'kuaizhizao:traceability:view'
        
        # Check if permission exists
        perm = await conn.fetchrow("SELECT id FROM core_permissions WHERE code = $1 AND tenant_id = $2", perm_code, tenant_id)
        
        perm_id = None
        if not perm:
            print(f"Creating permission: {perm_code}")
            perm_uuid = str(uuid.uuid4())
            now = datetime.utcnow()
            
            insert_query = """
                INSERT INTO core_permissions (
                    tenant_id, uuid, name, code, resource, action, description, permission_type, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING id
            """
            
            perm_id = await conn.fetchval(
                insert_query,
                tenant_id,
                perm_uuid,
                '追溯管理查看',
                perm_code,
                'traceability',
                'view',
                'Allow viewing Traceability Management',
                'menu', # Assuming 'menu' type or 'backend'
                now,
                now
            )
            print(f"Permission created with ID: {perm_id}")
        else:
            perm_id = perm['id']
            print(f"Permission already exists with ID: {perm_id}")
            
        # Assign to Roles
        role_codes = ['SYSTEM_ADMIN', 'TENANT_ADMIN', 'QUALITY_MGR']
        
        for code in role_codes:
            role = await conn.fetchrow("SELECT id FROM core_roles WHERE code = $1 AND tenant_id = $2", code, tenant_id)
            if role:
                role_id = role['id']
                # Check mapping
                mapping_count = await conn.fetchval(
                    "SELECT COUNT(*) FROM core_role_permissions WHERE role_id = $1 AND permission_id = $2",
                    role_id, perm_id
                )
                
                if mapping_count == 0:
                    await conn.execute(
                        "INSERT INTO core_role_permissions (permission_id, role_id) VALUES ($1, $2)",
                        perm_id, role_id
                    )
                    print(f"Assigned permission to role: {code} (ID: {role_id})")
                else:
                    print(f"Permission already assigned to role: {code}")
            else:
                print(f"Role {code} not found.")

        await conn.close()
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
