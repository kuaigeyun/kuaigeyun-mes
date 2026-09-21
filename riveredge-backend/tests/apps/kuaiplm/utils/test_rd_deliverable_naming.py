"""研发交付物命名校验。"""

import pytest

from apps.kuaiplm.utils.rd_deliverable_naming import validate_deliverable_catalog
from infra.exceptions.exceptions import ValidationError


def test_test_report_requires_material_code():
    with pytest.raises(ValidationError, match="关联料号"):
        validate_deliverable_catalog(
            deliverable_type="test_report",
            material_code=None,
            legacy_material_code=None,
            file_name="report.pdf",
        )


def test_test_report_accepts_legacy_material_code():
    validate_deliverable_catalog(
        deliverable_type="test_report",
        material_code="MAT-001",
        legacy_material_code="MAT-OLD",
        file_name="report.pdf",
    )


def test_part_spec_filename_must_include_material_code():
    with pytest.raises(ValidationError, match="料号"):
        validate_deliverable_catalog(
            deliverable_type="part_spec",
            material_code="MAT-001",
            legacy_material_code=None,
            file_name="wrong_name.pdf",
        )


def test_drawing_requires_version_suffix():
    with pytest.raises(ValidationError, match="版本后缀"):
        validate_deliverable_catalog(
            deliverable_type="drawing_3d",
            material_code=None,
            legacy_material_code=None,
            file_name="model.stp",
        )
