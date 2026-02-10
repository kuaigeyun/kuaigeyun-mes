"""
将 core_material_* 表注释同步为「基础数据管理 - 」前缀

覆盖 core_material_* 所有已定义 table_description 的表。
若表不存在则跳过。

Author: 基础数据管理表注释
Date: 2026-02-03
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

COMMENTS = [
    ("core_material_variant_attribute_definitions", "基础数据管理 - 变体属性定义"),
    ("core_material_variant_attribute_history", "基础数据管理 - 变体属性定义历史"),
    ("core_material_code_rule_main", "基础数据管理 - 主编码规则配置"),
    ("core_material_type_config", "基础数据管理 - 物料类型配置"),
    ("core_material_code_rule_alias", "基础数据管理 - 部门编码规则配置"),
    ("core_material_code_rule_history", "基础数据管理 - 编码规则版本历史"),
    ("core_material_sequence_counter", "基础数据管理 - 物料序号计数器"),
]


def _comment_sql(table: str, comment: str) -> str:
    escaped = comment.replace("'", "''")
    return f'COMMENT ON TABLE "{table}" IS \'{escaped}\';'


async def upgrade(db: BaseDBAsyncClient) -> str:
    parts = []
    for table, comment in COMMENTS:
        parts.append(
            f"""        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '{table}') THEN
                {_comment_sql(table, comment)}
            END IF;
        END $$;"""
        )
    return "\n".join(parts).strip()


async def downgrade(db: BaseDBAsyncClient) -> str:
    parts = []
    for table, _ in COMMENTS:
        parts.append(
            f"""        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '{table}') THEN
                COMMENT ON TABLE "{table}" IS '';
            END IF;
        END $$;"""
        )
    return "\n".join(parts).strip()
