"""
HRM数据 Schema 模块

定义人力资源相关的 Pydantic Schema，用于数据验证和序列化。
"""

from apps.kuaihrm.schemas.employee_onboarding_schemas import (
    EmployeeOnboardingCreate,
    EmployeeOnboardingUpdate,
    EmployeeOnboardingResponse,
)
from apps.kuaihrm.schemas.employee_resignation_schemas import (
    EmployeeResignationCreate,
    EmployeeResignationUpdate,
    EmployeeResignationResponse,
)
from apps.kuaihrm.schemas.employee_transfer_schemas import (
    EmployeeTransferCreate,
    EmployeeTransferUpdate,
    EmployeeTransferResponse,
)
from apps.kuaihrm.schemas.attendance_rule_schemas import (
    AttendanceRuleCreate,
    AttendanceRuleUpdate,
    AttendanceRuleResponse,
)
from apps.kuaihrm.schemas.attendance_record_schemas import (
    AttendanceRecordCreate,
    AttendanceRecordUpdate,
    AttendanceRecordResponse,
)
from apps.kuaihrm.schemas.leave_application_schemas import (
    LeaveApplicationCreate,
    LeaveApplicationUpdate,
    LeaveApplicationResponse,
)
from apps.kuaihrm.schemas.overtime_application_schemas import (
    OvertimeApplicationCreate,
    OvertimeApplicationUpdate,
    OvertimeApplicationResponse,
)
from apps.kuaihrm.schemas.attendance_statistics_schemas import (
    AttendanceStatisticsCreate,
    AttendanceStatisticsUpdate,
    AttendanceStatisticsResponse,
)
from apps.kuaihrm.schemas.salary_structure_schemas import (
    SalaryStructureCreate,
    SalaryStructureUpdate,
    SalaryStructureResponse,
)
from apps.kuaihrm.schemas.salary_calculation_schemas import (
    SalaryCalculationCreate,
    SalaryCalculationUpdate,
    SalaryCalculationResponse,
)
from apps.kuaihrm.schemas.social_security_tax_schemas import (
    SocialSecurityTaxCreate,
    SocialSecurityTaxUpdate,
    SocialSecurityTaxResponse,
)
from apps.kuaihrm.schemas.salary_payment_schemas import (
    SalaryPaymentCreate,
    SalaryPaymentUpdate,
    SalaryPaymentResponse,
)
from apps.kuaihrm.schemas.scheduling_plan_schemas import (
    SchedulingPlanCreate,
    SchedulingPlanUpdate,
    SchedulingPlanResponse,
)
from apps.kuaihrm.schemas.scheduling_execution_schemas import (
    SchedulingExecutionCreate,
    SchedulingExecutionUpdate,
    SchedulingExecutionResponse,
)

__all__ = [
    "EmployeeOnboardingCreate",
    "EmployeeOnboardingUpdate",
    "EmployeeOnboardingResponse",
    "EmployeeResignationCreate",
    "EmployeeResignationUpdate",
    "EmployeeResignationResponse",
    "EmployeeTransferCreate",
    "EmployeeTransferUpdate",
    "EmployeeTransferResponse",
    "AttendanceRuleCreate",
    "AttendanceRuleUpdate",
    "AttendanceRuleResponse",
    "AttendanceRecordCreate",
    "AttendanceRecordUpdate",
    "AttendanceRecordResponse",
    "LeaveApplicationCreate",
    "LeaveApplicationUpdate",
    "LeaveApplicationResponse",
    "OvertimeApplicationCreate",
    "OvertimeApplicationUpdate",
    "OvertimeApplicationResponse",
    "AttendanceStatisticsCreate",
    "AttendanceStatisticsUpdate",
    "AttendanceStatisticsResponse",
    "SalaryStructureCreate",
    "SalaryStructureUpdate",
    "SalaryStructureResponse",
    "SalaryCalculationCreate",
    "SalaryCalculationUpdate",
    "SalaryCalculationResponse",
    "SocialSecurityTaxCreate",
    "SocialSecurityTaxUpdate",
    "SocialSecurityTaxResponse",
    "SalaryPaymentCreate",
    "SalaryPaymentUpdate",
    "SalaryPaymentResponse",
    "SchedulingPlanCreate",
    "SchedulingPlanUpdate",
    "SchedulingPlanResponse",
    "SchedulingExecutionCreate",
    "SchedulingExecutionUpdate",
    "SchedulingExecutionResponse",
]

