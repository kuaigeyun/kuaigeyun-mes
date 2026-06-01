"""快格轻制造 - 注册数据范围资源画像（启动时调用一次）。"""

from core.services.authorization.data_scope_resource_registry import (
    DataScopeResourceProfile,
    register_resource_profile,
)

_KUAIZHIZAO_SALES_DOC_PROFILE = DataScopeResourceProfile(
    applicant_user_id_field="salesman_id",
    created_by_user_id_field="created_by",
    department_uuid_field=None,
)

_KUAIZHIZAO_PURCHASE_DOC_PROFILE = DataScopeResourceProfile(
    applicant_user_id_field="buyer_id",
    created_by_user_id_field="created_by",
    department_uuid_field=None,
)

_KUAIZHIZAO_WORK_ORDER_PROFILE = DataScopeResourceProfile(
    applicant_user_id_field="created_by",
    created_by_user_id_field=None,
    department_uuid_field=None,
)

_KUAIZHIZAO_RESOURCES = (
    "kuaizhizao:sales-order",
    "kuaizhizao:quotation",
    "kuaizhizao:customer-pool",
    "kuaizhizao:customer-follow-up",
    "kuaizhizao:sales-opportunity",
)

_registered = False


def register_kuaizhizao_data_scope_profiles() -> None:
    global _registered
    if _registered:
        return
    for resource in _KUAIZHIZAO_RESOURCES:
        register_resource_profile(resource, _KUAIZHIZAO_SALES_DOC_PROFILE)
    register_resource_profile("kuaizhizao:sales-contract", _KUAIZHIZAO_SALES_DOC_PROFILE)
    register_resource_profile("kuaizhizao:purchase-order", _KUAIZHIZAO_PURCHASE_DOC_PROFILE)
    register_resource_profile("kuaizhizao:work-order", _KUAIZHIZAO_WORK_ORDER_PROFILE)
    register_resource_profile("kuaizhizao:other-inbound", _KUAIZHIZAO_WORK_ORDER_PROFILE)
    register_resource_profile("kuaizhizao:other-outbound", _KUAIZHIZAO_WORK_ORDER_PROFILE)
    register_resource_profile("kuaizhizao:material-borrow", _KUAIZHIZAO_WORK_ORDER_PROFILE)
    register_resource_profile("kuaizhizao:material-return", _KUAIZHIZAO_WORK_ORDER_PROFILE)
    _registered = True
