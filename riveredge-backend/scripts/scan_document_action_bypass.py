#!/usr/bin/env python3
"""扫描单据动作旁路：页面本地 can* 门控、service 内散落 status 判断。"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
FRONTEND = ROOT.parent / "riveredge-frontend" / "src"

# 报价单试点：前端页面禁止本地 can* 业务门控
FE_QUOTATION_PAGE = FRONTEND / "apps/kuaizhizao/pages/sales-management/quotations/index.tsx"
FE_SALES_ORDER_PAGE = FRONTEND / "apps/kuaizhizao/pages/sales-management/sales-orders/index.tsx"
FE_SALES_ORDER_CHANGE_PAGE = FRONTEND / "apps/kuaizhizao/pages/sales-management/sales-order-changes/index.tsx"
FE_SALES_CONTRACT_PAGE = FRONTEND / "apps/kuaizhizao/pages/sales-management/sales-contracts/index.tsx"
FE_SALES_FORECAST_PAGE = FRONTEND / "apps/kuaizhizao/pages/sales-management/sales-forecasts/index.tsx"
FE_SHIPMENT_NOTICE_PAGE = FRONTEND / "apps/kuaizhizao/pages/sales-management/shipment-notices/index.tsx"
FE_SALES_RETURN_PAGE = FRONTEND / "apps/kuaizhizao/pages/sales-management/sales-returns/index.tsx"
FE_CAN_PATTERNS = [
    re.compile(r"function\s+can\w*Quotation\s*\("),
    re.compile(r"function\s+canConvertQuotation"),
    re.compile(r"function\s+canDeleteQuotation"),
]
FE_SALES_ORDER_CAN_PATTERNS = [
    re.compile(r"function\s+canPushDownSalesOrder\s*\("),
    re.compile(r"canWithdrawSalesOrderRecord\("),
    re.compile(r"canUnapproveSalesOrderRecord\("),
]
FE_ORDER_CHANGE_CAN_PATTERNS = [
    re.compile(r"isOrderChangeDraft\("),
]
FE_SALES_CONTRACT_CAN_PATTERNS = [
    re.compile(r"function\s+canWithdrawContract\s*\("),
    re.compile(r"function\s+canPrintContract\s*\("),
    re.compile(r"function\s+canRevokeContractApproval\s*\("),
]
FE_SALES_FORECAST_CAN_PATTERNS = [
    re.compile(r"const canEdit = \['草稿'"),
    re.compile(r"getSalesForecastPushComputationUiState"),
    re.compile(r"function\s+isForecastComputationPushed"),
]
FE_SHIPMENT_NOTICE_CAN_PATTERNS = [
    re.compile(r"record\.status === '待发货'"),
    re.compile(r"record\.status === '已通知'"),
]
FE_SALES_RETURN_CAN_PATTERNS = [
    re.compile(r"record\.status === '待退货'"),
    re.compile(r"record\.status === '草稿'"),
    re.compile(r"record\.status === '已退货'"),
    re.compile(r"detail\.status !== '待退货'"),
]

# service 内 quotation.status 用于动作门禁（白名单：policy 模块）
BE_POLICY_DIR = SRC / "apps/kuaizhizao/services/document_action_policy"
BE_QUOTATION_SERVICE = SRC / "apps/kuaizhizao/services/quotation_service.py"
BE_SALES_ORDER_SERVICE = SRC / "apps/kuaizhizao/services/sales_order_service.py"
BE_SALES_ORDER_CHANGE_SERVICE = SRC / "apps/kuaizhizao/services/sales_order_change_service.py"
BE_SALES_CONTRACT_SERVICE = SRC / "apps/kuaizhizao/services/sales_contract_service.py"
BE_SALES_SERVICE = SRC / "apps/kuaizhizao/services/sales_service.py"
BE_SHIPMENT_NOTICE_SERVICE = SRC / "apps/kuaizhizao/services/shipment_notice_service.py"
BE_WAREHOUSE_SERVICE = SRC / "apps/kuaizhizao/services/warehouse_service.py"
BE_STATUS_GATE = re.compile(
    r"quotation\.status\s*==|quotation\.status\s*!=|\(quotation\.status"
)
BE_SALES_ORDER_STATUS_GATE = re.compile(
    r"order\.status\s*==|order\.status\s*!=|self\._is_audited\(order\.status\)"
)


def _severity(level: str, msg: str) -> tuple[str, str]:
    return level, msg


def scan_frontend_quotation() -> list[tuple[str, str]]:
    findings: list[tuple[str, str]] = []
    if not FE_QUOTATION_PAGE.is_file():
        return findings
    text = FE_QUOTATION_PAGE.read_text(encoding="utf-8")
    for pat in FE_CAN_PATTERNS:
        if pat.search(text):
            findings.append(
                _severity(
                    "warn",
                    f"{FE_QUOTATION_PAGE.relative_to(ROOT.parent)}: 仍存在本地 can* 业务门控 {pat.pattern}",
                )
            )
    return findings


def scan_quotation_service_status_gates() -> list[tuple[str, str]]:
    """仅扫描已迁移为 policy 的动作方法，审核流 submit/approve 等不在此列。"""
    findings: list[tuple[str, str]] = []
    if not BE_QUOTATION_SERVICE.is_file():
        return findings
    text = BE_QUOTATION_SERVICE.read_text(encoding="utf-8")
    policy_actions = (
        "delete_quotation",
        "confirm_customer_quotation",
        "cancel_customer_confirm_quotation",
        "convert_to_sales_order",
        "reopen_quotation_after_reject",
        "revoke_push_quotation",
        "create_quotation_revision",
    )
    current_fn: str | None = None
    for i, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        if stripped.startswith("async def ") or stripped.startswith("def "):
            name = stripped.split("(")[0].replace("async def ", "").replace("def ", "").strip()
            current_fn = name if name in policy_actions else None
        if current_fn and BE_STATUS_GATE.search(line):
            if "assert_quotation_capability" in line or "prev_status" in line:
                continue
            findings.append(
                _severity(
                    "high",
                    f"{BE_QUOTATION_SERVICE.relative_to(ROOT)}:{i} "
                    f"({current_fn}): quotation.status 旁路门禁，应改用 assert_quotation_capability",
                )
            )
    return findings


def scan_frontend_sales_order() -> list[tuple[str, str]]:
    findings: list[tuple[str, str]] = []
    if not FE_SALES_ORDER_PAGE.is_file():
        return findings
    text = FE_SALES_ORDER_PAGE.read_text(encoding="utf-8")
    for pat in FE_SALES_ORDER_CAN_PATTERNS:
        if pat.search(text):
            findings.append(
                _severity(
                    "warn",
                    f"{FE_SALES_ORDER_PAGE.relative_to(ROOT.parent)}: 仍存在本地 can* 业务门控 {pat.pattern}",
                )
            )
    return findings


def scan_sales_order_service_status_gates() -> list[tuple[str, str]]:
    findings: list[tuple[str, str]] = []
    if not BE_SALES_ORDER_SERVICE.is_file():
        return findings
    text = BE_SALES_ORDER_SERVICE.read_text(encoding="utf-8")
    policy_actions = (
        "delete_sales_order",
        "update_sales_order",
        "close_sales_order",
        "withdraw_sales_order",
        "unapprove_sales_order",
        "push_sales_order_to_computation",
        "withdraw_sales_order_from_computation",
        "push_sales_order_to_work_order",
        "push_sales_order_to_shipment_notice",
        "push_sales_order_to_delivery",
        "push_sales_order_to_invoice",
    )
    current_fn: str | None = None
    for i, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        if stripped.startswith("async def ") or stripped.startswith("def "):
            name = stripped.split("(")[0].replace("async def ", "").replace("def ", "").strip()
            current_fn = name if name in policy_actions else None
        if current_fn and BE_SALES_ORDER_STATUS_GATE.search(line):
            if "assert_sales_order_capability" in line or "_assert_sales_order_capability" in line:
                continue
            if current_fn in ("unapprove_sales_order",) and "_is_strictly_audited" in line:
                continue
            findings.append(
                _severity(
                    "high",
                    f"{BE_SALES_ORDER_SERVICE.relative_to(ROOT)}:{i} "
                    f"({current_fn}): order.status 旁路门禁，应改用 assert_sales_order_capability",
                )
            )
    return findings


def scan_frontend_order_change() -> list[tuple[str, str]]:
    findings: list[tuple[str, str]] = []
    if not FE_SALES_ORDER_CHANGE_PAGE.is_file():
        return findings
    text = FE_SALES_ORDER_CHANGE_PAGE.read_text(encoding="utf-8")
    for pat in FE_ORDER_CHANGE_CAN_PATTERNS:
        if pat.search(text):
            findings.append(
                _severity(
                    "warn",
                    f"{FE_SALES_ORDER_CHANGE_PAGE.relative_to(ROOT.parent)}: 仍存在本地 can* 业务门控 {pat.pattern}",
                )
            )
    return findings


def scan_frontend_sales_contract() -> list[tuple[str, str]]:
    findings: list[tuple[str, str]] = []
    if not FE_SALES_CONTRACT_PAGE.is_file():
        return findings
    text = FE_SALES_CONTRACT_PAGE.read_text(encoding="utf-8")
    for pat in FE_SALES_CONTRACT_CAN_PATTERNS:
        if pat.search(text):
            findings.append(
                _severity(
                    "warn",
                    f"{FE_SALES_CONTRACT_PAGE.relative_to(ROOT.parent)}: 仍存在本地 can* 业务门控 {pat.pattern}",
                )
            )
    return findings


def scan_sales_order_change_service_status_gates() -> list[tuple[str, str]]:
    findings: list[tuple[str, str]] = []
    if not BE_SALES_ORDER_CHANGE_SERVICE.is_file():
        return findings
    text = BE_SALES_ORDER_CHANGE_SERVICE.read_text(encoding="utf-8")
    gate = re.compile(r"^\s*if\b.*(doc\.status|is_draft_status\(doc\.status\))")
    policy_actions = (
        "update_change_order",
        "delete_change_order",
        "submit",
        "withdraw",
        "apply",
    )
    current_fn: str | None = None
    for i, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        if stripped.startswith("async def ") or stripped.startswith("def "):
            name = stripped.split("(")[0].replace("async def ", "").replace("def ", "").strip()
            current_fn = name if name in policy_actions else None
        if current_fn and gate.search(line):
            if "assert_sales_order_change_capability" in line:
                continue
            if "APPLIED" in line:
                continue  # apply 幂等早退，非业务门禁
            findings.append(
                _severity(
                    "high",
                    f"{BE_SALES_ORDER_CHANGE_SERVICE.relative_to(ROOT)}:{i} "
                    f"({current_fn}): status 旁路门禁，应改用 assert_sales_order_change_capability",
                )
            )
    return findings


def scan_sales_contract_service_status_gates() -> list[tuple[str, str]]:
    findings: list[tuple[str, str]] = []
    if not BE_SALES_CONTRACT_SERVICE.is_file():
        return findings
    text = BE_SALES_CONTRACT_SERVICE.read_text(encoding="utf-8")
    gate = re.compile(r"^\s*if\b.*contract\.status")
    policy_actions = (
        "update_contract",
        "delete_contract",
        "submit_contract",
        "approve_contract",
        "reject_contract",
        "withdraw_contract",
        "revoke_contract_approval",
        "close_contract",
        "convert_to_sales_order",
        "create_contract_change",
    )
    current_fn: str | None = None
    for i, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        if stripped.startswith("async def ") or stripped.startswith("def "):
            name = stripped.split("(")[0].replace("async def ", "").replace("def ", "").strip()
            current_fn = name if name in policy_actions else None
        if current_fn and gate.search(line):
            if "assert_sales_contract_capability" in line:
                continue
            findings.append(
                _severity(
                    "high",
                    f"{BE_SALES_CONTRACT_SERVICE.relative_to(ROOT)}:{i} "
                    f"({current_fn}): contract.status 旁路门禁，应改用 assert_sales_contract_capability",
                )
            )
    return findings


def scan_frontend_sales_forecast() -> list[tuple[str, str]]:
    findings: list[tuple[str, str]] = []
    if not FE_SALES_FORECAST_PAGE.is_file():
        return findings
    text = FE_SALES_FORECAST_PAGE.read_text(encoding="utf-8")
    for pat in FE_SALES_FORECAST_CAN_PATTERNS:
        if pat.search(text):
            findings.append(
                _severity(
                    "warn",
                    f"{FE_SALES_FORECAST_PAGE.relative_to(ROOT.parent)}: 仍存在本地 can* 业务门控 {pat.pattern}",
                )
            )
    return findings


def scan_sales_forecast_service_status_gates() -> list[tuple[str, str]]:
    findings: list[tuple[str, str]] = []
    if not BE_SALES_SERVICE.is_file():
        return findings
    text = BE_SALES_SERVICE.read_text(encoding="utf-8")
    gate = re.compile(
        r"^\s*if\b.*(forecast\.status|forecast_row\.status|forecast\.review_status|is_draft_status\(forecast)"
    )
    policy_actions = (
        "update_sales_forecast",
        "delete_sales_forecast",
        "approve_forecast",
        "withdraw_forecast_approval",
        "submit_forecast",
        "withdraw_forecast",
        "push_to_computation",
    )
    current_fn: str | None = None
    for i, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        if stripped.startswith("async def ") or stripped.startswith("def "):
            name = stripped.split("(")[0].replace("async def ", "").replace("def ", "").strip()
            current_fn = name if name in policy_actions else None
        if current_fn and gate.search(line):
            if "assert_sales_forecast_capability" in line:
                continue
            findings.append(
                _severity(
                    "high",
                    f"{BE_SALES_SERVICE.relative_to(ROOT)}:{i} "
                    f"({current_fn}): status 旁路门禁，应改用 assert_sales_forecast_capability",
                )
            )
    return findings


def scan_frontend_shipment_notice() -> list[tuple[str, str]]:
    findings: list[tuple[str, str]] = []
    if not FE_SHIPMENT_NOTICE_PAGE.is_file():
        return findings
    text = FE_SHIPMENT_NOTICE_PAGE.read_text(encoding="utf-8")
    for pat in FE_SHIPMENT_NOTICE_CAN_PATTERNS:
        if pat.search(text):
            findings.append(
                _severity(
                    "warn",
                    f"{FE_SHIPMENT_NOTICE_PAGE.relative_to(ROOT.parent)}: 仍存在本地 status 业务门控 {pat.pattern}",
                )
            )
    return findings


def scan_shipment_notice_service_status_gates() -> list[tuple[str, str]]:
    findings: list[tuple[str, str]] = []
    if not BE_SHIPMENT_NOTICE_SERVICE.is_file():
        return findings
    text = BE_SHIPMENT_NOTICE_SERVICE.read_text(encoding="utf-8")
    gate = re.compile(r"^\s*if\b.*notice\.status")
    policy_actions = (
        "update_shipment_notice",
        "delete_shipment_notice",
        "notify_warehouse",
        "withdraw_notice",
    )
    current_fn: str | None = None
    for i, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        if stripped.startswith("async def ") or stripped.startswith("def "):
            name = stripped.split("(")[0].replace("async def ", "").replace("def ", "").strip()
            current_fn = name if name in policy_actions else None
        if current_fn and gate.search(line):
            if "assert_shipment_notice_capability" in line:
                continue
            findings.append(
                _severity(
                    "high",
                    f"{BE_SHIPMENT_NOTICE_SERVICE.relative_to(ROOT)}:{i} "
                    f"({current_fn}): status 旁路门禁，应改用 assert_shipment_notice_capability",
                )
            )
    return findings


def scan_frontend_sales_return() -> list[tuple[str, str]]:
    findings: list[tuple[str, str]] = []
    if not FE_SALES_RETURN_PAGE.is_file():
        return findings
    text = FE_SALES_RETURN_PAGE.read_text(encoding="utf-8")
    for pat in FE_SALES_RETURN_CAN_PATTERNS:
        if pat.search(text):
            findings.append(
                _severity(
                    "warn",
                    f"{FE_SALES_RETURN_PAGE.relative_to(ROOT.parent)}: 仍存在本地 status 业务门控 {pat.pattern}",
                )
            )
    return findings


def scan_sales_return_service_status_gates() -> list[tuple[str, str]]:
    findings: list[tuple[str, str]] = []
    if not BE_WAREHOUSE_SERVICE.is_file():
        return findings
    text = BE_WAREHOUSE_SERVICE.read_text(encoding="utf-8")
    gate = re.compile(r"^\s*if\b.*return_obj\.status")
    policy_actions = (
        "update_sales_return",
        "delete_sales_return",
        "confirm_return",
        "withdraw_confirmation",
    )
    current_fn: str | None = None
    for i, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        if stripped.startswith("async def ") or stripped.startswith("def "):
            name = stripped.split("(")[0].replace("async def ", "").replace("def ", "").strip()
            current_fn = name if name in policy_actions else None
        if current_fn and gate.search(line):
            if "assert_sales_return_capability" in line:
                continue
            findings.append(
                _severity(
                    "high",
                    f"{BE_WAREHOUSE_SERVICE.relative_to(ROOT)}:{i} "
                    f"({current_fn}): status 旁路门禁，应改用 assert_sales_return_capability",
                )
            )
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description="Scan document action bypass patterns")
    parser.add_argument(
        "--fail-on",
        choices=("high", "warn", "none"),
        default="none",
        help="Exit 1 when findings at or above this severity exist",
    )
    args = parser.parse_args()

    findings = (
        scan_frontend_quotation()
        + scan_frontend_sales_order()
        + scan_frontend_order_change()
        + scan_frontend_sales_contract()
        + scan_frontend_sales_forecast()
        + scan_frontend_shipment_notice()
        + scan_frontend_sales_return()
        + scan_quotation_service_status_gates()
        + scan_sales_order_service_status_gates()
        + scan_sales_order_change_service_status_gates()
        + scan_sales_contract_service_status_gates()
        + scan_sales_forecast_service_status_gates()
        + scan_shipment_notice_service_status_gates()
        + scan_sales_return_service_status_gates()
    )

    order = {"high": 3, "warn": 2, "info": 1}
    for level, msg in findings:
        print(f"[{level.upper()}] {msg}")

    if not findings:
        print("No document action bypass findings.")
        return 0

    threshold = order.get(args.fail_on, 0)
    worst = max(order.get(l, 0) for l, _ in findings)
    if worst >= threshold and args.fail_on != "none":
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
