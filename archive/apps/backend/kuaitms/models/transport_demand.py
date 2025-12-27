"""
运输需求模型模块

定义运输需求数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class TransportDemand(BaseModel):
    """
    运输需求模型
    
    用于管理运输需求，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        demand_no: 需求单编号（组织内唯一）
        source_type: 来源类型（销售订单、采购订单、调拨单等）
        source_id: 来源ID
        source_no: 来源编号
        customer_id: 客户ID（关联master-data）
        customer_name: 客户名称
        delivery_address: 收货地址
        contact_person: 联系人
        contact_phone: 联系电话
        material_id: 物料ID（关联master-data）
        material_name: 物料名称
        material_code: 物料编码
        quantity: 数量
        unit: 单位
        required_date: 要求到货日期
        priority: 优先级（高、中、低）
        status: 需求状态（待计划、已计划、执行中、已完成、已取消）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaitms_transport_demands"
        indexes = [
            ("tenant_id",),
            ("demand_no",),
            ("source_type", "source_id"),
            ("customer_id",),
            ("status",),
        ]
    
    demand_no = fields.CharField(max_length=100, description="需求单编号")
    source_type = fields.CharField(max_length=50, null=True, description="来源类型")
    source_id = fields.IntField(null=True, description="来源ID")
    source_no = fields.CharField(max_length=100, null=True, description="来源编号")
    customer_id = fields.IntField(null=True, description="客户ID")
    customer_name = fields.CharField(max_length=200, null=True, description="客户名称")
    delivery_address = fields.TextField(null=True, description="收货地址")
    contact_person = fields.CharField(max_length=100, null=True, description="联系人")
    contact_phone = fields.CharField(max_length=50, null=True, description="联系电话")
    material_id = fields.IntField(null=True, description="物料ID")
    material_name = fields.CharField(max_length=200, null=True, description="物料名称")
    material_code = fields.CharField(max_length=100, null=True, description="物料编码")
    quantity = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="数量")
    unit = fields.CharField(max_length=20, null=True, description="单位")
    required_date = fields.DatetimeField(null=True, description="要求到货日期")
    priority = fields.CharField(max_length=20, default="中", description="优先级")
    status = fields.CharField(max_length=50, default="待计划", description="需求状态")
    remark = fields.TextField(null=True, description="备注")

