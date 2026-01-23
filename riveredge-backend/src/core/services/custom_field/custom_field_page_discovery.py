"""
自定义字段页面发现服务

通过扫描应用的 manifest.json 文件，自动发现支持自定义字段的页面。
支持从应用清单中提取页面配置，实现动态页面发现。
"""

import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class CustomFieldPageDiscoveryService:
    """自定义字段页面发现服务"""
    
    @staticmethod
    def _get_plugins_directory() -> Path:
        """
        获取插件目录路径
        
        Returns:
            Path: 插件目录路径
        """
        # 使用与 ApplicationService 相同的方法获取插件目录
        # 这样可以确保路径计算的一致性
        current_file = Path(__file__).resolve()  # 使用绝对路径
        # riveredge-backend/src/core/services/custom_field/custom_field_page_discovery.py
        # -> riveredge-backend/src/core/services/custom_field/
        # -> riveredge-backend/src/core/services/
        # -> riveredge-backend/src/core/
        # -> riveredge-backend/src/
        # -> riveredge-backend/src/apps
        backend_src_dir = current_file.parent.parent.parent.parent  # riveredge-backend/src
        plugins_dir = backend_src_dir / "apps"
        return plugins_dir
    
    @staticmethod
    def _scan_app_manifests() -> List[Dict[str, Any]]:
        """
        扫描应用目录，读取所有应用的 manifest.json 文件
        
        Returns:
            List[Dict[str, Any]]: 应用清单列表
        """
        plugins_dir = CustomFieldPageDiscoveryService._get_plugins_directory()
        manifests = []
        
        if not plugins_dir.exists():
            logger.warning(f"插件目录不存在: {plugins_dir}")
            return manifests
        
        # 遍历 src/apps 目录下的所有子目录
        for app_dir in plugins_dir.iterdir():
            if not app_dir.is_dir():
                continue
            
            # 查找 manifest.json 文件
            manifest_file = app_dir / "manifest.json"
            if not manifest_file.exists():
                continue
            
            try:
                # 读取 manifest.json
                with open(manifest_file, 'r', encoding='utf-8') as f:
                    manifest_data = json.load(f)
                
                # 添加应用目录路径信息
                manifest_data['_app_dir'] = str(app_dir)
                manifests.append(manifest_data)
            except (json.JSONDecodeError, IOError) as e:
                # 忽略无法读取的 manifest.json
                logger.warning(f"警告: 无法读取应用 {app_dir.name} 的 manifest.json: {e}")
                continue
        
        return manifests
    
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
        
        Returns:
            List[Dict[str, Any]]: 页面配置列表
        """
        try:
            # 尝试从服务发现获取页面配置
            discovered_pages = CustomFieldPageDiscoveryService.discover_pages()
            
            if discovered_pages:
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
