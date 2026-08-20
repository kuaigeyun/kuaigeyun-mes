"""打印模板 code 族：超长基名截断后不得与预置去重失联。"""

from core.services.print.print_template_service import PrintTemplateService

CANONICAL = "HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_COMPLETE_PRINT"
TRUNCATED = "HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_COMPLETE_PR"
NUMBERED = "HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_COMPLETE_PR_287"


def test_normalize_long_outsource_print_code():
    assert len(CANONICAL) == 49
    family = PrintTemplateService._normalize_base_code(CANONICAL)
    assert family == TRUNCATED
    assert len(family) == 46
    assert not CANONICAL.startswith(f"{family}_")
    assert NUMBERED.startswith(f"{family}_")


def test_sql_like_escape_underscores():
    escaped = PrintTemplateService._sql_like_escape(TRUNCATED)
    assert escaped == r"HAOLIGO\_MOLD\_OUTSOURCE\_MAINTENANCE\_COMPLETE\_PR"
    assert (escaped + r"\_%") == r"HAOLIGO\_MOLD\_OUTSOURCE\_MAINTENANCE\_COMPLETE\_PR\_%"


def test_code_in_preset_family_matches_truncated_seq():
    assert PrintTemplateService.code_in_preset_family(NUMBERED, CANONICAL)
    assert PrintTemplateService.code_in_preset_family(CANONICAL, CANONICAL)
    assert PrintTemplateService.code_in_preset_family(TRUNCATED, CANONICAL)
    assert not PrintTemplateService.code_in_preset_family("HAOLIGO_EQUIPMENT_SPOT_CHECK_PRINT", CANONICAL)
    assert not PrintTemplateService.code_in_preset_family("", CANONICAL)
