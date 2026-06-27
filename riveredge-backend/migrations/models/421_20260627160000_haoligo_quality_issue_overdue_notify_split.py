"""好力 GO — 品质问题：临时/长期措施逾期提醒人拆分。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_quality_issue_tracking"
            ADD COLUMN IF NOT EXISTS "temporary_overdue_notify_user_ids" JSONB NOT NULL DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS "long_term_overdue_notify_user_ids" JSONB NOT NULL DEFAULT '[]';

        UPDATE "haoligo_quality_issue_tracking"
        SET
            "temporary_overdue_notify_user_ids" = "overdue_notify_user_ids",
            "long_term_overdue_notify_user_ids" = "overdue_notify_user_ids"
        WHERE jsonb_array_length("overdue_notify_user_ids") > 0
          AND jsonb_array_length("temporary_overdue_notify_user_ids") = 0
          AND jsonb_array_length("long_term_overdue_notify_user_ids") = 0;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_quality_issue_tracking"
            DROP COLUMN IF EXISTS "long_term_overdue_notify_user_ids",
            DROP COLUMN IF EXISTS "temporary_overdue_notify_user_ids";
    """
