"""好力 GO — 注册数据范围资源画像（启动时调用一次）。"""

from core.services.authorization.data_scope_constants import DIMENSION_SUPPLIER
from core.services.authorization.data_scope_resource_registry import (
    DataScopeResourceProfile,
    register_resource_profile,
)

_HAOLIGO_OUTSOURCE_PROFILE = DataScopeResourceProfile(
    applicant_user_id_field="applicant_user_id",
    department_uuid_field="department_uuid",
    partner_code_field="outsourced_unit_code",
    partner_dimension=DIMENSION_SUPPLIER,
)

_HAOLIGO_TRIAL_PROFILE = DataScopeResourceProfile(
    applicant_user_id_field="trial_user_id",
    partner_code_field="supplier_code",
    partner_dimension=DIMENSION_SUPPLIER,
)

_HAOLIGO_RESOURCES = (
    "haoligo:molds-documents-outsource-maintenance",
    "haoligo:molds-documents-outsource-complete",
    "haoligo:molds-reports-outsource-maintenance-log",
)

_HAOLIGO_TRIAL_RESOURCES = (
    "haoligo:molds-documents-trial",
    "haoligo:molds-reports-trial-record",
)

_registered = False


def register_haoligo_data_scope_profiles() -> None:
    global _registered
    if _registered:
        return
    for resource in _HAOLIGO_RESOURCES:
        register_resource_profile(resource, _HAOLIGO_OUTSOURCE_PROFILE)
    for resource in _HAOLIGO_TRIAL_RESOURCES:
        register_resource_profile(resource, _HAOLIGO_TRIAL_PROFILE)
    _registered = True
