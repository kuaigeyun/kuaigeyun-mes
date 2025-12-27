"""
HRM API 模块

整合所有人力资源相关的 API 路由。
"""

from apps.kuaihrm.api.employee_onboardings import router as employee_onboardings_router
from apps.kuaihrm.api.employee_resignations import router as employee_resignations_router
from apps.kuaihrm.api.employee_transfers import router as employee_transfers_router
from apps.kuaihrm.api.attendance_rules import router as attendance_rules_router
from apps.kuaihrm.api.attendance_records import router as attendance_records_router
from apps.kuaihrm.api.leave_applications import router as leave_applications_router
from apps.kuaihrm.api.overtime_applications import router as overtime_applications_router
from apps.kuaihrm.api.attendance_statistics import router as attendance_statistics_router
from apps.kuaihrm.api.salary_structures import router as salary_structures_router
from apps.kuaihrm.api.salary_calculations import router as salary_calculations_router
from apps.kuaihrm.api.social_security_taxes import router as social_security_taxes_router
from apps.kuaihrm.api.salary_payments import router as salary_payments_router
from apps.kuaihrm.api.scheduling_plans import router as scheduling_plans_router
from apps.kuaihrm.api.scheduling_executions import router as scheduling_executions_router

