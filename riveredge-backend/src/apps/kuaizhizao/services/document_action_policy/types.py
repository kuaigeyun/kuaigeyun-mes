"""单据业务态 capabilities 类型（不含 RBAC）。"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class ActionCapability(BaseModel):
    allowed: bool = Field(..., description="当前业务态是否允许该动作")
    reason: Optional[str] = Field(
        None,
        description="不允许时的稳定原因码（前端 i18n key 或后端默认文案）",
    )


class QuotationCapabilities(BaseModel):
    update: ActionCapability
    delete: ActionCapability
    submit: ActionCapability
    confirm_customer: ActionCapability
    cancel_customer_confirm: ActionCapability
    convert_to_order: ActionCapability
    convert_to_contract: ActionCapability
    revoke_push: ActionCapability
    reopen: ActionCapability
    create_revision: ActionCapability
    print_formal: ActionCapability


# 稳定原因码 → 默认中文（API 错误与日志）
CAPABILITY_REASON_MESSAGES: dict[str, str] = {
    "quotation.delete.not_allowed": "只能删除草稿、已驳回或待审核状态的报价单",
    "quotation.delete.linked_sales_order": "已关联有效销售订单的报价单不能删除",
    "quotation.delete.linked_contract": "已关联销售合同的报价单不能删除",
    "quotation.update.not_draft": "只能更新草稿状态的报价单",
    "quotation.confirm.not_sent": "仅已发送状态的报价单可客户确认",
    "quotation.confirm.not_approved": "请先完成审核通过后再标记客户确认",
    "quotation.cancel_customer_confirm.not_allowed": "当前状态不可取消客户确认",
    "quotation.cancel_customer_confirm.linked_contract": "已关联有效销售合同，请先处理合同后再取消确认",
    "quotation.convert_order.not_allowed": "当前状态不可转销售订单",
    "quotation.convert_order.linked_contract": "该报价已关联销售合同，请从销售合同下推订单",
    "quotation.convert_order.not_latest": "仅能对当前系列的最新版本报价单转销售订单",
    "quotation.convert_order.already_converted": "该报价单已转为销售订单",
    "quotation.convert_contract.not_allowed": "当前状态不可转销售合同",
    "quotation.convert_contract.linked_contract": "该报价单已关联销售合同",
    "quotation.convert_contract.linked_sales_order": "该报价单已关联销售订单",
    "quotation.convert_contract.superseded": "此为历史版本报价单，请使用系列最新版",
    "quotation.revoke_push.not_allowed": "仅已转订单且下游销售订单已删除时可撤回下推",
    "quotation.reopen.not_rejected": "仅已驳回的报价单可重新编辑",
    "quotation.revision.not_allowed": "仅非草稿的最新系列版本可新建修订版",
    "quotation.print.not_allowed": "正式报价 PDF 须在审核通过、客户确认或已转单后生成",
}
