"""
认证模块 API 路由

整合所有企业认证与评审相关的 API 路由。
"""

from fastapi import APIRouter
from apps.kuaicert.api.certification_types import router as certification_types_router
from apps.kuaicert.api.certification_standards import router as certification_standards_router
from apps.kuaicert.api.scoring_rules import router as scoring_rules_router
from apps.kuaicert.api.certification_requirements import router as certification_requirements_router
from apps.kuaicert.api.current_assessments import router as current_assessments_router
from apps.kuaicert.api.self_assessments import router as self_assessments_router
from apps.kuaicert.api.assessment_reports import router as assessment_reports_router
from apps.kuaicert.api.improvement_suggestions import router as improvement_suggestions_router
from apps.kuaicert.api.improvement_plans import router as improvement_plans_router
from apps.kuaicert.api.best_practices import router as best_practices_router
from apps.kuaicert.api.certification_applications import router as certification_applications_router
from apps.kuaicert.api.certification_progresss import router as certification_progresss_router
from apps.kuaicert.api.certification_certificates import router as certification_certificates_router

router = APIRouter(prefix="/kuaicert", tags=["认证"])

# 注册子路由
router.include_router(certification_types_router)
router.include_router(certification_standards_router)
router.include_router(scoring_rules_router)
router.include_router(certification_requirements_router)
router.include_router(current_assessments_router)
router.include_router(self_assessments_router)
router.include_router(assessment_reports_router)
router.include_router(improvement_suggestions_router)
router.include_router(improvement_plans_router)
router.include_router(best_practices_router)
router.include_router(certification_applications_router)
router.include_router(certification_progresss_router)
router.include_router(certification_certificates_router)
