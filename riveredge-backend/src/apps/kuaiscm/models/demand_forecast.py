"""
需求预测模型模块

定义需求预测数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel
from decimal import Decimal


class DemandForecast(BaseModel):
    """
    需求预测模型
    
    用于管理需求预测，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        forecast_no: 预测单编号（组织内唯一）
        forecast_name: 预测名称
        supplier_id: 供应商ID（关联master-data）
        supplier_name: 供应商名称
        material_id: 物料ID（关联master-data）
        material_name: 物料名称
        material_code: 物料编码
        forecast_period: 预测周期（月度、季度、年度）
        forecast_start_date: 预测开始日期
        forecast_end_date: 预测结束日期
        forecast_quantity: 预测数量
        actual_quantity: 实际数量
        accuracy_rate: 准确率（百分比）
        shared_status: 共享状态（未共享、已共享、已确认）
        status: 状态（草稿、已发布、已确认、已取消）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiscm_demand_forecasts"
        indexes = [
            ("tenant_id",),
            ("forecast_no",),
            ("supplier_id",),
            ("material_id",),
            ("forecast_period",),
            ("shared_status",),
            ("status",),
        ]
        unique_together = [("tenant_id", "forecast_no")]
    
    forecast_no = fields.CharField(max_length=100, description="预测单编号")
    forecast_name = fields.CharField(max_length=200, description="预测名称")
    supplier_id = fields.IntField(null=True, description="供应商ID")
    supplier_name = fields.CharField(max_length=200, null=True, description="供应商名称")
    material_id = fields.IntField(null=True, description="物料ID")
    material_name = fields.CharField(max_length=200, null=True, description="物料名称")
    material_code = fields.CharField(max_length=100, null=True, description="物料编码")
    forecast_period = fields.CharField(max_length=50, null=True, description="预测周期")
    forecast_start_date = fields.DatetimeField(null=True, description="预测开始日期")
    forecast_end_date = fields.DatetimeField(null=True, description="预测结束日期")
    forecast_quantity = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="预测数量")
    actual_quantity = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="实际数量")
    accuracy_rate = fields.DecimalField(max_digits=5, decimal_places=2, null=True, description="准确率")
    shared_status = fields.CharField(max_length=50, default="未共享", description="共享状态")
    status = fields.CharField(max_length=50, default="草稿", description="状态")
    remark = fields.TextField(null=True, description="备注")

