"""
经营分析模型模块

定义经营分析数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class BusinessDashboard(BaseModel):
    """
    经营仪表盘模型
    
    用于管理经营仪表盘，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        dashboard_no: 仪表盘编号（组织内唯一）
        dashboard_name: 仪表盘名称
        dashboard_type: 仪表盘类型（财务、生产、销售、综合等）
        dashboard_config: 仪表盘配置（JSON格式）
        status: 状态（草稿、已发布、已归档）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiepm_business_dashboards"
        indexes = [
            ("tenant_id",),
            ("dashboard_no",),
            ("uuid",),
            ("dashboard_name",),
            ("dashboard_type",),
            ("status",),
        ]
        unique_together = [("tenant_id", "dashboard_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    dashboard_no = fields.CharField(max_length=50, description="仪表盘编号（组织内唯一）")
    dashboard_name = fields.CharField(max_length=200, description="仪表盘名称")
    dashboard_type = fields.CharField(max_length=50, null=True, description="仪表盘类型（财务、生产、销售、综合等）")
    dashboard_config = fields.JSONField(null=True, description="仪表盘配置（JSON格式）")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="草稿", description="状态（草稿、已发布、已归档）")
    
    def __str__(self):
        return f"{self.dashboard_no} - {self.dashboard_name}"


class BusinessDataAnalysis(BaseModel):
    """
    经营数据分析模型
    
    用于管理经营数据分析，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        analysis_no: 分析编号（组织内唯一）
        analysis_type: 分析类型（数据汇总、数据对比、数据预测）
        analysis_period: 分析期间（格式：2024-01）
        analysis_date: 分析日期
        analysis_content: 分析内容
        analysis_result: 分析结果
        analyst_id: 分析人ID（关联master-data）
        analyst_name: 分析人姓名
        status: 状态（待分析、分析中、已完成）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiepm_business_data_analyses"
        indexes = [
            ("tenant_id",),
            ("analysis_no",),
            ("uuid",),
            ("analysis_type",),
            ("analysis_period",),
            ("analysis_date",),
            ("status",),
        ]
        unique_together = [("tenant_id", "analysis_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    analysis_no = fields.CharField(max_length=50, description="分析编号（组织内唯一）")
    analysis_type = fields.CharField(max_length=50, description="分析类型（数据汇总、数据对比、数据预测）")
    analysis_period = fields.CharField(max_length=20, null=True, description="分析期间（格式：2024-01）")
    analysis_date = fields.DatetimeField(description="分析日期")
    
    # 分析内容
    analysis_content = fields.TextField(null=True, description="分析内容")
    analysis_result = fields.TextField(null=True, description="分析结果")
    
    # 分析人信息
    analyst_id = fields.IntField(description="分析人ID（关联master-data）")
    analyst_name = fields.CharField(max_length=100, description="分析人姓名")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="待分析", description="状态（待分析、分析中、已完成）")
    
    def __str__(self):
        return f"{self.analysis_no} - {self.analysis_type}"


class TrendAnalysis(BaseModel):
    """
    趋势分析模型
    
    用于管理趋势分析，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        analysis_no: 分析编号（组织内唯一）
        analysis_indicator: 分析指标
        analysis_period: 分析期间（格式：2024-01）
        analysis_date: 分析日期
        trend_type: 趋势类型（上升、下降、平稳、波动）
        trend_description: 趋势描述
        forecast_value: 预测值
        forecast_period: 预测期间
        analyst_id: 分析人ID（关联master-data）
        analyst_name: 分析人姓名
        status: 状态（待分析、分析中、已完成）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiepm_trend_analyses"
        indexes = [
            ("tenant_id",),
            ("analysis_no",),
            ("uuid",),
            ("analysis_indicator",),
            ("analysis_period",),
            ("analysis_date",),
            ("trend_type",),
            ("status",),
        ]
        unique_together = [("tenant_id", "analysis_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    analysis_no = fields.CharField(max_length=50, description="分析编号（组织内唯一）")
    analysis_indicator = fields.CharField(max_length=200, description="分析指标")
    analysis_period = fields.CharField(max_length=20, null=True, description="分析期间（格式：2024-01）")
    analysis_date = fields.DatetimeField(description="分析日期")
    
    # 趋势信息
    trend_type = fields.CharField(max_length=50, null=True, description="趋势类型（上升、下降、平稳、波动）")
    trend_description = fields.TextField(null=True, description="趋势描述")
    forecast_value = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="预测值")
    forecast_period = fields.CharField(max_length=20, null=True, description="预测期间")
    
    # 分析人信息
    analyst_id = fields.IntField(description="分析人ID（关联master-data）")
    analyst_name = fields.CharField(max_length=100, description="分析人姓名")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="待分析", description="状态（待分析、分析中、已完成）")
    
    def __str__(self):
        return f"{self.analysis_no} - {self.analysis_indicator}"


class ComparisonAnalysis(BaseModel):
    """
    对比分析模型
    
    用于管理对比分析，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        analysis_no: 分析编号（组织内唯一）
        analysis_indicator: 分析指标
        comparison_type: 对比类型（同比、环比、目标对比）
        base_period: 基准期间（格式：2024-01）
        comparison_period: 对比期间（格式：2024-02）
        base_value: 基准值
        comparison_value: 对比值
        variance: 差异
        variance_rate: 差异率（百分比）
        analysis_content: 分析内容
        analyst_id: 分析人ID（关联master-data）
        analyst_name: 分析人姓名
        status: 状态（待分析、分析中、已完成）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiepm_comparison_analyses"
        indexes = [
            ("tenant_id",),
            ("analysis_no",),
            ("uuid",),
            ("analysis_indicator",),
            ("comparison_type",),
            ("base_period",),
            ("comparison_period",),
            ("status",),
        ]
        unique_together = [("tenant_id", "analysis_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    analysis_no = fields.CharField(max_length=50, description="分析编号（组织内唯一）")
    analysis_indicator = fields.CharField(max_length=200, description="分析指标")
    comparison_type = fields.CharField(max_length=50, description="对比类型（同比、环比、目标对比）")
    base_period = fields.CharField(max_length=20, null=True, description="基准期间（格式：2024-01）")
    comparison_period = fields.CharField(max_length=20, null=True, description="对比期间（格式：2024-02）")
    
    # 对比数据
    base_value = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="基准值")
    comparison_value = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="对比值")
    variance = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="差异")
    variance_rate = fields.DecimalField(max_digits=5, decimal_places=2, null=True, description="差异率（百分比）")
    analysis_content = fields.TextField(null=True, description="分析内容")
    
    # 分析人信息
    analyst_id = fields.IntField(description="分析人ID（关联master-data）")
    analyst_name = fields.CharField(max_length=100, description="分析人姓名")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="待分析", description="状态（待分析、分析中、已完成）")
    
    def __str__(self):
        return f"{self.analysis_no} - {self.comparison_type}"

