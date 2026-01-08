"""
手动应用平台设置迁移脚本

直接执行SQL创建 infra_platform_settings 表。

Author: Auto (AI Assistant)
Date: 2026-01-06
"""

import asyncio
import asyncpg
import os
from pathlib import Path
from dotenv import load_dotenv

# 加载环境变量
env_file = Path(__file__).parent.parent / '.env'
load_dotenv(env_file)

async def apply_platform_settings_migration():
    """应用平台设置迁移"""
    # 从环境变量读取数据库配置
    db_host = os.getenv('DB_HOST', 'localhost')
    db_port = int(os.getenv('DB_PORT', 5432))
    db_user = os.getenv('DB_USER', 'postgres')
    db_password = os.getenv('DB_PASSWORD', '')
    db_name = os.getenv('DB_NAME', 'riveredge')
    
    if not db_password:
        print("❌ 错误: DB_PASSWORD 未设置，请检查 .env 文件")
        return
    
    print(f"🔗 连接到数据库: {db_host}:{db_port}/{db_name}")
    print(f"   用户: {db_user}")
    
    # 连接数据库
    try:
        conn = await asyncpg.connect(
            host=db_host,
            port=db_port,
            user=db_user,
            password=db_password,
            database=db_name
        )
        print("✅ 数据库连接成功")
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        return
    
    try:
        # 检查表是否已存在
        table_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'infra_platform_settings'
            )
        """)
        
        if table_exists:
            print("⚠️  表 infra_platform_settings 已存在，跳过创建")
        else:
            print("📝 创建表 infra_platform_settings...")
            
            # 执行创建表的SQL
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS "infra_platform_settings" (
                    "id" SERIAL NOT NULL PRIMARY KEY,
                    "platform_name" VARCHAR(200) NOT NULL DEFAULT 'RiverEdge SaaS Framework',
                    "platform_logo" VARCHAR(500),
                    "platform_description" TEXT,
                    "platform_contact_email" VARCHAR(255),
                    "platform_contact_phone" VARCHAR(50),
                    "platform_website" VARCHAR(500),
                    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
            """)
            
            # 创建索引
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS "idx_infra_platform_settings_platform_name" 
                ON "infra_platform_settings" ("platform_name");
            """)
            
            # 添加表注释
            await conn.execute("""
                COMMENT ON TABLE "infra_platform_settings" IS '平台设置表，存储平台级配置信息（平台名称、Logo、联系方式等）';
            """)
            
            print("✅ 表 infra_platform_settings 创建成功")
        
        # 检查 aerich 表是否存在，如果存在则记录迁移
        aerich_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'aerich'
            )
        """)
        
        if aerich_exists:
            # 检查迁移是否已记录
            migration_version = '17_20260106000000'
            migration_exists = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT FROM aerich 
                    WHERE version = $1 
                    AND app = 'models'
                )
            """, migration_version)
            
            if not migration_exists:
                # 插入迁移记录
                await conn.execute("""
                    INSERT INTO aerich (version, app, content)
                    VALUES ($1, 'models', '{}')
                """, migration_version)
                print(f"✅ 已记录迁移: {migration_version}")
            else:
                print(f"ℹ️  迁移 {migration_version} 已记录")
        else:
            print("⚠️  aerich 表不存在，跳过迁移记录")
        
        print("\n✅ 平台设置迁移应用完成！")
        
    except Exception as e:
        print(f"❌ 执行迁移时出错: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.close()
        print("🔌 数据库连接已关闭")


if __name__ == "__main__":
    asyncio.run(apply_platform_settings_migration())

