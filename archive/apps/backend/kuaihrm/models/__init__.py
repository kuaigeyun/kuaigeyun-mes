"""
HRM数据模型模块

定义人力资源相关的数据模型。
"""

from apps.kuaihrm.models.employee_transfer import (
    EmployeeOnboarding,
    EmployeeResignation,
    EmployeeTransfer,
)
from apps.kuaihrm.models.attendance import (
    AttendanceRule,
    AttendanceRecord,
    LeaveApplication,
    OvertimeApplication,
    AttendanceStatistics,
)
from apps.kuaihrm.models.salary import (
    SalaryStructure,
    SalaryCalculation,
    SocialSecurityTax,
    SalaryPayment,
)
from apps.kuaihrm.models.scheduling import (
    SchedulingPlan,
    SchedulingExecution,
)

__all__ = [
    "EmployeeOnboarding",
    "EmployeeResignation",
    "EmployeeTransfer",
    "AttendanceRule",
    "AttendanceRecord",
    "LeaveApplication",
    "OvertimeApplication",
    "AttendanceStatistics",
    "SalaryStructure",
    "SalaryCalculation",
    "SocialSecurityTax",
    "SalaryPayment",
    "SchedulingPlan",
    "SchedulingExecution",
]

