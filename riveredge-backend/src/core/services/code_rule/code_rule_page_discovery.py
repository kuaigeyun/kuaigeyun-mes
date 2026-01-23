"""
编码规则页面发现服务

通过扫描应用的 manifest.json 文件，自动发现需要编码规则配置的页面。
支持从应用清单中提取页面配置，实现动态页面发现。
"""

import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from core.services.application.application_service import ApplicationService

logger = logging.getLogger(__name__)


class CodeRulePageDiscoveryService:
    """编码规则页面发现服务"""
    
    @staticmethod
    def _get_plugins_directory() -> Path:
        """
        获取插件目录路径
        
        Returns:
            Path: 插件目录路径
        """
        # 获取项目根目录（从当前文件位置向上查找）
        current_file = Path(__file__)
        # 从 core/services/code_rule/ 向上到项目根目录
        project_root = current_file.parent.parent.parent.parent
        plugins_dir = project_root / "src" / "apps"
        
        return plugins_dir
    
    @staticmethod
    def _scan_app_manifests() -> List[Dict[str, Any]]:
        """
        扫描应用目录，读取所有应用的 manifest.json 文件
        
        Returns:
            List[Dict[str, Any]]: 应用清单列表
        """
        plugins_dir = CodeRulePageDiscoveryService._get_plugins_directory()
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
        发现所有应用的编码规则页面配置
        
        从所有应用的 manifest.json 中提取 code_rule_pages 配置。
        
        Returns:
            List[Dict[str, Any]]: 页面配置列表
        """
        pages = []
        manifests = CodeRulePageDiscoveryService._scan_app_manifests()
        
        logger.info(f"🔍 扫描到 {len(manifests)} 个应用清单，开始提取页面配置...")
        
        for manifest in manifests:
            app_code = manifest.get('code')
            app_name = manifest.get('name', app_code)
            route_path = manifest.get('route_path', f"/apps/{app_code}")
            
            # 从 manifest.json 中提取 code_rule_pages 配置
            code_rule_pages = manifest.get('code_rule_pages', [])
            
            if not code_rule_pages:
                logger.debug(f"应用 {app_name} ({app_code}) 没有配置 code_rule_pages")
                continue
            
            logger.info(f"📋 从应用 {app_name} ({app_code}) 发现 {len(code_rule_pages)} 个页面配置")
            
            # 处理每个页面配置
            for page_config in code_rule_pages:
                # 确保页面配置包含必要字段
                page_code = page_config.get('page_code')
                if not page_code:
                    logger.warning(f"应用 {app_name} 的页面配置缺少 page_code，跳过")
                    continue
                
                # 构建完整的页面配置
                full_page_config = {
                    "page_code": page_code,
                    "page_name": page_config.get('page_name', page_code),
                    "page_path": page_config.get('page_path') or f"{route_path}/{page_code}",
                    "code_field": page_config.get('code_field', 'code'),
                    "code_field_label": page_config.get('code_field_label', '编码'),
                    "module": page_config.get('module', app_name),
                    "module_icon": page_config.get('module_icon', manifest.get('icon', 'app')),
                    "auto_generate": page_config.get('auto_generate', False),
                    "rule_code": page_config.get('rule_code'),
                    "allow_manual_edit": page_config.get('allow_manual_edit', True),
                    "available_fields": page_config.get('available_fields', []),
                }
                
                pages.append(full_page_config)
        
        logger.info(f"✅ 总共发现 {len(pages)} 个编码规则页面配置")
        return pages
    
    @staticmethod
    def get_all_pages() -> List[Dict[str, Any]]:
        """
        获取所有编码规则页面配置（包含服务发现和硬编码回退）
        
        优先使用服务发现，如果服务发现失败或返回空列表，则回退到硬编码配置。
        
        Returns:
            List[Dict[str, Any]]: 页面配置列表
        """
        try:
            # 尝试从服务发现获取页面配置
            discovered_pages = CodeRulePageDiscoveryService.discover_pages()
            
            if discovered_pages:
                logger.info(f"✅ 通过服务发现获取到 {len(discovered_pages)} 个页面配置")
                return discovered_pages
            else:
                logger.warning("⚠️ 服务发现未返回任何页面配置，使用硬编码配置作为回退")
                # 回退到硬编码配置
                from core.config.code_rule_pages import CODE_RULE_PAGES
                return CODE_RULE_PAGES
        except Exception as e:
            logger.error(f"❌ 页面发现服务失败: {e}", exc_info=True)
            # 回退到硬编码配置
            logger.info("📋 使用硬编码配置作为回退方案")
            from core.config.code_rule_pages import CODE_RULE_PAGES
            return CODE_RULE_PAGES
