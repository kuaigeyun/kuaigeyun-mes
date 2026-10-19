#!/usr/bin/env python3
"""将私有仓应用组装进主仓 src/apps（backend + frontend）。

用法（仓库根目录）:
  python fast-deploy/tools/workspace/compose.py
  python fast-deploy/tools/workspace/compose.py --status
  python fast-deploy/tools/workspace/compose.py --remove

依赖: PyYAML（已在后端环境常见；无则: pip install pyyaml）
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
from pathlib import Path
from typing import Iterator, Tuple

try:
    import yaml
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "需要 PyYAML。请执行: pip install pyyaml\n" + str(exc)
    ) from exc


# fast-deploy/tools/workspace/compose.py → 仓库根
ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CONFIG = Path(__file__).resolve().parent / "workspace.yaml"
BACKEND_APPS = ROOT / "riveredge-backend" / "src" / "apps"
FRONTEND_APPS = ROOT / "riveredge-frontend" / "src" / "apps"
CONFIG_HINT = "fast-deploy/tools/workspace/workspace.yaml"
EXAMPLE_HINT = "fast-deploy/tools/workspace/workspace.example.yaml"

# (mode, repo, label, backend_dir_name, frontend_dir_name)
BindingTuple = Tuple[str, Path, str, str, str]


def _load_config(path: Path) -> dict:
    if not path.is_file():
        raise SystemExit(
            f"未找到 {path}。请复制 {EXAMPLE_HINT} 为 {CONFIG_HINT} 并按本机路径修改。"
        )
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict):
        raise SystemExit(f"配置格式错误: {path}")
    return data


def _resolve_repo(repo: str) -> Path:
    p = Path(repo)
    if not p.is_absolute():
        p = (ROOT / p).resolve()
    return p


def _is_link_or_junction(path: Path) -> bool:
    if path.is_symlink() or os.path.islink(path):
        return True
    if not path.exists():
        return False
    if os.name == "nt" and path.is_dir():
        try:
            resolved = path.resolve()
            return resolved != path and not str(resolved).startswith(str(path))
        except OSError:
            return False
    return False


def _remove_target(path: Path) -> None:
    if not path.exists() and not path.is_symlink():
        return
    if path.is_symlink() or _is_link_or_junction(path):
        path.unlink()
        return
    if path.is_dir():
        shutil.rmtree(path)
        return
    path.unlink()


def _link_or_copy(src: Path, dst: Path, mode: str, *, quiet: bool = False) -> None:
    if not src.is_dir():
        raise SystemExit(f"源目录不存在: {src}")
    dst.parent.mkdir(parents=True, exist_ok=True)
    _remove_target(dst)
    if mode == "copy":
        shutil.copytree(src, dst)
        if not quiet:
            print(f"  copy  {src} -> {dst}")
        return
    if os.name == "nt":
        import subprocess

        r = subprocess.run(
            ["cmd", "/c", "mklink", "/J", str(dst), str(src)],
            capture_output=True,
        )
        if r.returncode != 0:
            detail = (r.stdout or b"") + (r.stderr or b"")
            raise SystemExit(
                f"创建 junction 失败: {dst}\n"
                f"{detail.decode('gbk', errors='replace')}\n"
                "可改用 mode: copy，或以管理员创建 symlink。"
            )
        if not quiet:
            print(f"  junction  {src} -> {dst}")
        return
    os.symlink(src, dst, target_is_directory=True)
    if not quiet:
        print(f"  symlink  {src} -> {dst}")


def _iter_app_bindings(cfg: dict) -> Iterator[BindingTuple]:
    mode = (cfg.get("mode") or "link").strip().lower()
    if mode not in {"link", "copy"}:
        raise SystemExit("mode 只能是 link 或 copy")
    for plugin in cfg.get("plugins") or []:
        repo = _resolve_repo(str(plugin.get("repo") or ""))
        bindings = plugin.get("app_bindings")
        if isinstance(bindings, list) and bindings:
            for item in bindings:
                if not isinstance(item, dict):
                    continue
                label = str(item.get("project") or item.get("code") or "").strip()
                backend = str(item.get("backend") or label).strip()
                frontend = str(item.get("frontend") or backend).strip()
                if not backend:
                    continue
                yield mode, repo, label or backend, backend, frontend
            continue
        for app in plugin.get("apps") or []:
            code = str(app).strip()
            if not code:
                continue
            be_name = code.replace("-", "_")
            fe_name = code
            yield mode, repo, code, be_name, fe_name


def compose(cfg: dict) -> None:
    ok: list[str] = []
    failed: list[str] = []
    for mode, repo, label, be_name, fe_name in _iter_app_bindings(cfg):
        display = (label or be_name).strip()
        be_src = repo / "backend" / "apps" / be_name
        fe_src = repo / "frontend" / "apps" / fe_name
        be_dst = BACKEND_APPS / be_name
        fe_dst = FRONTEND_APPS / fe_name
        assembled = False
        if be_src.is_dir():
            _link_or_copy(be_src, be_dst, mode, quiet=True)
            assembled = True
        if fe_src.is_dir():
            _link_or_copy(fe_src, fe_dst, mode, quiet=True)
            assembled = True
        if assembled:
            print(f"{display} 应用组装成功")
            ok.append(display)
        else:
            print(f"{display} 应用组装失败（源仓无 backend/apps/{be_name} 或 frontend/apps/{fe_name}）")
            failed.append(display)
    industry_ok = [name for name in ok if name.startswith("ind-") or name == "spoke-wheel"]
    print(
        f"组装完成: 成功 {len(ok)}，失败 {len(failed)}"
        + (f"（其中行业包 {len(industry_ok)} 个）" if industry_ok else "")
    )
    if failed:
        raise SystemExit(
            "以下应用组装失败: "
            + ", ".join(failed)
            + "。请检查专业仓路径与 backend/frontend/apps 目录。"
        )


def status(cfg: dict) -> None:
    print(f"状态（根: {ROOT}）")
    for _, repo, label, be_name, fe_name in _iter_app_bindings(cfg):
        for side, name in (("backend", be_name), ("frontend", fe_name)):
            dst = (BACKEND_APPS if side == "backend" else FRONTEND_APPS) / name
            if dst.is_symlink():
                print(f"  {label}/{side}: symlink -> {dst.resolve()}")
            elif dst.is_dir():
                print(f"  {label}/{side}: local dir ({dst})")
            else:
                print(f"  {label}/{side}: MISSING（需 compose；源仓 {repo}）")


def remove_composed(cfg: dict) -> None:
    print("移除已组装的可选应用链接/副本…")
    seen: set[str] = set()
    for _, _, _, be_name, fe_name in _iter_app_bindings(cfg):
        for name in (be_name, fe_name):
            if name in seen:
                continue
            seen.add(name)
            for dst in (BACKEND_APPS / name, FRONTEND_APPS / name):
                if dst.exists() or dst.is_symlink():
                    _remove_target(dst)
                    print(f"  removed {dst}")
    print("完成。")


def main() -> None:
    parser = argparse.ArgumentParser(description="组装私有仓应用到主仓")
    parser.add_argument(
        "--config",
        default=str(DEFAULT_CONFIG),
        help=f"workspace.yaml 路径（默认 {CONFIG_HINT}）",
    )
    parser.add_argument("--status", action="store_true", help="仅查看状态")
    parser.add_argument("--remove", action="store_true", help="移除已组装应用")
    args = parser.parse_args()
    cfg = _load_config(Path(args.config))
    if args.status:
        status(cfg)
        return
    if args.remove:
        remove_composed(cfg)
        return
    compose(cfg)


if __name__ == "__main__":
    main()
