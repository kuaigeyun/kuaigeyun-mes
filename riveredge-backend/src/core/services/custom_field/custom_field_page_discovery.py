"""
自定义字段页面发现服务

通过扫描应用的 manifest.json 文件，自动发现支持自定义字段的页面。
支持从应用清单中提取页面配置，实现动态页面发现。
"""

import logging
import time
from typing import List, Dict, Any, Optional, Tuple
from core.services.application.application_service import ApplicationService

logger = logging.getLogger(__name__)

# 页面发现结果缓存：manifest 在运行期极少变更，缓存 5 分钟以减少文件扫描
_PAGES_CACHE: Optional[Tuple[List[Dict[str, Any]], float]] = None
_PAGES_CACHE_TTL = 300  # 秒

# manifest 展示字段覆盖缓存
_MANIFEST_OVERLAY_CACHE: Optional[Tuple[Dict[str, Dict[str, Any]], Dict[str, Dict[str, Any]], float]] = None

DISPLAY_OVERLAY_FIELDS = ("page_name", "table_name_label", "module", "module_icon")


def _normalize_page_path(path: Optional[str]) -> Optional[str]:
    if not path:
        return None
    normalized = path.rstrip("/")
    return normalized or "/"


def build_manifest_display_overlay() -> Tuple[Dict[str, Dict[str, Any]], Dict[str, Dict[str, Any]]]:
    """从各应用 manifest.custom_field_pages 构建展示字段覆盖表。"""
    by_code: Dict[str, Dict[str, Any]] = {}
    by_path: Dict[str, Dict[str, Any]] = {}

    for manifest in ApplicationService._scan_plugin_manifests():
        app_name = manifest.get("name")
        for cfg in manifest.get("custom_field_pages") or []:
            page_code = cfg.get("page_code")
            if not page_code:
                continue

            entry: Dict[str, Any] = {}
            for field in DISPLAY_OVERLAY_FIELDS:
                value = cfg.get(field)
                if value is not None:
                    entry[field] = value
            if "module" not in entry and app_name:
                entry["module"] = app_name

            by_code[page_code] = {**by_code.get(page_code, {}), **entry}
            page_path = _normalize_page_path(cfg.get("page_path"))
            if page_path:
                by_path[page_path] = {**by_path.get(page_path, {}), **entry}

    return by_code, by_path


def get_manifest_display_overlay() -> Tuple[Dict[str, Dict[str, Any]], Dict[str, Dict[str, Any]]]:
    global _MANIFEST_OVERLAY_CACHE
    now = time.time()
    if _MANIFEST_OVERLAY_CACHE is not None:
        by_code, by_path, cached_at = _MANIFEST_OVERLAY_CACHE
        if now - cached_at < _PAGES_CACHE_TTL:
            return by_code, by_path

    by_code, by_path = build_manifest_display_overlay()
    _MANIFEST_OVERLAY_CACHE = (by_code, by_path, now)
    return by_code, by_path


def apply_manifest_display_overlay(page: Dict[str, Any]) -> Dict[str, Any]:
    """将 manifest 中的展示名称覆盖到硬编码页面配置（page_code 优先，page_path 回退）。"""
    result = dict(page)
    by_code, by_path = get_manifest_display_overlay()

    page_code = result.get("page_code")
    page_path = _normalize_page_path(result.get("page_path"))

    overlay: Dict[str, Any] = {}
    if page_code and page_code in by_code:
        overlay.update(by_code[page_code])
    elif page_path and page_path in by_path:
        overlay.update(by_path[page_path])

    for field, value in overlay.items():
        if value is not None:
            result[field] = value

    return result


class CustomFieldPageDiscoveryService:
    """自定义字段页面发现服务"""
    
    @staticmethod
    def _scan_app_manifests() -> List[Dict[str, Any]]:
        """扫描应用目录，读取所有应用的 manifest.json（后端 src/apps 为单一来源）。"""
        return ApplicationService._scan_plugin_manifests()

    @staticmethod
    def discover_pages() -> List[Dict[str, Any]]:
        """
        发现所有应用的自定义字段页面配置
        
        从所有应用的 manifest.json 中提取 custom_field_pages 配置。
        
        Returns:
            List[Dict[str, Any]]: 页面配置列表
        """
        pages = []
        manifests = CustomFieldPageDiscoveryService._scan_app_manifests()
        
        logger.info(f"🔍 扫描到 {len(manifests)} 个应用清单，开始提取自定义字段页面配置...")
        
        for manifest in manifests:
            app_code = manifest.get('code')
            app_name = manifest.get('name', app_code)
            route_path = manifest.get('route_path', f"/apps/{app_code}")
            
            # 从 manifest.json 中提取 custom_field_pages 配置
            custom_field_pages = manifest.get('custom_field_pages', [])
            
            if not custom_field_pages:
                logger.debug(f"应用 {app_name} ({app_code}) 没有配置 custom_field_pages")
                continue
            
            logger.info(f"📋 从应用 {app_name} ({app_code}) 发现 {len(custom_field_pages)} 个自定义字段页面配置")
            logger.debug(f"   页面列表: {[p.get('page_code') for p in custom_field_pages]}")
            
            # 处理每个页面配置
            for page_config in custom_field_pages:
                # 确保页面配置包含必要字段
                page_code = page_config.get('page_code')
                if not page_code:
                    logger.warning(f"应用 {app_name} 的页面配置缺少 page_code，跳过")
                    continue
                
                table_name = page_config.get('table_name')
                if not table_name:
                    logger.warning(f"应用 {app_name} 的页面配置 {page_code} 缺少 table_name，跳过")
                    continue
                
                # 构建完整的页面配置
                full_page_config = {
                    "page_code": page_code,
                    "page_name": page_config.get('page_name', page_code),
                    "page_path": page_config.get('page_path') or f"{route_path}/{page_code}",
                    "table_name": table_name,
                    "table_name_label": page_config.get('table_name_label', table_name),
                    "module": page_config.get('module', app_name),
                    "module_icon": page_config.get('module_icon', manifest.get('icon', 'app')),
                }
                
                pages.append(full_page_config)
        
        logger.info(f"✅ 总共发现 {len(pages)} 个自定义字段页面配置")
        return pages
    
    @staticmethod
    def get_all_pages() -> List[Dict[str, Any]]:
        """
        获取所有自定义字段页面配置（包含服务发现和硬编码回退）
        
        优先使用服务发现，如果服务发现失败或返回空列表，则回退到硬编码配置。
        结果缓存 5 分钟，减少重复文件扫描。
        
        Returns:
            List[Dict[str, Any]]: 页面配置列表
        """
        global _PAGES_CACHE
        now = time.time()
        if _PAGES_CACHE is not None:
            cached_pages, cached_at = _PAGES_CACHE
            if now - cached_at < _PAGES_CACHE_TTL:
                return cached_pages
        try:
            # 尝试从服务发现获取页面配置
            discovered_pages = CustomFieldPageDiscoveryService.discover_pages()
            
            if discovered_pages:
                _PAGES_CACHE = (discovered_pages, now)
                logger.info(f"✅ 通过服务发现获取到 {len(discovered_pages)} 个自定义字段页面配置")
                return discovered_pages
            else:
                logger.warning("⚠️ 服务发现未返回任何页面配置，使用硬编码配置作为回退")
                # 回退到硬编码配置（如果存在）
                # 注意：目前没有硬编码配置，返回空列表
                return []
        except Exception as e:
            logger.error(f"❌ 自定义字段页面发现服务失败: {e}", exc_info=True)
            # 回退到空列表
            logger.info("📋 使用空配置作为回退方案")
            return []
