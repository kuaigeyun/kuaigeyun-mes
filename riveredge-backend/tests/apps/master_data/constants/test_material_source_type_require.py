import pytest

from apps.master_data.constants.material_source_type import (
    require_canonical_material_source_type,
    SOURCE_TYPE_BUY,
)
from infra.exceptions.exceptions import ValidationError


def test_require_canonical_material_source_type_accepts_valid_value():
    assert require_canonical_material_source_type(SOURCE_TYPE_BUY) == SOURCE_TYPE_BUY


def test_require_canonical_material_source_type_rejects_missing():
    with pytest.raises(ValidationError, match="未配置有效的物料来源类型"):
        require_canonical_material_source_type(
            None,
            material_id=1,
            material_code="MAT-001",
            material_name="测试物料",
        )
