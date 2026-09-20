"""HttpWebhook / Adapter 注册 / OA Model 单测。"""

from apps.kuaizhizao.services.document_push_service import SUPPORTED_PROFILES, DocumentPushService
from apps.kuaizhizao.services.oa_document_push_service import (
    TARGET_PROFILE as OA_PROFILE,
    build_oa_document_model,
)
from core.services.integration.document_push_adapter import (
    ensure_default_adapters_registered,
    get_push_adapter,
    list_registered_adapter_types,
)
from core.services.integration.http_webhook_push_adapter import HttpWebhookPushAdapter


def test_adapters_register_galaxy_webhook_and_feishu():
    ensure_default_adapters_registered()
    kinds = set(list_registered_adapter_types())
    assert "kingdee_galaxy" in kinds
    assert "Webhook" in kinds
    assert "weaver" in kinds
    assert "feishu" in kinds
    assert get_push_adapter("kingdee_galaxy").connector_type == "kingdee_galaxy"
    assert get_push_adapter("Webhook").connector_type == "Webhook"
    assert get_push_adapter("feishu").connector_type == "feishu"


def test_http_webhook_wrap_and_parse():
    adapter = HttpWebhookPushAdapter()
    body = adapter.wrap_save(form_id="work_order", model={"code": "WO1"}, cfg={})
    assert body["form_id"] == "work_order"
    assert body["code"] == "WO1"
    ok, _ = adapter.parse_status({"_http_status": 200, "success": True, "code": "OA-1"})
    assert ok is True
    bill_id, bill_no = adapter.parse_bill_ref({"id": 9, "code": "OA-1"}, fallback="x")
    assert bill_id == 9
    assert bill_no == "OA-1"


def test_oa_document_model_uses_default_field_map():
    class _WO:
        id = 12
        code = "WO-12"
        name = "测试工单"
        product_code = "P1"
        product_name = "产品"
        quantity = 10
        status = "released"
        planned_start_date = None
        planned_end_date = None
        workshop_name = "一车间"

    model = build_oa_document_model(work_order=_WO(), cfg={})
    assert model["code"] == "WO-12"
    assert model["source_type"] == "work_order"
    assert model["source_id"] == 12
    # 业务配置 field_map 已下线：自定义键不会生效
    model2 = build_oa_document_model(work_order=_WO(), cfg={"field_map": {"code": "billNo"}})
    assert "billNo" not in model2
    assert model2["code"] == "WO-12"


def test_supported_profiles_include_oa():
    assert ("work_order", OA_PROFILE) in SUPPORTED_PROFILES
    profiles = {(p["source_type"], p["target_profile"]) for p in DocumentPushService().list_profiles()}
    assert ("work_order", "kingdee_prd_mo") in profiles
    assert ("work_order", "oa_http_webhook") in profiles
    assert ("work_order", "feishu_im_notify") in profiles
