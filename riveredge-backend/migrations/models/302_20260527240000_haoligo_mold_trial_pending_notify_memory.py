"""好力 GO — 模具台账记忆试模待处理消息提醒人员"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold"
        ADD COLUMN IF NOT EXISTS "trial_pending_notify_user_ids" JSONB DEFAULT '[]';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold" DROP COLUMN IF EXISTS "trial_pending_notify_user_ids";
    """
