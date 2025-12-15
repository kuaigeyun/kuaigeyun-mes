"""
HRM模块 API 路由

整合所有人力资源相关的 API 路由。
"""

from fastapi import APIRouter
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

router = APIRouter(prefix="/kuaihrm", tags=["HRM"])

# 注册子路由
router.include_router(employee_onboardings_router)
router.include_router(employee_resignations_router)
router.include_router(employee_transfers_router)
router.include_router(attendance_rules_router)
router.include_router(attendance_records_router)
router.include_router(leave_applications_router)
router.include_router(overtime_applications_router)
router.include_router(attendance_statistics_router)
router.include_router(salary_structures_router)
router.include_router(salary_calculations_router)
router.include_router(social_security_taxes_router)
router.include_router(salary_payments_router)
router.include_router(scheduling_plans_router)
router.include_router(scheduling_executions_router)

