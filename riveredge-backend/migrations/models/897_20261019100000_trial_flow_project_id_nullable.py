"""试流单 project_id 可空（与产品固件/样品加工一致：可仅手填项目代号）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaiplm_trial_flows"
            ALTER COLUMN "project_id" DROP NOT NULL;
        COMMENT ON COLUMN "apps_kuaiplm_trial_flows"."project_id"
            IS '研发项目ID（可空：仅手填项目代号）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaiplm_trial_flows"
            ALTER COLUMN "project_id" SET NOT NULL;
    """
