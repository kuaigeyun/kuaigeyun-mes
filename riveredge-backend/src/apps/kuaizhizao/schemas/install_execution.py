"""安装执行单 Schema"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import Field

from core.schemas.base import BaseSchema


JOB_STATUSES = ("待派工", "进行中", "待验收", "已关闭")
SUPPLY_SOURCES = ("自制", "外购", "混合")
STAGE_STATUSES = ("待开始", "进行中", "已完成")
TASK_STATUSES = ("待处理", "进行中", "已完成")
COST_TYPES = ("人工", "差旅", "外协", "物料")
MAX_TASK_ATTACHMENTS = 9

INSTALL_EXECUTION_STAGE_DICT_CODE = "INSTALL_EXECUTION_STAGE"
class InstallExecutionStageUpdate(BaseSchema):
    """阶段更新"""

    stage_key: str = Field(..., max_length=50, description="阶段键")
    status: Optional[str] = Field(None, max_length=20, description="阶段状态")
    planned_at: Optional[datetime] = Field(None, description="计划完成时间")
    actual_at: Optional[datetime] = Field(None, description="实际完成时间")
    notes: Optional[str] = Field(None, description="阶段备注")


class InstallExecutionStageResponse(BaseSchema):
    """阶段响应"""

    id: int = Field(..., description="阶段ID")
    uuid: str = Field(..., max_length=36, description="业务UUID")
    job_id: int = Field(..., description="安装执行单ID")
    stage_key: str = Field(..., description="阶段键")
    stage_name: str = Field(..., description="阶段名称")
    sort_order: int = Field(1, description="排序")
    status: str = Field(..., description="阶段状态")
    planned_at: Optional[datetime] = Field(None, description="计划完成时间")
    actual_at: Optional[datetime] = Field(None, description="实际完成时间")
    notes: Optional[str] = Field(None, description="阶段备注")


class InstallExecutionCostCreate(BaseSchema):
    """费用行创建/更新"""

    cost_type: str = Field(..., max_length=20, description="费用类型")
    amount: Decimal = Field(..., description="金额")
    occurred_at: datetime = Field(..., description="发生时间")
    description: Optional[str] = Field(None, max_length=500, description="说明")


class InstallExecutionCostResponse(InstallExecutionCostCreate):
    """费用行响应"""

    id: int = Field(..., description="费用行ID")
    uuid: str = Field(..., max_length=36, description="业务UUID")
    job_id: int = Field(..., description="安装执行单ID")
    line_no: int = Field(1, description="行号")


class InstallExecutionTaskCreate(BaseSchema):
    """任务登记"""

    stage_key: str = Field(..., max_length=50, description="所属阶段键")
    task_title: str = Field(..., max_length=200, description="任务标题")
    executor_id: Optional[int] = Field(None, description="执行人ID")
    executor_name: Optional[str] = Field(None, max_length=100, description="执行人姓名")
    status: str = Field("待处理", max_length=20, description="任务状态")
    planned_at: Optional[datetime] = Field(None, description="计划时间")
    actual_at: Optional[datetime] = Field(None, description="实际完成时间")
    notes: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[Dict[str, Any]]] = Field(None, description="现场照片")


class InstallExecutionTaskResponse(InstallExecutionTaskCreate):
    """任务响应"""

    id: int = Field(..., description="任务ID")
    uuid: str = Field(..., max_length=36, description="业务UUID")
    job_id: int = Field(..., description="安装执行单ID")
    line_no: int = Field(1, description="行号")
    stage_name: Optional[str] = Field(None, description="阶段名称")


class InstallExecutionAdvanceStage(BaseSchema):
    """阶段推进"""

    notes: Optional[str] = Field(None, description="完成备注（写入当前阶段）")


class InstallExecutionCreate(BaseSchema):
    """创建安装执行单"""

    customer_id: int = Field(..., description="客户ID")
    supply_source: str = Field("自制", max_length=20, description="供给来源")
    site_address: Optional[str] = Field(None, max_length=500, description="现场地址")
    owner_id: Optional[int] = Field(None, description="负责人ID")
    owner_name: Optional[str] = Field(None, max_length=100, description="负责人姓名")
    notes: Optional[str] = Field(None, description="备注")
    sales_order_id: Optional[int] = Field(None, description="关联销售订单ID")
    sales_delivery_id: Optional[int] = Field(None, description="关联销售出库单ID")
    packing_binding_id: Optional[int] = Field(None, description="关联装箱绑定ID")
    stages: Optional[List[InstallExecutionStageUpdate]] = Field(None, description="阶段（可选覆盖默认）")
    costs: List[InstallExecutionCostCreate] = Field(default_factory=list, description="费用明细")


class InstallExecutionUpdate(BaseSchema):
    """更新安装执行单"""

    supply_source: Optional[str] = Field(None, max_length=20, description="供给来源")
    site_address: Optional[str] = Field(None, max_length=500, description="现场地址")
    owner_id: Optional[int] = Field(None, description="负责人ID")
    owner_name: Optional[str] = Field(None, max_length=100, description="负责人姓名")
    status: Optional[str] = Field(None, max_length=20, description="单据状态")
    notes: Optional[str] = Field(None, description="备注")
    sales_order_id: Optional[int] = Field(None, description="关联销售订单ID")
    sales_delivery_id: Optional[int] = Field(None, description="关联销售出库单ID")
    packing_binding_id: Optional[int] = Field(None, description="关联装箱绑定ID")
    stages: Optional[List[InstallExecutionStageUpdate]] = Field(None, description="阶段更新")
    costs: Optional[List[InstallExecutionCostCreate]] = Field(None, description="费用明细（传入则整表替换）")


class InstallExecutionClose(BaseSchema):
    """关闭安装执行单"""

    notes: Optional[str] = Field(None, description="关闭备注")


class InstallExecutionPullFromSalesOrderRequest(BaseSchema):
    """从销售订单上拉创建"""

    sales_order_id: int = Field(..., description="销售订单ID")
    supply_source: str = Field("自制", max_length=20, description="供给来源")
    site_address: Optional[str] = Field(None, max_length=500, description="现场地址")


class InstallExecutionPullFromSalesDeliveryRequest(BaseSchema):
    """从销售出库上拉创建"""

    sales_delivery_id: int = Field(..., description="销售出库单ID")
    supply_source: str = Field("自制", max_length=20, description="供给来源")
    site_address: Optional[str] = Field(None, max_length=500, description="现场地址")
    packing_binding_id: Optional[int] = Field(None, description="关联装箱绑定ID")


class InstallExecutionResponse(BaseSchema):
    """安装执行单响应"""

    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., max_length=36, description="业务UUID")
    job_code: str = Field(..., description="安装执行单号")
    customer_id: int = Field(..., description="客户ID")
    customer_name: str = Field(..., description="客户名称")
    sales_order_id: Optional[int] = Field(None, description="关联销售订单ID")
    sales_order_code: Optional[str] = Field(None, description="关联销售订单编码")
    sales_delivery_id: Optional[int] = Field(None, description="关联销售出库单ID")
    sales_delivery_code: Optional[str] = Field(None, description="关联销售出库单编码")
    packing_binding_id: Optional[int] = Field(None, description="关联装箱绑定ID")
    supply_source: str = Field(..., description="供给来源")
    site_address: Optional[str] = Field(None, description="现场地址")
    owner_id: Optional[int] = Field(None, description="负责人ID")
    owner_name: Optional[str] = Field(None, description="负责人姓名")
    status: str = Field(..., description="单据状态")
    current_stage_key: Optional[str] = Field(None, description="当前阶段键")
    notes: Optional[str] = Field(None, description="备注")
    total_cost_amount: Optional[Decimal] = Field(None, description="费用合计")
    started_at: Optional[datetime] = Field(None, description="开始时间")
    closed_at: Optional[datetime] = Field(None, description="关闭时间")
    created_at: Optional[datetime] = Field(None, description="创建时间")
    updated_at: Optional[datetime] = Field(None, description="更新时间")
    created_by_name: Optional[str] = Field(None, description="创建人")
    updated_by_name: Optional[str] = Field(None, description="更新人")
    stages: List[InstallExecutionStageResponse] = Field(default_factory=list, description="阶段")
    costs: List[InstallExecutionCostResponse] = Field(default_factory=list, description="费用")
    tasks: List[InstallExecutionTaskResponse] = Field(default_factory=list, description="任务明细")
    capabilities: Optional[Dict[str, Any]] = Field(None, description="操作能力")


class InstallExecutionListEnvelope(BaseSchema):
    """列表响应"""

    data: List[InstallExecutionResponse] = Field(default_factory=list)
    total: int = Field(0, description="总数")
    success: bool = Field(True, description="是否成功")
