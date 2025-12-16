"""
KPI管理模型模块

定义KPI管理数据模型，支持多组织隔离。
"""

from tortoise import fields
from decimal import Decimal
from core.models.base import BaseModel


class KPI(BaseModel):
    """
    KPI模型
    
    用于管理KPI定义，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        kpi_code: KPI编码（组织内唯一）
        kpi_name: KPI名称
        kpi_category: KPI分类（财务、生产、质量、客户等）
        kpi_type: KPI类型（定量、定性）
        calculation_formula: 计算公式
        data_source: 数据来源
        target_value: 目标值
        unit: 单位
        frequency: 统计频率（日、周、月、季、年）
        owner_id: 负责人ID（关联master-data）
        owner_name: 负责人姓名
        status: 状态（启用、停用）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaiepm_kpis"
        indexes = [
            ("tenant_id",),
            ("kpi_code",),
            ("uuid",),
            ("kpi_category",),
            ("kpi_type",),
            ("owner_id",),
            ("status",),
        ]
        unique_together = [("tenant_id", "kpi_code")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    kpi_code = fields.CharField(max_length=50, description="KPI编码（组织内唯一）")
    kpi_name = fields.CharField(max_length=200, description="KPI名称")
    kpi_category = fields.CharField(max_length=50, description="KPI分类（财务、生产、质量、客户等）")
    kpi_type = fields.CharField(max_length=50, description="KPI类型（定量、定性）")
    
    # 计算信息
    calculation_formula = fields.TextField(null=True, description="计算公式")
    data_source = fields.CharField(max_length=200, null=True, description="数据来源")
    target_value = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="目标值")
    unit = fields.CharField(max_length=50, null=True, description="单位")
    frequency = fields.CharField(max_length=50, null=True, description="统计频率（日、周、月、季、年）")
    
    # 负责人信息
    owner_id = fields.IntField(null=True, description="负责人ID（关联master-data）")
    owner_name = fields.CharField(max_length=100, null=True, description="负责人姓名")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="启用", description="状态（启用、停用）")
    
    def __str__(self):
        return f"{self.kpi_code} - {self.kpi_name}"


class KPIMonitoring(BaseModel):
    """
    KPI监控模型
    
    用于管理KPI监控，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        monitoring_no: 监控编号（组织内唯一）
        kpi_id: KPI ID（关联KPI）
        monitoring_date: 监控日期
        actual_value: 实际值
        target_value: 目标值
        achievement_rate: 达成率（百分比，0-100）
        status: 状态（正常、预警、异常）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaiepm_kpi_monitorings"
        indexes = [
            ("tenant_id",),
            ("monitoring_no",),
            ("uuid",),
            ("kpi_id",),
            ("monitoring_date",),
            ("status",),
        ]
        unique_together = [("tenant_id", "monitoring_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    monitoring_no = fields.CharField(max_length=50, description="监控编号（组织内唯一）")
    kpi_id = fields.IntField(description="KPI ID（关联KPI）")
    monitoring_date = fields.DatetimeField(description="监控日期")
    
    # 监控数据
    actual_value = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="实际值")
    target_value = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="目标值")
    achievement_rate = fields.DecimalField(max_digits=5, decimal_places=2, null=True, description="达成率（百分比，0-100）")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="正常", description="状态（正常、预警、异常）")
    
    def __str__(self):
        return f"{self.monitoring_no} - {self.monitoring_date}"


class KPIAnalysis(BaseModel):
    """
    KPI分析模型
    
    用于管理KPI分析，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        analysis_no: 分析编号（组织内唯一）
        kpi_id: KPI ID（关联KPI）
        analysis_type: 分析类型（趋势分析、对比分析、根因分析）
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
        table = "seed_kuaiepm_kpi_analyses"
        indexes = [
            ("tenant_id",),
            ("analysis_no",),
            ("uuid",),
            ("kpi_id",),
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
    kpi_id = fields.IntField(description="KPI ID（关联KPI）")
    analysis_type = fields.CharField(max_length=50, description="分析类型（趋势分析、对比分析、根因分析）")
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


class KPIAlert(BaseModel):
    """
    KPI预警模型
    
    用于管理KPI预警，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        alert_no: 预警编号（组织内唯一）
        kpi_id: KPI ID（关联KPI）
        alert_rule: 预警规则
        alert_type: 预警类型（低于目标、高于目标、异常波动等）
        alert_date: 预警日期
        actual_value: 实际值
        target_value: 目标值
        deviation: 偏差
        alert_level: 预警级别（低、中、高、紧急）
        alert_content: 预警内容
        handler_id: 处理人ID（关联master-data）
        handler_name: 处理人姓名
        handling_measure: 处理措施
        status: 状态（已预警、处理中、已处理、已关闭）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaiepm_kpi_alerts"
        indexes = [
            ("tenant_id",),
            ("alert_no",),
            ("uuid",),
            ("kpi_id",),
            ("alert_type",),
            ("alert_date",),
            ("alert_level",),
            ("status",),
        ]
        unique_together = [("tenant_id", "alert_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    alert_no = fields.CharField(max_length=50, description="预警编号（组织内唯一）")
    kpi_id = fields.IntField(description="KPI ID（关联KPI）")
    alert_rule = fields.CharField(max_length=200, null=True, description="预警规则")
    alert_type = fields.CharField(max_length=50, description="预警类型（低于目标、高于目标、异常波动等）")
    alert_date = fields.DatetimeField(description="预警日期")
    
    # 预警数据
    actual_value = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="实际值")
    target_value = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="目标值")
    deviation = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="偏差")
    alert_level = fields.CharField(max_length=50, description="预警级别（低、中、高、紧急）")
    alert_content = fields.TextField(null=True, description="预警内容")
    
    # 处理人信息
    handler_id = fields.IntField(null=True, description="处理人ID（关联master-data）")
    handler_name = fields.CharField(max_length=100, null=True, description="处理人姓名")
    handling_measure = fields.TextField(null=True, description="处理措施")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="已预警", description="状态（已预警、处理中、已处理、已关闭）")
    
    def __str__(self):
        return f"{self.alert_no} - {self.alert_type}"

