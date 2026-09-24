#!/usr/bin/env python3
"""
扫描应用 manifest 权限声明规范性。

用法:
  python scripts/scan_manifest_permissions.py
  python scripts/scan_manifest_permissions.py --fail-on high

规则:
  high   — permissions[] 码格式非法 / action 不在 STANDARD_ACTIONS
  medium — 导航叶子 permission 未出现在该应用 permissions[]
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_SRC = REPO_ROOT / "riveredge-backend" / "src"
APPS_DIR = BACKEND_SRC / "apps"

if str(BACKEND_SRC) not in sys.path:
    sys.path.insert(0, str(BACKEND_SRC))

from core.config.permission_action_spec import STANDARD_ACTIONS  # noqa: E402


def normalize_permission_code(code: str) -> str:
    """与 menu_resource_resolver 一致：trim + lower；本脚本避免 import services 包。"""
    return (code or "").strip().lower()


@dataclass
class Finding:
    rule_id: str
    severity: str
    path: str
    line: int
    message: str
    snippet: str


def _iter_nav_permissions(node: object, path: str) -> list[tuple[str, str]]:
    """收集导航树中所有 permission 字段：(permission_code, node_path)。"""
    out: list[tuple[str, str]] = []
    if not isinstance(node, dict):
        return out
    code = node.get("permission")
    if isinstance(code, str) and code.strip():
        out.append((code.strip(), path))
    children = node.get("children")
    if isinstance(children, list):
        for i, child in enumerate(children):
            out.extend(_iter_nav_permissions(child, f"{path}.children[{i}]"))
    return out


def _validate_code_format(code: str) -> str | None:
    """返回错误信息；合法则 None。"""
    norm = normalize_permission_code(code)
    if not norm:
        return "权限码为空"
    parts = [p for p in norm.split(":") if p]
    if len(parts) < 3:
        return f"权限码须为 {{app}}:{{module}}:{{action}}，当前={code!r}"
    action = parts[-1]
    if action not in STANDARD_ACTIONS:
        return f"action={action!r} 不在 STANDARD_ACTIONS"
    return None


def run_scan() -> list[Finding]:
    findings: list[Finding] = []
    if not APPS_DIR.is_dir():
        return findings

    manifests: list[tuple[Path, dict]] = []
    global_declared: set[str] = set()
    for manifest_path in sorted(APPS_DIR.glob("*/manifest.json")):
        try:
            data = json.loads(manifest_path.read_text(encoding="utf-8"))
        except Exception:
            data = None
        if not isinstance(data, dict):
            findings.extend(scan_manifest_file(manifest_path, global_declared=set()))
            continue
        manifests.append((manifest_path, data))
        raw = data.get("permissions")
        if isinstance(raw, list):
            for item in raw:
                if isinstance(item, str):
                    norm = normalize_permission_code(item)
                    if norm:
                        global_declared.add(norm)

    # 入口码常仅挂在 menu_config，不进 permissions[]；全站认作合法导航码
    for path, data in manifests:
        app_code = str(data.get("code") or path.parent.name).strip().lower()
        if app_code:
            global_declared.add(f"{app_code}:entry:read")

    for manifest_path, _data in manifests:
        findings.extend(scan_manifest_file(manifest_path, global_declared=global_declared))
    return findings


def scan_manifest_file(
    manifest_path: Path,
    *,
    global_declared: set[str] | None = None,
) -> list[Finding]:
    findings: list[Finding] = []
    rel = str(manifest_path.relative_to(REPO_ROOT)).replace("\\", "/")
    try:
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception as exc:
        findings.append(
            Finding(
                rule_id="manifest_json_invalid",
                severity="high",
                path=rel,
                line=0,
                message=f"manifest 无法解析: {exc}",
                snippet="",
            )
        )
        return findings

    if not isinstance(data, dict):
        findings.append(
            Finding(
                rule_id="manifest_not_object",
                severity="high",
                path=rel,
                line=0,
                message="manifest 根须为 JSON 对象",
                snippet="",
            )
        )
        return findings

    app_code = str(data.get("code") or manifest_path.parent.name).strip()
    raw_permissions = data.get("permissions")
    declared: set[str] = set()
    if raw_permissions is None:
        pass
    elif not isinstance(raw_permissions, list):
        findings.append(
            Finding(
                rule_id="manifest_permissions_not_list",
                severity="high",
                path=rel,
                line=0,
                message="permissions 须为字符串数组",
                snippet="permissions",
            )
        )
    else:
        for raw in raw_permissions:
            if not isinstance(raw, str):
                findings.append(
                    Finding(
                        rule_id="manifest_permission_not_string",
                        severity="high",
                        path=rel,
                        line=0,
                        message=f"permissions 元素须为字符串，当前={raw!r}",
                        snippet=str(raw),
                    )
                )
                continue
            err = _validate_code_format(raw)
            if err:
                findings.append(
                    Finding(
                        rule_id="manifest_permission_invalid",
                        severity="high",
                        path=rel,
                        line=0,
                        message=f"{app_code}: {err}",
                        snippet=raw,
                    )
                )
                continue
            declared.add(normalize_permission_code(raw))

    catalog = global_declared if global_declared is not None else declared

    nav_roots: list[tuple[str, object]] = []
    if "menu_config" in data:
        nav_roots.append(("menu_config", data.get("menu_config")))
    if "navigation" in data:
        nav_roots.append(("navigation", data.get("navigation")))

    for root_name, root in nav_roots:
        for code, node_path in _iter_nav_permissions(root, root_name):
            err = _validate_code_format(code)
            if err:
                findings.append(
                    Finding(
                        rule_id="manifest_nav_permission_invalid",
                        severity="high",
                        path=rel,
                        line=0,
                        message=f"{app_code} {node_path}: {err}",
                        snippet=code,
                    )
                )
                continue
            norm = normalize_permission_code(code)
            # 跨应用挂菜单合法：码须在全站 permissions 目录（或 entry:read）中存在
            if catalog and norm not in catalog:
                findings.append(
                    Finding(
                        rule_id="manifest_nav_permission_undeclared",
                        severity="medium",
                        path=rel,
                        line=0,
                        message=(
                            f"{app_code} 导航 {node_path} 的 permission={norm} "
                            f"未出现在任何应用 permissions[]"
                        ),
                        snippet=norm,
                    )
                )

    return findings


def filter_findings(
    findings: list[Finding],
    *,
    min_severity: str | None = None,
) -> list[Finding]:
    severity_rank = {"high": 3, "medium": 2, "info": 1}
    min_rank = severity_rank.get((min_severity or "").lower(), 0)
    return [f for f in findings if severity_rank.get(f.severity, 0) >= min_rank]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="扫描 manifest 权限声明规范性")
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
