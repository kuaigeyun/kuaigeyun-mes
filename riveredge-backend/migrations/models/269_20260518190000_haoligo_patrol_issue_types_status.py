"""好力 GO — 巡查隐患：问题类型多选、状态简化为已登记/已治理。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_hazard_report"
            ADD COLUMN IF NOT EXISTS "issue_type_codes" JSONB NOT NULL DEFAULT '[]';

        UPDATE "haoligo_hazard_report"
        SET "issue_type_codes" = jsonb_build_array("issue_type_code")
        WHERE "issue_type_code" IS NOT NULL
          AND TRIM("issue_type_code") <> ''
          AND ("issue_type_codes" IS NULL OR "issue_type_codes" = '[]'::jsonb);

        UPDATE "haoligo_hazard_report"
        SET "status" = '已登记'
        WHERE "status" IN ('检查中', '维修中');

        UPDATE "haoligo_hazard_report"
        SET "status" = '已治理'
        WHERE "status" = '已完成';

        ALTER TABLE "haoligo_hazard_report"
            ALTER COLUMN "status" SET DEFAULT '已登记';

        COMMENT ON COLUMN "haoligo_hazard_report"."issue_type_codes" IS '问题类型编码列表（多选）';
        COMMENT ON COLUMN "haoligo_hazard_report"."status" IS '处理状态：已登记/已治理';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "haoligo_hazard_report"
        SET "status" = '检查中'
        WHERE "status" = '已登记';

        UPDATE "haoligo_hazard_report"
        SET "status" = '已完成'
        WHERE "status" = '已治理';

        ALTER TABLE "haoligo_hazard_report"
            ALTER COLUMN "status" SET DEFAULT '检查中';

        ALTER TABLE "haoligo_hazard_report" DROP COLUMN IF EXISTS "issue_type_codes";
    """
