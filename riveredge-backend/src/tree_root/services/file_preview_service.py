"""
文件预览服务模块

提供文件预览功能，支持简单预览和 kkFileView 预览两种模式。
"""

import jwt
import httpx
from typing import Dict, Any, Optional
from datetime import datetime, timedelta

from tree_root.models.file import File
from tree_root.services.system_parameter_service import SystemParameterService
from soil.config.platform_config import platform_settings as settings


class FilePreviewService:
    """
    文件预览服务类
    
    提供文件预览功能，支持简单预览和 kkFileView 预览两种模式。
    """
    
    # kkFileView 服务地址（从配置读取）
    KKFILEVIEW_URL = getattr(settings, "KKFILEVIEW_URL", "http://localhost:8012")
    # JWT 密钥（从配置读取）
    TOKEN_SECRET = getattr(settings, "SECRET_KEY", "your-secret-key")
    # Token 过期时间（秒）
    TOKEN_EXPIRES_IN = 3600  # 1小时
    
    @staticmethod
    def _generate_preview_token(
        file_uuid: str,
        tenant_id: int,
        expires_in: int = TOKEN_EXPIRES_IN
    ) -> str:
        """
        生成预览token（JWT格式）
        
        Token 包含：
        - file_uuid: 文件UUID
        - tenant_id: 组织ID
        - exp: 过期时间
        
        Args:
            file_uuid: 文件UUID
            tenant_id: 组织ID
            expires_in: 过期时间（秒）
            
        Returns:
            str: JWT token
        """
        payload = {
            "file_uuid": file_uuid,
            "tenant_id": tenant_id,
            "exp": datetime.utcnow() + timedelta(seconds=expires_in),
            "iat": datetime.utcnow(),
        }
        
        token = jwt.encode(payload, FilePreviewService.TOKEN_SECRET, algorithm="HS256")
        return token
    
    @staticmethod
    async def verify_preview_token(token: str) -> Dict[str, Any]:
        """
        验证预览token
        
        Args:
            token: JWT token
            
        Returns:
            Dict[str, Any]: token 解码后的数据（包含 file_uuid、tenant_id 等）
            
        Raises:
            ValueError: 当 token 无效或已过期时抛出
        """
        try:
            payload = jwt.decode(
                token,
                FilePreviewService.TOKEN_SECRET,
                algorithms=["HS256"]
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise ValueError("预览token已过期")
        except jwt.InvalidTokenError:
            raise ValueError("预览token无效")
    
    @staticmethod
    async def _get_kkfileview_enabled(tenant_id: int) -> bool:
        """
        从系统参数读取 kkFileView 开关配置
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            bool: 是否启用 kkFileView 预览
        """
        try:
            service = SystemParameterService()
            param = await service.get_parameter(tenant_id, "file.kkfileview.enabled")
            
            if param and param.is_active:
                return param.get_value() == True
        except Exception:
            pass
        
        return False  # 默认关闭
    
    @staticmethod
    def _is_simple_preview_supported(file_type: Optional[str]) -> bool:
        """
        检查文件类型是否支持简单预览
        
        支持的类型：
        - PDF: application/pdf
        - 图片: image/*
        - 文本: text/*
        - 视频: video/*
        - 音频: audio/*
        
        Args:
            file_type: 文件类型（MIME类型）
            
        Returns:
            bool: 是否支持简单预览
        """
        if not file_type:
            return False
        
        file_type_lower = file_type.lower()
        
        # PDF
        if file_type_lower == "application/pdf":
            return True
        
        # 图片
        if file_type_lower.startswith("image/"):
            return True
        
        # 文本
        if file_type_lower.startswith("text/"):
            return True
        
        # 视频
        if file_type_lower.startswith("video/"):
            return True
        
        # 音频
        if file_type_lower.startswith("audio/"):
            return True
        
        return False
    
    @staticmethod
    def _build_file_url(
        file_path: str,
        tenant_id: int,
        file_uuid: str
    ) -> str:
        """
        构建文件访问URL
        
        如果文件在私有存储，需要通过代理URL访问。
        如果文件在公共存储，可以直接使用文件URL。
        
        Args:
            file_path: 文件存储路径
            tenant_id: 组织ID
            file_uuid: 文件UUID
            
        Returns:
            str: 文件访问URL
        """
        # 方式1：文件在公共存储（OSS等），直接使用文件URL
        if file_path.startswith("http://") or file_path.startswith("https://"):
            return file_path
        
        # 方式2：文件在私有存储，通过代理URL访问
        # 生成文件下载代理URL（包含权限验证）
        base_url = getattr(settings, "BASE_URL", "http://localhost:9000")
        token = FilePreviewService._generate_preview_token(file_uuid, tenant_id)
        proxy_url = (
            f"{base_url}/api/v1/system/files/{file_uuid}/download"
            f"?token={token}"
        )
        
        return proxy_url
    
    @staticmethod
    async def generate_simple_preview_url(
        file_uuid: str,
        tenant_id: int,
    ) -> str:
        """
        生成简单预览URL（直接文件访问）
        
        简单预览通过直接访问文件URL实现，前端根据文件类型选择渲染方式。
        
        Args:
            file_uuid: 文件UUID
            tenant_id: 组织ID
            
        Returns:
            str: 预览URL
        """
        base_url = getattr(settings, "BASE_URL", "http://localhost:9000")
        # 生成文件访问URL（包含权限验证token）
        token = FilePreviewService._generate_preview_token(file_uuid, tenant_id)
        preview_url = (
            f"{base_url}/api/v1/system/files/{file_uuid}/download"
            f"?token={token}"
        )
        return preview_url
    
    @staticmethod
    async def generate_kkfileview_preview_url(
        file_uuid: str,
        file_path: str,
        tenant_id: int,
        file_name: str,
    ) -> str:
        """
        生成 kkFileView 预览URL
        
        Args:
            file_uuid: 文件UUID
            file_path: 文件存储路径
            tenant_id: 组织ID
            file_name: 文件名称
            
        Returns:
            str: kkFileView 预览URL
        """
        # 1. 生成预览token（包含文件UUID、组织ID、过期时间）
        token = FilePreviewService._generate_preview_token(
            file_uuid=file_uuid,
            tenant_id=tenant_id,
            expires_in=FilePreviewService.TOKEN_EXPIRES_IN
        )
        
        # 2. 构建文件访问URL（如果文件在私有存储，需要通过代理）
        file_url = FilePreviewService._build_file_url(file_path, tenant_id, file_uuid)
        
        # 3. 构建预览URL
        # kkFileView 预览URL格式：/onlinePreview?url={file_url}&token={token}
        preview_url = (
            f"{FilePreviewService.KKFILEVIEW_URL}/onlinePreview"
            f"?url={file_url}"
            f"&token={token}"
        )
        
        return preview_url
    
    @staticmethod
    async def get_preview_info(
        file_uuid: str,
        tenant_id: int,
    ) -> Dict[str, Any]:
        """
        获取文件预览信息（根据配置选择预览模式）
        
        Args:
            file_uuid: 文件UUID
            tenant_id: 组织ID
            
        Returns:
            Dict[str, Any]: 预览信息
            {
                "preview_mode": "simple" | "kkfileview",
                "preview_url": "...",
                "file_type": "...",
                "supported": True/False
            }
        """
        # 1. 查询文件
        from tree_root.services.file_service import FileService
        file = await FileService.get_file_by_uuid(tenant_id, file_uuid)
        
        # 2. 读取预览模式配置
        kkfileview_enabled = await FilePreviewService._get_kkfileview_enabled(tenant_id)
        
        # 3. 根据配置选择预览模式
        if kkfileview_enabled:
            # 使用 kkFileView 预览
            preview_url = await FilePreviewService.generate_kkfileview_preview_url(
                file_uuid=file.uuid,
                file_path=file.file_path,
                tenant_id=file.tenant_id,
                file_name=file.name,
            )
            return {
                "preview_mode": "kkfileview",
                "preview_url": preview_url,
                "file_type": file.file_type,
                "supported": True,
            }
        else:
            # 使用简单预览
            preview_url = await FilePreviewService.generate_simple_preview_url(
                file_uuid=file.uuid,
                tenant_id=file.tenant_id,
            )
            return {
                "preview_mode": "simple",
                "preview_url": preview_url,
                "file_type": file.file_type,
                "supported": FilePreviewService._is_simple_preview_supported(file.file_type),
            }
    
    @staticmethod
    async def check_kkfileview_health() -> bool:
        """
        检查 kkFileView 服务健康状态
        
        Returns:
            bool: 服务是否健康
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{FilePreviewService.KKFILEVIEW_URL}/health",
                    timeout=5.0
                )
                return response.status_code == 200
        except Exception:
            return False

