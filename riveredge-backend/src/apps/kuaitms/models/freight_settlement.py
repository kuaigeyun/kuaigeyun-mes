"""
运费结算模型模块

定义运费结算数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel
from decimal import Decimal


class FreightSettlement(BaseModel):
    """
    运费结算模型
    
    用于管理运费结算，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        settlement_no: 结算单编号（组织内唯一）
        execution_id: 运输执行ID
        execution_uuid: 运输执行UUID
        vehicle_id: 车辆ID（关联master-data）
        vehicle_no: 车牌号
        driver_id: 司机ID（用户ID）
        driver_name: 司机姓名
        distance: 运输距离（公里）
        freight_amount: 运费金额
        calculation_rule: 计算规则（JSON格式）
        settlement_date: 结算日期
        settlement_status: 结算状态（待结算、已结算、已取消）
        status: 状态（草稿、已确认、已结算、已取消）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaitms_freight_settlements"
        indexes = [
            ("tenant_id",),
            ("settlement_no",),
            ("execution_id",),
            ("vehicle_id",),
            ("driver_id",),
            ("status",),
            ("settlement_status",),
            ("settlement_date",),
        ]
        unique_together = [("tenant_id", "settlement_no")]
    
    settlement_no = fields.CharField(max_length=100, description="结算单编号")
    execution_id = fields.IntField(null=True, description="运输执行ID")
    execution_uuid = fields.CharField(max_length=36, null=True, description="运输执行UUID")
    vehicle_id = fields.IntField(null=True, description="车辆ID")
    vehicle_no = fields.CharField(max_length=50, null=True, description="车牌号")
    driver_id = fields.IntField(null=True, description="司机ID")
    driver_name = fields.CharField(max_length=100, null=True, description="司机姓名")
    distance = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="运输距离")
    freight_amount = fields.DecimalField(max_digits=18, decimal_places=2, null=True, description="运费金额")
    calculation_rule = fields.JSONField(null=True, description="计算规则")
    settlement_date = fields.DatetimeField(null=True, description="结算日期")
    settlement_status = fields.CharField(max_length=50, default="待结算", description="结算状态")
    status = fields.CharField(max_length=50, default="草稿", description="状态")
    remark = fields.TextField(null=True, description="备注")

