#!/usr/bin/env python3
"""Wire batch3 document pages with help view + DOCUMENT_LIST_HELP_KEYS."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"

# (path relative to src, DOCUMENT_LIST_HELP_KEYS property name)
DOC_WIRE: list[tuple[str, str]] = [
    # kuaizhizao batch3
    ("apps/kuaizhizao/pages/warehouse-management/outbound/index.tsx", "salesDelivery"),
    ("apps/kuaizhizao/pages/sales-management/sales-order-changes/index.tsx", "salesOrderChange"),
    ("apps/kuaizhizao/pages/sales-management/sales-reviews/index.tsx", "salesReview"),
    ("apps/kuaizhizao/pages/purchase-management/purchase-order-changes/index.tsx", "purchaseOrderChange"),
    ("apps/kuaizhizao/pages/warehouse-management/inbound/index.tsx", "purchaseReceipt"),
    ("apps/kuaizhizao/pages/plan-management/demand-computation/index.tsx", "demandComputation"),
    ("apps/kuaizhizao/pages/plan-management/demand-management/index.tsx", "demandManagement"),
    ("apps/kuaizhizao/pages/quality-management/incoming-inspection/index.tsx", "incomingInspection"),
    ("apps/kuaizhizao/pages/quality-management/finished-goods-inspection/index.tsx", "finishedGoodsInspection"),
    ("apps/kuaizhizao/pages/quality-management/process-inspection/index.tsx", "processInspection"),
    ("apps/kuaizhizao/pages/quality-management/oqc-inspection/index.tsx", "oqcInspection"),
    ("apps/kuaizhizao/pages/quality-management/fai-orders/index.tsx", "faiOrder"),
    ("apps/kuaizhizao/pages/production-execution/outsource-work-orders/index.tsx", "outsourceWorkOrder"),
    ("apps/kuaizhizao/pages/production-execution/outsource-orders/index.tsx", "outsourceOrder"),
    ("apps/kuaizhizao/pages/production-execution/rework-orders/index.tsx", "reworkOrder"),
    ("apps/kuaizhizao/pages/production-execution/reporting/index.tsx", "reporting"),
    ("apps/kuaizhizao/pages/warehouse-management/stocktaking/index.tsx", "stocktaking"),
    ("apps/kuaizhizao/pages/warehouse-management/inventory-transfer/index.tsx", "inventoryTransfer"),
    ("apps/kuaizhizao/pages/warehouse-management/other-inbound/index.tsx", "otherInbound"),
    ("apps/kuaizhizao/pages/warehouse-management/other-outbound/index.tsx", "otherOutbound"),
    ("apps/kuaizhizao/pages/warehouse-management/material-borrows/index.tsx", "materialBorrow"),
    ("apps/kuaizhizao/pages/warehouse-management/material-returns/index.tsx", "materialReturn"),
    ("apps/kuaizhizao/pages/warehouse-management/delivery-notes/index.tsx", "deliveryNote"),
    # equipment
    ("apps/kuaizhizao/pages/equipment-management/equipment-repairs/index.tsx", "equipmentRepairs"),
    ("apps/kuaizhizao/pages/equipment-management/equipment-faults/index.tsx", "equipmentFaults"),
    ("apps/kuaizhizao/pages/equipment-management/equipment-maintenances/index.tsx", "equipmentMaintenances"),
    ("apps/kuaizhizao/pages/equipment-management/equipment-calibrations/index.tsx", "equipmentCalibrations"),
    ("apps/kuaizhizao/pages/equipment-management/equipment-scrap/index.tsx", "equipmentScrap"),
    ("apps/kuaizhizao/pages/equipment-management/equipment-transfers/index.tsx", "equipmentTransfers"),
    ("apps/kuaizhizao/pages/equipment-management/equipment-status/index.tsx", "equipmentStatus"),
    ("apps/kuaizhizao/pages/equipment-management/maintenance-plans/index.tsx", "maintenancePlans"),
    ("apps/kuaizhizao/pages/equipment-management/maintenance-executions/index.tsx", "maintenanceExecutions"),
    ("apps/kuaizhizao/pages/equipment-management/maintenance-reminders/index.tsx", "maintenanceReminders"),
    ("apps/kuaizhizao/pages/equipment-management/maintenance-plan-calendar/index.tsx", "maintenancePlanCalendar"),
    ("apps/kuaizhizao/pages/equipment-management/spot-checks/index.tsx", "spotChecks"),
    ("apps/kuaizhizao/pages/equipment-management/route-patrols/index.tsx", "routePatrols"),
    ("apps/kuaizhizao/pages/equipment-management/spare-part-requisitions/index.tsx", "sparePartRequisitions"),
    ("apps/kuaizhizao/pages/equipment-management/spare-parts/index.tsx", "spareParts"),
    ("apps/kuaizhizao/pages/equipment-management/maintenance-schemes/index.tsx", "maintenanceSchemes"),
    ("apps/kuaizhizao/pages/equipment-management/maintenance-items/index.tsx", "maintenanceItems"),
    ("apps/kuaizhizao/pages/equipment-management/inspection-schemes/index.tsx", "inspectionSchemes"),
    ("apps/kuaizhizao/pages/equipment-management/inspection-items/index.tsx", "inspectionItems"),
    ("apps/kuaizhizao/pages/equipment-management/patrol-routes/index.tsx", "patrolRoutes"),
    ("apps/kuaizhizao/pages/equipment-management/mold-repairs/index.tsx", "moldRepairs"),
    ("apps/kuaizhizao/pages/equipment-management/mold-maintenances/index.tsx", "moldMaintenances"),
    ("apps/kuaizhizao/pages/equipment-management/mold-calibrations/index.tsx", "moldCalibrations"),
    ("apps/kuaizhizao/pages/equipment-management/mold-borrows/index.tsx", "moldBorrows"),
    ("apps/kuaizhizao/pages/equipment-management/mold-returns/index.tsx", "moldReturns"),
    ("apps/kuaizhizao/pages/equipment-management/mold-scrap-applications/index.tsx", "moldScrapApplications"),
    ("apps/kuaizhizao/pages/equipment-management/mold-trials/index.tsx", "moldTrials"),
    ("apps/kuaizhizao/pages/equipment-management/mold-maintenance-schemes/index.tsx", "moldMaintenanceSchemes"),
    ("apps/kuaizhizao/pages/equipment-management/mold-maintenance-items/index.tsx", "moldMaintenanceItems"),
    ("apps/kuaizhizao/pages/equipment-management/mold-repair-schemes/index.tsx", "moldRepairSchemes"),
    ("apps/kuaizhizao/pages/equipment-management/mold-repair-items/index.tsx", "moldRepairItems"),
    ("apps/kuaizhizao/pages/equipment-management/tool-repairs/index.tsx", "toolRepairs"),
    ("apps/kuaizhizao/pages/equipment-management/tool-maintenances/index.tsx", "toolMaintenances"),
    ("apps/kuaizhizao/pages/equipment-management/tool-calibrations/index.tsx", "toolCalibrations"),
    ("apps/kuaizhizao/pages/equipment-management/tool-borrows/index.tsx", "toolBorrows"),
    ("apps/kuaizhizao/pages/equipment-management/tool-returns/index.tsx", "toolReturns"),
    ("apps/kuaizhizao/pages/equipment-management/tool-scrap-applications/index.tsx", "toolScrapApplications"),
    ("apps/kuaizhizao/pages/equipment-management/tool-maintenance-schemes/index.tsx", "toolMaintenanceSchemes"),
    ("apps/kuaizhizao/pages/equipment-management/tool-maintenance-items/index.tsx", "toolMaintenanceItems"),
    ("apps/kuaizhizao/pages/equipment-management/tool-repair-schemes/index.tsx", "toolRepairSchemes"),
    ("apps/kuaizhizao/pages/equipment-management/tool-repair-items/index.tsx", "toolRepairItems"),
    # kuaicaiwu
    ("apps/kuaicaiwu/pages/finance-management/receipts/index.tsx", "receipt"),
    ("apps/kuaicaiwu/pages/finance-management/payments/index.tsx", "payment"),
    ("apps/kuaicaiwu/pages/finance-management/receivables/index.tsx", "receivable"),
    ("apps/kuaicaiwu/pages/finance-management/payables/index.tsx", "payable"),
    ("apps/kuaicaiwu/pages/finance-management/sales-invoices/index.tsx", "salesInvoice"),
    ("apps/kuaicaiwu/pages/finance-management/purchase-invoices/index.tsx", "purchaseInvoice"),
    ("apps/kuaicaiwu/pages/finance-management/settlement/index.tsx", "settlement"),
    ("apps/kuaicaiwu/pages/finance-management/price-settlement/index.tsx", "priceSettlement"),
    ("apps/kuaicaiwu/pages/gl-management/vouchers/index.tsx", "voucher"),
    ("apps/kuaicaiwu/pages/finance-management/prepayments/index.tsx", "prepayment"),
    ("apps/kuaicaiwu/pages/finance-management/notes-receivable/index.tsx", "notesReceivable"),
    ("apps/kuaicaiwu/pages/finance-management/notes-payable/index.tsx", "notesPayable"),
    ("apps/kuaicaiwu/pages/finance-management/bank-accounts/index.tsx", "bankAccount"),
    ("apps/kuaicaiwu/pages/finance-management/document-reconciliation/index.tsx", "documentReconciliation"),
    ("apps/kuaicaiwu/pages/gl-management/opening-balances/index.tsx", "openingBalance"),
    ("apps/kuaicaiwu/pages/gl-management/period-close/index.tsx", "periodClose"),
]

LIST_WIRE: list[tuple[str, str]] = [
    ("apps/kuaizhizao/pages/purchase-management/arrival-warnings/index.tsx", "kuaizhizao.purchaseArrivalWarnings"),
    ("apps/kuaizhizao/pages/sales-management/customer-pool/index.tsx", "kuaizhizao.customerPool"),
    ("apps/kuaizhizao/pages/sales-management/customer-follow-ups/index.tsx", "kuaizhizao.customerFollowUps"),
    ("apps/kuaizhizao/pages/warehouse-management/inventory/index.tsx", "kuaizhizao.inventory"),
    ("apps/kuaizhizao/pages/warehouse-management/inventory-alert/index.tsx", "kuaizhizao.inventoryAlert"),
    ("apps/kuaizhizao/pages/equipment-management/equipment/index.tsx", "kuaizhizao.equipmentLedger"),
    ("apps/kuaizhizao/pages/equipment-management/molds/index.tsx", "kuaizhizao.moldsLedger"),
    ("apps/kuaizhizao/pages/equipment-management/tool-ledger/index.tsx", "kuaizhizao.toolsLedger"),
    ("apps/kuaicaiwu/pages/gl-management/chart-of-accounts/index.tsx", "kuaicaiwu.chartOfAccounts"),
    ("apps/kuaicaiwu/pages/gl-management/cashier/index.tsx", "kuaicaiwu.cashier"),
    ("apps/kuaicaiwu/pages/gl-management/books/index.tsx", "kuaicaiwu.books"),
    ("apps/kuaicaiwu/pages/gl-management/financial-statements/index.tsx", "kuaicaiwu.financialStatements"),
    ("apps/kuaicaiwu/pages/gl-management/settings/index.tsx", "kuaicaiwu.glSettings"),
    ("apps/kuaicaiwu/pages/tax-management/settings/index.tsx", "kuaicaiwu.taxSettings"),
    ("apps/kuaicaiwu/pages/tax-management/vat-ledger/index.tsx", "kuaicaiwu.vatLedger"),
    ("apps/kuaicaiwu/pages/tax-management/input-certification/index.tsx", "kuaicaiwu.inputCertification"),
    ("apps/kuaicaiwu/pages/cost-management/standard-costs/index.tsx", "kuaicaiwu.standardCosts"),
    ("apps/kuaicaiwu/pages/cost-management/cost-calculations/index.tsx", "kuaicaiwu.costCalculations"),
    ("apps/kuaicaiwu/pages/management-analysis/margin-report/index.tsx", "kuaicaiwu.marginReport"),
]


def compute_import_path(file_path: Path) -> str:
    depth = len(file_path.relative_to(SRC).parts) - 1
    return f"import {{ buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS }} from '{'../' * depth}components/page-help-wiki';"


def compute_list_import_path(file_path: Path) -> str:
    depth = len(file_path.relative_to(SRC).parts) - 1
    return f"import {{ buildListPageHelpViewConfig }} from '{'../' * depth}components/page-help-wiki';"


def _last_import_insert_index(lines: list[str]) -> int:
    """Insert after the final complete import/export statement (handles multiline imports)."""
    insert_at = 0
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith(("import ", "export ")):
            j = i
            while j < len(lines) and " from " not in lines[j]:
                j += 1
            if j < len(lines):
                insert_at = j + 1
            i = j + 1
            continue
        i += 1
    return insert_at


def ensure_import(text: str, import_line: str, marker: str) -> str:
    if marker in text:
        return text
    lines = text.splitlines(keepends=True)
    lines.insert(_last_import_insert_index(lines), import_line + "\n")
    return "".join(lines)


def patch_view_types_doc(text: str, key_prop: str) -> tuple[str, bool]:
    help_expr = f"buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.{key_prop})"
    if help_expr in text:
        return text, False

    help_line = f"\n          helpViewConfig={{{help_expr}}}"

    view_types_match = re.search(r"viewTypes=\{(\[[^\]]+\])\}", text)
    if view_types_match:
        raw = view_types_match.group(1)
        inner = raw[1:-1].strip()
        if "'help'" in raw or '"help"' in raw:
            if "helpViewConfig" not in text:
                text = text.replace(view_types_match.group(0), view_types_match.group(0) + help_line, 1)
                return text, True
            return text, False
        new_view = f"viewTypes={{[{inner}, 'help']}}{help_line}"
        text = text.replace(view_types_match.group(0), new_view, 1)
        return text, True

    unitable_match = re.search(r"(<UniTable[^\n>]*\n(?:[^\n]*\n)*?\s+(?:columnPersistenceId|headerTitle|rowKey)=[^\n]+\n)", text)
    if not unitable_match:
        unitable_match = re.search(r"(<UniTable<[^>]+>\n)", text)
    if not unitable_match:
        return text, False

    insert = f"        viewTypes={{['table', 'help']}}{help_line}\n"
    pos = unitable_match.end()
    return text[:pos] + insert + text[pos:], True


def patch_view_types_list(text: str, page_key: str) -> tuple[str, bool]:
    help_expr = f"buildListPageHelpViewConfig('{page_key}')"
    if help_expr in text:
        return text, False
    help_line = f"\n          helpViewConfig={{{help_expr}}}"
    view_types_match = re.search(r"viewTypes=\{(\[[^\]]+\])\}", text)
    if view_types_match:
        raw = view_types_match.group(1)
        inner = raw[1:-1].strip()
        if "'help'" not in raw and '"help"' not in raw:
            new_view = f"viewTypes={{[{inner}, 'help']}}{help_line}"
            text = text.replace(view_types_match.group(0), new_view, 1)
            return text, True
        if "helpViewConfig" not in text:
            text = text.replace(view_types_match.group(0), view_types_match.group(0) + help_line, 1)
            return text, True
        return text, False
    unitable_match = re.search(r"(<UniTable[^\n>]*\n(?:[^\n]*\n)*?\s+columnPersistenceId=[^\n]+\n)", text)
    if not unitable_match:
        unitable_match = re.search(r"(<UniTable<[^>]+>\n)", text)
    if not unitable_match:
        return text, False
    insert = f"        viewTypes={{['table', 'help']}}{help_line}\n"
    pos = unitable_match.end()
    return text[:pos] + insert + text[pos:], True


def wire_doc(rel: str, key_prop: str) -> bool:
    path = SRC / rel
    if not path.exists():
        print(f"SKIP missing {rel}")
        return False
    text = path.read_text(encoding="utf-8")
    import_line = compute_import_path(path)
    new_text = ensure_import(text, import_line, "buildDocumentListHelpViewConfig")
    new_text, changed = patch_view_types_doc(new_text, key_prop)
    if new_text != text:
        path.write_text(new_text, encoding="utf-8")
        print(f"WIRED DOC {rel} -> {key_prop}")
        return True
    print(f"UNCHANGED DOC {rel}")
    return False


def wire_list(rel: str, page_key: str) -> bool:
    path = SRC / rel
    if not path.exists():
        print(f"SKIP missing {rel}")
        return False
    text = path.read_text(encoding="utf-8")
    import_line = compute_list_import_path(path)
    new_text = ensure_import(text, import_line, "buildListPageHelpViewConfig")
    new_text, changed = patch_view_types_list(new_text, page_key)
    if new_text != text:
        path.write_text(new_text, encoding="utf-8")
        print(f"WIRED LIST {rel} -> {page_key}")
        return True
    print(f"UNCHANGED LIST {rel}")
    return False


def main() -> None:
    doc_n = sum(1 for rel, key in DOC_WIRE if wire_doc(rel, key))
    list_n = sum(1 for rel, key in LIST_WIRE if wire_list(rel, key))
    print(f"Done. Documents {doc_n}/{len(DOC_WIRE)}, Lists {list_n}/{len(LIST_WIRE)}")


if __name__ == "__main__":
    main()
