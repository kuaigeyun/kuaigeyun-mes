"""
标准件预设目录（行业 / 一级分类 / 二级分类）：

- 存储：apps/master_data/data/standard_parts/*.json（每文件一个二级分类）
- 行业维度：industryId / industryName / industryDescription（可省略，省略时按一级分类推断）
- 一级分类：primaryCategory（standard_parts/raw_materials/electrical_components/auxiliary_materials）
- 二级分类：文件中的 id/name/description + items[]

对外：
- load-preset 仍按 presetKey 导入，不依赖前端层级结构
- preset-preview 返回 industries + categories（categories 保留兼容）
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, TypedDict

from loguru import logger
from apps.master_data.services.process_preset_catalog import INDUSTRY_PRESETS


class StandardPartItemDict(TypedDict, total=False):
    preset_key: str
    name: str
    specification: str
    gb_standard: str
    gb_code: str
    base_unit: str
    texture: str
    description: str


PRIMARY_CATEGORY_ALLOWED = frozenset(
    {
        "standard_parts",
        "raw_materials",
        "electrical_components",
        "auxiliary_materials",
        "general",
    }
)

PRIMARY_CATEGORY_LABELS: Dict[str, str] = {
    "standard_parts": "标准件",
    "raw_materials": "原材料",
    "electrical_components": "电气与自动化",
    "auxiliary_materials": "辅材",
    "general": "其它",
}

INDUSTRY_PRESET_META: Dict[str, Dict[str, str]] = {
    ind["id"]: {
        "name": ind["name"],
        "description": str(ind.get("description") or ""),
    }
    for ind in INDUSTRY_PRESETS
}
INDUSTRY_ORDER = [ind["id"] for ind in INDUSTRY_PRESETS]


def _normalize_primary_category(raw: Any, filename: str) -> str:
    s = str(raw or "").strip()
    if not s:
        raise ValueError(f"{filename}: 缺少 primaryCategory")
    if s in PRIMARY_CATEGORY_ALLOWED:
        return s
    raise ValueError(f"{filename}: 未知 primaryCategory「{s}」")


class StandardPartCategoryDict(TypedDict):
    id: str
    name: str
    description: str
    industry_id: str
    industry_name: str
    industry_description: str
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
    industry_id = str(data.get("industryId") or data.get("industry_id") or "").strip()
    if not industry_id:
        raise ValueError(f"{filename}: 缺少 industryId（须与工艺预设行业一致）")
    if industry_id not in INDUSTRY_PRESET_META:
        raise ValueError(f"{filename}: 未知 industryId「{industry_id}」（须与工艺预设行业 id 一致）")
    industry_meta = INDUSTRY_PRESET_META[industry_id]

    return {
        "id": cid,
        "name": cname,
        "description": desc,
        "industry_id": industry_id,
        "industry_name": industry_meta["name"],
        "industry_description": industry_meta["description"],
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


def get_preset_key_category_lookup() -> Dict[str, Dict[str, str]]:
    """
    preset_key -> 所属预设分类元数据（用于按分类建物料分组）。
    键：industry_id, industry_name, primary_category, category_id, category_name, category_description
    """
    _ensure_loaded()
    out: Dict[str, Dict[str, str]] = {}
    for cat in _categories_cache or []:
        cid = cat["id"]
        cname = cat["name"]
        cdesc = str(cat.get("description") or "")
        for it in cat["items"]:
            pk = it["preset_key"]
            out[pk] = {
                "industry_id": cat["industry_id"],
                "industry_name": cat["industry_name"],
                "primary_category": cat["primary_category"],
                "category_id": cid,
                "category_name": cname,
                "category_description": cdesc,
            }
    return out


def standard_parts_preset_catalog_for_api() -> Dict[str, Any]:
    """供 GET preset-preview：返回 industries（三层）+ 全量 taxonomy。"""
    industries_map: Dict[str, Dict[str, Any]] = {}
    taxonomy_primary: Dict[str, Dict[str, Any]] = {}
    taxonomy_secondary: Dict[str, Dict[str, Any]] = {}
    for cat in get_standard_parts_categories():
        cat_obj = {
            "id": cat["id"],
            "name": cat["name"],
            "description": cat["description"],
            "industryId": cat["industry_id"],
            "industryName": cat["industry_name"],
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

        ind = industries_map.get(cat["industry_id"])
        if not ind:
            ind = {
                "id": cat["industry_id"],
                "name": cat["industry_name"],
                "description": cat["industry_description"],
                "primaryCategories": {},
            }
            industries_map[cat["industry_id"]] = ind
        pkey = cat["primary_category"]
        pmap = ind["primaryCategories"]
        if pkey not in pmap:
            pmap[pkey] = {
                "id": pkey,
                "name": PRIMARY_CATEGORY_LABELS.get(pkey, pkey),
                "categories": [],
            }
        pmap[pkey]["categories"].append(cat_obj)

        if pkey not in taxonomy_primary:
            taxonomy_primary[pkey] = {
                "id": pkey,
                "name": PRIMARY_CATEGORY_LABELS.get(pkey, pkey),
            }
        if cat["id"] not in taxonomy_secondary:
            taxonomy_secondary[cat["id"]] = {
                "id": cat["id"],
                "name": cat["name"],
                "description": cat["description"],
                "primaryCategory": pkey,
            }

    industries: List[Dict[str, Any]] = []
    for iid in INDUSTRY_ORDER:
        ind = industries_map.get(iid) or {
            "id": iid,
            "name": INDUSTRY_PRESET_META[iid]["name"],
            "description": INDUSTRY_PRESET_META[iid]["description"],
            "primaryCategories": {},
        }
        pkeys = list(ind["primaryCategories"].keys())
        pkeys.sort(key=lambda x: (0 if x in PRIMARY_CATEGORY_LABELS else 1, x))
        industries.append(
            {
                "id": ind["id"],
                "name": ind["name"],
                "description": ind["description"],
                "primaryCategories": [ind["primaryCategories"][k] for k in pkeys],
            }
        )
    for iid, ind in industries_map.items():
        if iid in INDUSTRY_ORDER:
            continue
        pkeys = sorted(ind["primaryCategories"].keys())
        industries.append(
            {
                "id": ind["id"],
                "name": ind["name"],
                "description": ind["description"],
                "primaryCategories": [ind["primaryCategories"][k] for k in pkeys],
            }
        )

    primary_order = [p for p in ["standard_parts", "raw_materials", "electrical_components", "auxiliary_materials", "general"] if p in taxonomy_primary]
    tail_primary = sorted([k for k in taxonomy_primary.keys() if k not in set(primary_order)])
    primary_categories = [taxonomy_primary[k] for k in (primary_order + tail_primary)]
    secondary_categories = sorted(taxonomy_secondary.values(), key=lambda x: (x.get("primaryCategory") or "", x.get("id") or ""))

    return {
        "industries": industries,
        "taxonomy": {
            "primaryCategories": primary_categories,
            "secondaryCategories": secondary_categories,
        },
    }
