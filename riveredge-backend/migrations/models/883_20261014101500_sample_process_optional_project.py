"""样品加工：研发项目可选，支持存量项目代号手填（project_id 可空）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaiplm_sample_process_applications"
            ALTER COLUMN "project_id" DROP NOT NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaiplm_sample_process_applications"
            ALTER COLUMN "project_id" SET NOT NULL;
    """
