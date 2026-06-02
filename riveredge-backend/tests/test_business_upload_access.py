from core.services.file.business_upload_access import (
    BUSINESS_FILE_UPLOAD_PERMISSIONS,
    business_upload_permission_codes,
)


def test_business_upload_permission_codes_haoligo_equipment() -> None:
    codes = business_upload_permission_codes("haoligo_equipment")
    assert codes is not None
    assert "haoligo:equipment-ledger:create" in codes
    assert "haoligo:equipment-ledger:update" in codes


def test_business_upload_permission_codes_unknown_category() -> None:
    assert business_upload_permission_codes("not_registered") is None
    assert business_upload_permission_codes(None) is None
    assert business_upload_permission_codes("  ") is None


def test_all_haoligo_upload_categories_have_permissions() -> None:
    for category, perms in BUSINESS_FILE_UPLOAD_PERMISSIONS.items():
        assert category.startswith("haoligo_"), category
        assert len(perms) >= 2, category
