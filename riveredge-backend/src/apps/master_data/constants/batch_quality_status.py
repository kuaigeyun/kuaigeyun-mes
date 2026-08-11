"""物料批次库存质量态（唯一契约）。"""

QUALIFIED = "qualified"
PENDING_QC = "pending_qc"
QUARANTINE = "quarantine"
UNQUALIFIED = "unqualified"

BATCH_QUALITY_STATUS_CHOICES = (
    (QUALIFIED, "质量放行"),
    (PENDING_QC, "待检"),
    (QUARANTINE, "隔离"),
    (UNQUALIFIED, "不合格未处置"),
)

SALES_ELIGIBLE_STATUSES = frozenset({QUALIFIED})

ALL_BATCH_QUALITY_STATUSES = frozenset(
    {QUALIFIED, PENDING_QC, QUARANTINE, UNQUALIFIED}
)
