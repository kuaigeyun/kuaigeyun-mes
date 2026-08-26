"""
销售订单 / 需求单 status、review_status 存量中文回填为枚举

背景：
- SalesOrderResponse 对 status/review_status 使用严格 DemandStatus / ReviewStatus 枚举
- 迁移 102 只覆盖采购订单 / 销售预测 / 采购申请，漏了 sales_orders
- 部分环境库内仍有「待审批」「待审核」等中文，列表序列化直接 500

真源回填：只改库内存量值；不在读侧做兼容映射。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

# status：中文 / 旧同义词 → DemandStatus（销售订单与需求共用）
STATUS_MAP = {
    "草稿": "DRAFT",
    "draft": "DRAFT",
    "待审核": "PENDING_REVIEW",
    "待审批": "PENDING_REVIEW",
    "已提交": "PENDING_REVIEW",
    "PENDING": "PENDING_REVIEW",
    "pending": "PENDING_REVIEW",
    "pending_review": "PENDING_REVIEW",
    "已审核": "AUDITED",
    "审核通过": "AUDITED",
    "已通过": "AUDITED",
    "已驳回": "REJECTED",
    "已确认": "CONFIRMED",
    "已取消": "CANCELLED",
    "cancelled": "CANCELLED",
    "已关闭": "CLOSED",
    "closed": "CLOSED",
    "已完成": "COMPLETED",
    "completed": "COMPLETED",
}

# review_status：中文 / 旧同义词 → ReviewStatus
REVIEW_STATUS_MAP = {
    "待审核": "PENDING",
    "待审批": "PENDING",
    "PENDING_REVIEW": "PENDING",
    "pending_review": "PENDING",
    "审核通过": "APPROVED",
    "通过": "APPROVED",
    "已通过": "APPROVED",
    "已审核": "APPROVED",
    "审核驳回": "REJECTED",
    "驳回": "REJECTED",
}

_TABLES = (
    "apps_kuaizhizao_sales_orders",
    "apps_kuaizhizao_demands",
)


def _case_sql(column: str, mapping: dict[str, str]) -> str:
    return " ".join(
        f"WHEN \"{column}\" = '{src}' THEN '{dst}'" for src, dst in mapping.items()
    )


def _in_list(mapping: dict[str, str]) -> str:
    return ", ".join(repr(k) for k in mapping)


async def upgrade(db: BaseDBAsyncClient) -> str:
    status_cases = _case_sql("status", STATUS_MAP)
    review_cases = _case_sql("review_status", REVIEW_STATUS_MAP)
    status_in = _in_list(STATUS_MAP)
    review_in = _in_list(REVIEW_STATUS_MAP)

    blocks: list[str] = []
    for table in _TABLES:
        blocks.append(
            f"""
            IF to_regclass('public.{table}') IS NOT NULL THEN
                UPDATE {table}
                SET status = CASE {status_cases} ELSE status END
                WHERE status IN ({status_in});

                UPDATE {table}
                SET review_status = CASE {review_cases} ELSE review_status END
                WHERE review_status IN ({review_in});
            END IF;
            """
        )

    return f"""
        DO $$
        BEGIN
{''.join(blocks)}
        END$$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    # 存量中文→枚举为纠偏，不可安全逆转（英文枚举可能本就合法）
    return ""
