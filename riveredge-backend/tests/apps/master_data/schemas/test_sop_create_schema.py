"""SOP 创建 Schema：attachments 须接受前端 Upload 序列化后的列表或省略。"""

from apps.master_data.schemas.process_schemas import SOPCreate


def test_sop_create_omits_attachments():
    data = SOPCreate(code="SOP0001", name="测试 SOP")
    assert data.attachments is None


def test_sop_create_accepts_empty_attachments_list():
    data = SOPCreate(code="SOP0001", name="测试 SOP", attachments=[])
    assert data.attachments == []


def test_sop_create_accepts_upload_file_dicts():
    data = SOPCreate(
        code="SOP0001",
        name="测试 SOP",
        attachments=[{"uid": "file-uuid-1", "name": "扫描件.pdf", "status": "done"}],
    )
    assert data.attachments[0]["uid"] == "file-uuid-1"


def test_sop_create_rejects_non_dict_attachment_items():
    try:
        SOPCreate(code="SOP0001", name="测试 SOP", attachments=["bad"])
        assert False, "expected validation error"
    except Exception as exc:
        assert "valid dictionary" in str(exc)
