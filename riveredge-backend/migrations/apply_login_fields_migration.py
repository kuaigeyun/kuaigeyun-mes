"""
手动应用登录页配置字段迁移脚本

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

async def apply_login_fields_migration():
    """应用登录页配置字段迁移"""
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
        # 检查字段是否已存在
        login_desc_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'infra_platform_settings' 
                AND column_name = 'login_description'
            )
        """)
        
        icp_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'infra_platform_settings' 
                AND column_name = 'icp_license'
            )
        """)
        
        if login_desc_exists and icp_exists:
            print("⚠️  字段已存在，跳过添加")
        else:
            print("📝 添加登录页配置字段...")
            
            if not login_desc_exists:
                await conn.execute("""
                    ALTER TABLE "infra_platform_settings" 
                    ADD COLUMN "login_description" TEXT;
                """)
                print("✅ 添加 login_description 字段")
            
            if not icp_exists:
                await conn.execute("""
                    ALTER TABLE "infra_platform_settings" 
                    ADD COLUMN "icp_license" VARCHAR(100);
                """)
                print("✅ 添加 icp_license 字段")
            
            # 添加字段注释
            await conn.execute("""
                COMMENT ON COLUMN "infra_platform_settings"."login_description" IS '登录页描述';
                COMMENT ON COLUMN "infra_platform_settings"."icp_license" IS 'ICP备案信息';
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
            migration_version = '18_20260106000001'
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
        
        print("\n✅ 登录页配置字段迁移应用完成！")
        
    except Exception as e:
        print(f"❌ 执行迁移时出错: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.close()
        print("🔌 数据库连接已关闭")


if __name__ == "__main__":
    asyncio.run(apply_login_fields_migration())

