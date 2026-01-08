"""
手动应用登录页字段更新迁移脚本

将 login_description 拆分为 login_title 和 login_content。

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

async def apply_login_fields_update_migration():
    """应用登录页字段更新迁移"""
    db_host = os.getenv('DB_HOST', 'localhost')
    db_port = int(os.getenv('DB_PORT', 5432))
    db_user = os.getenv('DB_USER', 'postgres')
    db_password = os.getenv('DB_PASSWORD', '')
    db_name = os.getenv('DB_NAME', 'riveredge')
    
    if not db_password:
        print("❌ 错误: DB_PASSWORD 未设置，请检查 .env 文件")
        return
    
    print(f"🔗 连接到数据库: {db_host}:{db_port}/{db_name}")
    
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
        # 检查 login_description 字段是否存在
        login_desc_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'infra_platform_settings' 
                AND column_name = 'login_description'
            )
        """)
        
        # 检查新字段是否已存在
        login_title_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'infra_platform_settings' 
                AND column_name = 'login_title'
            )
        """)
        
        login_content_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'infra_platform_settings' 
                AND column_name = 'login_content'
            )
        """)
        
        if login_title_exists and login_content_exists and not login_desc_exists:
            print("⚠️  字段已更新，跳过迁移")
        else:
            print("📝 更新登录页配置字段...")
            
            # 添加新字段
            if not login_title_exists:
                await conn.execute("""
                    ALTER TABLE "infra_platform_settings" 
                    ADD COLUMN "login_title" VARCHAR(200);
                """)
                print("✅ 添加 login_title 字段")
            
            if not login_content_exists:
                await conn.execute("""
                    ALTER TABLE "infra_platform_settings" 
                    ADD COLUMN "login_content" TEXT;
                """)
                print("✅ 添加 login_content 字段")
            
            # 迁移旧数据（如果存在）
            if login_desc_exists:
                await conn.execute("""
                    UPDATE "infra_platform_settings" 
                    SET "login_content" = "login_description" 
                    WHERE "login_description" IS NOT NULL 
                    AND "login_content" IS NULL;
                """)
                print("✅ 迁移旧数据到 login_content")
                
                # 删除旧字段
                await conn.execute("""
                    ALTER TABLE "infra_platform_settings" 
                    DROP COLUMN "login_description";
                """)
                print("✅ 删除旧的 login_description 字段")
            
            # 添加字段注释
            await conn.execute("""
                COMMENT ON COLUMN "infra_platform_settings"."login_title" IS '登录页标题';
                COMMENT ON COLUMN "infra_platform_settings"."login_content" IS '登录页内容描述';
            """)
        
        # 记录迁移
        aerich_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'aerich'
            )
        """)
        
        if aerich_exists:
            migration_version = '19_20260106000002'
            migration_exists = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT FROM aerich 
                    WHERE version = $1 
                    AND app = 'models'
                )
            """, migration_version)
            
            if not migration_exists:
                await conn.execute("""
                    INSERT INTO aerich (version, app, content)
                    VALUES ($1, 'models', '{}')
                """, migration_version)
                print(f"✅ 已记录迁移: {migration_version}")
        
        print("\n✅ 登录页字段更新迁移应用完成！")
        
    except Exception as e:
        print(f"❌ 执行迁移时出错: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.close()
        print("🔌 数据库连接已关闭")


if __name__ == "__main__":
    asyncio.run(apply_login_fields_update_migration())

