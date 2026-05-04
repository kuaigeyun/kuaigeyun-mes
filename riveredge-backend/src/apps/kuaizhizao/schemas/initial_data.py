"""
期初数据导入 Schema 模块

提供期初数据导入相关的数据验证Schema。

Author: Luigi Lu
Date: 2026-01-15
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from core.schemas.base import BaseSchema


# === 期初导入请求体（与前端 uni-import 一致） ===


class InitialImportRequest(BaseSchema):
    """期初导入统一请求：表格二维数组 + 可选快照时间"""

    data: List[List[Any]] = Field(..., description="表头+示例行+数据行")
    snapshot_time: Optional[datetime] = Field(None, description="快照时间点")


# === 向导进度补丁（倒计时 progress / wizard_step） ===


class WizardCountdownPatchRequest(BaseSchema):
    """更新快照、当前步骤及各阶段完成/跳过状态"""

    snapshot_time: Optional[datetime] = Field(None, description="快照时间点")
    wizard_step: Optional[int] = Field(None, ge=0, le=10, description="向导步骤索引")
    stage: Optional[str] = Field(
        None,
        description="inventory / wip / receivables_payables",
    )
    stage_status: Optional[str] = Field(
        None,
        description="pending / in_progress / completed / skipped",
    )


# === 上线倒计时 ===

class LaunchCountdownBase(BaseSchema):
    """上线倒计时基础schema"""
    launch_date: datetime = Field(..., description="上线日期")
    snapshot_time: Optional[datetime] = Field(None, description="快照时间点（期初数据的基准时间点）")
    status: str = Field("pending", max_length=20, description="状态（pending/in_progress/completed/cancelled）")
    progress: Optional[Dict[str, Any]] = Field(None, description="导入进度（JSON格式，存储各阶段导入状态）")
    notes: Optional[str] = Field(None, description="备注")


class LaunchCountdownCreate(LaunchCountdownBase):
    """上线倒计时创建schema"""
    pass


class LaunchCountdownUpdate(BaseSchema):
    """上线倒计时更新schema"""
    launch_date: Optional[datetime] = Field(None, description="上线日期")
    snapshot_time: Optional[datetime] = Field(None, description="快照时间点")
    status: Optional[str] = Field(None, max_length=20, description="状态")
    progress: Optional[Dict[str, Any]] = Field(None, description="导入进度")
    notes: Optional[str] = Field(None, description="备注")


class LaunchCountdownResponse(LaunchCountdownBase):
    """上线倒计时响应schema"""
    id: int = Field(..., description="倒计时ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    class Config:
        from_attributes = True


# === 动态数据补偿 ===

class DataCompensationRequest(BaseSchema):
    """动态数据补偿请求schema"""
    snapshot_time: datetime = Field(..., description="快照时间点")
    launch_date: datetime = Field(..., description="上线日期")


class DataCompensationResponse(BaseSchema):
    """动态数据补偿响应schema"""
    inventory_compensation: Dict[str, Any] = Field(..., description="库存补偿结果")
    wip_compensation: Dict[str, Any] = Field(..., description="在制品补偿结果")
    receivables_payables_compensation: Dict[str, Any] = Field(..., description="应收应付补偿结果")
    total_compensation_count: int = Field(..., description="总补偿数量")

