from types import SimpleNamespace

import pytest

from apps.kuaiplm.utils.project_proposal_capabilities import (
    compute_project_proposal_capabilities,
    sales_content_ready,
    supplier_fill_ready,
    validate_sales_content_on_submit,
    validate_supplier_on_submit,
)
from infra.exceptions.exceptions import ValidationError


def test_sales_content_ready():
    row = SimpleNamespace(
        project_code="P01",
        project_name="试项目",
        customer_name="",
        summary="",
        product_lines=[],
        proposer_name="",
    )
    assert not sales_content_ready(row)
    row.customer_name = "客户A"
    assert sales_content_ready(row)


def test_supplier_fill_simple():
    row = SimpleNamespace(
        dev_req_types=["A"],
        supplier_name="供应商X",
        summary=None,
        supplier_assessment_lines=[],
    )
    assert supplier_fill_ready(row)
    row.supplier_name = ""
    assert not supplier_fill_ready(row)


def test_validate_on_submit():
    row = SimpleNamespace(
        project_code="P01",
        project_name="N",
        customer_name="C",
        summary="",
        product_lines=[],
        proposer_name="",
        dev_req_types=["A"],
        supplier_name="S",
        supplier_assessment_lines=[],
    )
    validate_sales_content_on_submit(row)
    validate_supplier_on_submit(row)

    row.customer_name = ""
    with pytest.raises(ValidationError):
        validate_sales_content_on_submit(row)


def test_supplier_assessment_optional_for_def():
    row = SimpleNamespace(
        dev_req_types=["D"],
        supplier_name="",
        summary="概述",
        supplier_assessment_lines=[
            {"material_key": "plastic_shell", "suppliers_text": ""},
        ],
    )
    assert not supplier_fill_ready(row)
    assert supplier_fill_ready(row, supplier_assessment_optional=True)
    validate_supplier_on_submit(row, supplier_assessment_optional=True)


def test_capabilities_progression():
    row = SimpleNamespace(
        project_code="P01",
        project_name="N",
        customer_name="C",
        summary="",
        product_lines=[],
        proposer_name="",
        dev_req_types=["A"],
        supplier_name="S",
        supplier_assessment_lines=[],
        status="draft",
        approved_at=None,
        issued_at=None,
    )
    caps = compute_project_proposal_capabilities(row)
    assert caps["sales_ready"] and caps["supplier_filled"]
    assert not caps["approved"]

    row.status = "approved"
    row.approved_at = object()
    caps2 = compute_project_proposal_capabilities(row)
    assert caps2["approved"]

    row.status = "issued"
    row.issued_at = object()
    caps3 = compute_project_proposal_capabilities(row)
    assert caps3["issued"]
