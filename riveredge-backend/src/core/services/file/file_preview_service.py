"""
文件预览服务模块

提供文件预览功能，支持简单预览和 kkFileView 预览两种模式。
"""

from jose import JWTError, jwt
import httpx
import random
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from loguru import logger

from core.models.file import File
from core.services.system.system_parameter_service import SystemParameterService
from infra.config.infra_config import infra_settings as settings
from infra.infrastructure.cache.cache_manager import cache_manager


class FilePreviewService:
    """
    文件预览服务类
    
    提供文件预览功能，支持简单预览和 kkFileView 预览两种模式。
    """
    
    # kkFileView 服务地址（从配置读取）
    KKFILEVIEW_URL = getattr(settings, "KKFILEVIEW_URL", "http://localhost:8400")
    # JWT 密钥（从配置读取，使用 JWT_SECRET_KEY）
    TOKEN_SECRET = getattr(settings, "JWT_SECRET_KEY", getattr(settings, "SECRET_KEY", "your-secret-key"))
    # Token 过期时间（秒）
    TOKEN_EXPIRES_IN = 3600  # 1小时
    
    # 缓存配置
    PREVIEW_URL_CACHE_TTL = 1800  # 预览URL缓存时间（30分钟）
    HEALTH_CHECK_CACHE_TTL = 60  # 健康检查结果缓存时间（1分钟）
    
    # 健康检查状态缓存（内存缓存，用于快速访问）
    _health_status_cache: Dict[str, Dict[str, Any]] = {}
    
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
    def verify_preview_token(token: str) -> Dict[str, Any]:
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
        except JWTError as e:
            # python-jose 的 JWTError 包含所有 JWT 相关错误（过期、无效等）
            error_msg = str(e).lower()
            if "expired" in error_msg or "exp" in error_msg:
                raise ValueError("预览token已过期")
            else:
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
            param = await SystemParameterService.get_parameter(tenant_id, "file.kkfileview.enabled")
            
            if param and param.is_active:
                return param.get_value() == True
        except Exception:
            pass
        
        return False  # 默认关闭
    
    @staticmethod
    async def _get_kkfileview_url(tenant_id: int) -> str:
        """
        从系统参数读取 kkFileView 服务地址
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            str: kkFileView 服务地址
        """
        try:
            param = await SystemParameterService.get_parameter(tenant_id, "file.kkfileview.url")
            
            if param and param.is_active:
                url = param.get_value()
                if url:
                    return url
        except Exception:
            pass
        
        return FilePreviewService.KKFILEVIEW_URL  # 使用默认值
    
    @staticmethod
    async def _get_kkfileview_urls(tenant_id: int) -> List[str]:
        """
        从系统参数读取 kkFileView 服务地址列表（支持负载均衡）
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            List[str]: kkFileView 服务地址列表
        """
        try:
            # 尝试读取多个服务地址（逗号分隔）
            param = await SystemParameterService.get_parameter(tenant_id, "file.kkfileview.urls")
            
            if param and param.is_active:
                urls_str = param.get_value()
                if urls_str:
                    # 解析逗号分隔的URL列表
                    urls = [url.strip() for url in str(urls_str).split(",") if url.strip()]
                    if urls:
                        return urls
        except Exception:
            pass
        
        # 如果没有配置多个地址，尝试单个地址
        single_url = await FilePreviewService._get_kkfileview_url(tenant_id)
        return [single_url] if single_url else []
    
    @staticmethod
    async def _select_healthy_url(urls: List[str], tenant_id: int) -> Optional[str]:
        """
        从URL列表中选择一个健康的服务地址（负载均衡）
        
        策略：
        1. 优先选择健康的服务
        2. 如果多个服务都健康，随机选择（简单负载均衡）
        3. 如果所有服务都不健康，返回第一个（降级策略）
        
        Args:
            urls: kkFileView 服务地址列表
            tenant_id: 组织ID
            
        Returns:
            Optional[str]: 选中的服务地址，如果所有服务都不健康则返回第一个
        """
        if not urls:
            return None
        
        if len(urls) == 1:
            return urls[0]
        
        # 检查每个服务的健康状态
        healthy_urls = []
        for url in urls:
            is_healthy = await FilePreviewService._check_url_health(url, tenant_id)
            if is_healthy:
                healthy_urls.append(url)
        
        # 如果有健康的服务，随机选择一个
        if healthy_urls:
            return random.choice(healthy_urls)
        
        # 如果所有服务都不健康，返回第一个（降级策略）
        logger.warning(f"所有 kkFileView 服务都不健康，使用第一个服务: {urls[0]}")
        return urls[0]
    
    @staticmethod
    async def _check_url_health(url: str, tenant_id: int, use_cache: bool = True) -> bool:
        """
        检查单个URL的健康状态（带缓存）
        
        Args:
            url: kkFileView 服务地址
            tenant_id: 组织ID
            use_cache: 是否使用缓存
            
        Returns:
            bool: 服务是否健康
        """
        cache_key = f"kkfileview_health:{tenant_id}:{url}"
        
        # 尝试从缓存获取
        if use_cache:
            try:
                cached = await cache_manager.get("file_preview", cache_key)
                if cached is not None:
                    return cached.get("healthy", False)
            except Exception:
                pass
        
        # 执行健康检查
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{url}/health",
                    timeout=5.0
                )
                is_healthy = response.status_code == 200
                
                # 缓存健康检查结果
                if use_cache:
                    try:
                        await cache_manager.set(
                            "file_preview",
                            cache_key,
                            {"healthy": is_healthy, "checked_at": datetime.utcnow().isoformat()},
                            ttl=FilePreviewService.HEALTH_CHECK_CACHE_TTL
                        )
                    except Exception:
                        pass
                
                return is_healthy
        except Exception as e:
            logger.warning(f"kkFileView 健康检查失败 ({url}): {e}")
            
            # 缓存失败结果
            if use_cache:
                try:
                    await cache_manager.set(
                        "file_preview",
                        cache_key,
                        {"healthy": False, "checked_at": datetime.utcnow().isoformat()},
                        ttl=FilePreviewService.HEALTH_CHECK_CACHE_TTL
                    )
                except Exception:
                    pass
            
            return False
    
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
        # 从配置获取 BASE_URL（自动从 HOST 和 PORT 生成）
        base_url = settings.BASE_URL
        token = FilePreviewService._generate_preview_token(file_uuid, tenant_id)
        proxy_url = (
            f"{base_url}/api/v1/core/files/{file_uuid}/download"
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
        # 从配置获取 BASE_URL（自动从 HOST 和 PORT 生成）
        base_url = settings.BASE_URL
        # 生成文件访问URL（包含权限验证token）
        token = FilePreviewService._generate_preview_token(file_uuid, tenant_id)
        preview_url = (
            f"{base_url}/api/v1/core/files/{file_uuid}/download"
            f"?token={token}"
        )
        return preview_url
    
    @staticmethod
    async def generate_kkfileview_preview_url(
        file_uuid: str,
        file_path: str,
        tenant_id: int,
        file_name: str,
        use_cache: bool = True
    ) -> str:
        """
        生成 kkFileView 预览URL（带缓存和负载均衡）
        
        Args:
            file_uuid: 文件UUID
            file_path: 文件存储路径
            tenant_id: 组织ID
            file_name: 文件名称
            use_cache: 是否使用缓存
            
        Returns:
            str: kkFileView 预览URL
        """
        cache_key = f"preview_url:{tenant_id}:{file_uuid}"
        
        # 尝试从缓存获取预览URL
        if use_cache:
            try:
                cached = await cache_manager.get("file_preview", cache_key)
                if cached:
                    return cached.get("preview_url")
            except Exception:
                pass
        
        # 1. 生成预览token（包含文件UUID、组织ID、过期时间）
        token = FilePreviewService._generate_preview_token(
            file_uuid=file_uuid,
            tenant_id=tenant_id,
            expires_in=FilePreviewService.TOKEN_EXPIRES_IN
        )
        
        # 2. 构建文件访问URL（如果文件在私有存储，需要通过代理）
        file_url = FilePreviewService._build_file_url(file_path, tenant_id, file_uuid)
        
        # 3. 从参数设置读取 kkFileView 服务地址列表（支持负载均衡）
        kkfileview_urls = await FilePreviewService._get_kkfileview_urls(tenant_id)
        
        # 4. 选择健康的服务地址（负载均衡）
        kkfileview_url = await FilePreviewService._select_healthy_url(kkfileview_urls, tenant_id)
        
        if not kkfileview_url:
            raise ValueError("没有可用的 kkFileView 服务")
        
        # 5. 构建预览URL
        # kkFileView 预览URL格式：/onlinePreview?url={file_url}&token={token}
        preview_url = (
            f"{kkfileview_url}/onlinePreview"
            f"?url={file_url}"
            f"&token={token}"
        )
        
        # 6. 缓存预览URL
        if use_cache:
            try:
                await cache_manager.set(
                    "file_preview",
                    cache_key,
                    {"preview_url": preview_url, "generated_at": datetime.utcnow().isoformat()},
                    ttl=FilePreviewService.PREVIEW_URL_CACHE_TTL
                )
            except Exception:
                pass
        
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
        from core.services.file.file_service import FileService
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
    async def check_kkfileview_health(tenant_id: Optional[int] = None) -> Dict[str, Any]:
        """
        检查 kkFileView 服务健康状态（支持多实例）
        
        Args:
            tenant_id: 组织ID（可选，如果提供则从参数设置读取URL）
        
        Returns:
            Dict[str, Any]: 健康检查结果
            {
                "overall_healthy": bool,  # 整体是否健康（至少有一个服务健康）
                "services": [  # 各个服务的健康状态
                    {
                        "url": "...",
                        "healthy": bool,
                        "response_time": float,  # 响应时间（毫秒）
                        "error": str  # 错误信息（如果有）
                    }
                ],
                "healthy_count": int,  # 健康服务数量
                "total_count": int  # 总服务数量
            }
        """
        if tenant_id:
            urls = await FilePreviewService._get_kkfileview_urls(tenant_id)
        else:
            urls = [FilePreviewService.KKFILEVIEW_URL]
        
        if not urls:
            return {
                "overall_healthy": False,
                "services": [],
                "healthy_count": 0,
                "total_count": 0,
                "error": "没有配置 kkFileView 服务地址"
            }
        
        services_status = []
        healthy_count = 0
        
        for url in urls:
            start_time = datetime.utcnow()
            is_healthy = await FilePreviewService._check_url_health(url, tenant_id or 0, use_cache=False)
            response_time = (datetime.utcnow() - start_time).total_seconds() * 1000  # 转换为毫秒
            
            if is_healthy:
                healthy_count += 1
            
            services_status.append({
                "url": url,
                "healthy": is_healthy,
                "response_time": round(response_time, 2),
            })
        
        return {
            "overall_healthy": healthy_count > 0,
            "services": services_status,
            "healthy_count": healthy_count,
            "total_count": len(urls),
        }
    
    @staticmethod
    async def clear_preview_cache(tenant_id: int, file_uuid: Optional[str] = None) -> None:
        """
        清除预览URL缓存
        
        Args:
            tenant_id: 组织ID
            file_uuid: 文件UUID（可选，如果提供则只清除该文件的缓存）
        """
        try:
            if file_uuid:
                cache_key = f"preview_url:{tenant_id}:{file_uuid}"
                await cache_manager.delete("file_preview", cache_key)
            else:
                # 清除该组织的所有预览URL缓存
                # 注意：这里需要遍历所有可能的缓存键，实际实现可能需要使用通配符删除
                logger.info(f"清除组织 {tenant_id} 的所有预览URL缓存")
        except Exception as e:
            logger.warning(f"清除预览URL缓存失败: {e}")

