"""
标准件库：从 JSON 文件加载，每文件对应一个类型（分类）。

默认目录：apps/master_data/data/standard_parts/*.json
可通过环境变量 STANDARD_PARTS_LIBRARY_DIR 指向其它目录（便于 Docker 挂载扩展库）。

每个 JSON 根对象字段：
- sortOrder（可选 int）：分类排序，默认 999；相同时按文件名排序。
- primaryCategory（可选 str）：一级大类，用于前端二级筛选。允许值见代码中
  PRIMARY_CATEGORY_DEFAULT / PRIMARY_CATEGORY_ALLOWED（缺省视为 standard_parts；
  非法值记入 general 并打日志）。
- id（必填 str）：分类 id，全局唯一。
- name、description：分类展示。
- items（必填 array）：标准件条目，每项含 preset_key, name, specification, gb_standard, gb_code，
  可选 base_unit（默认「件」）、texture、description。

仅负责目录扫描与校验；业务创建仍由 MaterialService.load_standard_parts_preset 调用。
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, TypedDict

from loguru import logger


class StandardPartItemDict(TypedDict, total=False):
    preset_key: str
    name: str
    specification: str
    gb_standard: str
    gb_code: str
    base_unit: str
    texture: str
    description: str


PRIMARY_CATEGORY_DEFAULT = "standard_parts"
PRIMARY_CATEGORY_ALLOWED = frozenset(
    {
        # 机电类外购标准件（紧固件、轴承、密封、管件等）
        "standard_parts",
        # 金属/非金属坯料与采购主料（板、棒、管、锭等，区别于已规格化的标准件）
        "raw_materials",
        # 电气与自动化元件（低压电器、传感器、连接件等）
        "electrical_components",
        # 刀具、夹具附件、量具检具（常单独管控）
        "tools_and_gauges",
        # 油品、切削液、清洗剂、胶粘与化学品
        "chemicals_lubricants",
        # 间接生产辅材（砂纸、磨料、工装辅料等，与易耗品可再细分）
        "auxiliary_materials",
        # 劳保、清洁、办公类易耗等
        "consumables",
        # 运输与防护包材
        "packaging",
        # 设备维修/MRO 与备件（与生产用标准件并列时常单独统计）
        "mro_spares",
        # 未归类或跨类
        "general",
    }
)


def _normalize_primary_category(raw: Any, filename: str) -> str:
    s = str(raw or "").strip()
    if not s:
        return PRIMARY_CATEGORY_DEFAULT
    if s in PRIMARY_CATEGORY_ALLOWED:
        return s
    logger.warning("标准件库 {} 未知 primaryCategory「{}」，已归入 general", filename, s)
    return "general"


class StandardPartCategoryDict(TypedDict):
    id: str
    name: str
    description: str
    primary_category: str
    items: List[StandardPartItemDict]


def _default_library_dir() -> Path:
    """与 master_data 包相对：apps/master_data/data/standard_parts"""
    return Path(__file__).resolve().parent.parent / "data" / "standard_parts"


def get_standard_parts_library_dir() -> Path:
    override = (os.environ.get("STANDARD_PARTS_LIBRARY_DIR") or "").strip()
    if override:
        return Path(override)
    return _default_library_dir()


_categories_cache: Optional[List[StandardPartCategoryDict]] = None
_index_cache: Optional[Dict[str, StandardPartItemDict]] = None
# 目录下 json 文件名 + mtime，任一变化则重新扫描（避免仅加文件却要重启服务）
_fingerprint_at_load: Optional[tuple] = None


def _library_fingerprint() -> tuple:
    base = get_standard_parts_library_dir()
    if not base.is_dir():
        return ()
    paths = sorted(p for p in base.glob("*.json") if not p.name.startswith("_"))
    return tuple((p.name, int(p.stat().st_mtime_ns)) for p in paths)


def clear_standard_parts_library_cache() -> None:
    """清空内存缓存（测试或热加载前可调用）。"""
    global _categories_cache, _index_cache, _fingerprint_at_load
    _categories_cache = None
    _index_cache = None
    _fingerprint_at_load = None


def reload_standard_parts_library() -> None:
    """强制重新扫描 JSON 目录。"""
    clear_standard_parts_library_cache()
    _ensure_loaded()


def _normalize_item(raw: Dict[str, Any], category_id: str) -> StandardPartItemDict:
    pk = str(raw.get("preset_key", "")).strip()
    if not pk:
        raise ValueError(f"分类 {category_id} 中存在缺少 preset_key 的条目")
    name = str(raw.get("name", "")).strip()
    if not name:
        raise ValueError(f"preset_key={pk} 缺少 name")
    gb_code = str(raw.get("gb_code", "")).strip()[:50]
    out: StandardPartItemDict = {
        "preset_key": pk,
        "name": name,
        "specification": str(raw.get("specification", "")).strip(),
        "gb_standard": str(raw.get("gb_standard", "")).strip(),
        "gb_code": gb_code,
        "base_unit": (str(raw.get("base_unit", "")).strip() or "件")[:20],
    }
    if raw.get("texture"):
        out["texture"] = str(raw["texture"]).strip()[:100]
    if raw.get("description"):
        out["description"] = str(raw["description"]).strip()
    return out


def _parse_category_object(filename: str, data: Dict[str, Any]) -> StandardPartCategoryDict:
    cid = str(data.get("id", "")).strip()
    if not cid:
        raise ValueError("缺少 id（分类唯一标识）")
    cname = str(data.get("name", "")).strip()
    if not cname:
        raise ValueError(f"{filename}: 缺少 name")
    desc = str(data.get("description", "") or "").strip()

    items_raw = data.get("items")
    if not isinstance(items_raw, list):
        raise ValueError("items 须为数组")
    items: List[StandardPartItemDict] = []
    for raw in items_raw:
        if isinstance(raw, dict):
            items.append(_normalize_item(raw, cid))

    pc = _normalize_primary_category(
        data.get("primaryCategory") or data.get("primary_category"),
        filename,
    )

    return {
        "id": cid,
        "name": cname,
        "description": desc,
        "primary_category": pc,
        "items": items,
    }


def _load_all_categories() -> List[StandardPartCategoryDict]:
    base = get_standard_parts_library_dir()
    if not base.is_dir():
        logger.warning("标准件库目录不存在或不是目录: {}", base)
        return []

    rows: List[tuple[int, str, StandardPartCategoryDict]] = []
    for path in sorted(base.glob("*.json")):
        if path.name.startswith("_"):
            continue
        try:
            with path.open(encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, dict):
                logger.error("标准件库 {} 根节点不是对象，已跳过", path.name)
                continue
            sort_order = data.get("sortOrder", 999)
            try:
                so = int(sort_order)
            except (TypeError, ValueError):
                so = 999
            cat = _parse_category_object(path.name, data)
            rows.append((so, path.name, cat))
        except Exception as e:
            logger.error("加载标准件库文件失败 {}: {}", path.name, e)
            continue

    rows.sort(key=lambda x: (x[0], x[1]))
    return [r[2] for r in rows]


def _build_index(categories: List[StandardPartCategoryDict]) -> Dict[str, StandardPartItemDict]:
    idx: Dict[str, StandardPartItemDict] = {}
    for cat in categories:
        for it in cat["items"]:
            pk = it["preset_key"]
            if pk in idx:
                logger.warning(
                    "重复 preset_key「{}」已忽略（保留先加载条目；分类 {}）",
                    pk,
                    cat["id"],
                )
                continue
            idx[pk] = it
    return idx


def _ensure_loaded() -> None:
    global _categories_cache, _index_cache, _fingerprint_at_load
    fp = _library_fingerprint()
    if (
        _categories_cache is not None
        and _index_cache is not None
        and _fingerprint_at_load == fp
    ):
        return
    cats = _load_all_categories()
    _categories_cache = cats
    _index_cache = _build_index(cats)
    _fingerprint_at_load = fp


def get_standard_parts_categories() -> List[StandardPartCategoryDict]:
    """已排序的分类列表（内存缓存）。"""
    _ensure_loaded()
    return list(_categories_cache or [])


def get_standard_part_by_preset_key(preset_key: str) -> Optional[StandardPartItemDict]:
    _ensure_loaded()
    if not _index_cache:
        return None
    return _index_cache.get(preset_key)


def validate_preset_keys(preset_keys: List[str]) -> None:
    from infra.exceptions.exceptions import ValidationError

    _ensure_loaded()
    if not _index_cache:
        raise ValidationError("标准件库未加载或为空，请检查 data/standard_parts 下 JSON 配置")
    for k in preset_keys:
        if k not in _index_cache:
            raise ValidationError(f"未知的标准件 presetKey: {k}")


def standard_parts_preset_catalog_for_api() -> Dict[str, Any]:
    """供 GET preset-preview：不含租户数据，仅目录。"""
    categories: List[Dict[str, Any]] = []
    for cat in get_standard_parts_categories():
        categories.append(
            {
                "id": cat["id"],
                "name": cat["name"],
                "description": cat["description"],
                "primaryCategory": cat["primary_category"],
                "items": [
                    {
                        "presetKey": it["preset_key"],
                        "name": it["name"],
                        "specification": it.get("specification") or "",
                        "gbStandard": it.get("gb_standard") or "",
                        "gbCode": it.get("gb_code") or "",
                        "baseUnit": it.get("base_unit") or "件",
                        **({"texture": it["texture"]} if it.get("texture") else {}),
                        **({"description": it["description"]} if it.get("description") else {}),
                    }
                    for it in cat["items"]
                ],
            }
        )
    return {"categories": categories}
