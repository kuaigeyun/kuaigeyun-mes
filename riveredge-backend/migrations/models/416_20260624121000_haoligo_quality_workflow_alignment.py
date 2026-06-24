"""好力 GO — 品质单据严格对齐流程字段。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_quality_issue_tracking"
            ADD COLUMN IF NOT EXISTS "work_order_no" VARCHAR(128),
            ADD COLUMN IF NOT EXISTS "material_code_snapshot" VARCHAR(128),
            ADD COLUMN IF NOT EXISTS "model_snapshot" VARCHAR(128),
            ADD COLUMN IF NOT EXISTS "mold_code_snapshot" VARCHAR(128),
            ADD COLUMN IF NOT EXISTS "temporary_action" TEXT,
            ADD COLUMN IF NOT EXISTS "temporary_due_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "temporary_action_image_uuids" JSONB NOT NULL DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS "temporary_submitted_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "long_term_due_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "long_term_action_image_uuids" JSONB NOT NULL DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS "long_term_submitted_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "responsible_user_ids" JSONB NOT NULL DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS "overdue_notify_user_ids" JSONB NOT NULL DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS "close_note" TEXT,
            ADD COLUMN IF NOT EXISTS "close_confirmed_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "close_confirmer_user_id" INT;

        ALTER TABLE "haoligo_customer_complaint"
            ADD COLUMN IF NOT EXISTS "work_order_no" VARCHAR(128),
            ADD COLUMN IF NOT EXISTS "material_code_snapshot" VARCHAR(128),
            ADD COLUMN IF NOT EXISTS "model_snapshot" VARCHAR(128),
            ADD COLUMN IF NOT EXISTS "mold_code_snapshot" VARCHAR(128),
            ADD COLUMN IF NOT EXISTS "temporary_action" TEXT,
            ADD COLUMN IF NOT EXISTS "temporary_due_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "temporary_action_image_uuids" JSONB NOT NULL DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS "temporary_submitted_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "long_term_due_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "long_term_action_image_uuids" JSONB NOT NULL DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS "long_term_submitted_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "responsible_user_ids" JSONB NOT NULL DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS "overdue_notify_user_ids" JSONB NOT NULL DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS "close_note" TEXT,
            ADD COLUMN IF NOT EXISTS "close_confirmed_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "close_confirmer_user_id" INT;

        ALTER TABLE "haoligo_line_stop_feedback"
            ADD COLUMN IF NOT EXISTS "work_order_no" VARCHAR(128),
            ADD COLUMN IF NOT EXISTS "material_code_snapshot" VARCHAR(128),
            ADD COLUMN IF NOT EXISTS "model_snapshot" VARCHAR(128),
            ADD COLUMN IF NOT EXISTS "mold_code_snapshot" VARCHAR(128),
            ADD COLUMN IF NOT EXISTS "temporary_action" TEXT,
            ADD COLUMN IF NOT EXISTS "temporary_due_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "temporary_action_image_uuids" JSONB NOT NULL DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS "temporary_submitted_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "long_term_due_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "long_term_action_image_uuids" JSONB NOT NULL DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS "long_term_submitted_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "responsible_user_ids" JSONB NOT NULL DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS "overdue_notify_user_ids" JSONB NOT NULL DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS "close_note" TEXT,
            ADD COLUMN IF NOT EXISTS "close_confirmed_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "close_confirmer_user_id" INT;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_quality_issue_tracking"
            DROP COLUMN IF EXISTS "work_order_no",
            DROP COLUMN IF EXISTS "material_code_snapshot",
            DROP COLUMN IF EXISTS "model_snapshot",
            DROP COLUMN IF EXISTS "mold_code_snapshot",
            DROP COLUMN IF EXISTS "temporary_action",
            DROP COLUMN IF EXISTS "temporary_due_at",
            DROP COLUMN IF EXISTS "temporary_action_image_uuids",
            DROP COLUMN IF EXISTS "temporary_submitted_at",
            DROP COLUMN IF EXISTS "long_term_due_at",
            DROP COLUMN IF EXISTS "long_term_action_image_uuids",
            DROP COLUMN IF EXISTS "long_term_submitted_at",
            DROP COLUMN IF EXISTS "responsible_user_ids",
            DROP COLUMN IF EXISTS "overdue_notify_user_ids",
            DROP COLUMN IF EXISTS "close_note",
            DROP COLUMN IF EXISTS "close_confirmed_at",
            DROP COLUMN IF EXISTS "close_confirmer_user_id";

        ALTER TABLE "haoligo_customer_complaint"
            DROP COLUMN IF EXISTS "work_order_no",
            DROP COLUMN IF EXISTS "material_code_snapshot",
            DROP COLUMN IF EXISTS "model_snapshot",
            DROP COLUMN IF EXISTS "mold_code_snapshot",
            DROP COLUMN IF EXISTS "temporary_action",
            DROP COLUMN IF EXISTS "temporary_due_at",
            DROP COLUMN IF EXISTS "temporary_action_image_uuids",
            DROP COLUMN IF EXISTS "temporary_submitted_at",
            DROP COLUMN IF EXISTS "long_term_due_at",
            DROP COLUMN IF EXISTS "long_term_action_image_uuids",
            DROP COLUMN IF EXISTS "long_term_submitted_at",
            DROP COLUMN IF EXISTS "responsible_user_ids",
            DROP COLUMN IF EXISTS "overdue_notify_user_ids",
            DROP COLUMN IF EXISTS "close_note",
            DROP COLUMN IF EXISTS "close_confirmed_at",
            DROP COLUMN IF EXISTS "close_confirmer_user_id";

        ALTER TABLE "haoligo_line_stop_feedback"
            DROP COLUMN IF EXISTS "work_order_no",
            DROP COLUMN IF EXISTS "material_code_snapshot",
            DROP COLUMN IF EXISTS "model_snapshot",
            DROP COLUMN IF EXISTS "mold_code_snapshot",
            DROP COLUMN IF EXISTS "temporary_action",
            DROP COLUMN IF EXISTS "temporary_due_at",
            DROP COLUMN IF EXISTS "temporary_action_image_uuids",
            DROP COLUMN IF EXISTS "temporary_submitted_at",
            DROP COLUMN IF EXISTS "long_term_due_at",
            DROP COLUMN IF EXISTS "long_term_action_image_uuids",
            DROP COLUMN IF EXISTS "long_term_submitted_at",
            DROP COLUMN IF EXISTS "responsible_user_ids",
            DROP COLUMN IF EXISTS "overdue_notify_user_ids",
            DROP COLUMN IF EXISTS "close_note",
            DROP COLUMN IF EXISTS "close_confirmed_at",
            DROP COLUMN IF EXISTS "close_confirmer_user_id";
    """

