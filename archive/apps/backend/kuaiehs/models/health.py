"""
健康管理模型模块

定义健康管理数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class OccupationalHealthCheck(BaseModel):
    """
    职业健康检查模型
    
    用于管理职业健康检查，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        check_no: 检查编号（组织内唯一）
        check_plan_id: 检查计划ID（关联检查计划）
        employee_id: 员工ID（关联master-data）
        employee_name: 员工姓名
        check_date: 检查日期
        check_type: 检查类型（岗前、在岗、离岗、应急等）
        check_item: 检查项目
        check_result: 检查结果（正常、异常、待复查）
        check_institution: 检查机构
        doctor_name: 医生姓名
        diagnosis: 诊断结果
        suggestion: 建议
        status: 状态（待检查、已检查、已复查）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiehs_occupational_health_checks"
        indexes = [
            ("tenant_id",),
            ("check_no",),
            ("uuid",),
            ("check_plan_id",),
            ("employee_id",),
            ("check_date",),
            ("check_type",),
            ("status",),
        ]
        unique_together = [("tenant_id", "check_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    check_no = fields.CharField(max_length=50, description="检查编号（组织内唯一）")
    check_plan_id = fields.IntField(null=True, description="检查计划ID（关联检查计划）")
    employee_id = fields.IntField(description="员工ID（关联master-data）")
    employee_name = fields.CharField(max_length=100, description="员工姓名")
    check_date = fields.DatetimeField(description="检查日期")
    check_type = fields.CharField(max_length=50, description="检查类型（岗前、在岗、离岗、应急等）")
    
    # 检查信息
    check_item = fields.CharField(max_length=200, description="检查项目")
    check_result = fields.CharField(max_length=50, null=True, description="检查结果（正常、异常、待复查）")
    check_institution = fields.CharField(max_length=200, null=True, description="检查机构")
    doctor_name = fields.CharField(max_length=100, null=True, description="医生姓名")
    diagnosis = fields.TextField(null=True, description="诊断结果")
    suggestion = fields.TextField(null=True, description="建议")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="待检查", description="状态（待检查、已检查、已复查）")
    
    def __str__(self):
        return f"{self.check_no} - {self.employee_name}"


class OccupationalDisease(BaseModel):
    """
    职业病模型
    
    用于管理职业病案，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        disease_no: 病案编号（组织内唯一）
        employee_id: 员工ID（关联master-data）
        employee_name: 员工姓名
        disease_name: 职业病名称
        disease_type: 职业病类型
        diagnosis_date: 诊断日期
        diagnosis_institution: 诊断机构
        diagnosis_level: 诊断级别（疑似、确诊）
        treatment_status: 治疗状态（治疗中、已治愈、已死亡）
        compensation_status: 赔偿状态（未赔偿、已赔偿、赔偿中）
        status: 状态（已登记、治疗中、已关闭）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiehs_occupational_diseases"
        indexes = [
            ("tenant_id",),
            ("disease_no",),
            ("uuid",),
            ("employee_id",),
            ("disease_name",),
            ("disease_type",),
            ("diagnosis_date",),
            ("status",),
        ]
        unique_together = [("tenant_id", "disease_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    disease_no = fields.CharField(max_length=50, description="病案编号（组织内唯一）")
    employee_id = fields.IntField(description="员工ID（关联master-data）")
    employee_name = fields.CharField(max_length=100, description="员工姓名")
    
    # 疾病信息
    disease_name = fields.CharField(max_length=200, description="职业病名称")
    disease_type = fields.CharField(max_length=50, null=True, description="职业病类型")
    diagnosis_date = fields.DatetimeField(description="诊断日期")
    diagnosis_institution = fields.CharField(max_length=200, null=True, description="诊断机构")
    diagnosis_level = fields.CharField(max_length=50, null=True, description="诊断级别（疑似、确诊）")
    
    # 状态信息
    treatment_status = fields.CharField(max_length=50, null=True, description="治疗状态（治疗中、已治愈、已死亡）")
    compensation_status = fields.CharField(max_length=50, null=True, description="赔偿状态（未赔偿、已赔偿、赔偿中）")
    status = fields.CharField(max_length=50, default="已登记", description="状态（已登记、治疗中、已关闭）")
    
    def __str__(self):
        return f"{self.disease_no} - {self.employee_name} - {self.disease_name}"


class HealthRecord(BaseModel):
    """
    健康档案模型
    
    用于管理员工健康档案，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        record_no: 档案编号（组织内唯一）
        employee_id: 员工ID（关联master-data）
        employee_name: 员工姓名
        record_type: 档案类型（入职体检、年度体检、专项体检等）
        record_date: 档案日期
        health_status: 健康状况（健康、亚健康、疾病）
        health_level: 健康等级（一级、二级、三级、四级）
        medical_history: 病史
        allergy_history: 过敏史
        family_history: 家族史
        current_medication: 当前用药
        health_advice: 健康建议
        status: 状态（有效、已归档）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiehs_health_records"
        indexes = [
            ("tenant_id",),
            ("record_no",),
            ("uuid",),
            ("employee_id",),
            ("record_type",),
            ("record_date",),
            ("health_status",),
            ("status",),
        ]
        unique_together = [("tenant_id", "record_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    record_no = fields.CharField(max_length=50, description="档案编号（组织内唯一）")
    employee_id = fields.IntField(description="员工ID（关联master-data）")
    employee_name = fields.CharField(max_length=100, description="员工姓名")
    record_type = fields.CharField(max_length=50, description="档案类型（入职体检、年度体检、专项体检等）")
    record_date = fields.DatetimeField(description="档案日期")
    
    # 健康信息
    health_status = fields.CharField(max_length=50, null=True, description="健康状况（健康、亚健康、疾病）")
    health_level = fields.CharField(max_length=50, null=True, description="健康等级（一级、二级、三级、四级）")
    medical_history = fields.TextField(null=True, description="病史")
    allergy_history = fields.TextField(null=True, description="过敏史")
    family_history = fields.TextField(null=True, description="家族史")
    current_medication = fields.TextField(null=True, description="当前用药")
    health_advice = fields.TextField(null=True, description="健康建议")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="有效", description="状态（有效、已归档）")
    
    def __str__(self):
        return f"{self.record_no} - {self.employee_name}"

