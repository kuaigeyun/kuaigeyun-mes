"""
数据迁移：DataSource -> IntegrationConfig，并回填 core_datasets.integration_config_id

前置条件：已执行迁移 70_20260203000000_add_integration_config_id_to_datasets（core_datasets 已有 integration_config_id 列）。

步骤：
1. 遍历 core_data_sources（deleted_at IS NULL）
2. 若 core_integration_configs 中不存在相同 tenant_id+code，则插入一条（uuid 新生成）
3. 建立 data_source_id -> integration_config_id 映射
4. 更新 core_datasets 设置 integration_config_id

运行：在项目根目录执行
  cd riveredge-backend && python migrations/apply_data_sources_to_integration_configs_migration.py
"""

import asyncio
import json
import sys
import uuid
from pathlib import Path

project_root = Path(__file__).parent.parent
src_path = project_root / "src"
sys.path.insert(0, str(src_path))
sys.path.insert(0, str(project_root))

from tortoise import Tortoise
from infra.infrastructure.database.database import TORTOISE_ORM

# 兼容 asyncpg 返回：可能是 (columns, rows) 或直接 rows
def _first_id(result):
    if not result:
        return None
    if isinstance(result, tuple) and len(result) >= 2:
        rows = result[1]
    else:
        rows = result
    if not rows:
        return None
    row = rows[0]
    if isinstance(row, (list, tuple)):
        return row[0]
    return row.get("id")


async def run_migration():
    # 仅加载 integration_config（DataSource 模型已移除，本脚本用原始 SQL 读 core_data_sources 表）
    config = {
        "connections": TORTOISE_ORM["connections"],
        "apps": {"models": {"models": ["core.models.integration_config"]}},
    }
    await Tortoise.init(config=config)
    conn = Tortoise.get_connection("default")

    try:
        # 1. 获取所有未删除的 DataSource
        result = await conn.execute_query(
            """
            SELECT id, tenant_id, name, code, description, type, config,
                   is_active, is_connected, last_connected_at, last_error
            FROM core_data_sources WHERE deleted_at IS NULL
            """
        )
        rows_list = result[1] if isinstance(result, tuple) and len(result) >= 2 else result
        if not rows_list:
            print("没有需要迁移的 DataSource 记录，跳过。")
            await Tortoise.close_connections()
            return

        mapping = {}
        for row in rows_list:
            if isinstance(row, (list, tuple)):
                ds_id, tenant_id, name, code, description, type_, config, is_active, is_connected, last_connected_at, last_error = (
                    row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[9], row[10]
                )
            else:
                ds_id, tenant_id = row["id"], row["tenant_id"]
                name, code = row["name"], row["code"]
                description, type_ = row["description"], row["type"]
                config = row["config"]
                is_active, is_connected = row["is_active"], row["is_connected"]
                last_connected_at, last_error = row["last_connected_at"], row["last_error"]

            existing = await conn.execute_query(
                "SELECT id FROM core_integration_configs WHERE tenant_id = $1 AND code = $2 AND deleted_at IS NULL",
                tenant_id,
                code,
            )
            ic_id = _first_id(existing)
            if ic_id is not None:
                mapping[ds_id] = ic_id
                print(f"  已存在 IntegrationConfig tenant_id={tenant_id} code={code} -> id={ic_id}")
                continue

            new_uuid = str(uuid.uuid4())
            config_json = json.dumps(config) if config is not None else "{}"
            insert_result = await conn.execute_query(
                """
                INSERT INTO core_integration_configs
                (uuid, tenant_id, name, code, description, type, config, is_active, is_connected, last_connected_at, last_error, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, NOW(), NOW())
                RETURNING id
                """,
                new_uuid,
                tenant_id,
                name,
                code,
                description,
                type_,
                config_json,
                is_active,
                is_connected,
                last_connected_at,
                last_error,
            )
            ic_id = _first_id(insert_result)
            if ic_id is None:
                got = await conn.execute_query("SELECT id FROM core_integration_configs WHERE uuid = $1", new_uuid)
                ic_id = _first_id(got)
            mapping[ds_id] = ic_id
            print(f"  插入 IntegrationConfig tenant_id={tenant_id} code={code} -> id={ic_id}")

        for ds_id, ic_id in mapping.items():
            await conn.execute_query(
                "UPDATE core_datasets SET integration_config_id = $1 WHERE data_source_id = $2",
                ic_id,
                ds_id,
            )
        print(f"已回填 core_datasets.integration_config_id，映射 {len(mapping)} 条 DataSource。")
        print("✅ 数据迁移完成。")
    except Exception as e:
        print(f"❌ 迁移失败: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(run_migration())
