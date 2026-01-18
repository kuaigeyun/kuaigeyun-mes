"""
操作引导服务模块

提供操作引导的配置和管理功能。

Author: Luigi Lu
Date: 2026-01-27
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from loguru import logger


# 预定义的操作引导配置（按页面/功能分组）
OPERATION_GUIDES: Dict[str, Dict[str, Any]] = {
    "user_management": {
        "page_key": "user_management",
        "page_name": "用户管理",
        "steps": [
            {
                "step": 1,
                "target": ".ant-btn-primary",  # 创建按钮
                "title": "创建用户",
                "description": "点击此按钮可以创建新用户",
                "placement": "bottom",
            },
            {
                "step": 2,
                "target": ".ant-table",  # 表格
                "title": "用户列表",
                "description": "这里显示所有用户，可以点击行进行编辑或查看详情",
                "placement": "top",
            },
            {
                "step": 3,
                "target": ".ant-input-search",  # 搜索框
                "title": "搜索用户",
                "description": "使用搜索框可以快速查找用户",
                "placement": "bottom",
            },
        ],
    },
    "work_order_management": {
        "page_key": "work_order_management",
        "page_name": "工单管理",
        "steps": [
            {
                "step": 1,
                "target": ".ant-btn-primary",
                "title": "创建工单",
                "description": "点击此按钮可以创建新的生产工单",
                "placement": "bottom",
            },
            {
                "step": 2,
                "target": ".ant-table",
                "title": "工单列表",
                "description": "这里显示所有工单，可以查看工单状态和进度",
                "placement": "top",
            },
            {
                "step": 3,
                "target": ".ant-btn[data-action='report']",
                "title": "报工操作",
                "description": "点击此按钮可以执行报工操作",
                "placement": "bottom",
            },
        ],
    },
    "material_management": {
        "page_key": "material_management",
        "page_name": "物料管理",
        "steps": [
            {
                "step": 1,
                "target": ".ant-btn-primary",
                "title": "创建物料",
                "description": "点击此按钮可以创建新物料",
                "placement": "bottom",
            },
            {
                "step": 2,
                "target": ".ant-tree",
                "title": "物料分组",
                "description": "左侧显示物料分组树，可以按分组查看物料",
                "placement": "right",
            },
            {
                "step": 3,
                "target": ".ant-table",
                "title": "物料列表",
                "description": "这里显示当前分组的物料列表",
                "placement": "top",
            },
        ],
    },
}


class OperationGuideService:
    """
    操作引导服务类
    
    提供操作引导的配置和管理功能。
    """
    
    @staticmethod
    async def get_operation_guide(
        tenant_id: int,
        page_key: str
    ) -> Dict[str, Any]:
        """
        获取指定页面的操作引导配置
        
        Args:
            tenant_id: 组织ID
            page_key: 页面标识（如 'user_management', 'work_order_management' 等）
            
        Returns:
            Dict[str, Any]: 操作引导配置
        """
        guide = OPERATION_GUIDES.get(page_key)
        
        if not guide:
            return {
                "page_key": page_key,
                "page_name": "未知页面",
                "steps": [],
            }
        
        return guide
    
    @staticmethod
    async def list_operation_guides(
        tenant_id: int
    ) -> List[Dict[str, Any]]:
        """
        列出所有操作引导配置
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            List[Dict[str, Any]]: 操作引导配置列表
        """
        return list(OPERATION_GUIDES.values())
    
    @staticmethod
    async def create_or_update_operation_guide(
        tenant_id: int,
        page_key: str,
        page_name: str,
        steps: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        创建或更新操作引导配置
        
        Args:
            tenant_id: 组织ID
            page_key: 页面标识
            page_name: 页面名称
            steps: 引导步骤列表
            
        Returns:
            Dict[str, Any]: 操作引导配置
        """
        guide = {
            "page_key": page_key,
            "page_name": page_name,
            "steps": steps,
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        OPERATION_GUIDES[page_key] = guide
        
        logger.info(f"操作引导已更新: {page_key}")
        return guide
