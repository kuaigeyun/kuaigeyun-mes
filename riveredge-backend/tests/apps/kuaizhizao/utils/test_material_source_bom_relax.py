"""validate_material_source_config 放宽 BOM 校验"""

from apps.kuaizhizao.utils.material_source_helper import _is_bom_requirement_error


def test_is_bom_requirement_error():
    assert _is_bom_requirement_error("组合型自制件必须有BOM配置，物料: A001")
    assert _is_bom_requirement_error("配置件必须有BOM属性配置，物料: A001")
    assert not _is_bom_requirement_error("自制件必须有工艺路线配置，物料: A001")


def test_relax_bom_filters_errors():
    errors = [
        "组合型自制件必须有BOM配置，物料: A001 (名称)",
        "自制件必须有工艺路线配置，物料: A001 (名称)",
    ]
    relaxed = [msg for msg in errors if not _is_bom_requirement_error(msg)]
    assert relaxed == ["自制件必须有工艺路线配置，物料: A001 (名称)"]
