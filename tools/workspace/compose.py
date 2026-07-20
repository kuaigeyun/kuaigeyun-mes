#!/usr/bin/env python3
"""将私有仓应用组装进主仓 src/apps（backend + frontend）。

用法（仓库根目录）:
  python tools/workspace/compose.py
  python tools/workspace/compose.py --config workspace.yaml
  python tools/workspace/compose.py --status
  python tools/workspace/compose.py --remove

依赖: PyYAML（已在后端环境常见；无则: pip install pyyaml）
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
from pathlib import Path

try:
    import yaml
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "需要 PyYAML。请执行: pip install pyyaml\n" + str(exc)
    ) from exc


ROOT = Path(__file__).resolve().parents[2]
BACKEND_APPS = ROOT / "riveredge-backend" / "src" / "apps"
FRONTEND_APPS = ROOT / "riveredge-frontend" / "src" / "apps"


def _load_config(path: Path) -> dict:
    if not path.is_file():
        raise SystemExit(
            f"未找到 {path}。请复制 tools/workspace/workspace.example.yaml "
            f"为仓库根目录 workspace.yaml 并按本机路径修改。"
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
    # Windows junction：解析后的路径与自身不同，且位于仓库外常见
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


def _link_or_copy(src: Path, dst: Path, mode: str) -> None:
    if not src.is_dir():
        raise SystemExit(f"源目录不存在: {src}")
    dst.parent.mkdir(parents=True, exist_ok=True)
    _remove_target(dst)
    if mode == "copy":
        shutil.copytree(src, dst)
        print(f"  copy  {src} -> {dst}")
        return
    # link
    if os.name == "nt":
        # junction 不需要管理员权限（目录）
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
        print(f"  junction  {src} -> {dst}")
        return
    os.symlink(src, dst, target_is_directory=True)
    print(f"  symlink  {src} -> {dst}")


def _iter_app_bindings(cfg: dict):
    mode = (cfg.get("mode") or "link").strip().lower()
    if mode not in {"link", "copy"}:
        raise SystemExit("mode 只能是 link 或 copy")
    for plugin in cfg.get("plugins") or []:
        repo = _resolve_repo(str(plugin.get("repo") or ""))
        for app in plugin.get("apps") or []:
            code = str(app).strip()
            if not code:
                continue
            yield mode, repo, code


def compose(cfg: dict) -> None:
    print(f"组装根目录: {ROOT}")
    for mode, repo, code in _iter_app_bindings(cfg):
        print(f"\n[{code}] from {repo}")
        be_src = repo / "backend" / "apps" / code
        fe_src = repo / "frontend" / "apps" / code
        be_dst = BACKEND_APPS / code
        fe_dst = FRONTEND_APPS / code
        if be_src.is_dir():
            _link_or_copy(be_src, be_dst, mode)
        else:
            print(f"  skip backend（无 {be_src}）")
        if fe_src.is_dir():
            _link_or_copy(fe_src, fe_dst, mode)
        else:
            print(f"  skip frontend（无 {fe_src}）")
    print("\n完成。重启后端与前端后生效。")


def status(cfg: dict) -> None:
    print(f"状态（根: {ROOT}）")
    for _, repo, code in _iter_app_bindings(cfg):
        for label, dst in (
            ("backend", BACKEND_APPS / code),
            ("frontend", FRONTEND_APPS / code),
        ):
            if dst.is_symlink():
                print(f"  {code}/{label}: symlink -> {dst.resolve()}")
            elif dst.is_dir():
                print(f"  {code}/{label}: local dir ({dst})")
            else:
                print(f"  {code}/{label}: MISSING（需 compose；源仓 {repo}）")


def remove_composed(cfg: dict) -> None:
    print("移除已组装的可选应用链接/副本…")
    for _, _, code in _iter_app_bindings(cfg):
        for dst in (BACKEND_APPS / code, FRONTEND_APPS / code):
            if dst.exists() or dst.is_symlink():
                _remove_target(dst)
                print(f"  removed {dst}")
    print("完成。")


def main() -> None:
    parser = argparse.ArgumentParser(description="组装私有仓应用到主仓")
    parser.add_argument(
        "--config",
        default=str(ROOT / "workspace.yaml"),
        help="workspace.yaml 路径",
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
