"""
直接使用 SQL 创建 soil_platform_superadmin 表

然后更新 aerich 迁移记录
"""

import asyncio
import sys
from pathlib import Path

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

from tortoise import Tortoise
from soil.infrastructure.database.database import TORTOISE_ORM


async def create_table_direct():
    """
    直接创建表并更新 aerich 记录
    """
    try:
        # 初始化 Tortoise ORM
        await Tortoise.init(config=TORTOISE_ORM)
        print("✅ Tortoise ORM 初始化成功")
        
        conn = Tortoise.get_connection("default")
        
        # 检查表是否已存在
        check_sql = """
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'soil_platform_superadmin'
            );
        """
        result = await conn.execute_query_dict(check_sql)
        table_exists = result[0]['exists'] if result else False
        
        if table_exists:
            print("ℹ️  表 'soil_platform_superadmin' 已存在，跳过创建")
        else:
            # 创建表
            create_sql = """
                CREATE TABLE IF NOT EXISTS "soil_platform_superadmin" (
                    "uuid" VARCHAR(36) NOT NULL,
                    "tenant_id" INT,
                    "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
                    "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
                    "id" SERIAL NOT NULL PRIMARY KEY,
                    "username" VARCHAR(50) NOT NULL UNIQUE,
                    "email" VARCHAR(255),
                    "password_hash" VARCHAR(255) NOT NULL,
                    "full_name" VARCHAR(100),
                    "is_active" BOOL NOT NULL  DEFAULT True,
                    "last_login" TIMESTAMPTZ
                );
                CREATE INDEX IF NOT EXISTS "idx_soil_platfo_usernam_84921b" ON "soil_platform_superadmin" ("username");
                COMMENT ON COLUMN "soil_platform_superadmin"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
                COMMENT ON COLUMN "soil_platform_superadmin"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
                COMMENT ON COLUMN "soil_platform_superadmin"."created_at" IS '创建时间';
                COMMENT ON COLUMN "soil_platform_superadmin"."updated_at" IS '更新时间';
                COMMENT ON COLUMN "soil_platform_superadmin"."id" IS '平台超级管理员 ID（主键）';
                COMMENT ON COLUMN "soil_platform_superadmin"."username" IS '用户名（全局唯一，平台唯一）';
                COMMENT ON COLUMN "soil_platform_superadmin"."email" IS '用户邮箱（可选）';
                COMMENT ON COLUMN "soil_platform_superadmin"."password_hash" IS '密码哈希值（使用 bcrypt 加密）';
                COMMENT ON COLUMN "soil_platform_superadmin"."full_name" IS '用户全名（可选）';
                COMMENT ON COLUMN "soil_platform_superadmin"."is_active" IS '是否激活';
                COMMENT ON COLUMN "soil_platform_superadmin"."last_login" IS '最后登录时间（可选）';
                COMMENT ON TABLE "soil_platform_superadmin" IS '平台超级管理员模型';
            """
            await conn.execute_script(create_sql)
            print("✅ 表 'soil_platform_superadmin' 创建成功")
        
        # 更新 aerich 迁移记录（标记简化迁移为已应用）
        # 检查 aerich 表是否存在
        aerich_check = """
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'aerich'
            );
        """
        aerich_result = await conn.execute_query_dict(aerich_check)
        aerich_exists = aerich_result[0]['exists'] if aerich_result else False
        
        if aerich_exists:
            # 检查简化迁移是否已记录
            check_migration = """
                SELECT * FROM aerich 
                WHERE version = '9_create_soil_platform_superadmin';
            """
            migration_result = await conn.execute_query_dict(check_migration)
            
            if not migration_result:
                # 插入迁移记录（content 字段是 JSON 类型）
                insert_migration = """
                    INSERT INTO aerich (version, app, content)
                    VALUES ('9_create_soil_platform_superadmin', 'models', '{"create_soil_platform_superadmin": true}'::json);
                """
                await conn.execute_script(insert_migration)
                print("✅ 已更新 aerich 迁移记录")
            else:
                print("ℹ️  迁移记录已存在")
        
        # 关闭连接
        await Tortoise.close_connections()
        print("\n✅ 完成！")
        
    except Exception as e:
        print(f"\n❌ 操作失败: {e}")
        import traceback
        traceback.print_exc()
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(create_table_direct())

