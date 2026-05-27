"""好力 GO — 模具单据简易审核状态（试模/维保/外协维保/外协完修）。

不接入平台审批流或业务蓝图 audit-required；仅 sheet_status + 各单据路由上的 approve/reject。
"""

SHEET_STATUS_PENDING = "待审核"
SHEET_STATUS_APPROVED = "已通过"
SHEET_STATUS_REJECTED = "已驳回"

SHEET_AUDIT_STATUS_SET = frozenset(
    {
        SHEET_STATUS_PENDING,
        SHEET_STATUS_APPROVED,
        SHEET_STATUS_REJECTED,
    }
)
