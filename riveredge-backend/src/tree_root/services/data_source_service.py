"""
数据源管理服务模块

提供数据源的 CRUD 操作和连接测试功能。
"""

import time
import httpx
from typing import Dict, Any, Optional, List
from uuid import UUID
from datetime import datetime

from tortoise.exceptions import IntegrityError

from tree_root.models.data_source import DataSource
from tree_root.schemas.data_source import DataSourceCreate, DataSourceUpdate, TestConnectionResponse
from soil.exceptions.exceptions import NotFoundError, ValidationError


class DataSourceService:
    """
    数据源管理服务类
    
    提供数据源的 CRUD 操作和连接测试功能。
    """
    
    async def create_data_source(
        self,
        tenant_id: int,
        data_source_data: DataSourceCreate,
    ) -> DataSource:
        """
        创建数据源
        
        Args:
            tenant_id: 组织ID
            data_source_data: 数据源创建数据
            
        Returns:
            DataSource: 创建的数据源对象
            
        Raises:
            ValidationError: 数据源代码已存在
        """
        # 检查数据源代码是否已存在
        existing_data_source = await DataSource.filter(
            tenant_id=tenant_id,
            code=data_source_data.code,
            deleted_at__isnull=True,
        ).first()
        
        if existing_data_source:
            raise ValidationError(f"数据源代码 '{data_source_data.code}' 已存在")
        
        # 创建数据源
        data_source = await DataSource.create(
            tenant_id=tenant_id,
            **data_source_data.model_dump(),
        )
        
        return data_source
    
    async def get_data_source_by_uuid(
        self,
        tenant_id: int,
        data_source_uuid: UUID,
    ) -> DataSource:
        """
        根据 UUID 获取数据源
        
        Args:
            tenant_id: 组织ID
            data_source_uuid: 数据源UUID
            
        Returns:
            DataSource: 数据源对象
            
        Raises:
            NotFoundError: 数据源不存在
        """
        data_source = await DataSource.filter(
            tenant_id=tenant_id,
            uuid=data_source_uuid,
            deleted_at__isnull=True,
        ).first()
        
        if not data_source:
            raise NotFoundError(f"数据源不存在: {data_source_uuid}")
        
        return data_source
    
    async def list_data_sources(
        self,
        tenant_id: int,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        type: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> tuple[List[DataSource], int]:
        """
        获取数据源列表
        
        Args:
            tenant_id: 组织ID
            page: 页码
            page_size: 每页数量
            search: 搜索关键词（名称、代码）
            type: 数据源类型筛选
            is_active: 是否启用筛选
            
        Returns:
            tuple[List[DataSource], int]: (数据源列表, 总数)
        """
        query = DataSource.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        
        # 搜索条件
        if search:
            query = query.filter(
                name__icontains=search,
            ) | query.filter(
                code__icontains=search,
            )
        
        # 类型筛选
        if type:
            query = query.filter(type=type)
        
        # 启用状态筛选
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        # 获取总数
        total = await query.count()
        
        # 分页查询
        data_sources = await query.order_by("-created_at").offset(
            (page - 1) * page_size
        ).limit(page_size).all()
        
        return data_sources, total
    
    async def update_data_source(
        self,
        tenant_id: int,
        data_source_uuid: UUID,
        data_source_data: DataSourceUpdate,
    ) -> DataSource:
        """
        更新数据源
        
        Args:
            tenant_id: 组织ID
            data_source_uuid: 数据源UUID
            data_source_data: 数据源更新数据
            
        Returns:
            DataSource: 更新后的数据源对象
            
        Raises:
            NotFoundError: 数据源不存在
            ValidationError: 数据源代码已存在
        """
        # 获取数据源
        data_source = await self.get_data_source_by_uuid(tenant_id, data_source_uuid)
        
        # 如果更新了代码，检查是否重复
        if data_source_data.code and data_source_data.code != data_source.code:
            existing_data_source = await DataSource.filter(
                tenant_id=tenant_id,
                code=data_source_data.code,
                deleted_at__isnull=True,
            ).exclude(uuid=data_source_uuid).first()
            
            if existing_data_source:
                raise ValidationError(f"数据源代码 '{data_source_data.code}' 已存在")
        
        # 记录变更前的状态
        old_is_active = data_source.is_active
        old_config = data_source.config
        
        # 更新数据源
        update_data = data_source_data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(data_source, key, value)
        
        await data_source.save()
        
        # 如果数据源状态或配置变更，异步通知数据集管理
        if (data_source_data.is_active is not None and old_is_active != data_source.is_active) or \
           (data_source_data.config and old_config != data_source.config):
            import asyncio
            from tree_root.services.dataset_service import DatasetService
            asyncio.create_task(
                DatasetService._notify_datasets_of_data_source_change(
                    tenant_id=tenant_id,
                    data_source_code=data_source.code,
                    is_active=data_source.is_active,
                    config_changed=(data_source_data.config and old_config != data_source.config)
                )
            )
        
        return data_source
    
    async def delete_data_source(
        self,
        tenant_id: int,
        data_source_uuid: UUID,
    ) -> None:
        """
        删除数据源（软删除）
        
        Args:
            tenant_id: 组织ID
            data_source_uuid: 数据源UUID
            
        Raises:
            NotFoundError: 数据源不存在
        """
        # 获取数据源
        data_source = await self.get_data_source_by_uuid(tenant_id, data_source_uuid)
        
        # 记录数据源代码（用于通知）
        data_source_code = data_source.code
        
        # 软删除
        data_source.deleted_at = datetime.now()
        await data_source.save()
        
        # 异步通知数据集管理数据源已被删除
        import asyncio
        from tree_root.services.dataset_service import DatasetService
        asyncio.create_task(
            DatasetService._notify_datasets_of_data_source_change(
                tenant_id=tenant_id,
                data_source_code=data_source_code,
                is_active=False,
                is_deleted=True
            )
        )
    
    async def test_connection(
        self,
        tenant_id: int,
        data_source_uuid: UUID,
    ) -> TestConnectionResponse:
        """
        测试数据源连接
        
        Args:
            tenant_id: 组织ID
            data_source_uuid: 数据源UUID
            
        Returns:
            TestConnectionResponse: 测试结果
            
        Raises:
            NotFoundError: 数据源不存在
        """
        # 获取数据源
        data_source = await self.get_data_source_by_uuid(tenant_id, data_source_uuid)
        
        start_time = time.time()
        
        try:
            # 根据类型测试连接
            if data_source.type == 'postgresql':
                result = await self._test_postgresql_connection(data_source.config)
            elif data_source.type == 'mysql':
                result = await self._test_mysql_connection(data_source.config)
            elif data_source.type == 'mongodb':
                result = await self._test_mongodb_connection(data_source.config)
            elif data_source.type == 'api':
                result = await self._test_api_connection(data_source.config)
            else:
                result = {
                    'success': False,
                    'message': f'不支持的数据源类型: {data_source.type}',
                }
            
            elapsed_time = time.time() - start_time
            
            # 更新连接状态
            data_source.is_connected = result['success']
            data_source.last_connected_at = datetime.now()
            if not result['success']:
                data_source.last_error = result.get('message', '连接失败')
            else:
                data_source.last_error = None
            await data_source.save()
            
            return TestConnectionResponse(
                success=result['success'],
                message=result.get('message', '连接成功' if result['success'] else '连接失败'),
                elapsed_time=round(elapsed_time, 3),
            )
        except Exception as e:
            elapsed_time = time.time() - start_time
            
            # 更新连接状态
            data_source.is_connected = False
            data_source.last_connected_at = datetime.now()
            data_source.last_error = str(e)
            await data_source.save()
            
            return TestConnectionResponse(
                success=False,
                message=f'连接测试异常: {str(e)}',
                elapsed_time=round(elapsed_time, 3),
            )
    
    async def _test_postgresql_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        测试 PostgreSQL 连接
        
        Args:
            config: 连接配置
            
        Returns:
            Dict[str, Any]: 测试结果
        """
        try:
            # 使用 Tortoise ORM 测试连接
            from tortoise import Tortoise
            from tortoise.backends.asyncpg import AsyncpgDBClient
            
            # 构建连接字符串
            host = config.get('host', 'localhost')
            port = config.get('port', 5432)
            database = config.get('database', '')
            user = config.get('username', '')
            password = config.get('password', '')
            
            # 创建临时连接
            db_client = AsyncpgDBClient(
                host=host,
                port=port,
                user=user,
                password=password,
                database=database,
            )
            
            # 测试连接
            await db_client.create_connection()
            await db_client.execute_query('SELECT 1')
            await db_client.close()
            
            return {
                'success': True,
                'message': 'PostgreSQL 连接成功',
            }
        except Exception as e:
            return {
                'success': False,
                'message': f'PostgreSQL 连接失败: {str(e)}',
            }
    
    async def _test_mysql_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        测试 MySQL 连接
        
        Args:
            config: 连接配置
            
        Returns:
            Dict[str, Any]: 测试结果
        """
        # TODO: 使用 SQLAlchemy 或 aiomysql 测试 MySQL 连接
        # 目前返回不支持
        return {
            'success': False,
            'message': 'MySQL 连接测试暂未实现，需要安装 SQLAlchemy 或 aiomysql',
        }
    
    async def _test_mongodb_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        测试 MongoDB 连接
        
        Args:
            config: 连接配置
            
        Returns:
            Dict[str, Any]: 测试结果
        """
        # TODO: 使用 pymongo 或 motor 测试 MongoDB 连接
        # 目前返回不支持
        return {
            'success': False,
            'message': 'MongoDB 连接测试暂未实现，需要安装 pymongo 或 motor',
        }
    
    async def _test_api_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        测试 API 连接
        
        Args:
            config: 连接配置
            
        Returns:
            Dict[str, Any]: 测试结果
        """
        try:
            base_url = config.get('base_url', '')
            if not base_url:
                return {
                    'success': False,
                    'message': 'API base_url 不能为空',
                }
            
            # 构建请求头
            headers = config.get('headers', {})
            if config.get('auth_type') == 'bearer' and config.get('token'):
                headers['Authorization'] = f"Bearer {config['token']}"
            
            # 测试连接（发送 GET 请求到 base_url）
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(base_url, headers=headers)
                
                if response.status_code < 400:
                    return {
                        'success': True,
                        'message': f'API 连接成功，状态码: {response.status_code}',
                    }
                else:
                    return {
                        'success': False,
                        'message': f'API 连接失败，状态码: {response.status_code}',
                    }
        except httpx.TimeoutException:
            return {
                'success': False,
                'message': 'API 连接超时',
            }
        except Exception as e:
            return {
                'success': False,
                'message': f'API 连接失败: {str(e)}',
            }

