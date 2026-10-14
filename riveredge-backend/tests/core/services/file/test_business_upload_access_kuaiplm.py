"""业务附件 category 白名单（kuaiplm 产品固件等）。"""

from core.services.file.business_upload_access import business_upload_permission_codes


def test_product_firmware_upload_permissions_registered():
    perms = business_upload_permission_codes("product_firmware")
    assert perms is not None
    assert "kuaiplm:product-firmware:create" in perms
    assert "kuaiplm:product-firmware:update" in perms


def test_unknown_category_returns_none():
    assert business_upload_permission_codes("not_a_real_category") is None
