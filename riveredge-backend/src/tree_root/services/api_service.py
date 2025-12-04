"""
接口管理服务模块

提供接口的 CRUD 操作和接口测试功能。
"""

import httpx
import time
from typing import Dict, Any, Optional, List
from uuid import UUID

from tortoise.exceptions import IntegrityError

from tree_root.models.api import API
from tree_root.schemas.api import APICreate, APIUpdate, APITestRequest
from soil.exceptions.exceptions import NotFoundError, ValidationError
from soil.config.platform_config import platform_settings as settings


class APIService:
    """
    接口管理服务类
    
    提供接口的 CRUD 操作和接口测试功能。
    """
    
    async def create_api(
        self,
        tenant_id: int,
        api_data: APICreate,
    ) -> API:
        """
        创建接口
        
        Args:
            tenant_id: 组织ID
            api_data: 接口创建数据
            
        Returns:
            API: 创建的接口对象
            
        Raises:
            ValidationError: 接口代码已存在
        """
        # 检查接口代码是否已存在
        existing_api = await API.filter(
            tenant_id=tenant_id,
            code=api_data.code,
            deleted_at__isnull=True,
        ).first()
        
        if existing_api:
            raise ValidationError(f"接口代码 '{api_data.code}' 已存在")
        
        # 创建接口
        api = await API.create(
            tenant_id=tenant_id,
            **api_data.model_dump(),
        )
        
        return api
    
    async def get_api_by_uuid(
        self,
        tenant_id: int,
        api_uuid: UUID,
    ) -> API:
        """
        根据 UUID 获取接口
        
        Args:
            tenant_id: 组织ID
            api_uuid: 接口UUID
            
        Returns:
            API: 接口对象
            
        Raises:
            NotFoundError: 接口不存在
        """
        api = await API.filter(
            tenant_id=tenant_id,
            uuid=api_uuid,
            deleted_at__isnull=True,
        ).first()
        
        if not api:
            raise NotFoundError(f"接口不存在: {api_uuid}")
        
        return api
    
    async def list_apis(
        self,
        tenant_id: int,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        method: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> tuple[List[API], int]:
        """
        获取接口列表
        
        Args:
            tenant_id: 组织ID
            page: 页码
            page_size: 每页数量
            search: 搜索关键词（名称、代码、路径）
            method: 请求方法筛选
            is_active: 是否启用筛选
            
        Returns:
            tuple[List[API], int]: (接口列表, 总数)
        """
        query = API.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        
        # 搜索条件（优化：使用 OR 查询，但限制在索引字段）
        if search:
            from tortoise.expressions import Q
            query = query.filter(
                Q(name__icontains=search) |
                Q(code__icontains=search) |
                Q(path__icontains=search)
            )
        
        # 方法筛选
        if method:
            query = query.filter(method=method.upper())
        
        # 启用状态筛选
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        # 优化分页查询：先查询总数，再查询数据
        total = await query.count()
        
        # 限制分页大小，避免过大查询
        if page_size > 100:
            page_size = 100
        
        # 分页查询（使用索引字段排序）
        offset = (page - 1) * page_size
        apis = await query.order_by("-created_at").offset(offset).limit(page_size).all()
        
        return apis, total
    
    async def update_api(
        self,
        tenant_id: int,
        api_uuid: UUID,
        api_data: APIUpdate,
    ) -> API:
        """
        更新接口
        
        Args:
            tenant_id: 组织ID
            api_uuid: 接口UUID
            api_data: 接口更新数据
            
        Returns:
            API: 更新后的接口对象
            
        Raises:
            NotFoundError: 接口不存在
            ValidationError: 接口代码已存在
        """
        # 获取接口
        api = await self.get_api_by_uuid(tenant_id, api_uuid)
        
        # 如果更新了代码，检查是否重复
        if api_data.code and api_data.code != api.code:
            existing_api = await API.filter(
                tenant_id=tenant_id,
                code=api_data.code,
                deleted_at__isnull=True,
            ).exclude(uuid=api_uuid).first()
            
            if existing_api:
                raise ValidationError(f"接口代码 '{api_data.code}' 已存在")
        
        # 记录变更前的状态（用于通知数据集管理）
        old_code = api.code
        old_path = api.path
        old_method = api.method
        old_is_active = api.is_active
        
        # 更新接口
        update_data = api_data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(api, key, value)
        
        await api.save()
        
        # 如果接口代码、路径、方法或状态变更，通知数据集管理（异步，不阻塞主流程）
        code_changed = old_code != api.code
        path_changed = old_path != api.path
        method_changed = old_method != api.method
        status_changed = old_is_active != api.is_active
        
        if code_changed or path_changed or method_changed or status_changed:
            import asyncio
            # 异步通知数据集管理接口变更
            asyncio.create_task(
                APIService._notify_datasets(
                    tenant_id=tenant_id,
                    api_code=old_code if code_changed else api.code,
                    new_api_code=api.code if code_changed else None,
                    is_active=api.is_active,
                    path_changed=path_changed,
                    method_changed=method_changed
                )
            )
        
        return api
    
    async def delete_api(
        self,
        tenant_id: int,
        api_uuid: UUID,
    ) -> None:
        """
        删除接口（软删除）
        
        Args:
            tenant_id: 组织ID
            api_uuid: 接口UUID
            
        Raises:
            NotFoundError: 接口不存在
            ValidationError: 系统接口不可删除
        """
        # 获取接口
        api = await self.get_api_by_uuid(tenant_id, api_uuid)
        
        # 检查是否为系统接口
        if api.is_system:
            raise ValidationError("系统接口不可删除")
        
        # 通知数据集管理接口将被删除（异步，不阻塞主流程）
        import asyncio
        asyncio.create_task(
            APIService._notify_datasets(
                tenant_id=tenant_id,
                api_code=api.code,
                is_active=False,
                is_deleted=True
            )
        )
        
        # 软删除
        from datetime import datetime
        api.deleted_at = datetime.now()
        await api.save()
    
    @staticmethod
    async def _notify_datasets(
        tenant_id: int,
        api_code: str,
        new_api_code: Optional[str] = None,
        is_active: bool = True,
        path_changed: bool = False,
        method_changed: bool = False,
        is_deleted: bool = False
    ) -> None:
        """
        通知数据集管理接口变更
        
        这是一个预留方法，用于将来实现数据集管理的接口变更通知。
        目前只是记录变更，不执行具体操作。
        
        Args:
            tenant_id: 组织ID
            api_code: 接口代码
            new_api_code: 新接口代码（如果接口代码变更）
            is_active: 是否启用
            path_changed: 路径是否变更
            method_changed: 方法是否变更
            is_deleted: 是否删除
        """
        # TODO: 如果将来需要数据集自动更新，可以在这里实现
        # 例如：
        # 1. 查找所有使用该接口的数据集（query_config 中包含 api_code）
        # 2. 根据新的接口配置更新数据集的 query_config
        # 3. 如果接口被删除或禁用，禁用关联的数据集
        
        # 注意：接口变更通常不应该自动更新数据集的 query_config
        # 因为用户可能有意使用旧的配置
        # 只有在特殊情况下（如接口路径变更）才需要更新
        pass
    
    async def test_api(
        self,
        tenant_id: int,
        api_uuid: UUID,
        test_request: APITestRequest,
        timeout: float = 30.0,
    ) -> Dict[str, Any]:
        """
        测试接口调用
        
        Args:
            tenant_id: 组织ID
            api_uuid: 接口UUID
            test_request: 测试请求数据（可覆盖接口定义的参数）
            timeout: 请求超时时间（秒）
            
        Returns:
            Dict[str, Any]: 测试结果
            {
                "status_code": 200,
                "headers": {...},
                "body": {...},
                "elapsed_time": 0.123
            }
            
        Raises:
            NotFoundError: 接口不存在
        """
        # 获取接口
        api = await self.get_api_by_uuid(tenant_id, api_uuid)
        
        # 1. 合并请求头（测试请求头优先）
        request_headers = api.request_headers or {}
        if test_request.headers:
            request_headers.update(test_request.headers)
        
        # 2. 合并请求参数（测试参数优先）
        request_params = api.request_params or {}
        if test_request.params:
            request_params.update(test_request.params)
        
        # 3. 合并请求体（测试请求体优先）
        request_body = api.request_body or {}
        if test_request.body:
            request_body.update(test_request.body)
        
        # 4. 构建完整URL
        url = api.path
        if not url.startswith("http://") and not url.startswith("https://"):
            # 相对路径，需要添加基础URL
            base_url = getattr(settings, "BASE_URL", "http://localhost:8000")
            url = f"{base_url}{url}"
        
        # 5. 发送请求
        start_time = time.time()
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                # 根据请求方法发送请求
                method_upper = api.method.upper()
                if method_upper == "GET":
                    response = await client.get(
                        url,
                        headers=request_headers,
                        params=request_params,
                    )
                elif method_upper == "POST":
                    response = await client.post(
                        url,
                        headers=request_headers,
                        params=request_params,
                        json=request_body,
                    )
                elif method_upper == "PUT":
                    response = await client.put(
                        url,
                        headers=request_headers,
                        params=request_params,
                        json=request_body,
                    )
                elif method_upper == "DELETE":
                    response = await client.delete(
                        url,
                        headers=request_headers,
                        params=request_params,
                    )
                elif method_upper == "PATCH":
                    response = await client.patch(
                        url,
                        headers=request_headers,
                        params=request_params,
                        json=request_body,
                    )
                else:
                    raise ValueError(f"不支持的请求方法: {api.method}")
                
                # 6. 解析响应
                elapsed_time = time.time() - start_time
                
                # 尝试解析 JSON 响应
                try:
                    response_body = response.json()
                except Exception:
                    # 如果不是 JSON，返回文本
                    response_body = response.text
                
                return {
                    "status_code": response.status_code,
                    "headers": dict(response.headers),
                    "body": response_body,
                    "elapsed_time": round(elapsed_time, 3),
                }
        except httpx.TimeoutException:
            elapsed_time = time.time() - start_time
            return {
                "status_code": 0,
                "headers": {},
                "body": {"error": "请求超时"},
                "elapsed_time": round(elapsed_time, 3),
            }
        except httpx.RequestError as e:
            elapsed_time = time.time() - start_time
            return {
                "status_code": 0,
                "headers": {},
                "body": {"error": f"请求失败: {str(e)}"},
                "elapsed_time": round(elapsed_time, 3),
            }
        except Exception as e:
            elapsed_time = time.time() - start_time
            return {
                "status_code": 0,
                "headers": {},
                "body": {"error": f"未知错误: {str(e)}"},
                "elapsed_time": round(elapsed_time, 3),
            }

