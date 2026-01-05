"""
上线倒计时服务模块

提供上线倒计时管理的业务逻辑处理。

Author: Luigi Lu
Date: 2026-01-15
"""

from typing import Optional, Dict, Any
from datetime import datetime
from tortoise.transactions import in_transaction
from loguru import logger

import uuid
from apps.kuaizhizao.models.launch_countdown import LaunchCountdown
from apps.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError


class LaunchCountdownService(AppBaseService[LaunchCountdown]):
    """
    上线倒计时服务类
    
    提供上线倒计时配置和进度跟踪功能。
    """
    
    def __init__(self):
        super().__init__(LaunchCountdown)
    
    async def create_or_update_countdown(
        self,
        tenant_id: int,
        launch_date: datetime,
        snapshot_time: Optional[datetime] = None,
        created_by: int = 1
    ) -> LaunchCountdown:
        """
        创建或更新上线倒计时
        
        Args:
            tenant_id: 组织ID
            launch_date: 上线日期
            snapshot_time: 快照时间点（可选）
            created_by: 创建人ID
            
        Returns:
            LaunchCountdown: 上线倒计时对象
        """
        async with in_transaction():
            # 查找现有的倒计时（进行中或待开始）
            existing = await LaunchCountdown.filter(
                tenant_id=tenant_id,
                status__in=["pending", "in_progress"],
                deleted_at__isnull=True
            ).first()
            
            if existing:
                # 更新现有倒计时
                existing.launch_date = launch_date
                if snapshot_time:
                    existing.snapshot_time = snapshot_time
                existing.status = "in_progress"
                existing.updated_by = created_by
                await existing.save()
                return existing
            else:
                # 创建新倒计时
                countdown = await LaunchCountdown.create(
                    tenant_id=tenant_id,
                    uuid=str(uuid.uuid4()),
                    launch_date=launch_date,
                    snapshot_time=snapshot_time,
                    status="in_progress",
                    progress={
                        "inventory": {"status": "pending", "completed": False},
                        "wip": {"status": "pending", "completed": False},
                        "receivables_payables": {"status": "pending", "completed": False},
                        "compensation": {"status": "pending", "completed": False},
                    },
                    created_by=created_by,
                    updated_by=created_by,
                )
                return countdown
    
    async def get_countdown(self, tenant_id: int) -> Optional[LaunchCountdown]:
        """
        获取当前组织的上线倒计时
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            LaunchCountdown: 上线倒计时对象，如果不存在则返回None
        """
        return await LaunchCountdown.filter(
            tenant_id=tenant_id,
            status__in=["pending", "in_progress"],
            deleted_at__isnull=True
        ).first()
    
    async def update_progress(
        self,
        tenant_id: int,
        stage: str,
        status: str = "completed",
        created_by: int = 1
    ) -> LaunchCountdown:
        """
        更新导入进度
        
        Args:
            tenant_id: 组织ID
            stage: 阶段名称（inventory/wip/receivables_payables/compensation）
            status: 状态（pending/in_progress/completed）
            created_by: 更新人ID
            
        Returns:
            LaunchCountdown: 更新后的上线倒计时对象
        """
        countdown = await self.get_countdown(tenant_id)
        if not countdown:
            raise NotFoundError("上线倒计时不存在")
        
        if countdown.progress:
            countdown.progress[stage] = {
                "status": status,
                "completed": status == "completed",
                "updated_at": datetime.now().isoformat()
            }
        else:
            countdown.progress = {
                stage: {
                    "status": status,
                    "completed": status == "completed",
                    "updated_at": datetime.now().isoformat()
                }
            }
        
        countdown.updated_by = created_by
        await countdown.save()
        return countdown
    
    async def complete_countdown(self, tenant_id: int, created_by: int = 1) -> LaunchCountdown:
        """
        完成上线倒计时
        
        Args:
            tenant_id: 组织ID
            created_by: 更新人ID
            
        Returns:
            LaunchCountdown: 更新后的上线倒计时对象
        """
        countdown = await self.get_countdown(tenant_id)
        if not countdown:
            raise NotFoundError("上线倒计时不存在")
        
        countdown.status = "completed"
        countdown.updated_by = created_by
        await countdown.save()
        return countdown

