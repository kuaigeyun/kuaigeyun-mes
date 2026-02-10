"""
一次性脚本：若表 apps_master_data_operation_defect_types 不存在则创建。
用于修复错误：关系 "models.OperationDefectType" 不存在。

使用：在项目根目录执行
  uv run python ensure_operation_defect_types_table.py
  或
  PYTHONPATH=. uv run python ensure_operation_defect_types_table.py
"""
import asyncio
import sys
from pathlib import Path

# 确保能加载 infra 配置
sys.path.insert(0, str(Path(__file__).parent / "src"))

from infra.config.infra_config import infra_settings


async def main():
    import asyncpg
    db_host = "127.0.0.1" if infra_settings.DB_HOST == "localhost" else infra_settings.DB_HOST
    conn = await asyncpg.connect(
        host=db_host,
        port=infra_settings.DB_PORT,
        user=infra_settings.DB_USER,
        password=infra_settings.DB_PASSWORD,
        database=infra_settings.DB_NAME,
    )
    try:
        # 与迁移 65 一致：工序-不良品项关联表（M2M）
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS apps_master_data_operation_defect_types (
                id SERIAL PRIMARY KEY,
                operation_id INT NOT NULL REFERENCES apps_master_data_operations(id) ON DELETE CASCADE,
                defect_type_id INT NOT NULL REFERENCES apps_master_data_defect_types(id) ON DELETE CASCADE,
                UNIQUE(operation_id, defect_type_id)
            );
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_operation_defect_types_operation_id
                ON apps_master_data_operation_defect_types(operation_id);
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_operation_defect_types_defect_type_id
                ON apps_master_data_operation_defect_types(defect_type_id);
        """)
        await conn.execute("""
            COMMENT ON TABLE apps_master_data_operation_defect_types IS '工序绑定不良品项（M2M）';
        """)
        print("OK: 表 apps_master_data_operation_defect_types 已存在或已创建。")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
