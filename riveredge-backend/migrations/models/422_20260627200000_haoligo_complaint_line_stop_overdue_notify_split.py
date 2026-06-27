"""好力 GO — 客户投诉 / 停线反馈：临时/长期措施逾期提醒人拆分。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_customer_complaint"
            ADD COLUMN IF NOT EXISTS "temporary_overdue_notify_user_ids" JSONB NOT NULL DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS "long_term_overdue_notify_user_ids" JSONB NOT NULL DEFAULT '[]';

        UPDATE "haoligo_customer_complaint"
        SET
            "temporary_overdue_notify_user_ids" = "overdue_notify_user_ids",
            "long_term_overdue_notify_user_ids" = "overdue_notify_user_ids"
        WHERE jsonb_array_length("overdue_notify_user_ids") > 0
          AND jsonb_array_length("temporary_overdue_notify_user_ids") = 0;

        ALTER TABLE "haoligo_line_stop_feedback"
            ADD COLUMN IF NOT EXISTS "temporary_overdue_notify_user_ids" JSONB NOT NULL DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS "long_term_overdue_notify_user_ids" JSONB NOT NULL DEFAULT '[]';

        UPDATE "haoligo_line_stop_feedback"
        SET
            "temporary_overdue_notify_user_ids" = "overdue_notify_user_ids",
            "long_term_overdue_notify_user_ids" = "overdue_notify_user_ids"
        WHERE jsonb_array_length("overdue_notify_user_ids") > 0
          AND jsonb_array_length("temporary_overdue_notify_user_ids") = 0;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_customer_complaint"
            DROP COLUMN IF EXISTS "temporary_overdue_notify_user_ids",
            DROP COLUMN IF EXISTS "long_term_overdue_notify_user_ids";

        ALTER TABLE "haoligo_line_stop_feedback"
            DROP COLUMN IF EXISTS "temporary_overdue_notify_user_ids",
            DROP COLUMN IF EXISTS "long_term_overdue_notify_user_ids";
    """
