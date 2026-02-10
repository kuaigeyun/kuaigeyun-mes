"""
将归属快格轻制造的原 core_* 表重命名为 apps_kuaizhizao_*

涉及：设备、设备校准、模具、模具使用/校准、工装及维保/校验、保养计划/执行、设备故障/维修。
仅重命名表，约束与索引名保持不变（PostgreSQL 下随表存在即可）。
若某表不存在（如从未执行过对应建表迁移），则跳过该表。

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
        ("core_equipment", "apps_kuaizhizao_equipment"),
        ("core_equipment_calibrations", "apps_kuaizhizao_equipment_calibrations"),
        ("core_equipment_faults", "apps_kuaizhizao_equipment_faults"),
        ("core_equipment_repairs", "apps_kuaizhizao_equipment_repairs"),
        ("core_maintenance_plans", "apps_kuaizhizao_maintenance_plans"),
        ("core_maintenance_executions", "apps_kuaizhizao_maintenance_executions"),
        ("core_molds", "apps_kuaizhizao_molds"),
        ("core_mold_usages", "apps_kuaizhizao_mold_usages"),
        ("core_mold_calibrations", "apps_kuaizhizao_mold_calibrations"),
        ("core_tools", "apps_kuaizhizao_tools"),
        ("core_tool_usages", "apps_kuaizhizao_tool_usages"),
        ("core_tool_maintenances", "apps_kuaizhizao_tool_maintenances"),
        ("core_tool_calibrations", "apps_kuaizhizao_tool_calibrations"),
    ]
    return "\n".join(_rename_sql(old, new) for old, new in renames).strip()


async def downgrade(db: BaseDBAsyncClient) -> str:
    renames = [
        ("apps_kuaizhizao_equipment", "core_equipment"),
        ("apps_kuaizhizao_equipment_calibrations", "core_equipment_calibrations"),
        ("apps_kuaizhizao_equipment_faults", "core_equipment_faults"),
        ("apps_kuaizhizao_equipment_repairs", "core_equipment_repairs"),
        ("apps_kuaizhizao_maintenance_plans", "core_maintenance_plans"),
        ("apps_kuaizhizao_maintenance_executions", "core_maintenance_executions"),
        ("apps_kuaizhizao_molds", "core_molds"),
        ("apps_kuaizhizao_mold_usages", "core_mold_usages"),
        ("apps_kuaizhizao_mold_calibrations", "core_mold_calibrations"),
        ("apps_kuaizhizao_tools", "core_tools"),
        ("apps_kuaizhizao_tool_usages", "core_tool_usages"),
        ("apps_kuaizhizao_tool_maintenances", "core_tool_maintenances"),
        ("apps_kuaizhizao_tool_calibrations", "core_tool_calibrations"),
    ]
    return "\n".join(_rename_sql(old, new) for old, new in renames).strip()
