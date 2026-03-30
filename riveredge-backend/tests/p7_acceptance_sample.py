"""
P7 验收样例脚本（HTTP 版）

覆盖链路：
1) 销售开票 -> （可选）自动应收
2) 采购开票 -> （可选）自动应付
3) 核销建议（应收/应付）
4) 期末调汇（汇兑凭证候选）

用法示例：
python tests/p7_acceptance_sample.py \
  --base-url http://127.0.0.1:8000 \
  --api-prefix /apps/kuaicaiwu \
  --token <JWT> \
  --tenant-id 1 \
  --customer-id 1001 \
  --customer-name "测试客户A" \
  --supplier-id 2001 \
  --supplier-name "测试供应商A"
"""

from __future__ import annotations

import argparse
import asyncio
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any

import httpx


@dataclass
class AcceptanceContext:
    base_url: str
    api_prefix: str
    token: str
    tenant_id: int | None
    customer_id: int
    customer_name: str
    supplier_id: int
    supplier_name: str
    timeout_seconds: float


def _build_headers(ctx: AcceptanceContext) -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {ctx.token}",
        "Content-Type": "application/json",
    }
    if ctx.tenant_id is not None:
        headers["X-Tenant-ID"] = str(ctx.tenant_id)
    return headers


def _url(ctx: AcceptanceContext, path: str) -> str:
    return f"{ctx.base_url.rstrip('/')}{ctx.api_prefix.rstrip('/')}{path}"


async def _request(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    *,
    json_body: dict[str, Any] | None = None,
    params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    resp = await client.request(method, url, json=json_body, params=params)
    if resp.status_code >= 400:
        raise RuntimeError(f"{method} {url} failed: {resp.status_code} {resp.text}")
    if resp.status_code == 204:
        return {}
    return resp.json()


async def run_acceptance(ctx: AcceptanceContext) -> None:
    today = date.today().isoformat()
    tag = date.today().strftime("%Y%m%d")
    headers = _build_headers(ctx)
    timeout = httpx.Timeout(ctx.timeout_seconds)

    async with httpx.AsyncClient(headers=headers, timeout=timeout) as client:
        print("== P7 验收样例开始 ==")
        print(f"BaseURL: {ctx.base_url}  Prefix: {ctx.api_prefix}")

        # 0) 健康检查
        health = await _request(client, "GET", _url(ctx, "/health"))
        print(f"[OK] health: {health}")

        # 1) 销售开票（触发可选自动应收）
        sales_payload = {
            "sales_order_code": f"SO-{tag}-P7",
            "customer_id": ctx.customer_id,
            "customer_name": ctx.customer_name,
            "invoice_number": f"SINV-{tag}-01",
            "invoice_date": today,
            "invoice_type": "增值税专用发票",
            "tax_rate": "13",
            "invoice_amount": "1000.00",
            "tax_amount": "130.00",
            "total_amount": "1130.00",
            "notes": "P7 acceptance sample sales invoice",
        }
        sales_invoice = await _request(client, "POST", _url(ctx, "/sales-invoices"), json_body=sales_payload)
        print(
            "[OK] sales invoice:",
            {
                "id": sales_invoice.get("id"),
                "invoice_code": sales_invoice.get("invoice_code"),
                "receivable_id": sales_invoice.get("receivable_id"),
                "receivable_code": sales_invoice.get("receivable_code"),
            },
        )

        # 2) 采购开票（触发可选自动应付）
        purchase_payload = {
            "purchase_order_code": f"PO-{tag}-P7",
            "supplier_id": ctx.supplier_id,
            "supplier_name": ctx.supplier_name,
            "invoice_number": f"PINV-{tag}-01",
            "invoice_date": today,
            "invoice_type": "增值税专用发票",
            "tax_rate": "13",
            "invoice_amount": "800.00",
            "tax_amount": "104.00",
            "total_amount": "904.00",
            "notes": "P7 acceptance sample purchase invoice",
        }
        purchase_invoice = await _request(
            client,
            "POST",
            _url(ctx, "/purchase-invoices"),
            json_body=purchase_payload,
        )
        print(
            "[OK] purchase invoice:",
            {
                "id": purchase_invoice.get("id"),
                "invoice_code": purchase_invoice.get("invoice_code"),
                "payable_id": purchase_invoice.get("payable_id"),
                "payable_code": purchase_invoice.get("payable_code"),
            },
        )

        # 3) 核销建议（应收 / 应付）
        recv_suggestions = await _request(
            client,
            "GET",
            _url(ctx, "/settlement/suggestions/receivable"),
            params={"customer_id": ctx.customer_id, "limit": 5},
        )
        pay_suggestions = await _request(
            client,
            "GET",
            _url(ctx, "/settlement/suggestions/payable"),
            params={"supplier_id": ctx.supplier_id, "limit": 5},
        )
        print(
            "[OK] suggestions:",
            {
                "receivable_total": recv_suggestions.get("total"),
                "payable_total": pay_suggestions.get("total"),
            },
        )

        # 4) 期末调汇（生成候选）
        revaluation = await _request(
            client,
            "POST",
            _url(ctx, "/settlement/fx-revaluation/period-end"),
            params={
                "period": date.today().strftime("%Y-%m"),
                "currency": "USD",
                "book_rate": str(Decimal("7.20")),
                "period_end_rate": str(Decimal("7.25")),
                "doc_type": "all",
            },
        )
        print(
            "[OK] period-end fx revaluation:",
            {
                "voucher_code": revaluation.get("voucher_code"),
                "line_count": revaluation.get("line_count"),
                "total_fx_gain": revaluation.get("total_fx_gain"),
                "total_fx_loss": revaluation.get("total_fx_loss"),
            },
        )
        print("== P7 验收样例结束 ==")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="P7 验收样例脚本")
    parser.add_argument("--base-url", required=True, help="后端基础地址，例如 http://127.0.0.1:8000")
    parser.add_argument("--api-prefix", default="/apps/kuaicaiwu", help="Kuaicaiwu API 前缀")
    parser.add_argument("--token", required=True, help="Bearer Token")
    parser.add_argument("--tenant-id", type=int, default=None, help="可选 X-Tenant-ID")
    parser.add_argument("--customer-id", type=int, required=True, help="样例客户ID")
    parser.add_argument("--customer-name", required=True, help="样例客户名称")
    parser.add_argument("--supplier-id", type=int, required=True, help="样例供应商ID")
    parser.add_argument("--supplier-name", required=True, help="样例供应商名称")
    parser.add_argument("--timeout-seconds", type=float, default=30.0, help="HTTP 超时时间")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    ctx = AcceptanceContext(
        base_url=args.base_url,
        api_prefix=args.api_prefix,
        token=args.token,
        tenant_id=args.tenant_id,
        customer_id=args.customer_id,
        customer_name=args.customer_name,
        supplier_id=args.supplier_id,
        supplier_name=args.supplier_name,
        timeout_seconds=args.timeout_seconds,
    )
    asyncio.run(run_acceptance(ctx))


if __name__ == "__main__":
    main()
