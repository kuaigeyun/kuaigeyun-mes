"""
工单增加 MRP 下推 BOM 版本快照字段。
"""
from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE apps_kuaizhizao_work_orders
            ADD COLUMN IF NOT EXISTS bom_id INT NULL,
            ADD COLUMN IF NOT EXISTS bom_version VARCHAR(20) NULL,
            ADD COLUMN IF NOT EXISTS material_bom_versions JSONB NULL,
            ADD COLUMN IF NOT EXISTS product_bom_version VARCHAR(20) NULL;

        COMMENT ON COLUMN apps_kuaizhizao_work_orders.bom_id IS '下推时锁定的成品 BOM 头 ID';
        COMMENT ON COLUMN apps_kuaizhizao_work_orders.bom_version IS '需求计算全局 BOM 版本参数';
        COMMENT ON COLUMN apps_kuaizhizao_work_orders.material_bom_versions IS '按物料 BOM 版本快照';
        COMMENT ON COLUMN apps_kuaizhizao_work_orders.product_bom_version IS '本工单成品实际采用的 BOM 版本号';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE apps_kuaizhizao_work_orders
            DROP COLUMN IF EXISTS product_bom_version,
            DROP COLUMN IF EXISTS material_bom_versions,
            DROP COLUMN IF EXISTS bom_version,
            DROP COLUMN IF EXISTS bom_id;
    """
