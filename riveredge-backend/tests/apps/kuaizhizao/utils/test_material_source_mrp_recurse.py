"""MRP BOM 展开：采购件/服务不递归子 BOM。"""

from apps.kuaizhizao.utils.material_source_helper import (
    SOURCE_TYPE_BUY,
    SOURCE_TYPE_CONFIGURE,
    SOURCE_TYPE_MAKE,
    SOURCE_TYPE_OUTSOURCE,
    SOURCE_TYPE_SERVICE,
    _should_recurse_child_bom_in_mrp,
)


def test_mrp_recurse_only_make_outsource_configure():
    assert _should_recurse_child_bom_in_mrp(SOURCE_TYPE_MAKE)
    assert _should_recurse_child_bom_in_mrp(SOURCE_TYPE_OUTSOURCE)
    assert _should_recurse_child_bom_in_mrp(SOURCE_TYPE_CONFIGURE)
    assert not _should_recurse_child_bom_in_mrp(SOURCE_TYPE_BUY)
    assert not _should_recurse_child_bom_in_mrp(SOURCE_TYPE_SERVICE)
    assert not _should_recurse_child_bom_in_mrp(None)
    assert not _should_recurse_child_bom_in_mrp("")
