"""
重置迁移脚本

删除aerich表并重新初始化迁移，确保所有kuaizhizao模型都被正确识别。
"""

import asyncio
import asyncpg
import os
from dotenv import load_dotenv
import subprocess
import sys

load_dotenv()

async def reset_migrations():
    """重置迁移系统"""
    conn = await asyncpg.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=int(os.getenv('DB_PORT', 5432)),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        database=os.getenv('DB_NAME')
    )

    try:
        # 检查并删除aerich表
        table_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'aerich'
            )
        """)

        if table_exists:
            print("🔧 删除现有的aerich表...")
            await conn.execute("DROP TABLE IF EXISTS aerich CASCADE")
            print("✅ 已删除aerich表")
        else:
            print("ℹ️ aerich表不存在，跳过删除步骤")

        # 提交事务
        await conn.execute("COMMIT")

    finally:
        await conn.close()

    print("🔧 重新初始化Aerich...")

    # 重新运行aerich init-db
    result = subprocess.run([
        sys.executable, "-m", "uv", "run", "aerich", "init-db"
    ], cwd=os.path.dirname(__file__), capture_output=True, text=True)

    if result.returncode == 0:
        print("✅ Aerich重新初始化成功")
        print("📋 输出:", result.stdout)
    else:
        print("❌ Aerich重新初始化失败")
        print("📋 错误输出:", result.stderr)
        return False

    return True

if __name__ == '__main__':
    success = asyncio.run(reset_migrations())
    if success:
        print("\n🎉 迁移重置完成！")
    else:
        print("\n❌ 迁移重置失败！")
        sys.exit(1)














