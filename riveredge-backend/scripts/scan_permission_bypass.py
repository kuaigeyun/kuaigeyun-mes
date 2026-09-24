#!/usr/bin/env python3
"""
扫描权限旁路 / action 混用。

用法:
  python scripts/scan_permission_bypass.py
  python scripts/scan_permission_bypass.py --json
  python scripts/scan_permission_bypass.py --fail-on high

规则分级:
  high   — 必须修复（CI 默认拦截）
  medium — 应迁移
  info   — 遗留推断/统计，不阻断
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_SRC = REPO_ROOT / "riveredge-backend" / "src"
FRONTEND_SRC = REPO_ROOT / "riveredge-frontend" / "src"
MOBILE_SRC = REPO_ROOT / "riveredge-adapt" / "haoli-go" / "mobile"

if str(BACKEND_SRC) not in sys.path:
    sys.path.insert(0, str(BACKEND_SRC))

# 应用内自建 assert_*_module_access（应迁 require_permission_codes / 契约 helper）
DUPLICATE_ASSERT_PATTERN = re.compile(
    r"^\s*async\s+def\s+(assert_\w+module_access)\s*\(",
    re.MULTILINE,
)
LOCAL_PERMISSION_BUILDER = re.compile(
    r"^\s*def\s+(_\w+_permission)\s*\(",
    re.MULTILINE,
)

# 审核数组混入 update（前端）
REVIEW_ARRAY_MIX = re.compile(
    r"hasAnyPermission\s*\([^)]*\[[^\]]*['\"]update['\"][^\]]*(?:audit|approve|reject)|"
    r"hasAnyPermission\s*\([^)]*\[[^\]]*(?:audit|approve|reject)[^\]]*['\"]update['\"]",
    re.IGNORECASE | re.DOTALL,
)

# 用 read 且「无 update」冒充其它 action（典型旁路）
READ_WITHOUT_UPDATE_BYPASS = re.compile(
    r"canRead\w*\s*&&\s*!\s*canUpdate\w*",
)

# workspace 模块保护业务 API
WORKSPACE_MODULE_GUARD = re.compile(
    r'require_module_access\s*\(\s*["\']haoligo["\']\s*,\s*["\']workspace["\']',
)

# _resolve_action_by_request 路径特例（仅统计新增）
RESOLVE_ACTION_SPECIAL = re.compile(
    r'if\s+["\'][^"\']+["\']\s+in\s+p\s*:',
)

# 权限同步内联 action 文案表（应使用 permission_action_spec.action_display_label）
SYNC_INLINE_ACTION_TEXT = re.compile(
    r"def _build_permission_name[\s\S]{0,400}action_text\s*=\s*\{",
)

# 硬编码角色矩阵 action 排序（应使用 manifest.permissions 顺序）
HARDCODED_ACTION_SORT = re.compile(
    r"function_grant_action_sort_key|_CRUD_IO_ACTION_ORDER|_SPECIAL_ACTION_ORDER",
)

# 前端角色矩阵文案/排序补丁
FRONTEND_GRANT_LABEL_PATCH = re.compile(
    r"pages\.system\.roles\.permissionLabel|function simpleActionLabel|const actionFallback\s*:\s*Record",
)

FRONTEND_ACTION_SORT_PATCH = re.compile(
    r"actions\.sort\s*\(|\.sort\([^)]*action",
)

# HaoliGO 路由 action 回落 core 路径推断
HAOLIGO_ROUTE_ACCESS_FALLBACK = re.compile(
    r"_resolve_action_by_request\s*\(",
)

# 外协身份旁路（已删除的模式 + 禁止回流）
EXTERNAL_PARTNER_BYPASS = re.compile(
    r"\bdetectIsOutsource\b|\b_detect_is_outsource\b|"
    r"/outsource\|vendor\|外协/i|"
    r"hasHaoligo\s*&&\s*!hasEquipOrPatrol|"
    r"\.some\s*\(\s*\([^)]*\)\s*=>\s*/[^/]*外协",
)

# 缺 role_type 时默认 internal（静默兜底，禁止）
EXTERNAL_PARTNER_ROLE_TYPE_DEFAULT = re.compile(
    r"role_type\s*\?\?\s*['\"]internal['\"]|"
    r"role_type[^;\n]{0,40}\bor\s*['\"]internal['\"]",
)

# HaoliGO 页面直接 hasPermission（应 useResourcePermissions / hasModulePermission）
HAOLIGO_DIRECT_HAS_PERMISSION = re.compile(
    r"\bhasPermission\s*\(",
)

# HaoliGO 后端仍用 core require_module_access（路径 action 推断，禁止）
HAOLIGO_REQUIRE_MODULE_ACCESS = re.compile(
    r'require_module_access\s*\(\s*["\']haoligo["\']',
)

# 快智造后端仍用 core require_module_access（应 require_kuaizhizao_module_access）
KUAIZHIZAO_REQUIRE_MODULE_ACCESS = re.compile(
    r'require_module_access\s*\(\s*["\']kuaizhizao["\']',
)

# 主数据 / 快财务后端仍用 core require_module_access
MASTER_DATA_REQUIRE_MODULE_ACCESS = re.compile(
    r'require_module_access\s*\(\s*["\']master-data["\']',
)
KUAICAIWU_REQUIRE_MODULE_ACCESS = re.compile(
    r'require_module_access\s*\(\s*["\']kuaicaiwu["\']',
)
KUAICAIWU_FINANCE_LEGACY_ACCESS = re.compile(
    r'require_access\s*\(\s*["\']finance\.',
)
PERMISSION_CODE_VIEW_SUFFIX = re.compile(
    r'require_permission_codes\s*\(\s*["\'][^"\']+:view["\']',
)
MASTER_DATA_PERFORMANCE_LEGACY_ACCESS = re.compile(
    r'\brequire_access\s*\(',
)

# umbrella module 一把梭（应路径/子模块映射 manifest）
HAOLIGO_UMBRELLA_MODULE_GUARD = re.compile(
    r'require_module_access\s*\(\s*["\']haoligo["\']\s*,\s*["\'](?:equipment|equipment-documents)["\']',
)

# 前端 resource 为空时 fail-open
RESOURCE_PERMISSIONS_FAIL_OPEN = re.compile(
    r"ALL_ALLOWED|保持历史页面行为",
)


@dataclass(frozen=True)
class Finding:
    rule_id: str
    severity: str
    path: str
    line: int
    message: str
    snippet: str = ""


def _rel(path: Path) -> str:
    try:
        return path.relative_to(REPO_ROOT).as_posix()
    except ValueError:
        return path.as_posix()


def _line_snippet(text: str, line_no: int, radius: int = 0) -> str:
    lines = text.splitlines()
    if line_no < 1 or line_no > len(lines):
        return ""
    idx = line_no - 1
    start = max(0, idx - radius)
    end = min(len(lines), idx + radius + 1)
    return "\n".join(lines[start:end]).strip()


def scan_backend_apps() -> list[Finding]:
    findings: list[Finding] = []
    apps_dir = BACKEND_SRC / "apps"
    if not apps_dir.is_dir():
        return findings

    for py_path in sorted(apps_dir.rglob("*.py")):
        text = py_path.read_text(encoding="utf-8", errors="replace")
        rel = _rel(py_path)

        for match in DUPLICATE_ASSERT_PATTERN.finditer(text):
            line = text[: match.start()].count("\n") + 1
            findings.append(
                Finding(
                    rule_id="backend_duplicate_module_assert",
                    severity="medium",
                    path=rel,
                    line=line,
                    message=f"应用内自建 {match.group(1)}，应迁 require_permission_codes + permission_contract",
                    snippet=_line_snippet(text, line),
                )
            )

        for match in LOCAL_PERMISSION_BUILDER.finditer(text):
            line = text[: match.start()].count("\n") + 1
            findings.append(
                Finding(
                    rule_id="backend_local_permission_builder",
                    severity="medium",
                    path=rel,
                    line=line,
                    message=f"本地 {match.group(1)}，应改用 core.config.permission_contract.build_permission_code",
                    snippet=_line_snippet(text, line),
                )
            )

        for match in WORKSPACE_MODULE_GUARD.finditer(text):
            line = text[: match.start()].count("\n") + 1
            findings.append(
                Finding(
                    rule_id="backend_workspace_module_guard",
                    severity="high",
                    path=rel,
                    line=line,
                    message="用 haoligo:workspace 保护业务 API，应使用单据 module 权限码",
                    snippet=_line_snippet(text, line),
                )
            )

        if rel.endswith("apps/haoligo/api/_haoligo_route_access.py"):
            for match in HAOLIGO_ROUTE_ACCESS_FALLBACK.finditer(text):
                line = text[: match.start()].count("\n") + 1
                findings.append(
                    Finding(
                        rule_id="backend_haoligo_route_action_fallback",
                        severity="high",
                        path=rel,
                        line=line,
                        message="HaoliGO 路由 action 回落 _resolve_action_by_request，应显式映射 manifest action",
                        snippet=_line_snippet(text, line),
                    )
                )

        if "/apps/haoligo/api/" in rel.replace("\\", "/"):
            for match in HAOLIGO_REQUIRE_MODULE_ACCESS.finditer(text):
                line = text[: match.start()].count("\n") + 1
                findings.append(
                    Finding(
                        rule_id="backend_haoligo_require_module_access",
                        severity="high",
                        path=rel,
                        line=line,
                        message="HaoliGO API 使用 require_module_access（core 路径推断），应 require_haoligo_module_access 或路径映射",
                        snippet=_line_snippet(text, line),
                    )
                )
            for match in HAOLIGO_UMBRELLA_MODULE_GUARD.finditer(text):
                line = text[: match.start()].count("\n") + 1
                findings.append(
                    Finding(
                        rule_id="backend_haoligo_umbrella_module_guard",
                        severity="high",
                        path=rel,
                        line=line,
                        message="umbrella equipment/equipment-documents 模块鉴权，应按 manifest 子模块映射",
                        snippet=_line_snippet(text, line),
                    )
                )

        if "/apps/kuaizhizao/api/" in rel.replace("\\", "/"):
            for match in KUAIZHIZAO_REQUIRE_MODULE_ACCESS.finditer(text):
                line = text[: match.start()].count("\n") + 1
                findings.append(
                    Finding(
                        rule_id="backend_kuaizhizao_require_module_access",
                        severity="high",
                        path=rel,
                        line=line,
                        message="快智造 API 使用 require_module_access（core 路径推断），应 require_kuaizhizao_module_access",
                        snippet=_line_snippet(text, line),
                    )
                )

        if "/apps/master_data/api/" in rel.replace("\\", "/"):
            for match in MASTER_DATA_REQUIRE_MODULE_ACCESS.finditer(text):
                line = text[: match.start()].count("\n") + 1
                findings.append(
                    Finding(
                        rule_id="backend_master_data_require_module_access",
                        severity="high",
                        path=rel,
                        line=line,
                        message="主数据 API 使用 require_module_access（core 路径推断），应 require_master_data_module_access",
                        snippet=_line_snippet(text, line),
                    )
                )

        if "/apps/kuaicaiwu/api/" in rel.replace("\\", "/"):
            for match in KUAICAIWU_REQUIRE_MODULE_ACCESS.finditer(text):
                line = text[: match.start()].count("\n") + 1
                findings.append(
                    Finding(
                        rule_id="backend_kuaicaiwu_require_module_access",
                        severity="high",
                        path=rel,
                        line=line,
                        message="快财务 API 使用 require_module_access（core 路径推断），应 require_kuaicaiwu_module_access",
                        snippet=_line_snippet(text, line),
                    )
                )
            for match in KUAICAIWU_FINANCE_LEGACY_ACCESS.finditer(text):
                line = text[: match.start()].count("\n") + 1
                findings.append(
                    Finding(
                        rule_id="backend_kuaicaiwu_finance_legacy_access",
                        severity="high",
                        path=rel,
                        line=line,
                        message="快财务 finance.* require_access 遗留，应 require_permission_codes + manifest 码",
                        snippet=_line_snippet(text, line),
                    )
                )
            for match in PERMISSION_CODE_VIEW_SUFFIX.finditer(text):
                line = text[: match.start()].count("\n") + 1
                findings.append(
                    Finding(
                        rule_id="backend_permission_code_view_suffix",
                        severity="high",
                        path=rel,
                        line=line,
                        message="权限码使用非标准 action :view，应改为 :read",
                        snippet=_line_snippet(text, line),
                    )
                )

        if rel.endswith("apps/master_data/api/performance.py"):
            for match in MASTER_DATA_PERFORMANCE_LEGACY_ACCESS.finditer(text):
                line = text[: match.start()].count("\n") + 1
                findings.append(
                    Finding(
                        rule_id="backend_master_data_performance_legacy_access",
                        severity="high",
                        path=rel,
                        line=line,
                        message="绩效 API 使用 require_access，应 require_performance_module_access",
                        snippet=_line_snippet(text, line),
                    )
                )

        for match in EXTERNAL_PARTNER_BYPASS.finditer(text):
            line = text[: match.start()].count("\n") + 1
            if rel.endswith("utils/externalPartner.ts"):
                continue
            findings.append(
                Finding(
                    rule_id="external_partner_identity_bypass",
                    severity="high",
                    path=rel,
                    line=line,
                    message="外协身份旁路（detectIsOutsource/角色名正则/权限推断），应使用 role_type + external_partner_type",
                    snippet=_line_snippet(text, line),
                )
            )

    access_py = BACKEND_SRC / "core" / "api" / "deps" / "access.py"
    if access_py.is_file():
        text = access_py.read_text(encoding="utf-8", errors="replace")
        rel = _rel(access_py)
        in_resolve = False
        for i, line in enumerate(text.splitlines(), start=1):
            if "def _resolve_action_by_request" in line:
                in_resolve = True
                continue
            if in_resolve and line.startswith("def ") and "_resolve_action_by_request" not in line:
                break
            if in_resolve and RESOLVE_ACTION_SPECIAL.search(line):
                findings.append(
                    Finding(
                        rule_id="backend_url_action_inference_special",
                        severity="info",
                        path=rel,
                        line=i,
                        message="URL 路径推断 action 特例（遗留）；新业务须 manifest + 显式依赖",
                        snippet=line.strip(),
                    )
                )
    sync_py = BACKEND_SRC / "core" / "services" / "authorization" / "permission_sync_service.py"
    if sync_py.is_file():
        text = sync_py.read_text(encoding="utf-8", errors="replace")
        rel = _rel(sync_py)
        if SYNC_INLINE_ACTION_TEXT.search(text):
            line = text[: SYNC_INLINE_ACTION_TEXT.search(text).start()].count("\n") + 1
            findings.append(
                Finding(
                    rule_id="backend_duplicate_action_label_dict",
                    severity="high",
                    path=rel,
                    line=line,
                    message="_build_permission_name 内联 action 文案表，应使用 permission_action_spec.action_display_label",
                    snippet=_line_snippet(text, line),
                )
            )

    core_identity_paths = [
        BACKEND_SRC / "core" / "services" / "authorization" / "data_scope_service.py",
    ]
    for py_path in core_identity_paths:
        if not py_path.is_file():
            continue
        text = py_path.read_text(encoding="utf-8", errors="replace")
        rel = _rel(py_path)
        for match in EXTERNAL_PARTNER_ROLE_TYPE_DEFAULT.finditer(text):
            line = text[: match.start()].count("\n") + 1
            findings.append(
                Finding(
                    rule_id="external_partner_role_type_default",
                    severity="high",
                    path=rel,
                    line=line,
                    message="缺 role_type 时默认 internal，外协身份须原样透出 DB 字段",
                    snippet=_line_snippet(text, line),
                )
            )

    for py_path in [BACKEND_SRC / "core" / "config" / "permission_action_spec.py", BACKEND_SRC / "core" / "services" / "authorization" / "role_permission_matrix_service.py"]:
        if not py_path.is_file():
            continue
        text = py_path.read_text(encoding="utf-8", errors="replace")
        for match in HARDCODED_ACTION_SORT.finditer(text):
            line = text[: match.start()].count("\n") + 1
            findings.append(
                Finding(
                    rule_id="backend_hardcoded_action_sort",
                    severity="high",
                    path=_rel(py_path),
                    line=line,
                    message="硬编码 action 排序，应使用 manifest.permissions 数组 manifest_index",
                    snippet=_line_snippet(text, line),
                )
            )

    return findings


def scan_frontend() -> list[Finding]:
    findings: list[Finding] = []
    if not FRONTEND_SRC.is_dir():
        return findings

    for path in sorted(FRONTEND_SRC.rglob("*")):
        if path.suffix not in {".ts", ".tsx"}:
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        rel = _rel(path)

        if "roles-permissions" in rel.replace("\\", "/"):
            for match in FRONTEND_GRANT_LABEL_PATCH.finditer(text):
                line = text[: match.start()].count("\n") + 1
                findings.append(
                    Finding(
                        rule_id="frontend_grant_label_patch",
                        severity="high",
                        path=rel,
                        line=line,
                        message="角色矩阵前端文案/兜底补丁，应使用 grant API 的 label（后端 permission_action_spec）",
                        snippet=_line_snippet(text, line),
                    )
                )
            for match in FRONTEND_ACTION_SORT_PATCH.finditer(text):
                line = text[: match.start()].count("\n") + 1
                findings.append(
                    Finding(
                        rule_id="frontend_grant_action_sort",
                        severity="high",
                        path=rel,
                        line=line,
                        message="前端对 grant actions 二次排序，顺序应由 manifest.permissions 决定",
                        snippet=_line_snippet(text, line),
                    )
                )

        for match in REVIEW_ARRAY_MIX.finditer(text):
            line = text[: match.start()].count("\n") + 1
            findings.append(
                Finding(
                    rule_id="frontend_review_update_mix",
                    severity="high",
                    path=rel,
                    line=line,
                    message="审核权限数组混入 update，违反 REVIEW_ACTIONS 契约",
                    snippet=_line_snippet(text, line, radius=1),
                )
            )

        for match in READ_WITHOUT_UPDATE_BYPASS.finditer(text):
            line = text[: match.start()].count("\n") + 1
            findings.append(
                Finding(
                    rule_id="frontend_read_without_update_bypass",
                    severity="high",
                    path=rel,
                    line=line,
                    message="用 read 且排除 update 冒充其它 action；应使用 manifest action 或 viewer-context",
                    snippet=_line_snippet(text, line, radius=1),
                )
            )

        rel_posix = rel.replace("\\", "/")
        if "/apps/haoligo/" in rel_posix and rel_posix.endswith((".ts", ".tsx")):
            if "utils/permission" in rel_posix or "hooks/useResourcePermissions" in rel_posix:
                pass
            elif HAOLIGO_DIRECT_HAS_PERMISSION.search(text):
                for i, line in enumerate(text.splitlines(), start=1):
                    if HAOLIGO_DIRECT_HAS_PERMISSION.search(line):
                        findings.append(
                            Finding(
                                rule_id="frontend_haoligo_direct_has_permission",
                                severity="high",
                                path=rel,
                                line=i,
                                message="HaoliGO 页面直接使用 hasPermission，应 useResourcePermissions / hasModulePermission",
                                snippet=line.strip(),
                            )
                        )
                        break

        if "useResourcePermissions" in rel.replace("\\", "/"):
            for match in RESOURCE_PERMISSIONS_FAIL_OPEN.finditer(text):
                line = text[: match.start()].count("\n") + 1
                findings.append(
                    Finding(
                        rule_id="frontend_resource_permissions_fail_open",
                        severity="high",
                        path=rel,
                        line=line,
                        message="useResourcePermissions 空 resource fail-open，应 fail-closed",
                        snippet=_line_snippet(text, line),
                    )
                )

        for match in EXTERNAL_PARTNER_BYPASS.finditer(text):
            line = text[: match.start()].count("\n") + 1
            if rel.endswith("utils/externalPartner.ts"):
                continue
            findings.append(
                Finding(
                    rule_id="external_partner_identity_bypass",
                    severity="high",
                    path=rel,
                    line=line,
                    message="外协身份旁路（detectIsOutsource/角色名正则/权限推断），应使用 role_type + external_partner_type",
                    snippet=_line_snippet(text, line),
                )
            )

        for match in EXTERNAL_PARTNER_ROLE_TYPE_DEFAULT.finditer(text):
            line = text[: match.start()].count("\n") + 1
            if rel.endswith("utils/externalPartner.ts"):
                continue
            findings.append(
                Finding(
                    rule_id="external_partner_role_type_default",
                    severity="high",
                    path=rel,
                    line=line,
                    message="缺 role_type 时默认 internal，外协身份须原样透出 DB 字段",
                    snippet=_line_snippet(text, line),
                )
            )

        # 打印应用 hasPermission(..., 'update') 邻近（粗检）
        if "print" in text.lower() and re.search(
            r"hasPermission\s*\([^)]*['\"]update['\"]",
            text,
        ):
            for i, line in enumerate(text.splitlines(), start=1):
                if re.search(r"hasPermission\s*\([^)]*['\"]update['\"]", line) and (
                    "print" in line.lower()
                    or (i > 1 and "print" in text.splitlines()[i - 2].lower())
                ):
                    findings.append(
                        Finding(
                            rule_id="frontend_print_update_same_line",
                            severity="high",
                            path=rel,
                            line=i,
                            message="同一上下文混用 update 与 print 门控",
                            snippet=line.strip(),
                        )
                    )
    return findings


def scan_mobile() -> list[Finding]:
    findings: list[Finding] = []
    if not MOBILE_SRC.is_dir():
        return findings

    for path in sorted(MOBILE_SRC.rglob("*")):
        if path.suffix not in {".ts", ".tsx"}:
            continue
        if "node_modules" in path.parts:
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        rel = _rel(path)

        for match in EXTERNAL_PARTNER_BYPASS.finditer(text):
            line = text[: match.start()].count("\n") + 1
            if rel.endswith("utils/externalPartner.ts"):
                continue
            findings.append(
                Finding(
                    rule_id="mobile_external_partner_identity_bypass",
                    severity="high",
                    path=rel,
                    line=line,
                    message="手机端外协身份旁路，应使用 utils/externalPartner.userIsExternalPartner",
                    snippet=_line_snippet(text, line),
                )
            )

        for match in EXTERNAL_PARTNER_ROLE_TYPE_DEFAULT.finditer(text):
            line = text[: match.start()].count("\n") + 1
            if rel.endswith("utils/externalPartner.ts"):
                continue
            findings.append(
                Finding(
                    rule_id="mobile_external_partner_role_type_default",
                    severity="high",
                    path=rel,
                    line=line,
                    message="缺 role_type 时默认 internal，外协身份须原样透出 DB 字段",
                    snippet=_line_snippet(text, line),
                )
            )

        if "syncOutsourceFromBootstrap" in text:
            line = text.split("syncOutsourceFromBootstrap")[0].count("\n") + 1
            findings.append(
                Finding(
                    rule_id="mobile_bootstrap_outsource_fallback",
                    severity="high",
                    path=rel,
                    line=line,
                    message="bootstrap 回落外协身份，应仅从 auth user role_type 解析",
                    snippet="syncOutsourceFromBootstrap",
                )
            )

        if "is_outsource" in text and "haoligoMobile" in rel.replace("\\", "/"):
            for i, line in enumerate(text.splitlines(), start=1):
                if "is_outsource" in line:
                    findings.append(
                        Finding(
                            rule_id="mobile_bootstrap_is_outsource_field",
                            severity="high",
                            path=rel,
                            line=i,
                            message="bootstrap 返回 is_outsource 第二身份源，应仅用 auth roles",
                            snippet=line.strip(),
                        )
                    )
                    break

        if rel.endswith("[id].tsx") and "equip/" in rel.replace("\\", "/"):
            if re.search(r"\bhasPermission\s*\(", text) and "useDocumentAccessGate" not in text:
                findings.append(
                    Finding(
                        rule_id="mobile_equip_detail_direct_has_permission",
                        severity="high",
                        path=rel,
                        line=1,
                        message="设备详情页直接 hasPermission，应 useDocumentAccessGate + manifest resource",
                        snippet="hasPermission",
                    )
                )
    return findings


def scan_manifest_reference_integrity() -> list[Finding]:
    findings: list[Finding] = []
    try:
        from core.services.authorization.reference_registry_service import ReferenceRegistryService

        errors = ReferenceRegistryService.validate_module_references(enabled_apps=None)
        for msg in errors:
            findings.append(
                Finding(
                    rule_id="module_references_unknown_target",
                    severity="high",
                    path="manifest.json",
                    line=0,
                    message=msg,
                    snippet="module_references",
                )
            )
    except Exception as exc:
        findings.append(
            Finding(
                rule_id="reference_registry_scan_error",
                severity="medium",
                path="reference_registry_service.py",
                line=0,
                message=f"引用资源 registry 扫描失败: {exc}",
                snippet="",
            )
        )
    return findings


SELECTOR_LIST_API_PATTERN = re.compile(
    r"(CustomerSelectDropdown|SupplierSelectDropdown).*?"
    r"(customerApi|supplierApi)\.list",
    re.DOTALL,
)


def scan_frontend_reference_selectors() -> list[Finding]:
    findings: list[Finding] = []
    components_dir = FRONTEND_SRC / "apps" / "master-data" / "components"
    for name in ("CustomerSelectDropdown.tsx", "SupplierSelectDropdown.tsx"):
        path = components_dir / name
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        if re.search(r"(customerApi|supplierApi)\.list", text):
            findings.append(
                Finding(
                    rule_id="selector_uses_list_api",
                    severity="high",
                    path=str(path.relative_to(REPO_ROOT)),
                    line=1,
                    message=f"{name} 仍调用 list API 加载选项，应改用 referenceDisplay",
                    snippet="Api.list",
                )
            )
    warehouse_select = FRONTEND_SRC / "components" / "uni-warehouse-select" / "index.tsx"
    if warehouse_select.is_file():
        text = warehouse_select.read_text(encoding="utf-8")
        if re.search(r"warehouseApi\.list|from ['\"].*warehouse['\"].*list", text):
            findings.append(
                Finding(
                    rule_id="warehouse_selector_uses_list_api",
                    severity="high",
                    path=str(warehouse_select.relative_to(REPO_ROOT)).replace("\\", "/"),
                    line=1,
                    message="UniWarehouseSelect 须走 searchReferenceDisplay，禁止 warehouse list API",
                    snippet="list",
                )
            )
        if "searchReferenceDisplay" not in text:
            findings.append(
                Finding(
                    rule_id="warehouse_selector_missing_reference_display",
                    severity="high",
                    path=str(warehouse_select.relative_to(REPO_ROOT)).replace("\\", "/"),
                    line=1,
                    message="UniWarehouseSelect 缺少 searchReferenceDisplay（跨模块引用读契约）",
                    snippet="",
                )
            )
    return findings


def scan_manifest_permission_declarations() -> list[Finding]:
    """委托 scan_manifest_permissions：码格式 / STANDARD_ACTIONS / 导航∈permissions。"""
    scripts_dir = Path(__file__).resolve().parent
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))
    from scan_manifest_permissions import run_scan as run_manifest_scan

    out: list[Finding] = []
    for item in run_manifest_scan():
        out.append(
            Finding(
                rule_id=item.rule_id,
                severity=item.severity,
                path=item.path,
                line=item.line,
                message=item.message,
                snippet=item.snippet,
            )
        )
    return out


def scan_custom_field_table_reference_mapping() -> list[Finding]:
    """custom_field_pages 关联表须映射到 reference_resources。"""
    findings: list[Finding] = []
    try:
        from core.config.associated_table_registry import reference_resource_for_table, _get_model
        from core.config.custom_field_pages import CUSTOM_FIELD_PAGES
    except Exception as exc:
        findings.append(
            Finding(
                rule_id="custom_field_reference_scan_error",
                severity="medium",
                path="associated_table_registry.py",
                line=0,
                message=f"custom_field 引用表扫描失败: {exc}",
                snippet="",
            )
        )
        return findings

    seen: set[str] = set()
    for page in CUSTOM_FIELD_PAGES:
        table_name = str(page.get("table_name") or "").strip()
        if not table_name or table_name in seen:
            continue
        seen.add(table_name)
        if _get_model(table_name) is None:
            continue
        if reference_resource_for_table(table_name) is None:
            findings.append(
                Finding(
                    rule_id="custom_field_table_unmapped_reference",
                    severity="high",
                    path="associated_table_registry.py",
                    line=0,
                    message=f"custom_field_pages 关联表未映射 reference_resources: {table_name}",
                    snippet=table_name,
                )
            )
    return findings


def scan_service_row_filter_bypass() -> list[Finding]:
    """业务 service 内 is_regular_user 手写行过滤（应 DataScopeService）。"""
    findings: list[Finding] = []
    patterns = [
        (re.compile(r"is_regular_user\s*\(\s*\).*filter\s*\("), "is_regular_user 行过滤"),
        (re.compile(r"\.filter\s*\(\s*buyer_id\s*=\s*current_user"), "buyer_id 手写数据隔离"),
    ]
    roots = [
        BACKEND_SRC / "apps" / "master_data" / "services",
        BACKEND_SRC / "apps" / "kuaizhizao" / "services",
    ]
    allowlist = {
        "customer_pool_service.py",  # 所有权变更校验，非 list visibility
    }
    for root in roots:
        if not root.is_dir():
            continue
        for path in root.rglob("*.py"):
            if path.name in allowlist:
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except Exception:
                continue
            for pat, label in patterns:
                if pat.search(text):
                    rel = path.relative_to(REPO_ROOT).as_posix()
                    findings.append(
                        Finding(
                            rule_id="service_manual_row_scope",
                            severity="medium",
                            path=rel,
                            line=1,
                            message=f"疑似平行数据范围：{label}，应 DataScopeService.apply",
                            snippet=label,
                        )
                    )
                    break
    return findings


def run_scan() -> list[Finding]:
    return (
        scan_backend_apps()
        + scan_frontend()
        + scan_mobile()
        + scan_manifest_reference_integrity()
        + scan_custom_field_table_reference_mapping()
        + scan_frontend_reference_selectors()
        + scan_service_row_filter_bypass()
        + scan_manifest_permission_declarations()
    )


def filter_findings(
    findings: list[Finding],
    *,
    min_severity: str | None = None,
) -> list[Finding]:
    severity_rank = {"high": 3, "medium": 2, "info": 1}
    min_rank = severity_rank.get((min_severity or "").lower(), 0)
    return [f for f in findings if severity_rank.get(f.severity, 0) >= min_rank]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="扫描权限旁路与 action 混用")
    parser.add_argument("--json", action="store_true", help="输出 JSON")
    parser.add_argument(
        "--fail-on",
        choices=("high", "medium", "info", "none"),
        default="high",
        help="违规达到该级别则退出码 1",
    )
    args = parser.parse_args(argv)

    all_findings = run_scan()
    fail_level = None if args.fail_on == "none" else args.fail_on
    active = filter_findings(all_findings, min_severity=fail_level)

    by_severity: dict[str, int] = {}
    for f in all_findings:
        by_severity[f.severity] = by_severity.get(f.severity, 0) + 1

    report = {
        "summary": {
            "total": len(all_findings),
            "active": len(active),
            "by_severity": by_severity,
        },
        "active": [asdict(f) for f in active],
    }

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(f"扫描完成: 共 {len(all_findings)} 条, 待处理 {len(active)}")
        for sev in ("high", "medium", "info"):
            items = [f for f in active if f.severity == sev]
            if not items:
                continue
            print(f"\n[{sev.upper()}] {len(items)}")
            for f in items:
                print(f"  {f.path}:{f.line} [{f.rule_id}] {f.message}")
        if active and fail_level:
            print(f"\n未通过: --fail-on {fail_level}")

    if fail_level and active:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
