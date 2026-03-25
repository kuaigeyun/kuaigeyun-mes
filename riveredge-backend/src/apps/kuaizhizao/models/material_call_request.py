"""
叫料请求数据模型模块

定义生产现场向仓库发起的物料需求（叫料）请求模型。
支持拉动式物料管理（Pull System）。
"""

from tortoise import fields
from core.models.base import BaseModel


class MaterialCallRequest(BaseModel):
    """
    叫料请求模型

    用于记录生产车间/工作中心向仓库发起的物料配送请求。
    """
    tenant_id = fields.IntField(description="租户ID")
    code = fields.CharField(max_length=50, unique=True, description="叫料单号")
    
    # 关联信息
    work_order_id = fields.IntField(description="关联工单ID")
    work_order_code = fields.CharField(max_length=50, description="工单编码")
    
    # 物料信息
    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    material_unit = fields.CharField(max_length=20, null=True, description="单位")
    
    # 数量信息
    requested_quantity = fields.DecimalField(max_digits=12, decimal_places=4, description="请求数量")
    delivered_quantity = fields.DecimalField(max_digits=12, decimal_places=4, default=0, description="已送达数量")
    
    # 仓库信息
    source_warehouse_id = fields.IntField(null=True, description="来源仓库ID（通常为主仓）")
    target_warehouse_id = fields.IntField(null=True, description="目标仓库ID（通常为线边仓）")
    
    # 状态：pending(待处理), processing(配料中), partial(部分送达), completed(已完成), cancelled(已取消)
    status = fields.CharField(max_length=20, default="pending", description="状态")
    priority = fields.CharField(max_length=20, default="normal", description="优先级（low/normal/high/urgent）")
    
    # 人员与时间
    caller_id = fields.IntField(description="发起人ID")
    caller_name = fields.CharField(max_length=100, description="发起人姓名")
    handler_id = fields.IntField(null=True, description="处理人/配料人ID")
    handler_name = fields.CharField(max_length=100, null=True, description="处理人姓名")
    
    needed_at = fields.DatetimeField(null=True, description="期望送达时间")
    completed_at = fields.DatetimeField(null=True, description="完成时间")
    
    remarks = fields.TextField(null=True, description="备注")
    is_active = fields.BooleanField(default=True, description="是否有效")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_material_call_requests"
        table_description = "快格轻制造 - 叫料请求"
        indexes = [
            ("tenant_id", "status"),
            ("work_order_id",),
            ("material_id",),
            ("code",),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
