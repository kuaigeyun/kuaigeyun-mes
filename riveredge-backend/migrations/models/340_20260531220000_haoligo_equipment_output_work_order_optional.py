"""好力 GO — 设备产出单制令单号改为可选。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_output_record"
            ALTER COLUMN "work_order_no" DROP NOT NULL;
        COMMENT ON COLUMN "haoligo_equipment_output_record"."work_order_no" IS '制令单号（可选）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "haoligo_equipment_output_record"
        SET "work_order_no" = ''
        WHERE "work_order_no" IS NULL;

        ALTER TABLE "haoligo_equipment_output_record"
            ALTER COLUMN "work_order_no" SET NOT NULL;
    """
