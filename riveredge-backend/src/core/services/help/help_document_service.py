"""
帮助文档服务模块

提供帮助文档的存储、检索和管理功能。
"""

from typing import Dict, Any, Optional, List
from datetime import datetime
from loguru import logger

from infra.exceptions.exceptions import NotFoundError, ValidationError


class HelpDocumentService:
    """
    帮助文档服务类
    
    提供帮助文档的 CRUD 操作。
    """
    
    # 帮助文档存储（可以存储在数据库或配置文件中）
    # 这里使用内存存储作为示例，实际应该存储在数据库中
    _help_documents: Dict[str, Dict[str, Any]] = {}
    
    @staticmethod
    async def get_help_document(
        tenant_id: int,
        document_key: str
    ) -> Dict[str, Any]:
        """
        获取帮助文档
        
        Args:
            tenant_id: 组织ID
            document_key: 文档标识（如 'user_management', 'role_management' 等）
            
        Returns:
            Dict[str, Any]: 帮助文档内容
            {
                "key": "user_management",
                "title": "用户管理帮助",
                "sections": [
                    {
                        "title": "功能介绍",
                        "content": "..."
                    }
                ]
            }
        """
        cache_key = f"{tenant_id}:{document_key}"
        
        if cache_key in HelpDocumentService._help_documents:
            return HelpDocumentService._help_documents[cache_key]
        
        # 如果文档不存在，返回默认文档
        return HelpDocumentService._get_default_document(document_key)
    
    @staticmethod
    def _get_default_document(document_key: str) -> Dict[str, Any]:
        """
        获取默认帮助文档
        
        Args:
            document_key: 文档标识
            
        Returns:
            Dict[str, Any]: 默认帮助文档内容
        """
        default_documents = {
            "user_management": {
                "key": "user_management",
                "title": "用户管理帮助",
                "sections": [
                    {
                        "title": "功能介绍",
                        "content": "用户管理模块用于管理系统用户，包括用户的创建、编辑、删除、权限分配等功能。"
                    },
                    {
                        "title": "操作步骤",
                        "content": "1. 点击\"创建用户\"按钮\n2. 填写用户信息\n3. 分配角色和权限\n4. 保存用户"
                    },
                ]
            },
            "role_management": {
                "key": "role_management",
                "title": "角色管理帮助",
                "sections": [
                    {
                        "title": "功能介绍",
                        "content": "角色管理模块用于管理系统角色，包括角色的创建、编辑、删除、权限分配等功能。"
                    },
                ]
            },
        }
        
        return default_documents.get(document_key, {
            "key": document_key,
            "title": "帮助文档",
            "sections": [
                {
                    "title": "说明",
                    "content": "此功能的帮助文档正在完善中。"
                }
            ]
        })
    
    @staticmethod
    async def create_or_update_help_document(
        tenant_id: int,
        document_key: str,
        title: str,
        sections: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        创建或更新帮助文档
        
        Args:
            tenant_id: 组织ID
            document_key: 文档标识
            title: 文档标题
            sections: 文档章节列表
            
        Returns:
            Dict[str, Any]: 帮助文档内容
        """
        cache_key = f"{tenant_id}:{document_key}"
        
        document = {
            "key": document_key,
            "title": title,
            "sections": sections,
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        HelpDocumentService._help_documents[cache_key] = document
        
        logger.info(f"帮助文档已更新: {cache_key}")
        return document
    
    @staticmethod
    async def list_help_documents(
        tenant_id: int
    ) -> List[Dict[str, Any]]:
        """
        列出所有帮助文档
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            List[Dict[str, Any]]: 帮助文档列表
        """
        # 返回该组织的所有帮助文档
        documents = []
        prefix = f"{tenant_id}:"
        
        for key, document in HelpDocumentService._help_documents.items():
            if key.startswith(prefix):
                documents.append(document)
        
        return documents

