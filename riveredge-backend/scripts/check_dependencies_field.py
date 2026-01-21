"""
检查数据库中是否存在 dependencies 字段

Author: Luigi Lu
Date: 2025-12-27
"""

import asyncio
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "src"))

from infra.infrastructure.database.database import get_db_connection


async def check_field():
    """检查字段是否存在"""
    conn = await get_db_connection()
    try:
        result = await conn.fetchval(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'core_applications' AND column_name = 'dependencies'"
        )
        if result:
            print("✅ 字段 dependencies 已存在")
        else:
            print("❌ 字段 dependencies 不存在，需要创建迁移")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(check_field())





































