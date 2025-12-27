"""
预算分析模型模块

定义预算分析数据模型，支持多组织隔离。
"""

from tortoise import fields
from decimal import Decimal
from core.models.base import BaseModel


class Budget(BaseModel):
    """
    预算模型
    
    用于管理预算，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        budget_no: 预算编号（组织内唯一）
        budget_name: 预算名称
        budget_type: 预算类型（年度预算、季度预算、月度预算等）
        budget_period: 预算期间（格式：2024）
        budget_amount: 预算金额
        department_id: 部门ID（关联master-data）
        budget_category: 预算分类（收入、支出、成本等）
        status: 状态（草稿、已审批、执行中、已关闭）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiepm_budgets"
        indexes = [
            ("tenant_id",),
            ("budget_no",),
            ("uuid",),
            ("budget_name",),
            ("budget_type",),
            ("budget_period",),
            ("department_id",),
            ("status",),
        ]
        unique_together = [("tenant_id", "budget_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    budget_no = fields.CharField(max_length=50, description="预算编号（组织内唯一）")
    budget_name = fields.CharField(max_length=200, description="预算名称")
    budget_type = fields.CharField(max_length=50, description="预算类型（年度预算、季度预算、月度预算等）")
    budget_period = fields.CharField(max_length=20, null=True, description="预算期间（格式：2024）")
    budget_amount = fields.DecimalField(max_digits=18, decimal_places=2, description="预算金额")
    department_id = fields.IntField(null=True, description="部门ID（关联master-data）")
    budget_category = fields.CharField(max_length=50, null=True, description="预算分类（收入、支出、成本等）")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="草稿", description="状态（草稿、已审批、执行中、已关闭）")
    
    def __str__(self):
        return f"{self.budget_no} - {self.budget_name}"


class BudgetVariance(BaseModel):
    """
    预算差异模型
    
    用于管理预算差异分析，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        variance_no: 差异编号（组织内唯一）
        budget_id: 预算ID（关联Budget）
        analysis_period: 分析期间（格式：2024-01）
        analysis_date: 分析日期
        budget_amount: 预算金额
        actual_amount: 实际金额
        variance_amount: 差异金额
        variance_rate: 差异率（百分比）
        variance_reason: 差异原因
        variance_category: 差异分类（有利差异、不利差异）
        analyst_id: 分析人ID（关联master-data）
        analyst_name: 分析人姓名
        handling_measure: 处理措施
        status: 状态（待分析、分析中、已处理、已关闭）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiepm_budget_variances"
        indexes = [
            ("tenant_id",),
            ("variance_no",),
            ("uuid",),
            ("budget_id",),
            ("analysis_period",),
            ("analysis_date",),
            ("variance_category",),
            ("status",),
        ]
        unique_together = [("tenant_id", "variance_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    variance_no = fields.CharField(max_length=50, description="差异编号（组织内唯一）")
    budget_id = fields.IntField(description="预算ID（关联Budget）")
    analysis_period = fields.CharField(max_length=20, null=True, description="分析期间（格式：2024-01）")
    analysis_date = fields.DatetimeField(description="分析日期")
    
    # 差异数据
    budget_amount = fields.DecimalField(max_digits=18, decimal_places=2, description="预算金额")
    actual_amount = fields.DecimalField(max_digits=18, decimal_places=2, description="实际金额")
    variance_amount = fields.DecimalField(max_digits=18, decimal_places=2, null=True, description="差异金额")
    variance_rate = fields.DecimalField(max_digits=5, decimal_places=2, null=True, description="差异率（百分比）")
    variance_reason = fields.TextField(null=True, description="差异原因")
    variance_category = fields.CharField(max_length=50, null=True, description="差异分类（有利差异、不利差异）")
    
    # 分析人信息
    analyst_id = fields.IntField(description="分析人ID（关联master-data）")
    analyst_name = fields.CharField(max_length=100, description="分析人姓名")
    handling_measure = fields.TextField(null=True, description="处理措施")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="待分析", description="状态（待分析、分析中、已处理、已关闭）")
    
    def __str__(self):
        return f"{self.variance_no} - {self.variance_amount}"


class BudgetForecast(BaseModel):
    """
    预算预测模型
    
    用于管理预算预测，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        forecast_no: 预测编号（组织内唯一）
        budget_id: 预算ID（关联Budget）
        forecast_period: 预测期间（格式：2024-02）
        forecast_date: 预测日期
        forecast_amount: 预测金额
        forecast_model: 预测模型
        forecast_content: 预测内容
        forecast_accuracy: 预测准确度（百分比，0-100）
        forecaster_id: 预测人ID（关联master-data）
        forecaster_name: 预测人姓名
        status: 状态（待预测、预测中、已完成）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiepm_budget_forecasts"
        indexes = [
            ("tenant_id",),
            ("forecast_no",),
            ("uuid",),
            ("budget_id",),
            ("forecast_period",),
            ("forecast_date",),
            ("status",),
        ]
        unique_together = [("tenant_id", "forecast_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    forecast_no = fields.CharField(max_length=50, description="预测编号（组织内唯一）")
    budget_id = fields.IntField(description="预算ID（关联Budget）")
    forecast_period = fields.CharField(max_length=20, null=True, description="预测期间（格式：2024-02）")
    forecast_date = fields.DatetimeField(description="预测日期")
    
    # 预测数据
    forecast_amount = fields.DecimalField(max_digits=18, decimal_places=2, description="预测金额")
    forecast_model = fields.CharField(max_length=200, null=True, description="预测模型")
    forecast_content = fields.TextField(null=True, description="预测内容")
    forecast_accuracy = fields.IntField(null=True, description="预测准确度（百分比，0-100）")
    
    # 预测人信息
    forecaster_id = fields.IntField(description="预测人ID（关联master-data）")
    forecaster_name = fields.CharField(max_length=100, description="预测人姓名")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="待预测", description="状态（待预测、预测中、已完成）")
    
    def __str__(self):
        return f"{self.forecast_no} - {self.forecast_amount}"

