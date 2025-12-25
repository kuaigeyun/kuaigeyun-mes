"""
登录日志管理服务模块

提供登录日志的创建、查询和统计功能。
"""

from typing import List, Optional, Dict
from datetime import datetime

from tortoise.expressions import Q
from tortoise.functions import Count

from core.models.login_log import LoginLog
from core.schemas.login_log import (
    LoginLogCreate,
    LoginLogResponse,
    LoginLogListResponse,
    LoginLogStatsResponse,
)
from infra.exceptions.exceptions import NotFoundError


class LoginLogService:
    """
    登录日志管理服务类
    
    提供登录日志的创建、查询和统计功能。
    """
    
    @staticmethod
    async def create_login_log(data: LoginLogCreate) -> LoginLogResponse:
        """
        创建登录日志
        
        Args:
            data: 登录日志创建数据
            
        Returns:
            LoginLogResponse: 创建的登录日志对象
        """
        login_log = await LoginLog.create(**data.model_dump())
        return LoginLogResponse.model_validate(login_log)
    
    @staticmethod
    async def get_login_logs(
        tenant_id: Optional[int],
        page: int = 1,
        page_size: int = 20,
        user_id: Optional[int] = None,
        username: Optional[str] = None,
        login_status: Optional[str] = None,
        login_ip: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> LoginLogListResponse:
        """
        获取登录日志列表
        
        Args:
            tenant_id: 组织ID（可为空，用于查询所有组织的日志）
            page: 页码
            page_size: 每页数量
            user_id: 用户ID过滤（可选）
            username: 用户名过滤（可选）
            login_status: 登录状态过滤（可选）
            login_ip: 登录IP过滤（可选）
            start_time: 开始时间过滤（可选）
            end_time: 结束时间过滤（可选）
            
        Returns:
            LoginLogListResponse: 登录日志列表
        """
        query = Q()
        
        # 如果提供了 tenant_id，则过滤组织（登录失败时 tenant_id 可能为空）
        if tenant_id is not None:
            query &= Q(tenant_id=tenant_id)
        
        if user_id:
            query &= Q(user_id=user_id)
        if username:
            query &= Q(username__icontains=username)
        if login_status:
            query &= Q(login_status=login_status)
        if login_ip:
            query &= Q(login_ip__icontains=login_ip)
        if start_time:
            query &= Q(created_at__gte=start_time)
        if end_time:
            query &= Q(created_at__lte=end_time)
        
        total = await LoginLog.filter(query).count()
        
        offset = (page - 1) * page_size
        logs = await LoginLog.filter(query).order_by("-created_at").offset(offset).limit(page_size)
        
        items = [LoginLogResponse.model_validate(log) for log in logs]
        
        return LoginLogListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )
    
    @staticmethod
    async def get_login_log_by_uuid(
        tenant_id: Optional[int],
        uuid: str
    ) -> LoginLogResponse:
        """
        根据UUID获取登录日志详情
        
        Args:
            tenant_id: 组织ID（可为空）
            uuid: 登录日志UUID
            
        Returns:
            LoginLogResponse: 登录日志详情
            
        Raises:
            NotFoundError: 当登录日志不存在时抛出
        """
        query = Q(uuid=uuid)
        if tenant_id is not None:
            query &= Q(tenant_id=tenant_id)
        
        log = await LoginLog.get_or_none(query)
        if not log:
            raise NotFoundError("登录日志不存在")
        
        return LoginLogResponse.model_validate(log)
    
    @staticmethod
    async def get_login_log_stats(
        tenant_id: Optional[int],
    ) -> LoginLogStatsResponse:
        """
        获取登录日志统计
        
        Args:
            tenant_id: 组织ID（可为空）
            
        Returns:
            LoginLogStatsResponse: 登录日志统计数据
        """
        query = Q()
        if tenant_id is not None:
            query &= Q(tenant_id=tenant_id)
        
        total = await LoginLog.filter(query).count()
        success_count = await LoginLog.filter(query & Q(login_status="success")).count()
        failed_count = await LoginLog.filter(query & Q(login_status="failed")).count()
        
        # 按登录状态统计
        by_status_raw = await LoginLog.filter(query).group_by("login_status").annotate(count=Count("id")).values("login_status", "count")
        by_status = {item["login_status"]: item["count"] for item in by_status_raw}
        
        # 按用户统计（前10名）
        by_user_raw = await LoginLog.filter(query & Q(user_id__isnull=False)).group_by("user_id", "username").annotate(count=Count("id")).order_by("-count").limit(10).values("user_id", "username", "count")
        by_user = {f"{item['username']}({item['user_id']})": item["count"] for item in by_user_raw}
        
        return LoginLogStatsResponse(
            total=total,
            success_count=success_count,
            failed_count=failed_count,
            by_status=by_status,
            by_user=by_user,
        )

