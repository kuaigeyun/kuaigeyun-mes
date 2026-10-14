"""其他费用收入/支出单据编码分配（主仓 kuaizhizao）。"""

from __future__ import annotations

from apps.common.base_service import AppBaseService
from core.services.business.code_rule_service import CodeRuleService
from core.services.default.default_values_service import DefaultValuesService
from core.utils.timezone_utils import today_site_str
from infra.exceptions.exceptions import ValidationError

_OTHER_INCOME_PAGE = "kuaicaiwu-finance-other-income"
_OTHER_EXPENSE_PAGE = "kuaicaiwu-finance-other-expense"

OTHER_INCOME_RULE = "OTHER_INCOME_CODE"
OTHER_EXPENSE_RULE = "OTHER_EXPENSE_CODE"


async def _ensure_rule(tenant_id: int, rule_code: str, page_code: str) -> None:
    rule, _ = await CodeRuleService.resolve_rule_by_code(
        tenant_id, rule_code, active_only=True
    )
    if rule:
        return
    restored = await DefaultValuesService.restore_preset_for_page(tenant_id, page_code)
    if not restored:
        raise ValidationError(
            f"编码规则 {rule_code} 未注册（page_code={page_code}），请升级后端并在「编码规则」中加载预设"
        )
    rule, _ = await CodeRuleService.resolve_rule_by_code(
        tenant_id, rule_code, active_only=True
    )
    if not rule:
        raise ValidationError(
            f"编码规则 {rule_code} 不存在或未启用，请在「编码规则」中启用并保存该规则"
        )


async def allocate_other_income_code(tenant_id: int) -> str:
    await _ensure_rule(tenant_id, OTHER_INCOME_RULE, _OTHER_INCOME_PAGE)
    today = today_site_str()
    return await AppBaseService().generate_code(
        tenant_id, OTHER_INCOME_RULE, prefix=f"QS{today}"
    )


async def allocate_other_expense_code(tenant_id: int) -> str:
    await _ensure_rule(tenant_id, OTHER_EXPENSE_RULE, _OTHER_EXPENSE_PAGE)
    today = today_site_str()
    return await AppBaseService().generate_code(
        tenant_id, OTHER_EXPENSE_RULE, prefix=f"QZ{today}"
    )
