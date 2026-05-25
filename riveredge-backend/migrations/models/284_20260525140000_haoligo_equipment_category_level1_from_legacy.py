"""好力 GO — 283 迁移后遗留类别：原单级 name 回填为一级分类（供台账 Segmented 筛选）。

283 将原 name 仅保留为二级且清空一级，导致台账只能看到「未分级」。
本迁移仅处理 name = level2 且一级为空的遗留行，将 level2 同步写入 level1；已配置一级/二级的行不受影响。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "haoligo_equipment_category"
        SET "level1_category" = TRIM("level2_category")
        WHERE "deleted_at" IS NULL
          AND TRIM(COALESCE("level1_category", '')) = ''
          AND TRIM(COALESCE("level2_category", '')) <> ''
          AND TRIM(COALESCE("name", '')) = TRIM("level2_category");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "haoligo_equipment_category"
        SET "level1_category" = ''
        WHERE "deleted_at" IS NULL
          AND TRIM(COALESCE("level1_category", '')) = TRIM(COALESCE("level2_category", ''))
          AND TRIM(COALESCE("name", '')) = TRIM(COALESCE("level2_category", ''));
    """
