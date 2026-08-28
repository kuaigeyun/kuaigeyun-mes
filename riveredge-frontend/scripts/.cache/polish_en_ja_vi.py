from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2] / "src" / "locales"
LINE = re.compile(r"^(\s*)'((?:\\'|[^'])*)'\s*:\s*'((?:\\'|[^'])*)'(,?)\s*(?://.*)?$")


def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace("'", "\\'")


def patch_file(path: Path, by_key: dict[str, str], by_value: dict[str, str] | None = None) -> tuple[int, int]:
    n_key = n_val = 0
    out: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        m = LINE.match(line)
        if not m:
            out.append(line)
            continue
        indent, key, val = m.group(1), m.group(2), m.group(3)
        new = val
        if key in by_key:
            new = by_key[key]
            if new != val:
                n_key += 1
        elif by_value and val in by_value:
            new = by_value[val]
            if new != val:
                n_val += 1
        out.append(f"{indent}'{key}': '{esc(new)}',")
    path.write_text("\n".join(out) + "\n", encoding="utf-8")
    return n_key, n_val


SHARED_KEYS = {
    "documentStatus.pending_review": {
        "en-US": "In review",
        "ja-JP": "審査待ち",
        "vi-VN": "Chờ duyệt",
    },
    "documentStatus.audited": {
        "en-US": "Reviewed",
        "ja-JP": "審査済",
        "vi-VN": "Đã duyệt",
    },
    "documentStatus.effective": {
        "en-US": "In effect",
        "ja-JP": "有効",
        "vi-VN": "Hiệu lực",
    },
    "lifecycle.stage.invoicing": {
        "en-US": "Invoicing",
        "ja-JP": "請求",
        "vi-VN": "Hóa đơn",
    },
    "app.kuaizhizao.salesOrder.lifecycleInvoicing": {
        "en-US": "Invoicing",
        "ja-JP": "請求",
        "vi-VN": "Hóa đơn",
    },
    "app.kuaizhizao.purchaseOrder.lifecycleInvoicing": {
        "en-US": "Invoicing",
        "ja-JP": "請求",
        "vi-VN": "Hóa đơn",
    },
    "app.kuaizhizao.salesOrder.batchReopen": {
        "en-US": "Undo close",
        "ja-JP": "クローズ取消",
        "vi-VN": "Mở lại",
    },
    "components.uniAction.addFollowUpFromDocument": {
        "en-US": "Follow-up",
        "ja-JP": "フォロー",
        "vi-VN": "Theo dõi",
    },
    "app.kuaizhizao.customerFollowUp.addFollowUpFromDocument": {
        "en-US": "Follow-up",
        "ja-JP": "フォロー",
        "vi-VN": "Theo dõi",
    },
    "app.kuaizhizao.customerFollowUp.new": {
        "en-US": "Follow-up",
        "ja-JP": "フォロー",
        "vi-VN": "Theo dõi",
    },
    "components.uniPush.disabled.noActions": {
        "en-US": "No downstream action",
        "ja-JP": "後続伝票を作成できません",
        "vi-VN": "Không có chứng từ tiếp theo",
    },
    "components.uniPush.disabled.selection": {
        "en-US": "Select one document first",
        "ja-JP": "先に1件選択してください",
        "vi-VN": "Hãy chọn một chứng từ",
    },
    "components.uniPush.disabled.unavailable": {
        "en-US": "Cannot create downstream in this status",
        "ja-JP": "この状態では後続伝票を作成できません",
        "vi-VN": "Trạng thái hiện tại không tạo được chứng từ tiếp",
    },
    "components.uniReport.pageSizeAll": {
        "en-US": "All",
        "ja-JP": "すべて",
        "vi-VN": "Tất cả",
    },
    "common.importing": {
        "en-US": "Importing…",
        "ja-JP": "インポート中…",
        "vi-VN": "Đang nhập…",
    },
    "common.importPartialSuccess": {
        "en-US": "Partially imported",
        "ja-JP": "一部インポート済み",
        "vi-VN": "Nhập một phần thành công",
    },
    "common.importDetail": {
        "en-US": "Import lines",
        "ja-JP": "明細をインポート",
        "vi-VN": "Nhập dòng hàng",
    },
    "components.uniTable.exportSelected": {
        "en-US": "Export selected",
        "ja-JP": "選択分をエクスポート",
        "vi-VN": "Xuất dòng đã chọn",
    },
    "app.haoligo.name": {
        "en-US": "Haoli GO",
        "ja-JP": "Haoli GO",
        "vi-VN": "Haoli GO",
    },
    "app.kuaizhizao.demandComputation.colDynamicMonitor": {
        "en-US": "Live monitor",
        "ja-JP": "動態監視",
        "vi-VN": "Giám sát động",
    },
    "app.kuaizhizao.equipmentReports.colPlanNo": {
        "en-US": "Plan no.",
        "ja-JP": "計画番号",
        "vi-VN": "Số kế hoạch",
    },
    "app.kuaizhizao.salesReview.colItemCount": {
        "en-US": "Lines",
        "ja-JP": "明細数",
        "vi-VN": "Số dòng",
    },
    "app.kuaizhizao.salesReview.colProjectName": {
        "en-US": "Project",
        "ja-JP": "案件名",
        "vi-VN": "Hạng mục",
    },
    "app.kuaizhizao.salesReview.colQuotation": {
        "en-US": "Quote",
        "ja-JP": "見積",
        "vi-VN": "Báo giá",
    },
    "app.kuaizhizao.salesReview.colRiskLevel": {
        "en-US": "Risk",
        "ja-JP": "リスク",
        "vi-VN": "Rủi ro",
    },
    "app.kuaizhizao.warehouseDashboard.colSkuCount": {
        "en-US": "SKUs",
        "ja-JP": "SKU数",
        "vi-VN": "Số SKU",
    },
    "app.kuaizhizao.warehouseDashboard.colStockStatus": {
        "en-US": "Stock",
        "ja-JP": "在庫",
        "vi-VN": "Tồn kho",
    },
    "app.kuaizhizao.warehouseOutbound.confirm.batchPicker.colProductionDate": {
        "en-US": "Prod. date",
        "ja-JP": "製造日",
        "vi-VN": "Ngày SX",
    },
    "app.kuaizhizao.warehouseReports.colEventAt": {
        "en-US": "Time",
        "ja-JP": "日時",
        "vi-VN": "Thời điểm",
    },
    "app.kuaizhizao.warehouseReports.colTransferDate": {
        "en-US": "Transfer date",
        "ja-JP": "移動日",
        "vi-VN": "Ngày điều chuyển",
    },
    "components.documentTrackingPanel.traceBriefOpenPerformanceHoliday": {
        "en-US": "Open holiday calendar",
        "ja-JP": "休日管理へ",
        "vi-VN": "Mở lịch nghỉ",
    },
    "components.documentTrackingPanel.traceBriefOpenPerformanceSkill": {
        "en-US": "Open skills",
        "ja-JP": "技能管理へ",
        "vi-VN": "Mở kỹ năng",
    },
    "components.documentTrackingPanel.traceBriefOpenPerformanceSummary": {
        "en-US": "Open performance summary",
        "ja-JP": "績效集計へ",
        "vi-VN": "Mở tổng hợp hiệu suất",
    },
    "components.documentTrackingPanel.traceBriefOpenPerformanceSummaryDetail": {
        "en-US": "Open performance summary",
        "ja-JP": "績效集計を開く",
        "vi-VN": "Mở tổng hợp hiệu suất",
    },
    "components.documentTrackingPanel.traceBriefOpenReportingDetail": {
        "en-US": "Open production report",
        "ja-JP": "出来高記録を開く",
        "vi-VN": "Mở báo cáo sản lượng",
    },
    "app.kuaizhizao.salesOrder.lifecycleEffective": {
        "en-US": "In effect",
        "ja-JP": "有効",
        "vi-VN": "Hiệu lực",
    },
    "app.kuaizhizao.salesForecast.lifecycleEffective": {
        "en-US": "In effect",
        "ja-JP": "有効",
        "vi-VN": "Hiệu lực",
    },
    "codeRulePage.module.快格轻制造": {
        "en-US": "Kuai Manufacturing",
        "ja-JP": "快製造",
        "vi-VN": "Sản xuất Kuai",
    },
}

JA_EXTRA = {
    "app.kuaizhizao.salesOrder.batchReopenConfirmTitle": "クローズ取消の確認",
}

for lang in ("en-US", "ja-JP", "vi-VN"):
    by_key = {k: v[lang] for k, v in SHARED_KEYS.items()}
    if lang == "ja-JP":
        by_key.update(JA_EXTRA)
    by_value = None
    if lang == "vi-VN":
        by_value = {
            "Tán thành": "Đã duyệt",
            "Vật bị loại bỏ": "Từ chối",
        }
    nk, nv = patch_file(ROOT / f"{lang}.ts", by_key, by_value)
    print(f"{lang}.ts key={nk} value={nv}")

gen = ROOT / "generated" / "codeRulePage"
for lang in ("en-US", "ja-JP", "vi-VN"):
    p = gen / f"{lang}.ts"
    nk, nv = patch_file(p, {k: v[lang] for k, v in SHARED_KEYS.items() if k.startswith("codeRulePage")})
    print(f"generated/{lang}.ts key={nk}")
