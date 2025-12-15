"""
考勤管理模型模块

定义考勤数据模型，支持多组织隔离。
"""

from tortoise import fields
from decimal import Decimal
from core.models.base import BaseModel


class AttendanceRule(BaseModel):
    """
    考勤规则模型
    
    用于管理考勤规则，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        rule_code: 规则编码（组织内唯一）
        rule_name: 规则名称
        rule_type: 规则类型（标准工时、弹性工时、综合工时等）
        work_days: 工作日（JSON格式，如：["周一","周二","周三","周四","周五"]）
        work_start_time: 上班时间
        work_end_time: 下班时间
        break_duration: 休息时长（分钟）
        late_tolerance: 迟到容忍时间（分钟）
        early_leave_tolerance: 早退容忍时间（分钟）
        overtime_threshold: 加班阈值（小时）
        status: 状态（启用、停用）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaihrm_attendance_rules"
        indexes = [
            ("tenant_id",),
            ("rule_code",),
            ("uuid",),
            ("rule_type",),
            ("status",),
        ]
        unique_together = [("tenant_id", "rule_code")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    rule_code = fields.CharField(max_length=50, description="规则编码（组织内唯一）")
    rule_name = fields.CharField(max_length=200, description="规则名称")
    rule_type = fields.CharField(max_length=50, description="规则类型（标准工时、弹性工时、综合工时等）")
    
    # 工作时间配置
    work_days = fields.JSONField(null=True, description="工作日（JSON格式）")
    work_start_time = fields.CharField(max_length=10, description="上班时间（格式：HH:mm）")
    work_end_time = fields.CharField(max_length=10, description="下班时间（格式：HH:mm）")
    break_duration = fields.IntField(default=60, description="休息时长（分钟）")
    
    # 考勤规则
    late_tolerance = fields.IntField(default=15, description="迟到容忍时间（分钟）")
    early_leave_tolerance = fields.IntField(default=15, description="早退容忍时间（分钟）")
    overtime_threshold = fields.DecimalField(max_digits=5, decimal_places=2, default=Decimal("8.00"), description="加班阈值（小时）")
    
    # 状态
    status = fields.CharField(max_length=20, default="启用", description="状态（启用、停用）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.rule_code} - {self.rule_name}"


class AttendanceRecord(BaseModel):
    """
    打卡记录模型
    
    用于管理员工打卡记录，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        record_date: 打卡日期
        employee_id: 员工ID（关联master-data）
        employee_name: 员工姓名
        rule_id: 考勤规则ID（关联AttendanceRule）
        check_in_time: 上班打卡时间
        check_out_time: 下班打卡时间
        check_in_location: 上班打卡位置（GPS坐标）
        check_out_location: 下班打卡位置（GPS坐标）
        check_in_method: 上班打卡方式（GPS、WiFi、蓝牙、人脸识别等）
        check_out_method: 下班打卡方式（GPS、WiFi、蓝牙、人脸识别等）
        work_hours: 工作时长（小时）
        is_late: 是否迟到
        is_early_leave: 是否早退
        is_absent: 是否缺勤
        is_overtime: 是否加班
        overtime_hours: 加班时长（小时）
        status: 状态（正常、迟到、早退、缺勤、异常）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaihrm_attendance_records"
        indexes = [
            ("tenant_id",),
            ("uuid",),
            ("record_date",),
            ("employee_id",),
            ("rule_id",),
            ("status",),
        ]
        unique_together = [("tenant_id", "record_date", "employee_id")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    record_date = fields.DatetimeField(description="打卡日期")
    employee_id = fields.IntField(description="员工ID（关联master-data）")
    employee_name = fields.CharField(max_length=100, description="员工姓名")
    rule_id = fields.IntField(null=True, description="考勤规则ID（关联AttendanceRule）")
    
    # 打卡信息
    check_in_time = fields.DatetimeField(null=True, description="上班打卡时间")
    check_out_time = fields.DatetimeField(null=True, description="下班打卡时间")
    check_in_location = fields.CharField(max_length=200, null=True, description="上班打卡位置（GPS坐标）")
    check_out_location = fields.CharField(max_length=200, null=True, description="下班打卡位置（GPS坐标）")
    check_in_method = fields.CharField(max_length=50, null=True, description="上班打卡方式（GPS、WiFi、蓝牙、人脸识别等）")
    check_out_method = fields.CharField(max_length=50, null=True, description="下班打卡方式（GPS、WiFi、蓝牙、人脸识别等）")
    
    # 考勤统计
    work_hours = fields.DecimalField(max_digits=5, decimal_places=2, null=True, description="工作时长（小时）")
    is_late = fields.BooleanField(default=False, description="是否迟到")
    is_early_leave = fields.BooleanField(default=False, description="是否早退")
    is_absent = fields.BooleanField(default=False, description="是否缺勤")
    is_overtime = fields.BooleanField(default=False, description="是否加班")
    overtime_hours = fields.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"), description="加班时长（小时）")
    
    # 状态和备注
    status = fields.CharField(max_length=20, default="正常", description="状态（正常、迟到、早退、缺勤、异常）")
    remark = fields.TextField(null=True, description="备注")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.record_date} - {self.employee_name} - {self.status}"


class LeaveApplication(BaseModel):
    """
    请假申请模型
    
    用于管理员工请假申请，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        application_no: 申请编号（组织内唯一）
        employee_id: 员工ID（关联master-data）
        employee_name: 员工姓名
        leave_type: 请假类型（年假、病假、事假、调休、其他）
        start_date: 开始日期
        end_date: 结束日期
        leave_days: 请假天数
        leave_hours: 请假小时数
        leave_reason: 请假原因
        status: 状态（待审批、已审批、已拒绝、已取消）
        approval_instance_id: 审批实例ID（关联ApprovalInstance）
        approval_status: 审批状态
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaihrm_leave_applications"
        indexes = [
            ("tenant_id",),
            ("application_no",),
            ("uuid",),
            ("employee_id",),
            ("start_date",),
            ("leave_type",),
            ("status",),
            ("approval_instance_id",),
        ]
        unique_together = [("tenant_id", "application_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    application_no = fields.CharField(max_length=50, description="申请编号（组织内唯一）")
    employee_id = fields.IntField(description="员工ID（关联master-data）")
    employee_name = fields.CharField(max_length=100, description="员工姓名")
    leave_type = fields.CharField(max_length=50, description="请假类型（年假、病假、事假、调休、其他）")
    
    # 请假信息
    start_date = fields.DatetimeField(description="开始日期")
    end_date = fields.DatetimeField(description="结束日期")
    leave_days = fields.DecimalField(max_digits=5, decimal_places=2, description="请假天数")
    leave_hours = fields.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"), description="请假小时数")
    leave_reason = fields.TextField(null=True, description="请假原因")
    
    # 状态和审批
    status = fields.CharField(max_length=20, default="待审批", description="状态（待审批、已审批、已拒绝、已取消）")
    approval_instance_id = fields.IntField(null=True, description="审批实例ID（关联ApprovalInstance）")
    approval_status = fields.CharField(max_length=20, null=True, description="审批状态（pending、approved、rejected、cancelled）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.application_no} - {self.employee_name} - {self.leave_type}"


class OvertimeApplication(BaseModel):
    """
    加班申请模型
    
    用于管理员工加班申请，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        application_no: 申请编号（组织内唯一）
        employee_id: 员工ID（关联master-data）
        employee_name: 员工姓名
        overtime_date: 加班日期
        start_time: 开始时间
        end_time: 结束时间
        overtime_hours: 加班时长（小时）
        overtime_reason: 加班原因
        status: 状态（待审批、已审批、已拒绝、已取消）
        approval_instance_id: 审批实例ID（关联ApprovalInstance）
        approval_status: 审批状态
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaihrm_overtime_applications"
        indexes = [
            ("tenant_id",),
            ("application_no",),
            ("uuid",),
            ("employee_id",),
            ("overtime_date",),
            ("status",),
            ("approval_instance_id",),
        ]
        unique_together = [("tenant_id", "application_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    application_no = fields.CharField(max_length=50, description="申请编号（组织内唯一）")
    employee_id = fields.IntField(description="员工ID（关联master-data）")
    employee_name = fields.CharField(max_length=100, description="员工姓名")
    overtime_date = fields.DatetimeField(description="加班日期")
    
    # 加班信息
    start_time = fields.DatetimeField(description="开始时间")
    end_time = fields.DatetimeField(description="结束时间")
    overtime_hours = fields.DecimalField(max_digits=5, decimal_places=2, description="加班时长（小时）")
    overtime_reason = fields.TextField(null=True, description="加班原因")
    
    # 状态和审批
    status = fields.CharField(max_length=20, default="待审批", description="状态（待审批、已审批、已拒绝、已取消）")
    approval_instance_id = fields.IntField(null=True, description="审批实例ID（关联ApprovalInstance）")
    approval_status = fields.CharField(max_length=20, null=True, description="审批状态（pending、approved、rejected、cancelled）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.application_no} - {self.employee_name} - {self.overtime_hours}小时"


class AttendanceStatistics(BaseModel):
    """
    考勤统计模型
    
    用于管理考勤统计，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        statistics_period: 统计期间（格式：2024-01）
        employee_id: 员工ID（关联master-data）
        employee_name: 员工姓名
        work_days: 应出勤天数
        actual_work_days: 实际出勤天数
        leave_days: 请假天数
        overtime_hours: 加班小时数
        late_count: 迟到次数
        early_leave_count: 早退次数
        absent_count: 缺勤次数
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaihrm_attendance_statistics"
        indexes = [
            ("tenant_id",),
            ("uuid",),
            ("statistics_period",),
            ("employee_id",),
        ]
        unique_together = [("tenant_id", "statistics_period", "employee_id")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    statistics_period = fields.CharField(max_length=20, description="统计期间（格式：2024-01）")
    employee_id = fields.IntField(description="员工ID（关联master-data）")
    employee_name = fields.CharField(max_length=100, description="员工姓名")
    
    # 考勤统计
    work_days = fields.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"), description="应出勤天数")
    actual_work_days = fields.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"), description="实际出勤天数")
    leave_days = fields.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"), description="请假天数")
    overtime_hours = fields.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"), description="加班小时数")
    late_count = fields.IntField(default=0, description="迟到次数")
    early_leave_count = fields.IntField(default=0, description="早退次数")
    absent_count = fields.IntField(default=0, description="缺勤次数")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.statistics_period} - {self.employee_name}"

