"""
默认关闭审核流程后，将历史待审核单据推进到后续状态。

迁移策略：
- review_status 为待审核/PENDING 的记录统一改为 APPROVED
- status 为待审核/PENDING_REVIEW 的记录按单据映射改为已确认或等价后续节点
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DO $$
        BEGIN
            IF to_regclass('public.apps_kuaizhizao_sales_orders') IS NOT NULL THEN
                UPDATE apps_kuaizhizao_sales_orders
                SET review_status = 'APPROVED',
                    status = CASE
                        WHEN status IN ('PENDING_REVIEW', '待审核', 'PENDING') THEN 'CONFIRMED'
                        ELSE status
                    END
                WHERE COALESCE(review_status, '') IN ('PENDING', '待审核', 'PENDING_REVIEW');
            END IF;

            IF to_regclass('public.apps_kuaizhizao_sales_forecasts') IS NOT NULL THEN
                UPDATE apps_kuaizhizao_sales_forecasts
                SET review_status = 'APPROVED',
                    status = CASE
                        WHEN status IN ('PENDING_REVIEW', '待审核', 'PENDING') THEN 'CONFIRMED'
                        ELSE status
                    END
                WHERE COALESCE(review_status, '') IN ('PENDING', '待审核', 'PENDING_REVIEW');
            END IF;

            IF to_regclass('public.apps_kuaizhizao_demands') IS NOT NULL THEN
                UPDATE apps_kuaizhizao_demands
                SET review_status = 'APPROVED',
                    status = CASE
                        WHEN status IN ('PENDING_REVIEW', '待审核', 'PENDING') THEN 'CONFIRMED'
                        ELSE status
                    END
                WHERE COALESCE(review_status, '') IN ('PENDING', '待审核', 'PENDING_REVIEW');
            END IF;

            IF to_regclass('public.apps_kuaizhizao_purchase_orders') IS NOT NULL THEN
                UPDATE apps_kuaizhizao_purchase_orders
                SET review_status = 'APPROVED',
                    status = CASE
                        WHEN status IN ('PENDING_REVIEW', '待审核', 'PENDING') THEN 'CONFIRMED'
                        ELSE status
                    END
                WHERE COALESCE(review_status, '') IN ('PENDING', '待审核', 'PENDING_REVIEW');
            END IF;

            IF to_regclass('public.apps_kuaizhizao_purchase_requisitions') IS NOT NULL THEN
                UPDATE apps_kuaizhizao_purchase_requisitions
                SET review_status = 'APPROVED',
                    status = CASE
                        WHEN status IN ('PENDING_REVIEW', '待审核', 'PENDING') THEN 'CONFIRMED'
                        ELSE status
                    END
                WHERE COALESCE(review_status, '') IN ('PENDING', '待审核', 'PENDING_REVIEW');
            END IF;

            IF to_regclass('public.apps_kuaizhizao_production_plans') IS NOT NULL THEN
                UPDATE apps_kuaizhizao_production_plans
                SET review_status = '通过',
                    status = CASE
                        WHEN status IN ('待审核', 'PENDING_REVIEW', 'PENDING') THEN '已确认'
                        ELSE status
                    END
                WHERE COALESCE(review_status, '') IN ('待审核', 'PENDING', 'PENDING_REVIEW');
            END IF;

            IF to_regclass('public.apps_kuaizhizao_incoming_inspections') IS NOT NULL THEN
                UPDATE apps_kuaizhizao_incoming_inspections
                SET review_status = 'APPROVED'
                WHERE COALESCE(review_status, '') IN ('PENDING', '待审核', 'PENDING_REVIEW');
            END IF;

            IF to_regclass('public.apps_kuaizhizao_process_inspections') IS NOT NULL THEN
                UPDATE apps_kuaizhizao_process_inspections
                SET review_status = 'APPROVED'
                WHERE COALESCE(review_status, '') IN ('PENDING', '待审核', 'PENDING_REVIEW');
            END IF;

            IF to_regclass('public.apps_kuaizhizao_finished_goods_inspections') IS NOT NULL THEN
                UPDATE apps_kuaizhizao_finished_goods_inspections
                SET review_status = 'APPROVED'
                WHERE COALESCE(review_status, '') IN ('PENDING', '待审核', 'PENDING_REVIEW');
            END IF;

            IF to_regclass('public.apps_kuaizhizao_sales_deliveries') IS NOT NULL THEN
                UPDATE apps_kuaizhizao_sales_deliveries
                SET review_status = 'APPROVED',
                    status = CASE
                        WHEN status IN ('PENDING_REVIEW', '待审核', 'PENDING') THEN 'CONFIRMED'
                        ELSE status
                    END
                WHERE COALESCE(review_status, '') IN ('PENDING', '待审核', 'PENDING_REVIEW');
            END IF;
        END$$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return ""
