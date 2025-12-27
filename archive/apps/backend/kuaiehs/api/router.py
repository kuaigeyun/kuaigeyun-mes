"""
EHS模块 API 路由

整合所有环境健康安全管理相关的 API 路由。
"""

from fastapi import APIRouter
from apps.kuaiehs.api.environment_monitorings import router as environment_monitorings_router
from apps.kuaiehs.api.emission_managements import router as emission_managements_router
from apps.kuaiehs.api.environmental_compliances import router as environmental_compliances_router
from apps.kuaiehs.api.environmental_incidents import router as environmental_incidents_router
from apps.kuaiehs.api.occupational_health_checks import router as occupational_health_checks_router
from apps.kuaiehs.api.occupational_diseases import router as occupational_diseases_router
from apps.kuaiehs.api.health_records import router as health_records_router
from apps.kuaiehs.api.safety_trainings import router as safety_trainings_router
from apps.kuaiehs.api.safety_inspections import router as safety_inspections_router
from apps.kuaiehs.api.safety_hazards import router as safety_hazards_router
from apps.kuaiehs.api.safety_incidents import router as safety_incidents_router
from apps.kuaiehs.api.regulations import router as regulations_router
from apps.kuaiehs.api.compliance_checks import router as compliance_checks_router
from apps.kuaiehs.api.compliance_reports import router as compliance_reports_router

router = APIRouter(prefix="/kuaiehs", tags=["EHS"])

# 注册子路由
router.include_router(environment_monitorings_router)
router.include_router(emission_managements_router)
router.include_router(environmental_compliances_router)
router.include_router(environmental_incidents_router)
router.include_router(occupational_health_checks_router)
router.include_router(occupational_diseases_router)
router.include_router(health_records_router)
router.include_router(safety_trainings_router)
router.include_router(safety_inspections_router)
router.include_router(safety_hazards_router)
router.include_router(safety_incidents_router)
router.include_router(regulations_router)
router.include_router(compliance_checks_router)
router.include_router(compliance_reports_router)
