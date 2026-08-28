from pathlib import Path
import re

LOCALES = Path(__file__).resolve().parents[2] / "src" / "locales"
LINE = re.compile(r"^(\s*)'((?:\\'|[^'])*)'\s*:\s*'((?:\\'|[^'])*)'(,?)\s*(?://.*)?$")

PATCH = {
    "app.kuaicaiwu.notes.filterExpiring": {
        "en-US": "Expiring within {{days}} days",
        "ja-JP": "{{days}}日以内に期限切れ",
        "vi-VN": "Hết hạn trong {{days}} ngày",
    },
    "app.kuaicaiwu.notes.filterKeyword": {
        "en-US": "Keyword: {{keyword}}",
        "ja-JP": "キーワード：{{keyword}}",
        "vi-VN": "Từ khóa: {{keyword}}",
    },
    "app.kuaizhizao.demandComputation.mrpPlanPanelTitle": {
        "en-US": "{{code}} {{name}}",
        "ja-JP": "{{code}} {{name}}",
        "vi-VN": "{{code}} {{name}}",
    },
    "app.kuaizhizao.demandComputation.mrpTabExceptions": {
        "en-US": "Exceptions ({{count}})",
        "ja-JP": "例外 ({{count}})",
        "vi-VN": "Ngoại lệ ({{count}})",
    },
    "app.kuaizhizao.demandComputation.mrpTabOpenSupply": {
        "en-US": "Open supply ({{count}})",
        "ja-JP": "未完了供給 ({{count}})",
        "vi-VN": "Nguồn cung mở ({{count}})",
    },
    "app.kuaizhizao.demandComputation.mrpTabPlannedOrders": {
        "en-US": "Planned orders ({{count}})",
        "ja-JP": "計画オーダ ({{count}})",
        "vi-VN": "Lệnh kế hoạch ({{count}})",
    },
    "app.kuaizhizao.demandComputation.mrpTabTimeBuckets": {
        "en-US": "Time buckets ({{count}})",
        "ja-JP": "期間バケット ({{count}})",
        "vi-VN": "Nhóm thời gian ({{count}})",
    },
    "app.kuaizhizao.demandComputation.sourcePullMergeNote": {
        "en-US": "Create by merging {{count}} demand lines",
        "ja-JP": "{{count}}件の需要をまとめて作成",
        "vi-VN": "Gộp {{count}} nhu cầu để tạo",
    },
    "app.kuaizhizao.quality.fai.balloon.editorTitle": {
        "en-US": "Balloon annotation {{code}}",
        "ja-JP": "バルーン注記 {{code}}",
        "vi-VN": "Chú thích balloon {{code}}",
    },
    "app.kuaizhizao.quality.fai.balloon.messages.ocrSuccess": {
        "en-US": "OCR complete, {{count}} balloons recognized",
        "ja-JP": "OCR完了、{{count}}個のバルーンを認識しました",
        "vi-VN": "OCR xong, đã nhận {{count}} balloon",
    },
    "app.kuaizhizao.quality.qms.reviewDueBanner": {
        "en-US": "{{count}} QMS documents are due for review",
        "ja-JP": "体系文書 {{count}}件がレビュー期限に近づいています",
        "vi-VN": "Có {{count}} tài liệu hệ thống sắp đến kỳ đánh giá",
    },
    "app.kuaizhizao.salesReview.batchDeleteSuccess": {
        "en-US": "Deleted {{count}} sales reviews",
        "ja-JP": "受注審査 {{count}}件を削除しました",
        "vi-VN": "Đã xóa {{count}} phiếu thẩm định đơn hàng",
    },
    "app.kuaizhizao.salesReview.batchOperationPartial": {
        "en-US": "{{action}} finished: {{success}} succeeded, {{failed}} failed",
        "ja-JP": "{{action}}完了：成功 {{success}}、失敗 {{failed}}",
        "vi-VN": "{{action}} xong: thành công {{success}}, thất bại {{failed}}",
    },
    "app.kuaizhizao.salesReview.batchOperationSuccess": {
        "en-US": "{{action}} succeeded for {{count}} records",
        "ja-JP": "{{action}}成功 {{count}}件",
        "vi-VN": "{{action}} thành công {{count}} phiếu",
    },
    "app.kuaizhizao.salesReview.batchRejectConfirm": {
        "en-US": "Reject the selected {{count}} sales reviews?",
        "ja-JP": "選択した受注審査 {{count}}件を却下しますか？",
        "vi-VN": "Xác nhận từ chối {{count}} phiếu thẩm định đã chọn?",
    },
    "app.kuaizhizao.salesReview.confirmBatchDelete": {
        "en-US": "Delete the selected {{count}} sales reviews?",
        "ja-JP": "選択した受注審査 {{count}}件を削除しますか？",
        "vi-VN": "Xác nhận xóa {{count}} phiếu thẩm định đã chọn?",
    },
    "app.kuaizhizao.salesReview.detailTitle": {
        "en-US": "Sales review details{{suffix}}",
        "ja-JP": "受注審査詳細{{suffix}}",
        "vi-VN": "Chi tiết thẩm định đơn hàng{{suffix}}",
    },
    "app.kuaizhizao.salesReview.exportSuccess": {
        "en-US": "Exported {{count}} records",
        "ja-JP": "{{count}}件をエクスポートしました",
        "vi-VN": "Đã xuất {{count}} bản ghi",
    },
    "app.kuaizhizao.salesReview.push.singleOnly": {
        "en-US": "Downstream create supports one record; {{count}} are selected",
        "ja-JP": "後続伝票の作成は1件のみです。現在 {{count}}件選択中",
        "vi-VN": "Chỉ tạo chứng từ tiếp theo cho 1 phiếu; đang chọn {{count}}",
    },
    "app.kuaizhizao.salesReview.pushSuccessWithCode": {
        "en-US": "Created downstream sales order: {{code}}",
        "ja-JP": "後続の受注を作成しました：{{code}}",
        "vi-VN": "Đã tạo đơn bán hàng tiếp theo: {{code}}",
    },
    "app.kuaizhizao.salesReview.reviewModalTitle": {
        "en-US": "Sales review {{code}}",
        "ja-JP": "受注審査 {{code}}",
        "vi-VN": "Thẩm định đơn hàng {{code}}",
    },
    "app.master-data.materials.autoGenerateAvailableHint": {
        "en-US": "About {{count}} combinations are available for batch auto-generate.",
        "ja-JP": "現在 約{{count}}件の組合せがあり、一括自動生成できます。",
        "vi-VN": "Hiện khoảng {{count}} tổ hợp, có thể sinh hàng loạt tự động.",
    },
    "app.master-data.materials.importInspection.masterNotFound": {
        "en-US": "Master material {{code}} was not found",
        "ja-JP": "親品目 {{code}} が見つかりません",
        "vi-VN": "Không tìm thấy vật tư chính {{code}}",
    },
    "app.master-data.materials.variantSkuCount": {
        "en-US": "{{count}} items",
        "ja-JP": "全 {{count}}件",
        "vi-VN": "Tổng {{count}} dòng",
    },
    "components.uniReport.pageSizePerPage": {
        "en-US": "{{size}} / page",
        "ja-JP": "{{size}}件/ページ",
        "vi-VN": "{{size}} dòng/trang",
    },
    "app.master-data.bom.quantityCalcFormula": {
        "en-US": "({{line}} ÷ {{base}}) × {{parent}} × (1 + {{rate}}%) = {{actual}}",
        "ja-JP": "({{line}} ÷ {{base}}) × {{parent}} × (1 + {{rate}}%) = {{actual}}",
        "vi-VN": "({{line}} ÷ {{base}}) × {{parent}} × (1 + {{rate}}%) = {{actual}}",
    },
    "app.kuaizhizao.planControlTower.mrpExceptionInboxAlertTitle": {
        "en-US": "{{count}} MRP exceptions pending",
        "ja-JP": "MRP例外 {{count}}件が未処理",
        "vi-VN": "{{count}} ngoại lệ MRP chờ xử lý",
    },
    "app.kuaizhizao.customerMaterialRegistration.startProductionSuccess": {
        "en-US": "Customer-supplied receipt posted and production started: {{registration}} → {{workOrder}}{{batching}}",
        "ja-JP": "客供入庫済み、着手：{{registration}} → {{workOrder}}{{batching}}",
        "vi-VN": "Đã nhập kho hàng khách cung và khởi công: {{registration}} → {{workOrder}}{{batching}}",
    },
    "app.kuaizhizao.scheduling.msg.quickActionResult": {
        "en-US": "{{prefix}}: delayed {{updated}}, to exception {{converted}}, unfrozen {{unfreezed}}, skipped {{skipped}}{{failedPart}}",
        "ja-JP": "{{prefix}}: 順延 {{updated}}、例外へ {{converted}}、凍結解除 {{unfreezed}}、スキップ {{skipped}}{{failedPart}}",
        "vi-VN": "{{prefix}}: dời hạn {{updated}}, chuyển ngoại lệ {{converted}}, bỏ đóng băng {{unfreezed}}, bỏ qua {{skipped}}{{failedPart}}",
    },
}


def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace("'", "\\'")


def main() -> None:
    for lang in ("en-US", "ja-JP", "vi-VN"):
        path = LOCALES / f"{lang}.ts"
        n = 0
        out = []
        for line in path.read_text(encoding="utf-8").splitlines():
            m = LINE.match(line)
            if m and m.group(2) in PATCH:
                indent, key = m.group(1), m.group(2)
                out.append(f"{indent}'{key}': '{esc(PATCH[key][lang])}',")
                n += 1
            else:
                out.append(line)
        path.write_text("\n".join(out) + "\n", encoding="utf-8")
        print(lang, "patched", n)


if __name__ == "__main__":
    main()
