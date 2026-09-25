"""
接口库目录

系统预置接口包，供租户一键加载到本组织。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, TypedDict

from core.services.integration.kingdee_cosmic_api_presets import list_kingdee_cosmic_api_presets
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
    return {
        "pack_id": "kingdee_galaxy",
        "name": "金蝶AI星空",
        "description": "金蝶AI星空常用查询与单据查看接口模板，加载前请先在应用连接器中配置金蝶AI星空并完成连接测试。",
        "connector_type": "kingdee_galaxy",
        "category_name": "金蝶AI星空",
        "category_code": "kingdee",
        "category_description": "金蝶AI星空常用接口",
        "preset_loader": "kingdee_galaxy",
    }


def _build_kingdee_cosmic_pack() -> ApiLibraryPackDefinition:
    return {
        "pack_id": "kingdee_cosmic",
        "name": "金蝶AI苍穹 OpenAPI",
        "description": (
            "金蝶AI苍穹开放平台入站常用接口：物料、单位、分组、供应商、客户、仓库、采购订单等标准业务对象 query。"
            "加载前请先在应用连接器中配置并测通「金蝶AI苍穹 OpenAPI」，并在开放服务云完成 API 初始化与授权。"
            "select/filter 可按现场字段在接口管理中微调。"
        ),
        "connector_type": "kingdee_cosmic",
        "category_name": "金蝶AI苍穹",
        "category_code": "kingdee_cosmic",
        "category_description": "金蝶AI苍穹 OpenAPI 常用接口",
        "preset_loader": "kingdee_cosmic",
    }


_API_LIBRARY_PACKS: Dict[str, ApiLibraryPackDefinition] = {
    "kingdee_galaxy": _build_kingdee_galaxy_pack(),
    "kingdee_cosmic": _build_kingdee_cosmic_pack(),
}


def get_api_library_pack(pack_id: str) -> Optional[ApiLibraryPackDefinition]:
    normalized = str(pack_id or "").strip()
    if not normalized:
        return None
    return _API_LIBRARY_PACKS.get(normalized)


def list_api_library_pack_previews(pack: ApiLibraryPackDefinition) -> List[Dict[str, str]]:
    loader = pack["preset_loader"]
    if loader == "kingdee_galaxy":
        presets = list_kingdee_galaxy_api_presets()
    elif loader == "kingdee_cosmic":
        presets = list_kingdee_cosmic_api_presets()
    else:
        return []
    return [
        {
            "item_key": item["code_suffix"],
            "name": item["name"],
            "description": item["description"],
        }
        for item in presets
    ]


def list_api_library_pack_item_keys(pack: ApiLibraryPackDefinition) -> List[str]:
    return [str(item["item_key"]) for item in list_api_library_pack_previews(pack)]


def list_api_library_catalog() -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    packs = sorted(_API_LIBRARY_PACKS.values(), key=lambda pack: pack["name"])
    for pack in packs:
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
