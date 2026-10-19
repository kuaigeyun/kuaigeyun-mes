"""研发项目体系归档八类（R-01 #70）常量。"""

from apps.kuaiplm.constants.rd_project_system_archive import (
    SYSTEM_ARCHIVE_GATE_KEY_BY_CODE,
    SYSTEM_ARCHIVE_TOTAL_COUNT,
    SYSTEM_ARCHIVE_TYPE_BY_CODE,
    SYSTEM_ARCHIVE_TYPE_DEFINITIONS,
    SYSTEM_ARCHIVE_UPLOAD_TEMPLATES,
    system_archive_gate_key,
)


def test_system_archive_type_count_matches_prd():
    assert SYSTEM_ARCHIVE_TOTAL_COUNT == 26
    codes = [d["code"] for d in SYSTEM_ARCHIVE_TYPE_DEFINITIONS]
    assert len(codes) == len(set(codes))
    assert SYSTEM_ARCHIVE_TYPE_BY_CODE["design_task_plan"]["name"] == "设计任务计划书"
    assert SYSTEM_ARCHIVE_TYPE_BY_CODE["project_summary"]["name"] == "项目总结报告"
    assert SYSTEM_ARCHIVE_TYPE_BY_CODE["t1_prototype_build"]["link_target_types"] == [
        "prototype_build_sheet"
    ]
    assert SYSTEM_ARCHIVE_TYPE_BY_CODE["bom_release"]["link_target_types"] == ["bom_collaboration"]


def test_system_archive_gate_key_covers_all_types():
    for type_def in SYSTEM_ARCHIVE_TYPE_DEFINITIONS:
        code = str(type_def["code"])
        assert code in SYSTEM_ARCHIVE_GATE_KEY_BY_CODE
        assert system_archive_gate_key(code)


def test_upload_templates_from_customer_xlsx():
    plan = SYSTEM_ARCHIVE_UPLOAD_TEMPLATES["design_task_plan"]
    assert "项目代号" in plan["columns"]
    assert "任务内容" in plan["columns"]
    summary = SYSTEM_ARCHIVE_UPLOAD_TEMPLATES["project_summary"]
    assert "总结内容" in summary["columns"]
    proto = SYSTEM_ARCHIVE_UPLOAD_TEMPLATES["prototype_build_sheet"]
    assert "制造意见" in proto["columns"]
