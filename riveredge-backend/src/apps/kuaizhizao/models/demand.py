"""
统一需求模型

提供统一的需求数据模型定义，支持销售预测和销售订单两种需求类型。

根据《☆ 用户使用全场景推演.md》的设计理念，将销售预测和销售订单统一为需求管理，
作为整个业务流程的源头。

Author: Luigi Lu
Date: 2025-01-14
"""

from tortoise import fields
from core.models.base import BaseModel


class Demand(BaseModel):
    """
    统一需求模型

    用于统一管理销售预测（MTS模式）和销售订单（MTO模式）两种需求类型。
    作为整个业务流程的源头，支持需求下推到物料需求运算。

    需求类型（demand_type）：
    - sales_forecast: 销售预测（MTS模式）
    - sales_order: 销售订单（MTO模式）
    
    注意：继承自BaseModel，自动获得id、uuid、tenant_id、created_at、updated_at字段
    """
    demand_code = fields.CharField(max_length=50, description="需求编码")
    
    # 需求类型（sales_forecast 或 sales_order）
    demand_type = fields.CharField(max_length=20, description="需求类型")
    
    # 需求基本信息（通用字段）
    demand_name = fields.CharField(max_length=200, description="需求名称")
    
    # 业务模式（MTS 或 MTO，根据需求类型自动识别）
    business_mode = fields.CharField(max_length=20, description="业务模式（MTS/MTO）")
    
    # 时间范围（通用）
    start_date = fields.DateField(description="开始日期")
    end_date = fields.DateField(null=True, description="结束日期（销售订单可为空）")
    
    # 客户信息（销售订单专用，销售预测可为空）
    customer_id = fields.IntField(null=True, description="客户ID")
    customer_name = fields.CharField(max_length=200, null=True, description="客户名称")
    customer_contact = fields.CharField(max_length=100, null=True, description="客户联系人")
    customer_phone = fields.CharField(max_length=20, null=True, description="客户电话")
    
    # 销售预测专用字段
    forecast_period = fields.CharField(max_length=20, null=True, description="预测周期（销售预测专用）")
    
    # 销售订单专用字段
    order_date = fields.DateField(null=True, description="订单日期（销售订单专用）")
    delivery_date = fields.DateField(null=True, description="交货日期（销售订单专用）")
    
    # 金额信息（通用）
    total_quantity = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="总数量")
    total_amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="总金额")
    
    # 状态（通用）
    status = fields.CharField(max_length=20, default="草稿", description="需求状态")
    
    # 时间节点记录（用于耗时统计）
    submit_time = fields.DatetimeField(null=True, description="提交时间")
    
    # 审核信息（通用）
    reviewer_id = fields.IntField(null=True, description="审核人ID")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    review_time = fields.DatetimeField(null=True, description="审核时间")
    review_status = fields.CharField(max_length=20, default="待审核", description="审核状态")
    review_remarks = fields.TextField(null=True, description="审核备注")
    
    # 销售信息（销售订单专用）
    salesman_id = fields.IntField(null=True, description="销售员ID")
    salesman_name = fields.CharField(max_length=100, null=True, description="销售员姓名")
    
    # 物流信息（销售订单专用）
    shipping_address = fields.TextField(null=True, description="收货地址")
    shipping_method = fields.CharField(max_length=50, null=True, description="发货方式")
    payment_terms = fields.CharField(max_length=100, null=True, description="付款条件")
    
    # 需求关联信息
    source_id = fields.IntField(null=True, description="来源ID（用于关联原始销售预测或销售订单）")
    source_type = fields.CharField(max_length=50, null=True, description="来源类型")
    source_code = fields.CharField(max_length=50, null=True, description="来源编码")
    
    # 下推信息
    pushed_to_computation = fields.BooleanField(default=False, description="是否已下推到需求计算")
    computation_id = fields.IntField(null=True, description="关联的需求计算ID")
    computation_code = fields.CharField(max_length=50, null=True, description="关联的需求计算编码")
    
    notes = fields.TextField(null=True, description="备注")
    is_active = fields.BooleanField(default=True, description="是否有效")
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")
    
    class Meta:
        table = "apps_kuaizhizao_demands"
        table_description = "快格轻制造 - 统一需求"
        indexes = [
            ("tenant_id", "demand_type"),
            ("tenant_id", "status"),
            ("tenant_id", "business_mode"),
            ("start_date",),
            ("end_date",),
            ("delivery_date",),
            ("customer_id",),
            ("demand_code",),
        ]
    
    class PydanticMeta:
        exclude = ["deleted_at"]
