"""
直接创建 soil_packages 表

由于迁移文件存在依赖问题，直接执行创建表的 SQL
"""

import asyncio
import sys
from pathlib import Path

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

from tortoise import Tortoise
from soil.infrastructure.database.database import TORTOISE_ORM


async def create_soil_packages_table():
    """
    直接创建 soil_packages 表
    """
    try:
        # 初始化 Tortoise ORM
        await Tortoise.init(config=TORTOISE_ORM)
        print("✅ Tortoise ORM 初始化成功")
        
        # 获取数据库连接
        conn = Tortoise.get_connection("default")
        
        # 创建表的 SQL（从迁移文件中提取）
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS "soil_packages" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "name" VARCHAR(100) NOT NULL,
            "plan" VARCHAR(12) NOT NULL,
            "max_users" INT NOT NULL,
            "max_storage_mb" INT NOT NULL,
            "allow_pro_apps" BOOL NOT NULL  DEFAULT False,
            "description" TEXT,
            "price" DOUBLE PRECISION,
            "features" JSONB NOT NULL DEFAULT '[]'::jsonb
        );
        
        CREATE INDEX IF NOT EXISTS "idx_soil_packag_plan_493a83" ON "soil_packages" ("plan");
        
        COMMENT ON COLUMN "soil_packages"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        COMMENT ON COLUMN "soil_packages"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
        COMMENT ON COLUMN "soil_packages"."created_at" IS '创建时间';
        COMMENT ON COLUMN "soil_packages"."updated_at" IS '更新时间';
        COMMENT ON COLUMN "soil_packages"."id" IS '套餐 ID（主键）';
        COMMENT ON COLUMN "soil_packages"."name" IS '套餐名称';
        COMMENT ON COLUMN "soil_packages"."plan" IS '套餐类型';
        COMMENT ON COLUMN "soil_packages"."max_users" IS '最大用户数限制';
        COMMENT ON COLUMN "soil_packages"."max_storage_mb" IS '最大存储空间限制（MB）';
        COMMENT ON COLUMN "soil_packages"."allow_pro_apps" IS '是否允许使用 PRO 应用';
        COMMENT ON COLUMN "soil_packages"."description" IS '套餐描述';
        COMMENT ON COLUMN "soil_packages"."price" IS '套餐价格（可选）';
        COMMENT ON COLUMN "soil_packages"."features" IS '套餐功能列表（JSON 存储）';
        COMMENT ON TABLE "soil_packages" IS '套餐模型';
        """
        
        print("\n正在创建 soil_packages 表...")
        await conn.execute_script(create_table_sql)
        print("✅ soil_packages 表创建成功！")
        
        # 关闭连接
        await Tortoise.close_connections()
        print("\n✅ 完成！")
        
    except Exception as e:
        print(f"\n❌ 创建表失败: {e}")
        import traceback
        traceback.print_exc()
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(create_soil_packages_table())

