"""associated_table_registry 租户字段检测单元测试。"""

from apps.master_data.models.factory import Workshop
from core.models.model_fields import model_has_field


def test_tortoise_inherited_tenant_id_not_detected_by_hasattr():
    """Tortoise 继承字段：hasattr 为 False，fields_map 为 True。"""
    assert not hasattr(Workshop, "tenant_id")
    assert model_has_field(Workshop, "tenant_id")
    assert model_has_field(Workshop, "deleted_at")
