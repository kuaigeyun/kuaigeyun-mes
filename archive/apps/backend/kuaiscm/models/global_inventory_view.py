"""
全局库存视图模型模块

定义全局库存视图数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel
from decimal import Decimal


class GlobalInventoryView(BaseModel):
    """
    全局库存视图模型
    
    用于管理全局库存视图，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        view_no: 视图编号（组织内唯一）
        view_name: 视图名称
        material_id: 物料ID（关联master-data）
        material_name: 物料名称
        material_code: 物料编码
        inventory_type: 库存类型（原材料、在制品、成品）
        warehouse_id: 仓库ID（关联master-data）
        warehouse_name: 仓库名称
        quantity: 数量
        unit: 单位
        unit_price: 单价
        total_value: 总价值
        turnover_rate: 周转率
        alert_status: 预警状态（正常、预警、紧急）
        status: 状态（正常、预警、呆滞）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiscm_global_inventory_views"
        indexes = [
            ("tenant_id",),
            ("view_no",),
            ("material_id",),
            ("inventory_type",),
            ("warehouse_id",),
            ("alert_status",),
            ("status",),
        ]
        unique_together = [("tenant_id", "view_no")]
    
    view_no = fields.CharField(max_length=100, description="视图编号")
    view_name = fields.CharField(max_length=200, description="视图名称")
    material_id = fields.IntField(null=True, description="物料ID")
    material_name = fields.CharField(max_length=200, null=True, description="物料名称")
    material_code = fields.CharField(max_length=100, null=True, description="物料编码")
    inventory_type = fields.CharField(max_length=50, null=True, description="库存类型")
    warehouse_id = fields.IntField(null=True, description="仓库ID")
    warehouse_name = fields.CharField(max_length=200, null=True, description="仓库名称")
    quantity = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="数量")
    unit = fields.CharField(max_length=20, null=True, description="单位")
    unit_price = fields.DecimalField(max_digits=18, decimal_places=2, null=True, description="单价")
    total_value = fields.DecimalField(max_digits=18, decimal_places=2, null=True, description="总价值")
    turnover_rate = fields.DecimalField(max_digits=10, decimal_places=4, null=True, description="周转率")
    alert_status = fields.CharField(max_length=50, default="正常", description="预警状态")
    status = fields.CharField(max_length=50, default="正常", description="状态")
    remark = fields.TextField(null=True, description="备注")

