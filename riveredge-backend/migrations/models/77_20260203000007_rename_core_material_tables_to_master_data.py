"""
将归属基础数据管理的 core_material_* 表重命名为 apps_master_data_material_*

涉及：变体属性定义/历史、主编码规则、物料类型配置、部门编码规则、规则历史、序号计数器。
仅重命名表，约束与索引随表保留。若某表不存在则跳过。

Author: 表前缀统一
Date: 2026-02-03
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


def _rename_sql(old: str, new: str) -> str:
    return f"""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '{old}') THEN
                ALTER TABLE "{old}" RENAME TO "{new}";
            END IF;
        END $$;"""


async def upgrade(db: BaseDBAsyncClient) -> str:
    renames = [
        ("core_material_variant_attribute_definitions", "apps_master_data_material_variant_attribute_definitions"),
        ("core_material_variant_attribute_history", "apps_master_data_material_variant_attribute_history"),
        ("core_material_code_rule_main", "apps_master_data_material_code_rule_main"),
        ("core_material_type_config", "apps_master_data_material_type_config"),
        ("core_material_code_rule_alias", "apps_master_data_material_code_rule_alias"),
        ("core_material_code_rule_history", "apps_master_data_material_code_rule_history"),
        ("core_material_sequence_counter", "apps_master_data_material_sequence_counter"),
    ]
    return "\n".join(_rename_sql(old, new) for old, new in renames).strip()


async def downgrade(db: BaseDBAsyncClient) -> str:
    renames = [
        ("apps_master_data_material_variant_attribute_definitions", "core_material_variant_attribute_definitions"),
        ("apps_master_data_material_variant_attribute_history", "core_material_variant_attribute_history"),
        ("apps_master_data_material_code_rule_main", "core_material_code_rule_main"),
        ("apps_master_data_material_type_config", "core_material_type_config"),
        ("apps_master_data_material_code_rule_alias", "core_material_code_rule_alias"),
        ("apps_master_data_material_code_rule_history", "core_material_code_rule_history"),
        ("apps_master_data_material_sequence_counter", "core_material_sequence_counter"),
    ]
    return "\n".join(_rename_sql(old, new) for old, new in renames).strip()
