"""好力 GO — 设备点检方案以多对多绑定为准，清空遗留单列 inspection_param_set_id。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "haoligo_equipment"
        SET "inspection_param_set_id" = NULL
        WHERE "deleted_at" IS NULL
          AND "inspection_param_set_id" IS NOT NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "haoligo_equipment" e
        SET "inspection_param_set_id" = sub."set_id"
        FROM (
            SELECT "equipment_id", MIN("set_id") AS "set_id"
            FROM "haoligo_equipment_inspection_param_set"
            WHERE "deleted_at" IS NULL
            GROUP BY "equipment_id"
            HAVING COUNT(*) = 1
        ) sub
        WHERE e."id" = sub."equipment_id"
          AND e."deleted_at" IS NULL;
    """
