"""
质量异常状态回填：不合格品已处置或 8D 已关闭时，同步将关联质量异常置为 closed。

真源曾只写台账/8D、未回写质量异常，导致跟踪报表长期显示「待处理」。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "apps_kuaizhizao_quality_exceptions" AS qe
        SET
            "status" = 'closed',
            "actual_completion_date" = COALESCE(qe."actual_completion_date", dr."processed_at", CURRENT_TIMESTAMP),
            "handled_at" = COALESCE(qe."handled_at", dr."processed_at", CURRENT_TIMESTAMP),
            "handled_by" = COALESCE(qe."handled_by", dr."processed_by"),
            "handled_by_name" = COALESCE(qe."handled_by_name", dr."processed_by_name"),
            "verification_result" = COALESCE(
                NULLIF(TRIM(qe."verification_result"), ''),
                '不合格品台账已处置完成（历史回填）'
            )
        FROM "apps_kuaizhizao_defect_records" AS dr
        WHERE qe."tenant_id" = dr."tenant_id"
          AND qe."deleted_at" IS NULL
          AND dr."deleted_at" IS NULL
          AND dr."status" = 'processed'
          AND qe."status" IN ('pending', 'investigating', 'correcting')
          AND (
            (
              qe."inspection_source_type" = 'incoming_inspection'
              AND qe."inspection_record_id" = dr."incoming_inspection_id"
            )
            OR (
              qe."inspection_source_type" = 'process_inspection'
              AND qe."inspection_record_id" = dr."process_inspection_id"
            )
            OR (
              qe."inspection_source_type" = 'finished_goods_inspection'
              AND qe."inspection_record_id" = dr."finished_goods_inspection_id"
            )
          );

        UPDATE "apps_kuaizhizao_quality_exceptions" AS qe
        SET
            "status" = 'closed',
            "actual_completion_date" = COALESCE(qe."actual_completion_date", r."closed_at", CURRENT_TIMESTAMP),
            "handled_at" = COALESCE(qe."handled_at", r."closed_at", CURRENT_TIMESTAMP),
            "verification_result" = COALESCE(
                NULLIF(TRIM(qe."verification_result"), ''),
                NULLIF(TRIM(r."verification_result"), ''),
                '8D 报告已关闭（历史回填）'
            )
        FROM "apps_kuaizhizao_quality_8d_reports" AS r
        WHERE qe."id" = r."quality_exception_id"
          AND qe."tenant_id" = r."tenant_id"
          AND qe."deleted_at" IS NULL
          AND r."deleted_at" IS NULL
          AND r."status" = 'closed'
          AND qe."status" IN ('pending', 'investigating', 'correcting');
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return "-- noop: quality exception closed-status backfill is irreversible"
