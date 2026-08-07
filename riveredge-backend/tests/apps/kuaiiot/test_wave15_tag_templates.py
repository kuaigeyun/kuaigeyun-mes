"""点位模板单元测试。"""



from apps.kuaiiot.services.tag_template_service import TagTemplateService

from apps.kuaiiot.tag_templates import TAG_TEMPLATES





def test_list_templates():

    templates = TagTemplateService.list_templates()

    assert len(templates) == len(TAG_TEMPLATES)

    codes = {item.code for item in templates}

    assert "generic_line" in codes

    assert "injection_molding" in codes

    assert "cnc" in codes





def test_template_tag_map_targets_valid():

    from apps.kuaiiot.services.tag_service import TagService



    for code, template in TAG_TEMPLATES.items():

        for tag in template["tags"]:

            TagService._validate_map_target(tag["map_target"])

