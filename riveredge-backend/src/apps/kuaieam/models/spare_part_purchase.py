"""
备件采购模型模块

定义备件采购数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class SparePartPurchase(BaseModel):
    """
    备件采购模型
    
    用于管理备件采购，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        purchase_no: 采购单编号（组织内唯一）
        demand_id: 备件需求ID（关联备件需求）
        demand_uuid: 备件需求UUID
        material_id: 物料ID（关联master-data）
        material_name: 物料名称
        material_code: 物料编码
        purchase_quantity: 采购数量
        unit_price: 单价
        total_amount: 总金额
        supplier_id: 供应商ID（关联master-data）
        supplier_name: 供应商名称
        purchase_date: 采购日期
        expected_delivery_date: 预计到货日期
        actual_delivery_date: 实际到货日期
        purchaser_id: 采购人员ID（用户ID）
        purchaser_name: 采购人员姓名
        status: 采购状态（草稿、待审批、已审批、已下单、已到货、已验收、已取消）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaieam_spare_part_purchases"
        indexes = [
            ("tenant_id",),
            ("purchase_no",),
            ("demand_id",),
            ("material_id",),
            ("supplier_id",),
            ("status",),
            ("purchase_date",),
        ]
        unique_together = [("tenant_id", "purchase_no")]
    
    purchase_no = fields.CharField(max_length=100, description="采购单编号")
    demand_id = fields.IntField(null=True, description="备件需求ID")
    demand_uuid = fields.CharField(max_length=36, null=True, description="备件需求UUID")
    material_id = fields.IntField(description="物料ID")
    material_name = fields.CharField(max_length=200, description="物料名称")
    material_code = fields.CharField(max_length=100, null=True, description="物料编码")
    purchase_quantity = fields.IntField(description="采购数量")
    unit_price = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="单价")
    total_amount = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="总金额")
    supplier_id = fields.IntField(null=True, description="供应商ID")
    supplier_name = fields.CharField(max_length=200, null=True, description="供应商名称")
    purchase_date = fields.DatetimeField(description="采购日期")
    expected_delivery_date = fields.DatetimeField(null=True, description="预计到货日期")
    actual_delivery_date = fields.DatetimeField(null=True, description="实际到货日期")
    purchaser_id = fields.IntField(null=True, description="采购人员ID")
    purchaser_name = fields.CharField(max_length=100, null=True, description="采购人员姓名")
    status = fields.CharField(max_length=50, default="草稿", description="采购状态")
    remark = fields.TextField(null=True, description="备注")
