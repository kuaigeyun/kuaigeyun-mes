"""试模不合格处理中：已审核且未收回的单据不应处于「已结案」流程阶段。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "haoligo_mold_trial_sheet"
        SET "workflow_phase" = '试模合格待试产'
        WHERE "deleted_at" IS NULL
          AND "workflow_phase" = '已结案'
          AND TRIM(COALESCE("production_trial_result", '')) = '不合格'
          AND TRIM(COALESCE("failure_handling", '')) IN ('待处理', '立即送修', '已发出', '调整完成');

        UPDATE "haoligo_mold_trial_sheet"
        SET "workflow_phase" = '试模'
        WHERE "deleted_at" IS NULL
          AND "workflow_phase" = '已结案'
          AND TRIM(COALESCE("trial_result", '')) = '不合格'
          AND TRIM(COALESCE("production_trial_result", '')) = ''
          AND TRIM(COALESCE("failure_handling", '')) IN ('待处理', '立即送修', '已发出', '调整完成');
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "haoligo_mold_trial_sheet"
        SET "workflow_phase" = '已结案'
        WHERE "deleted_at" IS NULL
          AND TRIM(COALESCE("sheet_status", '')) = '已通过'
          AND TRIM(COALESCE("failure_handling", '')) IN ('待处理', '立即送修', '已发出', '调整完成')
          AND TRIM(COALESCE("workflow_phase", '')) IN ('试模', '试模合格待试产');
    """
