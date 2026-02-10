"""
将 apps_master_data 表注释同步为「基础数据管理 - 」前缀

覆盖 apps_master_data_* 所有已定义 table_description 的表。
若表不存在则跳过。

Author: 基础数据管理表注释
Date: 2026-02-03
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

COMMENTS = [
    ("apps_master_data_plants", "基础数据管理 - 厂区"),
    ("apps_master_data_workshops", "基础数据管理 - 车间"),
    ("apps_master_data_production_lines", "基础数据管理 - 产线"),
    ("apps_master_data_workstations", "基础数据管理 - 工位"),
    ("apps_master_data_warehouses", "基础数据管理 - 仓库"),
    ("apps_master_data_storage_areas", "基础数据管理 - 库区"),
    ("apps_master_data_storage_locations", "基础数据管理 - 库位"),
    ("apps_master_data_material_groups", "基础数据管理 - 物料组"),
    ("apps_master_data_materials", "基础数据管理 - 物料"),
    ("apps_master_data_bom", "基础数据管理 - BOM"),
    ("apps_master_data_products", "基础数据管理 - 产品"),
    ("apps_master_data_customers", "基础数据管理 - 客户"),
    ("apps_master_data_suppliers", "基础数据管理 - 供应商"),
    ("apps_master_data_holidays", "基础数据管理 - 节假日"),
    ("apps_master_data_skills", "基础数据管理 - 技能"),
    ("apps_master_data_defect_types", "基础数据管理 - 不良类型"),
    ("apps_master_data_sop_executions", "基础数据管理 - SOP执行记录"),
    ("apps_master_data_operations", "基础数据管理 - 工序"),
    ("apps_master_data_operation_defect_types", "基础数据管理 - 工序不良类型关联"),
    ("apps_master_data_process_routes", "基础数据管理 - 工艺路线"),
    ("apps_master_data_process_route_templates", "基础数据管理 - 工艺路线模板"),
    ("apps_master_data_sop", "基础数据管理 - SOP"),
    ("apps_master_data_process_route_changes", "基础数据管理 - 工艺路线变更"),
    ("apps_master_data_material_batches", "基础数据管理 - 物料批次"),
    ("apps_master_data_material_serials", "基础数据管理 - 物料序列号"),
    ("apps_master_data_material_code_aliases", "基础数据管理 - 物料编码别名"),
    ("apps_master_data_material_code_mappings", "基础数据管理 - 物料编码映射"),
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
