"""好力 GO 模具单据单号：走系统编码规则（简称 + YYMMDD + 3 位流水）。"""

from core.config.code_rule_pages import get_rule_code_to_page_code
from core.services.business.code_generation_service import CodeGenerationService
from core.services.default.default_values_service import DefaultValuesService
from infra.exceptions.exceptions import ValidationError


async def generate_mold_sheet_no(tenant_id: int, rule_code: str) -> str:
    page_code = get_rule_code_to_page_code().get(rule_code)
    if not page_code:
        raise ValidationError(f"未在编码规则页面配置中注册的单据规则: {rule_code}")
    await DefaultValuesService.ensure_code_rule_for_page(tenant_id, page_code)
    return await CodeGenerationService.generate_code(tenant_id, rule_code, None)
