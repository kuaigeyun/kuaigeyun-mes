"""
薪资管理模型模块

定义薪资数据模型，支持多组织隔离。
"""

from tortoise import fields
from decimal import Decimal
from core.models.base import BaseModel


class SalaryStructure(BaseModel):
    """
    薪资结构模型
    
    用于管理薪资结构，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        structure_code: 结构编码（组织内唯一）
        structure_name: 结构名称
        structure_type: 结构类型（固定薪资、绩效薪资、计件薪资等）
        base_salary: 基本工资
        performance_salary: 绩效工资
        allowance: 津贴
        bonus: 奖金
        deduction: 扣款
        total_salary: 总薪资
        status: 状态（启用、停用）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaihrm_salary_structures"
        indexes = [
            ("tenant_id",),
            ("structure_code",),
            ("uuid",),
            ("structure_type",),
            ("status",),
        ]
        unique_together = [("tenant_id", "structure_code")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    structure_code = fields.CharField(max_length=50, description="结构编码（组织内唯一）")
    structure_name = fields.CharField(max_length=200, description="结构名称")
    structure_type = fields.CharField(max_length=50, description="结构类型（固定薪资、绩效薪资、计件薪资等）")
    
    # 薪资构成
    base_salary = fields.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"), description="基本工资")
    performance_salary = fields.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"), description="绩效工资")
    allowance = fields.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"), description="津贴")
    bonus = fields.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"), description="奖金")
    deduction = fields.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"), description="扣款")
    total_salary = fields.DecimalField(max_digits=10, decimal_places=2, description="总薪资")
    
    # 状态
    status = fields.CharField(max_length=20, default="启用", description="状态（启用、停用）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.structure_code} - {self.structure_name}"


class SalaryCalculation(BaseModel):
    """
    薪资计算模型
    
    用于管理薪资计算，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        calculation_no: 计算编号（组织内唯一）
        employee_id: 员工ID（关联master-data）
        employee_name: 员工姓名
        salary_period: 薪资期间（格式：2024-01）
        structure_id: 薪资结构ID（关联SalaryStructure）
        base_salary: 基本工资
        performance_salary: 绩效工资
        allowance: 津贴
        bonus: 奖金
        deduction: 扣款
        social_security: 社保扣款
        tax: 个税扣款
        total_salary: 应发工资
        actual_salary: 实发工资
        status: 状态（待计算、已计算、已确认、已发放）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaihrm_salary_calculations"
        indexes = [
            ("tenant_id",),
            ("calculation_no",),
            ("uuid",),
            ("employee_id",),
            ("salary_period",),
            ("status",),
        ]
        unique_together = [("tenant_id", "calculation_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    calculation_no = fields.CharField(max_length=50, description="计算编号（组织内唯一）")
    employee_id = fields.IntField(description="员工ID（关联master-data）")
    employee_name = fields.CharField(max_length=100, description="员工姓名")
    salary_period = fields.CharField(max_length=20, description="薪资期间（格式：2024-01）")
    structure_id = fields.IntField(null=True, description="薪资结构ID（关联SalaryStructure）")
    
    # 薪资构成
    base_salary = fields.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"), description="基本工资")
    performance_salary = fields.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"), description="绩效工资")
    allowance = fields.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"), description="津贴")
    bonus = fields.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"), description="奖金")
    deduction = fields.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"), description="扣款")
    
    # 社保个税
    social_security = fields.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"), description="社保扣款")
    tax = fields.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"), description="个税扣款")
    
    # 薪资总额
    total_salary = fields.DecimalField(max_digits=10, decimal_places=2, description="应发工资")
    actual_salary = fields.DecimalField(max_digits=10, decimal_places=2, description="实发工资")
    
    # 状态
    status = fields.CharField(max_length=20, default="待计算", description="状态（待计算、已计算、已确认、已发放）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.calculation_no} - {self.employee_name} - {self.actual_salary}"


class SocialSecurityTax(BaseModel):
    """
    社保个税模型
    
    用于管理社保个税，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        employee_id: 员工ID（关联master-data）
        employee_name: 员工姓名
        social_security_base: 社保基数
        pension_rate: 养老保险费率
        medical_rate: 医疗保险费率
        unemployment_rate: 失业保险费率
        work_injury_rate: 工伤保险费率
        maternity_rate: 生育保险费率
        housing_fund_rate: 住房公积金费率
        social_security_amount: 社保总额
        tax_base: 个税基数
        tax_rate: 个税税率
        tax_amount: 个税金额
        effective_date: 生效日期
        expiry_date: 失效日期
        status: 状态（启用、停用）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaihrm_social_security_taxes"
        indexes = [
            ("tenant_id",),
            ("uuid",),
            ("employee_id",),
            ("effective_date",),
            ("status",),
        ]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    employee_id = fields.IntField(description="员工ID（关联master-data）")
    employee_name = fields.CharField(max_length=100, description="员工姓名")
    
    # 社保配置
    social_security_base = fields.DecimalField(max_digits=10, decimal_places=2, description="社保基数")
    pension_rate = fields.DecimalField(max_digits=5, decimal_places=4, default=Decimal("0.08"), description="养老保险费率")
    medical_rate = fields.DecimalField(max_digits=5, decimal_places=4, default=Decimal("0.02"), description="医疗保险费率")
    unemployment_rate = fields.DecimalField(max_digits=5, decimal_places=4, default=Decimal("0.005"), description="失业保险费率")
    work_injury_rate = fields.DecimalField(max_digits=5, decimal_places=4, default=Decimal("0.00"), description="工伤保险费率")
    maternity_rate = fields.DecimalField(max_digits=5, decimal_places=4, default=Decimal("0.00"), description="生育保险费率")
    housing_fund_rate = fields.DecimalField(max_digits=5, decimal_places=4, default=Decimal("0.12"), description="住房公积金费率")
    social_security_amount = fields.DecimalField(max_digits=10, decimal_places=2, description="社保总额")
    
    # 个税配置
    tax_base = fields.DecimalField(max_digits=10, decimal_places=2, description="个税基数")
    tax_rate = fields.DecimalField(max_digits=5, decimal_places=4, description="个税税率")
    tax_amount = fields.DecimalField(max_digits=10, decimal_places=2, description="个税金额")
    
    # 有效期
    effective_date = fields.DatetimeField(description="生效日期")
    expiry_date = fields.DatetimeField(null=True, description="失效日期")
    
    # 状态
    status = fields.CharField(max_length=20, default="启用", description="状态（启用、停用）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.employee_name} - {self.social_security_base}"


class SalaryPayment(BaseModel):
    """
    薪资发放模型
    
    用于管理薪资发放，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        payment_no: 发放编号（组织内唯一）
        payment_period: 发放期间（格式：2024-01）
        payment_date: 发放日期
        employee_id: 员工ID（关联master-data）
        employee_name: 员工姓名
        calculation_id: 薪资计算ID（关联SalaryCalculation）
        payment_amount: 发放金额
        payment_method: 发放方式（银行转账、现金、其他）
        bank_account: 银行账号
        status: 状态（待发放、已发放、已取消）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaihrm_salary_payments"
        indexes = [
            ("tenant_id",),
            ("payment_no",),
            ("uuid",),
            ("payment_period",),
            ("employee_id",),
            ("payment_date",),
            ("status",),
        ]
        unique_together = [("tenant_id", "payment_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    payment_no = fields.CharField(max_length=50, description="发放编号（组织内唯一）")
    payment_period = fields.CharField(max_length=20, description="发放期间（格式：2024-01）")
    payment_date = fields.DatetimeField(description="发放日期")
    employee_id = fields.IntField(description="员工ID（关联master-data）")
    employee_name = fields.CharField(max_length=100, description="员工姓名")
    calculation_id = fields.IntField(null=True, description="薪资计算ID（关联SalaryCalculation）")
    
    # 发放信息
    payment_amount = fields.DecimalField(max_digits=10, decimal_places=2, description="发放金额")
    payment_method = fields.CharField(max_length=50, description="发放方式（银行转账、现金、其他）")
    bank_account = fields.CharField(max_length=50, null=True, description="银行账号")
    
    # 状态
    status = fields.CharField(max_length=20, default="待发放", description="状态（待发放、已发放、已取消）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.payment_no} - {self.employee_name} - {self.payment_amount}"

