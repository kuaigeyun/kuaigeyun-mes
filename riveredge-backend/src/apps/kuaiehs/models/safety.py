"""
安全管理模型模块

定义安全管理数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class SafetyTraining(BaseModel):
    """
    安全培训模型
    
    用于管理安全培训，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        training_no: 培训编号（组织内唯一）
        training_plan_id: 培训计划ID（关联培训计划）
        training_name: 培训名称
        training_type: 培训类型（入职培训、定期培训、专项培训等）
        training_date: 培训日期
        trainer_id: 培训人ID（关联master-data）
        trainer_name: 培训人姓名
        training_content: 培训内容
        training_duration: 培训时长（小时）
        participant_count: 参与人数
        training_result: 培训结果（合格、不合格、待补考）
        status: 状态（计划中、进行中、已完成、已取消）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaiehs_safety_trainings"
        indexes = [
            ("tenant_id",),
            ("training_no",),
            ("uuid",),
            ("training_plan_id",),
            ("training_type",),
            ("training_date",),
            ("status",),
        ]
        unique_together = [("tenant_id", "training_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    training_no = fields.CharField(max_length=50, description="培训编号（组织内唯一）")
    training_plan_id = fields.IntField(null=True, description="培训计划ID（关联培训计划）")
    training_name = fields.CharField(max_length=200, description="培训名称")
    training_type = fields.CharField(max_length=50, description="培训类型（入职培训、定期培训、专项培训等）")
    training_date = fields.DatetimeField(description="培训日期")
    
    # 培训人信息
    trainer_id = fields.IntField(description="培训人ID（关联master-data）")
    trainer_name = fields.CharField(max_length=100, description="培训人姓名")
    
    # 培训内容
    training_content = fields.TextField(null=True, description="培训内容")
    training_duration = fields.DecimalField(max_digits=5, decimal_places=2, null=True, description="培训时长（小时）")
    participant_count = fields.IntField(default=0, description="参与人数")
    training_result = fields.CharField(max_length=50, null=True, description="培训结果（合格、不合格、待补考）")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="计划中", description="状态（计划中、进行中、已完成、已取消）")
    
    def __str__(self):
        return f"{self.training_no} - {self.training_name}"


class SafetyInspection(BaseModel):
    """
    安全检查模型
    
    用于管理安全检查，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        inspection_no: 检查编号（组织内唯一）
        inspection_plan_id: 检查计划ID（关联检查计划）
        inspection_type: 检查类型（日常检查、专项检查、定期检查等）
        inspection_date: 检查日期
        inspection_location: 检查地点
        inspector_id: 检查人ID（关联master-data）
        inspector_name: 检查人姓名
        inspection_content: 检查内容
        inspection_result: 检查结果（合格、不合格、待整改）
        issue_count: 问题数量
        status: 状态（待检查、检查中、已通过、待整改、已整改）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaiehs_safety_inspections"
        indexes = [
            ("tenant_id",),
            ("inspection_no",),
            ("uuid",),
            ("inspection_plan_id",),
            ("inspection_type",),
            ("inspection_date",),
            ("inspection_result",),
            ("status",),
        ]
        unique_together = [("tenant_id", "inspection_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    inspection_no = fields.CharField(max_length=50, description="检查编号（组织内唯一）")
    inspection_plan_id = fields.IntField(null=True, description="检查计划ID（关联检查计划）")
    inspection_type = fields.CharField(max_length=50, description="检查类型（日常检查、专项检查、定期检查等）")
    inspection_date = fields.DatetimeField(description="检查日期")
    inspection_location = fields.CharField(max_length=200, description="检查地点")
    
    # 检查人信息
    inspector_id = fields.IntField(description="检查人ID（关联master-data）")
    inspector_name = fields.CharField(max_length=100, description="检查人姓名")
    
    # 检查内容
    inspection_content = fields.TextField(null=True, description="检查内容")
    inspection_result = fields.CharField(max_length=50, null=True, description="检查结果（合格、不合格、待整改）")
    issue_count = fields.IntField(default=0, description="问题数量")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="待检查", description="状态（待检查、检查中、已通过、待整改、已整改）")
    
    def __str__(self):
        return f"{self.inspection_no} - {self.inspection_location}"


class SafetyHazard(BaseModel):
    """
    安全隐患模型
    
    用于管理安全隐患，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        hazard_no: 隐患编号（组织内唯一）
        hazard_type: 隐患类型（设备隐患、环境隐患、管理隐患等）
        hazard_level: 隐患等级（一般、较大、重大）
        hazard_location: 隐患地点
        hazard_description: 隐患描述
        reporter_id: 报告人ID（关联master-data）
        reporter_name: 报告人姓名
        report_date: 报告日期
        handler_id: 处理人ID（关联master-data）
        handler_name: 处理人姓名
        handling_measure: 处理措施
        handling_date: 处理日期
        verification_date: 验收日期
        status: 状态（已登记、处理中、已整改、已验收、已关闭）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaiehs_safety_hazards"
        indexes = [
            ("tenant_id",),
            ("hazard_no",),
            ("uuid",),
            ("hazard_type",),
            ("hazard_level",),
            ("report_date",),
            ("status",),
        ]
        unique_together = [("tenant_id", "hazard_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    hazard_no = fields.CharField(max_length=50, description="隐患编号（组织内唯一）")
    hazard_type = fields.CharField(max_length=50, description="隐患类型（设备隐患、环境隐患、管理隐患等）")
    hazard_level = fields.CharField(max_length=50, description="隐患等级（一般、较大、重大）")
    hazard_location = fields.CharField(max_length=200, description="隐患地点")
    hazard_description = fields.TextField(description="隐患描述")
    
    # 报告人信息
    reporter_id = fields.IntField(description="报告人ID（关联master-data）")
    reporter_name = fields.CharField(max_length=100, description="报告人姓名")
    report_date = fields.DatetimeField(description="报告日期")
    
    # 处理人信息
    handler_id = fields.IntField(null=True, description="处理人ID（关联master-data）")
    handler_name = fields.CharField(max_length=100, null=True, description="处理人姓名")
    handling_measure = fields.TextField(null=True, description="处理措施")
    handling_date = fields.DatetimeField(null=True, description="处理日期")
    verification_date = fields.DatetimeField(null=True, description="验收日期")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="已登记", description="状态（已登记、处理中、已整改、已验收、已关闭）")
    
    def __str__(self):
        return f"{self.hazard_no} - {self.hazard_type}"


class SafetyIncident(BaseModel):
    """
    安全事故模型
    
    用于管理安全事故，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        incident_no: 事故编号（组织内唯一）
        incident_type: 事故类型（轻伤、重伤、死亡、财产损失等）
        incident_date: 事故日期
        incident_location: 事故地点
        incident_description: 事故描述
        severity: 严重程度（轻微、一般、严重、重大、特别重大）
        casualty_count: 伤亡人数
        property_loss: 财产损失（元）
        reporter_id: 报告人ID（关联master-data）
        reporter_name: 报告人姓名
        handler_id: 处理人ID（关联master-data）
        handler_name: 处理人姓名
        handling_measure: 处理措施
        root_cause: 根本原因
        preventive_measure: 预防措施
        status: 状态（已登记、调查中、已处理、已关闭）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaiehs_safety_incidents"
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
    incident_type = fields.CharField(max_length=50, description="事故类型（轻伤、重伤、死亡、财产损失等）")
    incident_date = fields.DatetimeField(description="事故日期")
    incident_location = fields.CharField(max_length=200, description="事故地点")
    incident_description = fields.TextField(description="事故描述")
    severity = fields.CharField(max_length=50, description="严重程度（轻微、一般、严重、重大、特别重大）")
    
    # 损失信息
    casualty_count = fields.IntField(default=0, description="伤亡人数")
    property_loss = fields.DecimalField(max_digits=18, decimal_places=2, null=True, description="财产损失（元）")
    
    # 报告人信息
    reporter_id = fields.IntField(description="报告人ID（关联master-data）")
    reporter_name = fields.CharField(max_length=100, description="报告人姓名")
    
    # 处理人信息
    handler_id = fields.IntField(null=True, description="处理人ID（关联master-data）")
    handler_name = fields.CharField(max_length=100, null=True, description="处理人姓名")
    handling_measure = fields.TextField(null=True, description="处理措施")
    root_cause = fields.TextField(null=True, description="根本原因")
    preventive_measure = fields.TextField(null=True, description="预防措施")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="已登记", description="状态（已登记、调查中、已处理、已关闭）")
    
    def __str__(self):
        return f"{self.incident_no} - {self.incident_type}"

