"""数据备份 include_files（数据表 / 数据表+文件）单元测试。"""

from core.services.system.data_backup_jobs import resolve_include_files, zip_has_upload_entries


def test_resolve_include_files_explicit_true():
    assert resolve_include_files(include_files=True, backup_type="incremental") is True


def test_resolve_include_files_explicit_false():
    assert resolve_include_files(include_files=False, backup_type="full") is False


def test_resolve_include_files_from_metadata():
    assert resolve_include_files(metadata={"include_files": False}, backup_type="full") is False


def test_resolve_include_files_legacy_incremental():
    assert resolve_include_files(backup_type="incremental") is False


def test_resolve_include_files_legacy_full_default():
    assert resolve_include_files(backup_type="full") is True


def test_zip_has_upload_entries(tmp_path):
    import zipfile

    zip_path = tmp_path / "with_uploads.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("database.dump", "data")
        zf.writestr("uploads/1/a.txt", "hello")
    assert zip_has_upload_entries(str(zip_path)) is True

    empty_zip = tmp_path / "data_only.zip"
    with zipfile.ZipFile(empty_zip, "w") as zf:
        zf.writestr("database.dump", "data")
    assert zip_has_upload_entries(str(empty_zip)) is False
