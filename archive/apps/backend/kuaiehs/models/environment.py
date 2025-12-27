"""
环境管理模型模块

定义环境管理数据模型，支持多组织隔离。
"""

from tortoise import fields
from decimal import Decimal
from core.models.base import BaseModel


class EnvironmentMonitoring(BaseModel):
    """
    环境监测模型
    
    用于管理环境监测数据，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        monitoring_no: 监测编号（组织内唯一）
        monitoring_point: 监测点位
        monitoring_type: 监测类型（大气、水质、噪声、土壤等）
        monitoring_date: 监测日期
        parameter_name: 监测参数名称
        parameter_value: 监测参数值
        unit: 单位
        standard_value: 标准值
        is_compliant: 是否合规
        status: 状态（正常、超标、预警）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiehs_environment_monitorings"
        indexes = [
            ("tenant_id",),
            ("monitoring_no",),
            ("uuid",),
            ("monitoring_point",),
            ("monitoring_type",),
            ("monitoring_date",),
            ("status",),
        ]
        unique_together = [("tenant_id", "monitoring_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    monitoring_no = fields.CharField(max_length=50, description="监测编号（组织内唯一）")
    monitoring_point = fields.CharField(max_length=200, description="监测点位")
    monitoring_type = fields.CharField(max_length=50, description="监测类型（大气、水质、噪声、土壤等）")
    monitoring_date = fields.DatetimeField(description="监测日期")
    
    # 监测数据
    parameter_name = fields.CharField(max_length=200, description="监测参数名称")
    parameter_value = fields.DecimalField(max_digits=18, decimal_places=4, description="监测参数值")
    unit = fields.CharField(max_length=50, description="单位")
    standard_value = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="标准值")
    is_compliant = fields.BooleanField(default=True, description="是否合规")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="正常", description="状态（正常、超标、预警）")
    remark = fields.TextField(null=True, description="备注")
    
    def __str__(self):
        return f"{self.monitoring_no} - {self.parameter_name}"


class EmissionManagement(BaseModel):
    """
    排放管理模型
    
    用于管理排放数据，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        emission_no: 排放编号（组织内唯一）
        emission_source: 排放源
        emission_type: 排放类型（废气、废水、固废等）
        emission_date: 排放日期
        emission_amount: 排放量
        unit: 单位
        control_measure: 控制措施
        status: 状态（正常、超标、已整改）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiehs_emission_managements"
        indexes = [
            ("tenant_id",),
            ("emission_no",),
            ("uuid",),
            ("emission_source",),
            ("emission_type",),
            ("emission_date",),
            ("status",),
        ]
        unique_together = [("tenant_id", "emission_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    emission_no = fields.CharField(max_length=50, description="排放编号（组织内唯一）")
    emission_source = fields.CharField(max_length=200, description="排放源")
    emission_type = fields.CharField(max_length=50, description="排放类型（废气、废水、固废等）")
    emission_date = fields.DatetimeField(description="排放日期")
    
    # 排放数据
    emission_amount = fields.DecimalField(max_digits=18, decimal_places=4, description="排放量")
    unit = fields.CharField(max_length=50, description="单位")
    control_measure = fields.TextField(null=True, description="控制措施")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="正常", description="状态（正常、超标、已整改）")
    
    def __str__(self):
        return f"{self.emission_no} - {self.emission_source}"


class EnvironmentalCompliance(BaseModel):
    """
    环保合规模型
    
    用于管理环保合规检查，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        compliance_no: 合规编号（组织内唯一）
        compliance_type: 合规类型（环评、排污许可、环保验收等）
        check_date: 检查日期
        check_result: 检查结果（合格、不合格、待整改）
        check_content: 检查内容
        inspector_id: 检查人ID（关联master-data）
        inspector_name: 检查人姓名
        report_id: 报告ID（关联ComplianceReport）
        status: 状态（待检查、已通过、待整改、已整改）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiehs_environmental_compliances"
        indexes = [
            ("tenant_id",),
            ("compliance_no",),
            ("uuid",),
            ("compliance_type",),
            ("check_date",),
            ("check_result",),
            ("status",),
        ]
        unique_together = [("tenant_id", "compliance_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    compliance_no = fields.CharField(max_length=50, description="合规编号（组织内唯一）")
    compliance_type = fields.CharField(max_length=50, description="合规类型（环评、排污许可、环保验收等）")
    check_date = fields.DatetimeField(description="检查日期")
    check_result = fields.CharField(max_length=50, null=True, description="检查结果（合格、不合格、待整改）")
    check_content = fields.TextField(null=True, description="检查内容")
    
    # 检查人信息
    inspector_id = fields.IntField(description="检查人ID（关联master-data）")
    inspector_name = fields.CharField(max_length=100, description="检查人姓名")
    
    # 关联信息
    report_id = fields.IntField(null=True, description="报告ID（关联ComplianceReport）")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="待检查", description="状态（待检查、已通过、待整改、已整改）")
    
    def __str__(self):
        return f"{self.compliance_no} - {self.compliance_type}"


class EnvironmentalIncident(BaseModel):
    """
    环境事故模型
    
    用于管理环境事故，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        incident_no: 事故编号（组织内唯一）
        incident_type: 事故类型（泄漏、污染、超标等）
        incident_date: 事故日期
        incident_location: 事故地点
        incident_description: 事故描述
        impact_scope: 影响范围
        severity: 严重程度（轻微、一般、严重、重大）
        reporter_id: 报告人ID（关联master-data）
        reporter_name: 报告人姓名
        handler_id: 处理人ID（关联master-data）
        handler_name: 处理人姓名
        handling_measure: 处理措施
        status: 状态（已登记、处理中、已处理、已关闭）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiehs_environmental_incidents"
        indexes = [
            ("tenant_id",),
            ("incident_no",),
            ("uuid",),
            ("incident_type",),
            ("incident_date",),
            ("severity",),
            ("status",),
        ]
        unique_together = [("tenant_id", "incident_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    incident_no = fields.CharField(max_length=50, description="事故编号（组织内唯一）")
    incident_type = fields.CharField(max_length=50, description="事故类型（泄漏、污染、超标等）")
    incident_date = fields.DatetimeField(description="事故日期")
    incident_location = fields.CharField(max_length=200, description="事故地点")
    incident_description = fields.TextField(description="事故描述")
    impact_scope = fields.TextField(null=True, description="影响范围")
    severity = fields.CharField(max_length=50, description="严重程度（轻微、一般、严重、重大）")
    
    # 报告人信息
    reporter_id = fields.IntField(description="报告人ID（关联master-data）")
    reporter_name = fields.CharField(max_length=100, description="报告人姓名")
    
    # 处理人信息
    handler_id = fields.IntField(null=True, description="处理人ID（关联master-data）")
    handler_name = fields.CharField(max_length=100, null=True, description="处理人姓名")
    handling_measure = fields.TextField(null=True, description="处理措施")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="已登记", description="状态（已登记、处理中、已处理、已关闭）")
    
    def __str__(self):
        return f"{self.incident_no} - {self.incident_type}"

