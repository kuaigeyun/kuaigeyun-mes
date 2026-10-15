#!/usr/bin/env python3
"""根据 deploy.env 与定制仓 projects/registry.yaml 生成 workspace.yaml。

专业仓（kuaigeyun-pro）同时承载：
  - 专业 APP（kuaiplm / kuaicaiwu / …）
  - 付费行业包（spoke-wheel / ind-*）

组装专业仓时必须把仓内实际存在的行业包一并写入 apps，禁止只装 kuai*。
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

try:
    import yaml
except ImportError as exc:  # pragma: no cover
    raise SystemExit("需要 PyYAML: pip install pyyaml") from exc

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_REGISTRY = "projects/registry.yaml"

# 专业 APP（License）；序与 pro_app_catalog / 应用中心一致
PRO_CORE_APPS = [
    "kuaipd",
    "kuaiplm",
    "kuaicaiwu",
    "kuaioa",
    "kuaireport",
    "kuaiiot",
    "kuaiai",
    "kuaiconnect",
]

# 与专业仓同仓发布的行业包（应用中心「行业」Tab；主仓不发源码）
PRO_INDUSTRY_APPS = [
    "spoke-wheel",
    "ind-electronics",
    "ind-mold",
    "ind-relay",
    "ind-foreign-trade",
]

# 目录优先序 + 兼容旧引用
PRO_APPS = PRO_CORE_APPS + PRO_INDUSTRY_APPS


def _relpath(from_root: Path, target: Path) -> str:
    try:
        return os.path.relpath(str(target.resolve()), str(from_root.resolve())).replace("\\", "/")
    except ValueError:
        return str(target)


def _pro_app_code_from_backend_dir(name: str) -> str:
    """backend 目录名 → 应用 code（ind_foreign_trade → ind-foreign-trade）。"""
    return name.replace("_", "-") if "_" in name else name


def discover_pro_repo_app_codes(pro_repo: Path) -> list[str]:
    """扫描专业仓 frontend/backend apps，返回可组装的应用 code（前端 kebab 名）。"""
    fe_root = pro_repo / "frontend" / "apps"
    be_root = pro_repo / "backend" / "apps"
    codes: set[str] = set()
    if fe_root.is_dir():
        for path in fe_root.iterdir():
            if path.is_dir() and not path.name.startswith((".", "_")):
                codes.add(path.name)
    if be_root.is_dir():
        for path in be_root.iterdir():
            if path.is_dir() and not path.name.startswith((".", "_")):
                codes.add(_pro_app_code_from_backend_dir(path.name))
    return sorted(codes)


def resolve_pro_apps(pro_repo: Path) -> list[str]:
    """
    组装清单 = 目录序（专业 + 行业）∩ 专业仓实存 + 仓内额外应用。

    行业包与专业 APP 同仓；禁止只写 kuai* 漏掉 ind-* / spoke-wheel。
    """
    present = set(discover_pro_repo_app_codes(pro_repo))
    if not present:
        print(
            f"WARN: 专业仓未发现 apps 或为空: {pro_repo}；仍按目录清单写入 workspace.yaml",
            file=sys.stderr,
        )
        return list(PRO_APPS)

    ordered: list[str] = []
    for code in PRO_APPS:
        if code in present and code not in ordered:
            ordered.append(code)
    for code in sorted(present):
        if code not in ordered:
            ordered.append(code)

    missing_catalog = [code for code in PRO_APPS if code not in present]
    if missing_catalog:
        print(
            "WARN: 专业仓缺少目录清单中的应用（已跳过）: " + ", ".join(missing_catalog),
            file=sys.stderr,
        )

    industry_codes = [
        code
        for code in ordered
        if code in PRO_INDUSTRY_APPS or code.startswith("ind-")
    ]
    print(
        f"专业仓组装清单 {len(ordered)} 个（含行业包 {len(industry_codes)} 个）: "
        + ", ".join(ordered),
        file=sys.stderr,
    )
    return ordered


def _load_registry(custom_repo: Path) -> dict:
    path = custom_repo / DEFAULT_REGISTRY
    if not path.is_file():
        raise SystemExit(f"定制仓缺少注册表: {path}")
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    projects = data.get("projects")
    if not isinstance(projects, dict) or not projects:
        raise SystemExit(f"注册表无 projects: {path}")
    return projects


def _find_custom_plugin(doc: dict) -> dict | None:
    for plugin in doc.get("plugins") or []:
        if isinstance(plugin, dict) and isinstance(plugin.get("app_bindings"), list):
            if plugin["app_bindings"]:
                return plugin
    return None


def list_custom_project_rows(custom_repo: Path) -> list[tuple[str, str]]:
    registry = _load_registry(custom_repo)
    rows: list[tuple[str, str]] = []
    for project_id in registry.keys():
        entry = registry[project_id]
        if not isinstance(entry, dict):
            continue
        desc = str(entry.get("description") or project_id).strip()
        rows.append((project_id, desc))
    return rows


def custom_projects_csv_from_yaml(path: Path) -> str:
    """从已有 workspace.yaml 的 app_bindings 提取 project id 列表。"""
    if not path.is_file():
        return ""
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    plugin = _find_custom_plugin(data)
    if not plugin:
        return ""
    names: list[str] = []
    for item in plugin["app_bindings"]:
        if not isinstance(item, dict):
            continue
        name = str(item.get("project") or item.get("code") or "").strip()
        if name and name not in names:
            names.append(name)
    return ",".join(names)


def _resolve_custom_bindings(custom_repo: Path, projects_csv: str) -> list[dict]:
    registry = _load_registry(custom_repo)
    names = [p.strip() for p in (projects_csv or "").split(",") if p.strip()]
    if not names:
        raise SystemExit(
            "CUSTOM_ENABLED=1 时必须设置 CUSTOM_PROJECTS（逗号分隔项目 id，见定制仓 projects/registry.yaml）"
        )
    bindings: list[dict] = []
    for name in names:
        entry = registry.get(name)
        if not isinstance(entry, dict):
            known = ", ".join(sorted(registry.keys()))
            raise SystemExit(f"未知定制项目 '{name}'，可选: {known}")
        apps = entry.get("apps")
        if isinstance(apps, str):
            backend = frontend = apps
        elif isinstance(apps, dict):
            backend = str(apps.get("backend") or name).strip()
            frontend = str(apps.get("frontend") or backend).strip()
        else:
            backend = frontend = name
        bindings.append({"backend": backend, "frontend": frontend, "project": name})
    return bindings


def build_workspace(
    *,
    mode: str,
    pro_enabled: bool,
    custom_enabled: bool,
    pro_repo: Path,
    custom_repo: Path,
    custom_projects: str,
    compose_scope: str = "all",
    merge_from: Path | None = None,
) -> dict:
    scope = (compose_scope or "all").strip().lower()
    if scope not in {"pro", "custom", "all"}:
        raise SystemExit(f"compose_scope 无效: {compose_scope}")

    existing_doc: dict | None = None
    existing_custom: dict | None = None
    if merge_from and merge_from.is_file():
        existing_doc = yaml.safe_load(merge_from.read_text(encoding="utf-8")) or {}
        existing_custom = _find_custom_plugin(existing_doc)

    projects_csv = (custom_projects or "").strip()
    if custom_enabled and not projects_csv and existing_custom:
        projects_csv = custom_projects_csv_from_yaml(merge_from)  # type: ignore[arg-type]

    plugins: list[dict] = []

    if pro_enabled:
        pro_apps = resolve_pro_apps(pro_repo)
        plugins.append(
            {
                "repo": _relpath(ROOT, pro_repo),
                "apps": pro_apps,
            }
        )

    if custom_enabled:
        if not projects_csv:
            if scope == "pro":
                if existing_custom:
                    plugins.append(existing_custom)
                    print(
                        "WARN: CUSTOM_ENABLED=1 但未配置 CUSTOM_PROJECTS；"
                        "本次仅刷新专业包（含行业包），定制包沿用现有 workspace.yaml",
                        file=sys.stderr,
                    )
                else:
                    print(
                        "WARN: CUSTOM_ENABLED=1 但未配置 CUSTOM_PROJECTS，且无既有 workspace；"
                        "本次仅组装专业包（含行业包）",
                        file=sys.stderr,
                    )
            elif scope == "custom":
                raise SystemExit(
                    "安装/更新定制包时必须设置 CUSTOM_PROJECTS（逗号分隔，见定制仓 projects/registry.yaml）"
                )
            else:
                raise SystemExit(
                    "CUSTOM_ENABLED=1 时必须设置 CUSTOM_PROJECTS（逗号分隔，见定制仓 projects/registry.yaml）"
                )
        else:
            bindings = _resolve_custom_bindings(custom_repo, projects_csv)
            plugins.append({"repo": _relpath(ROOT, custom_repo), "app_bindings": bindings})

    if not plugins:
        raise SystemExit("PRO_ENABLED / CUSTOM_ENABLED 均为未启用，无法生成 workspace.yaml")
    return {"mode": mode, "plugins": plugins}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", help="workspace.yaml 输出路径")
    parser.add_argument("--mode", default=os.environ.get("WORKSPACE_COMPOSE_MODE", "copy"))
    parser.add_argument("--pro-enabled", default=os.environ.get("PRO_ENABLED", "0"))
    parser.add_argument("--custom-enabled", default=os.environ.get("CUSTOM_ENABLED", "0"))
    parser.add_argument("--pro-repo", default=os.environ.get("PRO_REPO_PATH", ""))
    parser.add_argument("--custom-repo", default=os.environ.get("CUSTOM_REPO_PATH", ""))
    parser.add_argument("--custom-projects", default=os.environ.get("CUSTOM_PROJECTS", ""))
    parser.add_argument(
        "--compose-scope",
        default=os.environ.get("COMPOSE_SCOPE", "all"),
        choices=["pro", "custom", "all"],
    )
    parser.add_argument(
        "--merge-from",
        default=os.environ.get("WORKSPACE_MERGE_FROM", ""),
        help="合并已有 workspace.yaml 中的定制 app_bindings",
    )
    parser.add_argument(
        "--print-custom-projects",
        metavar="WORKSPACE_YAML",
        help="从已有 workspace.yaml 打印 CUSTOM_PROJECTS 并退出",
    )
    parser.add_argument(
        "--list-custom-projects",
        metavar="CUSTOM_REPO",
        help="列出 registry 中可选定制项目（id<TAB>description，每行一个）",
    )
    args = parser.parse_args()

    if args.print_custom_projects:
        csv = custom_projects_csv_from_yaml(Path(args.print_custom_projects))
        print(csv, end="")
        return

    if args.list_custom_projects:
        repo = Path(args.list_custom_projects)
        for project_id, desc in list_custom_project_rows(repo):
            print(f"{project_id}\t{desc}")
        return

    if not args.output:
        raise SystemExit("缺少 --output")

    pro_en = str(args.pro_enabled).strip() == "1"
    custom_en = str(args.custom_enabled).strip() == "1"
    pro_repo = Path(args.pro_repo) if args.pro_repo else (ROOT.parent / "kuaigeyun-pro")
    custom_repo = Path(args.custom_repo) if args.custom_repo else (ROOT.parent / "kuaigeyun-custom")
    merge_from = Path(args.merge_from) if args.merge_from else None

    doc = build_workspace(
        mode=str(args.mode or "copy"),
        pro_enabled=pro_en,
        custom_enabled=custom_en,
        pro_repo=pro_repo,
        custom_repo=custom_repo,
        custom_projects=str(args.custom_projects or ""),
        compose_scope=str(args.compose_scope or "all"),
        merge_from=merge_from,
    )
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    header = (
        "# generated by fast-deploy — do not commit secrets\n"
        "# pro apps include industry packs from the same private repo (ind-* / spoke-wheel)\n"
    )
    out.write_text(header + yaml.safe_dump(doc, allow_unicode=True, sort_keys=False), encoding="utf-8")
    print(f"Wrote {out} ({len(doc.get('plugins') or [])} plugins)")


if __name__ == "__main__":
    main()
