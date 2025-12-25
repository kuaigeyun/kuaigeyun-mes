"""
备件需求模型模块

定义备件需求数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class SparePartDemand(BaseModel):
    """
    备件需求模型
    
    用于管理备件需求，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        demand_no: 需求单编号（组织内唯一）
        source_type: 来源类型（维护计划、故障维修、库存预警）
        source_id: 来源ID
        source_no: 来源编号
        material_id: 物料ID（关联master-data）
        material_name: 物料名称
        material_code: 物料编码
        demand_quantity: 需求数量
        demand_date: 需求日期
        required_date: 要求到货日期
        applicant_id: 申请人ID（用户ID）
        applicant_name: 申请人姓名
        status: 需求状态（草稿、待审批、已审批、已采购、已到货、已取消）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaieam_spare_part_demands"
        indexes = [
            ("tenant_id",),
            ("demand_no",),
            ("source_type",),
            ("material_id",),
            ("status",),
            ("demand_date",),
        ]
        unique_together = [("tenant_id", "demand_no")]
    
    demand_no = fields.CharField(max_length=100, description="需求单编号")
    source_type = fields.CharField(max_length=50, null=True, description="来源类型（维护计划、故障维修、库存预警）")
    source_id = fields.IntField(null=True, description="来源ID")
    source_no = fields.CharField(max_length=100, null=True, description="来源编号")
    material_id = fields.IntField(description="物料ID")
    material_name = fields.CharField(max_length=200, description="物料名称")
    material_code = fields.CharField(max_length=100, null=True, description="物料编码")
    demand_quantity = fields.IntField(description="需求数量")
    demand_date = fields.DatetimeField(description="需求日期")
    required_date = fields.DatetimeField(null=True, description="要求到货日期")
    applicant_id = fields.IntField(null=True, description="申请人ID")
    applicant_name = fields.CharField(max_length=100, null=True, description="申请人姓名")
    status = fields.CharField(max_length=50, default="草稿", description="需求状态")
    remark = fields.TextField(null=True, description="备注")
