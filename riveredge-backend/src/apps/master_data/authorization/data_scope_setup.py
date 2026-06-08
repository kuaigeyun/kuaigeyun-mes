"""主数据 - 注册数据范围资源画像（启动时调用一次）。"""

from core.services.authorization.data_scope_resource_registry import (
    DataScopeResourceProfile,
    register_resource_profile,
)

_MASTER_DATA_BUYER_PROFILE = DataScopeResourceProfile(
    applicant_user_id_field="buyer_id",
    department_uuid_field=None,
)

_MASTER_DATA_SALESMAN_PROFILE = DataScopeResourceProfile(
    applicant_user_id_field="salesman_id",
    department_uuid_field=None,
)

_registered = False


def register_master_data_data_scope_profiles() -> None:
    global _registered
    if _registered:
        return
    register_resource_profile(
        "master-data:supply-chain:supplier",
        _MASTER_DATA_BUYER_PROFILE,
    )
    register_resource_profile(
        "master-data:supply-chain:customer",
        _MASTER_DATA_SALESMAN_PROFILE,
    )
    _registered = True
