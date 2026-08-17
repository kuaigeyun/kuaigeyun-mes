"""好力 GO — 设备合同登记增加签订时间、预计交付时间。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_finance_equipment_contract"
            ADD COLUMN IF NOT EXISTS "signed_at" TIMESTAMPTZ;
        ALTER TABLE "haoligo_finance_equipment_contract"
            ADD COLUMN IF NOT EXISTS "expected_delivery_at" TIMESTAMPTZ;
        COMMENT ON COLUMN "haoligo_finance_equipment_contract"."signed_at"
            IS '合同签订业务时刻';
        COMMENT ON COLUMN "haoligo_finance_equipment_contract"."expected_delivery_at"
            IS '预计交付业务时刻';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_finance_equipment_contract"
            DROP COLUMN IF EXISTS "expected_delivery_at";
        ALTER TABLE "haoligo_finance_equipment_contract"
            DROP COLUMN IF EXISTS "signed_at";
    """
