"""
能源报表模型模块

定义能源报表数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel
from decimal import Decimal
from datetime import datetime


class EnergyReport(BaseModel):
    """
    能源报表模型
    
    用于管理能源报表，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        report_no: 报表编号（组织内唯一）
        report_name: 报表名称
        report_type: 报表类型（能耗报表、成本分析、碳排放统计）
        report_period: 报表周期（日、周、月、年）
        report_start_date: 报表开始日期
        report_end_date: 报表结束日期
        energy_type: 能源类型（电、水、气、蒸汽等）
        total_consumption: 总能耗
        total_cost: 总成本
        carbon_emission: 碳排放量（kg CO2）
        carbon_emission_rate: 碳排放率（kg CO2/单位能耗）
        report_data: 报表数据（JSON格式）
        report_config: 报表配置（JSON格式）
        status: 状态（草稿、已生成、已发布）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaiems_energy_reports"
        indexes = [
            ("tenant_id",),
            ("report_no",),
            ("report_type",),
            ("report_period",),
            ("energy_type",),
            ("status",),
        ]
        unique_together = [("tenant_id", "report_no")]
    
    report_no = fields.CharField(max_length=100, description="报表编号")
    report_name = fields.CharField(max_length=200, description="报表名称")
    report_type = fields.CharField(max_length=50, description="报表类型")
    report_period = fields.CharField(max_length=50, null=True, description="报表周期")
    report_start_date = fields.DatetimeField(null=True, description="报表开始日期")
    report_end_date = fields.DatetimeField(null=True, description="报表结束日期")
    energy_type = fields.CharField(max_length=50, null=True, description="能源类型")
    total_consumption = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="总能耗")
    total_cost = fields.DecimalField(max_digits=18, decimal_places=2, null=True, description="总成本")
    carbon_emission = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="碳排放量")
    carbon_emission_rate = fields.DecimalField(max_digits=10, decimal_places=4, null=True, description="碳排放率")
    report_data = fields.JSONField(null=True, description="报表数据")
    report_config = fields.JSONField(null=True, description="报表配置")
    status = fields.CharField(max_length=50, default="草稿", description="状态")
    remark = fields.TextField(null=True, description="备注")

