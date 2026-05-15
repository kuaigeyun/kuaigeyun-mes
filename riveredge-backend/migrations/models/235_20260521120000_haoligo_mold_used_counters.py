"""好力 GO 模具台账：已使用次数 / 已使用产量（还入单累计；额定次数/产量不再被还入扣减）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold" ADD COLUMN IF NOT EXISTS "used_times" INT NOT NULL DEFAULT 0;
        ALTER TABLE "haoligo_mold" ADD COLUMN IF NOT EXISTS "used_yield" DECIMAL(18,4) NOT NULL DEFAULT 0;
        COMMENT ON COLUMN "haoligo_mold"."used_times" IS '已使用次数（每笔还入单 +1，可随还入单删除/修改回滚）';
        COMMENT ON COLUMN "haoligo_mold"."used_yield" IS '已使用产量（还入单制造数量累计）';
        COMMENT ON COLUMN "haoligo_mold"."usable_times" IS '额定可用次数（还入不再扣减）';
        COMMENT ON COLUMN "haoligo_mold"."usable_yield" IS '额定可用产量（还入不再扣减）';

        UPDATE "haoligo_mold" m SET
            "used_times" = COALESCE(s.cnt, 0),
            "used_yield" = COALESCE(s.sumy, 0)
        FROM (
            SELECT tenant_id, mold_code,
                   COUNT(*)::int AS cnt,
                   COALESCE(SUM(manufacture_qty), 0) AS sumy
            FROM haoligo_mold_return_sheet
            WHERE deleted_at IS NULL
            GROUP BY tenant_id, mold_code
        ) s
        WHERE m.tenant_id = s.tenant_id AND m.mold_code = s.mold_code;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold" DROP COLUMN IF EXISTS "used_yield";
        ALTER TABLE "haoligo_mold" DROP COLUMN IF EXISTS "used_times";
    """
