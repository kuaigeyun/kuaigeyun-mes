"""
凭证 CSV 导出服务
"""

from __future__ import annotations

import csv
import io
from typing import List, Optional

from apps.kuaicaiwu.models.voucher import Voucher
from apps.kuaicaiwu.models.voucher_line import VoucherLine


class VoucherExportService:
    async def export_vouchers_csv(
        self,
        tenant_id: int,
        *,
        voucher_ids: Optional[List[int]] = None,
        status: Optional[str] = None,
    ) -> str:
        q = Voucher.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if voucher_ids:
            q = q.filter(id__in=voucher_ids)
        if status:
            q = q.filter(status=status)
        vouchers = await q.order_by("voucher_date", "voucher_code").all()

        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([
            "voucher_code",
            "voucher_date",
            "status",
            "line_no",
            "account_code",
            "account_name",
            "summary",
            "debit_amount",
            "credit_amount",
        ])

        for voucher in vouchers:
            lines = await VoucherLine.filter(
                tenant_id=tenant_id, voucher_id=voucher.id
            ).order_by("line_no").all()
            for line in lines:
                writer.writerow([
                    voucher.voucher_code,
                    voucher.voucher_date.isoformat(),
                    voucher.status,
                    line.line_no,
                    line.account_code,
                    line.account_name,
                    line.summary or "",
                    float(line.debit_amount or 0),
                    float(line.credit_amount or 0),
                ])
        return buf.getvalue()
