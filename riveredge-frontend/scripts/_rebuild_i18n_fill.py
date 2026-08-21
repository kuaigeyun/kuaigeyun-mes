"""Rebuild _i18n_fill.json from gap + source defaultValue + curated overrides."""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SRC = REPO / "riveredge-frontend" / "src"
LOCALES = SRC / "locales"
GAP_PATH = REPO / "_i18n_gap.json"
OLD_FILL_PATH = REPO / "_i18n_fill.json"
OUT_PATH = REPO / "_i18n_fill.json"

ENTRY_RE = re.compile(r"^(\s*)'((?:\\'|[^'])*)'\s*:\s*'((?:\\'|[^'])*)',?\s*(?://.*)?$")
T_CALL = re.compile(
    r"""(?:\bt\(|i18n\.t\()\s*(['"])([a-zA-Z][^'"]+)\1\s*(?:,\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\})?""",
    re.S,
)
DEFAULT_IN_OPTS = re.compile(r"""defaultValue\s*:\s*(['"])(.*?)\1""", re.S)
NS_ASSIGN = re.compile(r"""(?:const|let)\s+NS\s*=\s*['"]([^'"]+)['"]""")
T_NS = re.compile(
    r"""t\(\s*`\$\{NS\}\.([^`$]+)`\s*(?:,\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\})?"""
)
SKIP = {"locales", "node_modules", "__tests__", "generated"}
PH = re.compile(r"\{\{[^}]+\}\}")

LEAF_ZH = {
    "actions": "操作",
    "retry": "重试",
    "loadFailed": "加载失败",
    "saveFailed": "保存失败",
    "saveSuccess": "保存成功",
    "deleteSuccess": "删除成功",
    "createSuccess": "创建成功",
    "updateSuccess": "更新成功",
    "operationFailed": "操作失败",
    "createTitle": "新建",
    "editTitle": "编辑",
    "detailTitle": "详情",
    "search": "搜索",
    "reset": "重置",
    "confirm": "确认",
    "cancel": "取消",
    "submit": "提交",
    "export": "导出",
    "import": "导入",
    "print": "打印",
    "status": "状态",
    "remark": "备注",
    "code": "编码",
    "name": "名称",
    "title": "标题",
    "type": "类型",
    "quantity": "数量",
    "amount": "金额",
    "date": "日期",
    "month": "月",
    "year": "年",
    "customer": "客户",
    "supplier": "供应商",
    "material": "物料",
    "warehouse": "仓库",
    "pendingApprovals": "待审批",
    "allTotal": "合计",
    "start": "开始",
    "end": "结束",
    "components": "组件",
    "outline": "大纲",
    "page": "页面",
    "noItems": "暂无内容",
    "required": "必填",
    "options": "选项",
    "undo": "撤销",
    "redo": "重做",
    "span": "列宽",
    "spanFull": "整行",
    "spanHalf": "半行",
    "untitled": "未命名",
}
LEAF_EN = {
    "actions": "Actions",
    "retry": "Retry",
    "loadFailed": "Load failed",
    "saveFailed": "Save failed",
    "saveSuccess": "Saved successfully",
    "deleteSuccess": "Deleted successfully",
    "createSuccess": "Created successfully",
    "updateSuccess": "Updated successfully",
    "operationFailed": "Operation failed",
    "createTitle": "Create",
    "editTitle": "Edit",
    "detailTitle": "Details",
    "search": "Search",
    "reset": "Reset",
    "confirm": "Confirm",
    "cancel": "Cancel",
    "submit": "Submit",
    "export": "Export",
    "import": "Import",
    "print": "Print",
    "status": "Status",
    "remark": "Remark",
    "code": "Code",
    "name": "Name",
    "title": "Title",
    "type": "Type",
    "quantity": "Quantity",
    "amount": "Amount",
    "date": "Date",
    "month": "Month",
    "year": "Year",
    "customer": "Customer",
    "supplier": "Supplier",
    "material": "Material",
    "warehouse": "Warehouse",
    "pendingApprovals": "Pending approvals",
    "allTotal": "Total",
    "start": "Start",
    "end": "End",
    "components": "Components",
    "outline": "Outline",
    "page": "Page",
    "noItems": "No items",
    "required": "Required",
    "options": "Options",
    "undo": "Undo",
    "redo": "Redo",
    "span": "Column span",
    "spanFull": "Full width",
    "spanHalf": "Half width",
    "untitled": "Untitled",
}

KEY_OVERRIDE = {
    "app.common.deleteSuccess": ("删除成功", "Deleted successfully"),
    "app.common.operationFailed": ("操作失败", "Operation failed"),
    "app.common.actions": ("操作", "Actions"),
    "app.kuaioa.workbench.loadFailed": ("加载失败", "Load failed"),
    "app.kuaioa.workbench.pendingApprovals": ("待审批", "Pending approvals"),
    "app.kuaizhizao.salesReview.loadFailed": ("加载失败", "Load failed"),
    "app.kuaicaiwu.gl.vouchers.createTitle": ("填制凭证", "Create voucher"),
    "app.kuaicaiwu.gl.chartOfAccounts.createTitle": ("新建科目", "Create account"),
    "app.kuaizhizao.quality.isoClauses.createTitle": ("新建 ISO 条款", "Create ISO clause"),
    "app.kuaizhizao.salesReview.createTitle": ("新建订单评审", "Create order review"),
    "app.master-data.marketPrices.createTitle": ("新建市场价格", "Create market price"),
    "pages.infra.licenseCenter.createTitle": ("新增许可证密钥", "Create license key"),
}


def load_locale(lang: str) -> dict[str, str]:
    out: dict[str, str] = {}
    text = (LOCALES / f"{lang}.ts").read_text(encoding="utf-8")
    for line in text.splitlines():
        m = ENTRY_RE.match(line)
        if m:
            out[m.group(2)] = m.group(3).replace("\\'", "'").replace("\\n", "\n")
    generated = LOCALES / "generated"
    if generated.exists():
        for path in generated.rglob(f"{lang}.ts"):
            for line in path.read_text(encoding="utf-8").splitlines():
                m = ENTRY_RE.match(line)
                if m:
                    out[m.group(2)] = m.group(3).replace("\\'", "'").replace("\\n", "\n")
    return out


def mode(vals: list[str]) -> str | None:
    if not vals:
        return None
    return Counter(vals).most_common(1)[0][0]


def camel_to_words(s: str) -> str:
    s = re.sub(r"([a-z])([A-Z])", r"\1 \2", s)
    s = s.replace("_", " ").replace("-", " ")
    return s.strip()


def en_from_leaf(leaf: str, leaf_en: dict[str, list[str]]) -> str:
    if leaf in LEAF_EN:
        return LEAF_EN[leaf]
    existing = mode(leaf_en.get(leaf, []))
    if existing:
        return existing
    words = camel_to_words(leaf)
    if any(
        leaf.lower().endswith(x)
        for x in ("failed", "success", "hint", "confirm", "required", "invalid", "empty")
    ):
        return words[:1].upper() + words[1:] if words else leaf
    return words.title() if words else leaf


def zh_looks_ok(leaf: str, zh: str) -> bool:
    if not zh or not zh.strip():
        return False
    checks = {
        "loadFailed": ("加载", "失敗", "失败", "載入"),
        "deleteSuccess": ("删除", "刪除", "成功"),
        "operationFailed": ("操作", "失败", "失敗"),
        "retry": ("重试", "重試"),
        "pendingApprovals": ("审批", "審批", "待"),
    }
    for tip, words in checks.items():
        if tip.lower() == leaf.lower() or leaf.endswith(tip):
            return any(w in zh for w in words)
    if leaf in LEAF_ZH and zh != LEAF_ZH[leaf] and len(zh) > 12 and LEAF_ZH[leaf] not in zh:
        if leaf in ("createTitle", "editTitle"):
            return True
        return False
    return True


def strip_sep(s: str) -> str:
    return s.replace("·", " ").replace("・", " ").replace("•", " ").strip()


def main() -> None:
    gap = json.loads(GAP_PATH.read_text(encoding="utf-8"))
    old_fill = json.loads(OLD_FILL_PATH.read_text(encoding="utf-8")) if OLD_FILL_PATH.exists() else {"entries": {}}

    missing: set[str] = set()
    for keys in gap["buckets"].values():
        missing.update(keys)
    missing.update(gap.get("default_keys", []))

    zh_existing = load_locale("zh-CN")
    en_existing = load_locale("en-US")
    leaf_zh: dict[str, list[str]] = defaultdict(list)
    leaf_en: dict[str, list[str]] = defaultdict(list)
    for key, value in zh_existing.items():
        leaf_zh[key.split(".")[-1]].append(value)
    for key, value in en_existing.items():
        leaf_en[key.split(".")[-1]].append(value)

    key_defaults: dict[str, str] = {}
    for path in SRC.rglob("*"):
        if path.suffix not in {".ts", ".tsx"} or any(part in path.parts for part in SKIP):
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for match in T_CALL.finditer(text):
            key = match.group(2)
            if "/" in key or key.startswith("import"):
                continue
            opts = match.group(3) or ""
            default_match = DEFAULT_IN_OPTS.search(opts)
            if default_match and key in missing:
                key_defaults[key] = default_match.group(2)
        ns_match = NS_ASSIGN.search(text)
        if not ns_match:
            continue
        prefix = ns_match.group(1)
        for match in T_NS.finditer(text):
            suffix = match.group(1)
            if "${" in suffix:
                continue
            key = f"{prefix}.{suffix}"
            opts = match.group(2) or ""
            default_match = DEFAULT_IN_OPTS.search(opts)
            if default_match and key in missing:
                key_defaults[key] = default_match.group(2)

    result: dict[str, dict[str, str]] = {}
    src_stats: Counter[str] = Counter()

    for key in sorted(missing):
        leaf = key.split(".")[-1]
        old = old_fill.get("entries", {}).get(key, {})
        if key in KEY_OVERRIDE:
            zh, en = KEY_OVERRIDE[key]
            src_stats["override"] += 1
        elif key in key_defaults:
            zh = key_defaults[key]
            en = old.get("en") or en_from_leaf(leaf, leaf_en)
            src_stats["defaultValue"] += 1
        else:
            zh_old = old.get("zh", "")
            en_old = old.get("en", "")
            if zh_old and zh_looks_ok(leaf, zh_old):
                zh = zh_old
                en = en_old or en_from_leaf(leaf, leaf_en)
                src_stats["old_ok"] += 1
            elif leaf in LEAF_ZH:
                zh = LEAF_ZH[leaf]
                en = LEAF_EN.get(leaf) or en_from_leaf(leaf, leaf_en)
                src_stats["leaf"] += 1
            else:
                zh = mode(leaf_zh.get(leaf, [])) or zh_old or leaf
                en = mode(leaf_en.get(leaf, [])) or en_old or en_from_leaf(leaf, leaf_en)
                if zh == leaf and zh_old:
                    zh = zh_old
                src_stats["reuse_or_old"] += 1

        zh = strip_sep(zh)
        en = strip_sep(en)
        # Align placeholders: if zh has them and en missing, keep zh phs in en by appending nothing — flag later
        result[key] = {"zh": zh, "en": en}

    mismatches = [
        key
        for key, value in result.items()
        if set(PH.findall(value["zh"])) != set(PH.findall(value["en"]))
    ]
    # Fix placeholder mismatches by copying placeholders from zh into en if en lacks them
    for key in mismatches:
        zh_ph = PH.findall(result[key]["zh"])
        en_ph = set(PH.findall(result[key]["en"]))
        for ph in zh_ph:
            if ph not in en_ph:
                result[key]["en"] = f"{result[key]['en']} {ph}".strip()

    out = {
        "entries": result,
        "stats": dict(src_stats),
        "total": len(result),
        "defaults_found": len(key_defaults),
        "placeholder_fixed": len(mismatches),
    }
    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", OUT_PATH, "total", len(result), "stats", dict(src_stats))
    print("defaults_found", len(key_defaults), "placeholder_fixed", len(mismatches))

    remaining = []
    for key, value in result.items():
        leaf = key.split(".")[-1]
        if leaf == "loadFailed" and "失败" not in value["zh"] and "失敗" not in value["zh"]:
            remaining.append((key, value))
        if leaf == "deleteSuccess" and "删除" not in value["zh"] and "刪除" not in value["zh"]:
            remaining.append((key, value))
        if leaf == "operationFailed" and "失败" not in value["zh"] and "失敗" not in value["zh"]:
            remaining.append((key, value))
    print("remaining_suspicious", len(remaining))
    for row in remaining[:20]:
        print(row)


if __name__ == "__main__":
    main()
