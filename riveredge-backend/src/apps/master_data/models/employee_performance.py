"""
员工绩效数据模型模块

定义员工绩效配置、计件单价、工时单价、KPI 定义、绩效汇总等模型。
支持计时/计件/混合计算模式，适配中国中小企业实情。

Author: RiverEdge Team
Date: 2026-02-26
"""

from tortoise import fields
from core.models.base import BaseModel


class EmployeePerformanceConfig(BaseModel):
    """
    员工绩效配置模型

    配置每个员工的绩效计算模式（计时/计件/混合）、单价、月保障工资等。
    employee_id 关联 User.id（车间员工即系统用户）。
    """

    class Meta:
        table = "apps_master_data_employee_performance_configs"
        table_description = "基础数据管理 - 员工绩效配置"
        indexes = [
            ("tenant_id",),
            ("employee_id",),
            ("effective_from",),
        ]
        unique_together = [("tenant_id", "employee_id")]

    id = fields.IntField(pk=True, description="主键ID")

    # 员工（关联 User.id）
    employee_id = fields.IntField(description="员工ID（User.id）")
    employee_name = fields.CharField(max_length=100, null=True, description="员工姓名（冗余）")

    # 计算模式：time=计时, piece=计件, mixed=混合
    calc_mode = fields.CharField(max_length=20, default="time", description="计算模式")
    # 计件模式：operation=按工序, default=默认单价
    piece_rate_mode = fields.CharField(max_length=20, null=True, description="计件单价来源")

    # 单价（元）
    hourly_rate = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="工时单价（元/小时）")
    default_piece_rate = fields.DecimalField(max_digits=10, decimal_places=4, null=True, description="默认计件单价（元/件）")

    # 月保障工资（元，不低于最低工资）
    base_salary = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="月保障工资（元）")

    # 生效日期
    effective_from = fields.DateField(null=True, description="生效日期")
    effective_to = fields.DateField(null=True, description="失效日期")

    is_active = fields.BooleanField(default=True, description="是否启用")
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        return f"EmployeeConfig#{self.employee_id}"


class PieceRate(BaseModel):
    """
    计件单价模型

    按工序、可选物料配置计件单价。
    """

    class Meta:
        table = "apps_master_data_piece_rates"
        table_description = "基础数据管理 - 计件单价"
        indexes = [
            ("tenant_id",),
            ("operation_id",),
            ("material_id",),
            ("effective_from",),
        ]

    id = fields.IntField(pk=True, description="主键ID")

    operation_id = fields.IntField(description="工序ID")
    operation_code = fields.CharField(max_length=50, null=True, description="工序编码")
    operation_name = fields.CharField(max_length=200, null=True, description="工序名称")
    material_id = fields.IntField(null=True, description="物料ID（可选，不填则适用所有物料）")
    material_code = fields.CharField(max_length=50, null=True, description="物料编码")

    rate = fields.DecimalField(max_digits=10, decimal_places=4, description="单价（元/件）")
    effective_from = fields.DateField(null=True, description="生效日期")
    effective_to = fields.DateField(null=True, description="失效日期")

    is_active = fields.BooleanField(default=True, description="是否启用")
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        return f"PieceRate op={self.operation_id} mat={self.material_id} rate={self.rate}"


class HourlyRate(BaseModel):
    """
    工时单价模型

    按部门或职位配置工时单价。
    department_id 与 position_id 二选一。
    """

    class Meta:
        table = "apps_master_data_hourly_rates"
        table_description = "基础数据管理 - 工时单价"
        indexes = [
            ("tenant_id",),
            ("department_id",),
            ("position_id",),
            ("effective_from",),
        ]

    id = fields.IntField(pk=True, description="主键ID")

    department_id = fields.IntField(null=True, description="部门ID（与position_id二选一）")
    department_name = fields.CharField(max_length=100, null=True, description="部门名称")
    position_id = fields.IntField(null=True, description="职位ID（与department_id二选一）")
    position_name = fields.CharField(max_length=100, null=True, description="职位名称")

    rate = fields.DecimalField(max_digits=10, decimal_places=2, description="工时单价（元/小时）")
    effective_from = fields.DateField(null=True, description="生效日期")
    effective_to = fields.DateField(null=True, description="失效日期")

    is_active = fields.BooleanField(default=True, description="是否启用")
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        return f"HourlyRate dept={self.department_id} pos={self.position_id} rate={self.rate}"


class KPIDefinition(BaseModel):
    """
    KPI 指标定义模型

    定义质量、效率、出勤、产量等 KPI 指标及权重、计算公式。
    """

    class Meta:
        table = "apps_master_data_kpi_definitions"
        table_description = "基础数据管理 - KPI指标定义"
        indexes = [
            ("tenant_id",),
            ("code",),
        ]
        unique_together = [("tenant_id", "code")]

    id = fields.IntField(pk=True, description="主键ID")

    code = fields.CharField(max_length=50, description="指标编码")
    name = fields.CharField(max_length=200, description="指标名称")
    weight = fields.DecimalField(max_digits=5, decimal_places=2, default=1, description="权重")
    # 计算类型：quality=质量, efficiency=效率, attendance=出勤, output=产量
    calc_type = fields.CharField(max_length=50, description="计算类型")
    formula_json = fields.JSONField(null=True, description="计算公式（JSON）")

    is_active = fields.BooleanField(default=True, description="是否启用")
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        return f"{self.code} - {self.name}"


class EmployeeKPIScore(BaseModel):
    """
    员工 KPI 得分模型

    按周期存储员工各 KPI 指标的得分及来源数据。
    """

    class Meta:
        table = "apps_master_data_employee_kpi_scores"
        table_description = "基础数据管理 - 员工KPI得分"
        indexes = [
            ("tenant_id",),
            ("employee_id",),
            ("period",),
            ("kpi_code",),
        ]
        unique_together = [("tenant_id", "employee_id", "period", "kpi_code")]

    id = fields.IntField(pk=True, description="主键ID")

    employee_id = fields.IntField(description="员工ID")
    employee_name = fields.CharField(max_length=100, null=True, description="员工姓名")
    period = fields.CharField(max_length=7, description="周期（YYYY-MM）")
    kpi_code = fields.CharField(max_length=50, description="KPI指标编码")
    score = fields.DecimalField(max_digits=10, decimal_places=2, description="得分")
    source_data_json = fields.JSONField(null=True, description="来源数据（JSON）")

    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        return f"KPIScore emp={self.employee_id} period={self.period} {self.kpi_code}={self.score}"


class PerformanceSummary(BaseModel):
    """
    绩效汇总模型

    按员工、周期汇总总工时、总件数、应发金额、KPI 综合分等。
    """

    class Meta:
        table = "apps_master_data_performance_summaries"
        table_description = "基础数据管理 - 绩效汇总"
        indexes = [
            ("tenant_id",),
            ("employee_id",),
            ("period",),
        ]
        unique_together = [("tenant_id", "employee_id", "period")]

    id = fields.IntField(pk=True, description="主键ID")

    employee_id = fields.IntField(description="员工ID")
    employee_name = fields.CharField(max_length=100, null=True, description="员工姓名")

    period = fields.CharField(max_length=7, description="周期（YYYY-MM）")

    # 汇总数据
    total_hours = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="总工时（小时）")
    total_pieces = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="总件数（合格）")
    total_unqualified = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="不合格件数")

    # 金额
    time_amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="计时金额（元）")
    piece_amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="计件金额（元）")
    total_amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="应发总额（元）")

    # KPI
    kpi_score = fields.DecimalField(max_digits=6, decimal_places=2, null=True, description="KPI综合分")
    kpi_coefficient = fields.DecimalField(max_digits=4, decimal_places=2, null=True, description="绩效系数")

    # 状态：draft=草稿, calculated=已计算, confirmed=已确认
    status = fields.CharField(max_length=20, default="draft", description="状态")

    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        return f"Summary emp={self.employee_id} period={self.period} amount={self.total_amount}"
