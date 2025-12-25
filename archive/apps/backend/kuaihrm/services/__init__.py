"""
HRM服务模块

定义人力资源相关的业务逻辑处理，支持多组织隔离。
"""

from apps.kuaihrm.services.employee_onboarding_service import EmployeeOnboardingService
from apps.kuaihrm.services.employee_resignation_service import EmployeeResignationService
from apps.kuaihrm.services.employee_transfer_service import EmployeeTransferService
from apps.kuaihrm.services.attendance_rule_service import AttendanceRuleService
from apps.kuaihrm.services.attendance_record_service import AttendanceRecordService
from apps.kuaihrm.services.leave_application_service import LeaveApplicationService
from apps.kuaihrm.services.overtime_application_service import OvertimeApplicationService
from apps.kuaihrm.services.attendance_statistics_service import AttendanceStatisticsService
from apps.kuaihrm.services.salary_structure_service import SalaryStructureService
from apps.kuaihrm.services.salary_calculation_service import SalaryCalculationService
from apps.kuaihrm.services.social_security_tax_service import SocialSecurityTaxService
from apps.kuaihrm.services.salary_payment_service import SalaryPaymentService
from apps.kuaihrm.services.scheduling_plan_service import SchedulingPlanService
from apps.kuaihrm.services.scheduling_execution_service import SchedulingExecutionService

__all__ = [
    "EmployeeOnboardingService",
    "EmployeeResignationService",
    "EmployeeTransferService",
    "AttendanceRuleService",
    "AttendanceRecordService",
    "LeaveApplicationService",
    "OvertimeApplicationService",
    "AttendanceStatisticsService",
    "SalaryStructureService",
    "SalaryCalculationService",
    "SocialSecurityTaxService",
    "SalaryPaymentService",
    "SchedulingPlanService",
    "SchedulingExecutionService",
]

