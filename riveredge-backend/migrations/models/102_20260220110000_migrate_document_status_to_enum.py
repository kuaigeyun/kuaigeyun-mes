"""
各单据 status/review_status 迁移到统一枚举

将采购订单、销售预测、采购申请的存量中文状态迁移为 DocumentStatus/ReviewStatus 枚举值。
兼容：部署后新数据已用枚举，此脚本处理存量数据。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

# status 映射：中文 -> 枚举
STATUS_MAP = {
    "草稿": "DRAFT",
    "待审核": "PENDING_REVIEW",
    "已审核": "AUDITED",
    "已驳回": "REJECTED",
    "已确认": "CONFIRMED",
    "已取消": "CANCELLED",
    "已通过": "AUDITED",
    "部分转单": "PARTIAL_CONVERTED",
    "全部转单": "FULL_CONVERTED",
}

# review_status 映射：中文 -> ReviewStatus
REVIEW_STATUS_MAP = {
    "待审核": "PENDING",
    "审核通过": "APPROVED",
    "审核驳回": "REJECTED",
    "通过": "APPROVED",
    "驳回": "REJECTED",
    "已通过": "APPROVED",
}


def _build_case_sql(column: str, mapping: dict, table: str) -> str:
    """构建 CASE WHEN 形式的 UPDATE 子句"""
    cases = []
    for zh, enum_val in mapping.items():
        cases.append(f"WHEN \"{column}\" = '{zh}' THEN '{enum_val}'")
    return " ".join(cases)


async def upgrade(db: BaseDBAsyncClient) -> str:
    statements = []

    # 采购订单
    status_cases = _build_case_sql("status", STATUS_MAP, "purchase_order")
    review_cases = _build_case_sql("review_status", REVIEW_STATUS_MAP, "purchase_order")
    if status_cases:
        statements.append(f"""
            UPDATE apps_kuaizhizao_purchase_orders
            SET status = CASE {status_cases} ELSE status END
            WHERE status IN ({', '.join(repr(k) for k in STATUS_MAP)});
        """)
    if review_cases:
        statements.append(f"""
            UPDATE apps_kuaizhizao_purchase_orders
            SET review_status = CASE {review_cases} ELSE review_status END
            WHERE review_status IN ({', '.join(repr(k) for k in REVIEW_STATUS_MAP)});
        """)

    # 销售预测
    if status_cases:
        statements.append(f"""
            UPDATE apps_kuaizhizao_sales_forecasts
            SET status = CASE {status_cases} ELSE status END
            WHERE status IN ({', '.join(repr(k) for k in STATUS_MAP)});
        """)
    if review_cases:
        statements.append(f"""
            UPDATE apps_kuaizhizao_sales_forecasts
            SET review_status = CASE {review_cases} ELSE review_status END
            WHERE review_status IN ({', '.join(repr(k) for k in REVIEW_STATUS_MAP)});
        """)

    # 采购申请
    req_status_map = {k: v for k, v in STATUS_MAP.items() if k in ("草稿", "待审核", "已驳回", "已通过", "部分转单", "全部转单")}
    req_status_cases = _build_case_sql("status", req_status_map, "purchase_requisition")
    if req_status_cases:
        statements.append(f"""
            UPDATE apps_kuaizhizao_purchase_requisitions
            SET status = CASE {req_status_cases} ELSE status END
            WHERE status IN ({', '.join(repr(k) for k in req_status_map)});
        """)
    if review_cases:
        statements.append(f"""
            UPDATE apps_kuaizhizao_purchase_requisitions
            SET review_status = CASE {review_cases} ELSE review_status END
            WHERE review_status IN ({', '.join(repr(k) for k in REVIEW_STATUS_MAP)});
        """)

    return "\n".join(s.strip() for s in statements if s.strip())


async def downgrade(db: BaseDBAsyncClient) -> str:
    # 反向映射
    REV_STATUS = {v: k for k, v in STATUS_MAP.items()}
    REV_REVIEW = {v: k for k, v in REVIEW_STATUS_MAP.items()}

    statements = []

    def _rev_case(column: str, mapping: dict) -> str:
        cases = []
        for enum_val, zh in mapping.items():
            cases.append(f"WHEN \"{column}\" = '{enum_val}' THEN '{zh}'")
        return " ".join(cases)

    rev_status = _rev_case("status", REV_STATUS)
    rev_review = _rev_case("review_status", REV_REVIEW)

    for table in ["apps_kuaizhizao_purchase_orders", "apps_kuaizhizao_sales_forecasts", "apps_kuaizhizao_purchase_requisitions"]:
        if rev_status:
            statements.append(f"""
                UPDATE {table}
                SET status = CASE {rev_status} ELSE status END
                WHERE status IN ({', '.join(repr(v) for v in REV_STATUS)});
            """)
        if rev_review:
            statements.append(f"""
                UPDATE {table}
                SET review_status = CASE {rev_review} ELSE review_status END
                WHERE review_status IN ({', '.join(repr(v) for v in REV_REVIEW)});
            """)

    return "\n".join(s.strip() for s in statements if s.strip())
