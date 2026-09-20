"""DocumentPushService 注册表单测。"""

from apps.kuaizhizao.services.document_push_service import SUPPORTED_PROFILES, DocumentPushService
from apps.kuaizhizao.services.feishu_work_order_push_service import (
    TARGET_PROFILE as FEISHU_PROFILE,
)
from apps.kuaizhizao.services.kingdee_production_order_push_service import (
    TARGET_PROFILE as WO_PROFILE,
)
from apps.kuaizhizao.services.kingdee_production_report_push_service import (
    TARGET_PROFILE as RPT_PROFILE,
)
from apps.kuaizhizao.services.oa_document_push_service import (
    TARGET_PROFILE as OA_PROFILE,
)


def test_supported_profiles_include_work_order_reporting_oa_feishu():
    assert ("work_order", WO_PROFILE) in SUPPORTED_PROFILES
    assert ("work_order", OA_PROFILE) in SUPPORTED_PROFILES
    assert ("work_order", FEISHU_PROFILE) in SUPPORTED_PROFILES
    assert ("reporting_record", RPT_PROFILE) in SUPPORTED_PROFILES
    profiles = DocumentPushService().list_profiles()
    assert {(p["source_type"], p["target_profile"]) for p in profiles} == SUPPORTED_PROFILES
