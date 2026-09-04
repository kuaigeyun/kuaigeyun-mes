"""
好力 GO — 合并 migration 611 铸造的影子制造厂商。

611 把「财务材料供应商」迁成「设备制造厂商」时，为每条历史合同/应付款新建了
EQM-/EQC-/EQP- 前缀的厂商记录：名称是真实公司名，编码却是合成码。
外协账号绑定的是真实厂商代号，数据范围按 manufacturer_code 过滤，
于是这些单据列表上厂商名看着一样、却永远不在任何厂家的可见范围内。

本迁移把影子厂商指回同租户同名的真实厂商（真源字段改写），并软删影子记录。
只合并「同名真实厂商唯一」的影子；一对多含糊的保持原样，交由主数据人工归并。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TEMP TABLE "_haoligo_shadow_manufacturer_merge" ON COMMIT DROP AS
        SELECT s."id" AS shadow_id,
               s."tenant_id" AS tenant_id,
               MIN(r."id") AS real_id
        FROM "haoligo_manufacturer" s
        JOIN "haoligo_manufacturer" r
          ON r."tenant_id" = s."tenant_id"
         AND BTRIM(r."name") = BTRIM(s."name")
         AND r."deleted_at" IS NULL
         AND r."code" NOT LIKE 'EQM-%'
         AND r."code" NOT LIKE 'EQC-%'
         AND r."code" NOT LIKE 'EQP-%'
        WHERE s."deleted_at" IS NULL
          AND (s."code" LIKE 'EQM-%' OR s."code" LIKE 'EQC-%' OR s."code" LIKE 'EQP-%')
        GROUP BY s."id", s."tenant_id"
        HAVING COUNT(DISTINCT r."id") = 1;

        UPDATE "haoligo_finance_equipment_contract" c
        SET "manufacturer_id" = m."id",
            "manufacturer_code" = m."code",
            "manufacturer_name" = m."name"
        FROM "_haoligo_shadow_manufacturer_merge" mm
        JOIN "haoligo_manufacturer" m ON m."id" = mm.real_id
        WHERE c."manufacturer_id" = mm.shadow_id
          AND c."tenant_id" = mm.tenant_id;

        UPDATE "haoligo_finance_equipment_payable" p
        SET "manufacturer_id" = m."id",
            "manufacturer_code" = m."code",
            "manufacturer_name" = m."name"
        FROM "_haoligo_shadow_manufacturer_merge" mm
        JOIN "haoligo_manufacturer" m ON m."id" = mm.real_id
        WHERE p."manufacturer_id" = mm.shadow_id
          AND p."tenant_id" = mm.tenant_id;

        UPDATE "haoligo_equipment_acceptance_sheet" a
        SET "manufacturer_id" = m."id",
            "manufacturer_code" = m."code",
            "manufacturer_name" = m."name"
        FROM "_haoligo_shadow_manufacturer_merge" mm
        JOIN "haoligo_manufacturer" m ON m."id" = mm.real_id
        WHERE a."manufacturer_id" = mm.shadow_id
          AND a."tenant_id" = mm.tenant_id;

        UPDATE "haoligo_equipment" e
        SET "manufacturer_id" = mm.real_id
        FROM "_haoligo_shadow_manufacturer_merge" mm
        WHERE e."manufacturer_id" = mm.shadow_id
          AND e."tenant_id" = mm.tenant_id;

        UPDATE "haoligo_manufacturer" s
        SET "deleted_at" = NOW()
        FROM "_haoligo_shadow_manufacturer_merge" mm
        WHERE s."id" = mm.shadow_id;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 影子厂商归并后原始归属不可还原
    """
