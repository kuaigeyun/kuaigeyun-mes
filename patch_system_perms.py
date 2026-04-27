import os
import re
import asyncio
import logging
import sys
from pathlib import Path

sys.path.append(os.path.join(os.getcwd(), "src"))
from infra.infrastructure.database.database import get_db_connection

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def patch_files():
    root_dirs = [
        "f:/dev/riveredge/riveredge-frontend/src",
        "f:/dev/riveredge/riveredge-backend/src",
    ]
    
    # We want to replace 'system.xxx:yyy' with 'system:xxx:yyy'
    # But only inside quotes basically.
    pattern = re.compile(r"""(['"])system\.([a-z_]+):([a-z]+)\1""")
    
    count = 0
    for root_dir in root_dirs:
        for root, dirs, files in os.walk(root_dir):
            for file in files:
                if not file.endswith(('.ts', '.tsx', '.py', '.json')):
                    continue
                
                path = os.path.join(root, file)
                
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        content = f.read()
                except:
                    continue
                    
                new_content, n = pattern.subn(r"\g<1>system:\g<2>:\g<3>\g<1>", content)
                
                if n > 0:
                    with open(path, "w", encoding="utf-8") as f:
                        f.write(new_content)
                    logger.info(f"Patched {n} occurrences in {path}")
                    count += 1
                    
    logger.info(f"Patched a total of {count} files.")

async def patch_database():
    conn = await get_db_connection()
    try:
        # Patch core_permissions strings
        rows = await conn.fetch("SELECT id, code FROM core_permissions WHERE code LIKE 'system.%'")
        for row in rows:
            old_code = row["code"]
            parts = old_code.split(":")
            if old_code.startswith("system.") and len(parts) == 2:
                # e.g. system.user:read -> system:user:read
                resource = old_code.split(".")[1].split(":")[0]
                action = parts[1]
                new_code = f"system:{resource}:{action}"
                await conn.execute("UPDATE core_permissions SET code = $1 WHERE id = $2", new_code, row["id"])
                
        # Now patch Data scopes if any were generated e.g. system.user:data:all
        rows_data = await conn.fetch("SELECT id, code FROM core_permissions WHERE code LIKE 'system.%:data:%'")
        for row in rows_data:
            old_code = row["code"]
            new_code = old_code.replace("system.", "system:")
            await conn.execute("UPDATE core_permissions SET code = $1 WHERE id = $2", new_code, row["id"])

        logger.info(f"Database core_permissions patched.")
    finally:
        await conn.close()

def main():
    patch_files()
    asyncio.run(patch_database())

if __name__ == "__main__":
    main()
