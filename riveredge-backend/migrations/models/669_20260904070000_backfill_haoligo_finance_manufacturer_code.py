"""
设备合同/应付款 manufacturer_code 回填：外协数据范围按编码过滤。
已提交合同若只写了 manufacturer_id、编码快照为空，设备制造商会看不到该行。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "haoligo_finance_equipment_contract" AS c
        SET "manufacturer_code" = m."code",
            "manufacturer_name" = COALESCE(NULLIF(BTRIM(c."manufacturer_name"), ''), m."name")
        FROM "haoligo_manufacturer" AS m
        WHERE c."manufacturer_id" = m."id"
          AND c."tenant_id" = m."tenant_id"
          AND c."deleted_at" IS NULL
          AND m."deleted_at" IS NULL
          AND m."code" IS NOT NULL
          AND BTRIM(m."code") <> ''
          AND (
                c."manufacturer_code" IS NULL
                OR BTRIM(c."manufacturer_code") = ''
              );

        UPDATE "haoligo_finance_equipment_payable" AS p
        SET "manufacturer_code" = m."code",
            "manufacturer_name" = COALESCE(NULLIF(BTRIM(p."manufacturer_name"), ''), m."name")
        FROM "haoligo_manufacturer" AS m
        WHERE p."manufacturer_id" = m."id"
          AND p."tenant_id" = m."tenant_id"
          AND p."deleted_at" IS NULL
          AND m."deleted_at" IS NULL
          AND m."code" IS NOT NULL
          AND BTRIM(m."code") <> ''
          AND (
                p."manufacturer_code" IS NULL
                OR BTRIM(p."manufacturer_code") = ''
              );
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 快照回填不可逆
    """
