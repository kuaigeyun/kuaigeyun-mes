"""
接口库目录

系统预置接口包，供租户一键加载到本组织。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, TypedDict

from core.services.integration.kingdee_galaxy_api_presets import list_kingdee_galaxy_api_presets


class ApiLibraryPackDefinition(TypedDict):
    pack_id: str
    name: str
    description: str
    connector_type: str
    category_name: str
    category_code: str
    category_description: str
    preset_loader: str


def _build_kingdee_galaxy_pack() -> ApiLibraryPackDefinition:
    presets = list_kingdee_galaxy_api_presets()
    return {
        "pack_id": "kingdee_galaxy",
        "name": "金蝶云星空",
        "description": "常用查询与查看单据接口，需已配置金蝶云星空应用连接器",
        "connector_type": "kingdee_galaxy",
        "category_name": "金蝶",
        "category_code": "kingdee",
        "category_description": "金蝶云星空常用接口",
        "preset_loader": "kingdee_galaxy",
    }


_API_LIBRARY_PACKS: Dict[str, ApiLibraryPackDefinition] = {
    "kingdee_galaxy": _build_kingdee_galaxy_pack(),
}


def get_api_library_pack(pack_id: str) -> Optional[ApiLibraryPackDefinition]:
    normalized = str(pack_id or "").strip()
    if not normalized:
        return None
    return _API_LIBRARY_PACKS.get(normalized)


def list_api_library_pack_previews(pack: ApiLibraryPackDefinition) -> List[Dict[str, str]]:
    loader = pack["preset_loader"]
    if loader == "kingdee_galaxy":
        return [
            {
                "item_key": item["code_suffix"],
                "name": item["name"],
                "description": item["description"],
            }
            for item in list_kingdee_galaxy_api_presets()
        ]
    return []


def list_api_library_pack_item_keys(pack: ApiLibraryPackDefinition) -> List[str]:
    return [str(item["item_key"]) for item in list_api_library_pack_previews(pack)]


def list_api_library_catalog() -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    for pack in _API_LIBRARY_PACKS.values():
        previews = list_api_library_pack_previews(pack)
        items.append(
            {
                "pack_id": pack["pack_id"],
                "name": pack["name"],
                "description": pack["description"],
                "connector_type": pack["connector_type"],
                "category_name": pack["category_name"],
                "api_count": len(previews),
                "items": previews,
                "source": "system",
            }
        )
    return items
