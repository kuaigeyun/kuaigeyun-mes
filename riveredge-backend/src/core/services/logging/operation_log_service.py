"""
操作日志管理服务模块

提供操作日志的查询和统计功能。
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import uuid

from tortoise.expressions import Q

from core.models.operation_log import OperationLog
from core.schemas.operation_log import (
    OperationLogResponse,
    OperationLogListResponse,
    OperationLogStatsResponse,
)


class OperationLogService:
    """
    操作日志管理服务类
    
    提供操作日志的查询和统计功能。
    """
    
    @staticmethod
    async def create_operation_log(
        tenant_id: int,
        user_id: int,
        operation_type: str,
        operation_module: Optional[str] = None,
        operation_object_type: Optional[str] = None,
        operation_object_id: Optional[int] = None,
        operation_object_uuid: Optional[str] = None,
        operation_content: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        request_method: Optional[str] = None,
        request_path: Optional[str] = None,
    ) -> OperationLog:
        """
        创建操作日志
        
        Args:
            tenant_id: 组织ID
            user_id: 操作用户ID
            operation_type: 操作类型
            operation_module: 操作模块
            operation_object_type: 操作对象类型
            operation_object_id: 操作对象ID
            operation_object_uuid: 操作对象UUID
            operation_content: 操作内容
            ip_address: 操作IP
            user_agent: 用户代理
            request_method: 请求方法
            request_path: 请求路径
            
        Returns:
            OperationLog: 创建的操作日志对象
        """
        operation_log = await OperationLog.create(
            uuid=str(uuid.uuid4()),
            tenant_id=tenant_id,
            user_id=user_id,
            operation_type=operation_type,
            operation_module=operation_module,
            operation_object_type=operation_object_type,
            operation_object_id=operation_object_id,
            operation_object_uuid=operation_object_uuid,
            operation_content=operation_content,
            ip_address=ip_address,
            user_agent=user_agent,
            request_method=request_method,
            request_path=request_path,
        )
        return operation_log
    
    @staticmethod
    async def get_operation_logs(
        tenant_id: int,
        page: int = 1,
        page_size: int = 20,
        user_id: Optional[int] = None,
        operation_type: Optional[str] = None,
        operation_module: Optional[str] = None,
        operation_object_type: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> OperationLogListResponse:
        """
        获取操作日志列表
        
        Args:
            tenant_id: 组织ID
            page: 页码
            page_size: 每页数量
            user_id: 用户ID过滤（可选）
            operation_type: 操作类型过滤（可选）
            operation_module: 操作模块过滤（可选）
            operation_object_type: 操作对象类型过滤（可选）
            start_time: 开始时间过滤（可选）
            end_time: 结束时间过滤（可选）
            
        Returns:
            OperationLogListResponse: 操作日志列表
        """
        # 构建查询条件
        query = Q(tenant_id=tenant_id)
        
        # 用户过滤
        if user_id:
            query &= Q(user_id=user_id)
        
        # 操作类型过滤
        if operation_type:
            query &= Q(operation_type=operation_type)
        
        # 操作模块过滤
        if operation_module:
            query &= Q(operation_module=operation_module)
        
        # 操作对象类型过滤
        if operation_object_type:
            query &= Q(operation_object_type=operation_object_type)
        
        # 时间范围过滤
        if start_time:
            query &= Q(created_at__gte=start_time)
        if end_time:
            query &= Q(created_at__lte=end_time)
        
        # 查询总数
        total = await OperationLog.filter(query).count()
        
        # 查询列表（按创建时间倒序）
        offset = (page - 1) * page_size
        logs = await OperationLog.filter(query).order_by("-created_at").offset(offset).limit(page_size)
        
        # 批量查询用户信息（优化性能）
        from infra.models.user import User
        user_ids = list(set([log.user_id for log in logs]))
        users = await User.filter(id__in=user_ids).all()
        user_map = {user.id: user for user in users}
        
        # 转换为响应格式，并添加用户信息
        items = []
        for log in logs:
            log_dict = OperationLogResponse.model_validate(log).model_dump()
            # 添加用户信息
            user = user_map.get(log.user_id)
            if user:
                log_dict['username'] = user.username
                log_dict['user_full_name'] = user.full_name
            items.append(OperationLogResponse(**log_dict))
        
        return OperationLogListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )
    
    @staticmethod
    async def get_operation_log_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> OperationLogResponse:
        """
        根据UUID获取操作日志详情
        
        Args:
            tenant_id: 组织ID
            uuid: 操作日志UUID
            
        Returns:
            OperationLogResponse: 操作日志详情
            
        Raises:
            NotFoundError: 当操作日志不存在时抛出
        """
        from infra.exceptions.exceptions import NotFoundError
        
        log = await OperationLog.filter(tenant_id=tenant_id, uuid=uuid).first()
        if not log:
            raise NotFoundError("操作日志", uuid)
        
        # 查询用户信息
        from infra.models.user import User
        user = await User.get_or_none(id=log.user_id)
        
        # 转换为响应格式，并添加用户信息
        log_dict = OperationLogResponse.model_validate(log).model_dump()
        if user:
            log_dict['username'] = user.username
            log_dict['user_full_name'] = user.full_name
        
        return OperationLogResponse(**log_dict)
    
    @staticmethod
    async def get_operation_log_stats(
        tenant_id: int,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> OperationLogStatsResponse:
        """
        获取操作日志统计
        
        Args:
            tenant_id: 组织ID
            start_time: 开始时间过滤（可选）
            end_time: 结束时间过滤（可选）
            
        Returns:
            OperationLogStatsResponse: 操作日志统计
        """
        from tortoise.functions import Count
        
        # 构建查询条件
        query = Q(tenant_id=tenant_id)
        
        # 时间范围过滤
        if start_time:
            query &= Q(created_at__gte=start_time)
        if end_time:
            query &= Q(created_at__lte=end_time)
        
        # 查询总数
        total = await OperationLog.filter(query).count()
        
        # 按操作类型统计（使用聚合查询优化性能）
        # 注意：Tortoise ORM 的聚合查询语法是 annotate().group_by().values()
        by_type: Dict[str, int] = {}
        logs_by_type = await OperationLog.filter(query).annotate(
            count=Count('id')
        ).group_by('operation_type').values('operation_type', 'count')
        
        for item in logs_by_type:
            by_type[item['operation_type']] = item['count']
        
        # 按操作模块统计（使用聚合查询优化性能）
        by_module: Dict[str, int] = {}
        logs_by_module = await OperationLog.filter(query & Q(operation_module__not_isnull=True)).annotate(
            count=Count('id')
        ).group_by('operation_module').values('operation_module', 'count')
        
        for item in logs_by_module:
            if item['operation_module']:
                by_module[item['operation_module']] = item['count']
        
        return OperationLogStatsResponse(
            total=total,
            by_type=by_type,
            by_module=by_module,
        )

