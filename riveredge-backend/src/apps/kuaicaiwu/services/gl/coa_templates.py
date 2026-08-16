"""中国标准会计科目预置模板（多准则 / 多行业）。

对标用友/金蝶「导入行业科目」：先选准则与行业，再幂等写入一级科目。
编码均为 4 位一级，默认账套规则 4-2-2-2；下级明细导入后按需增设。
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, List, Optional


def _a(
    code: str,
    name: str,
    account_type: str,
    direction: str,
    **flags: Any,
) -> Dict[str, Any]:
    row: Dict[str, Any] = {
        "account_code": code,
        "account_name": name,
        "account_type": account_type,
        "balance_direction": direction,
    }
    row.update(flags)
    return row


# —— 企业会计准则：共用一级科目 ——
_CAS_CORE: List[Dict[str, Any]] = [
    _a("1001", "库存现金", "asset", "debit", is_cash_journal=True),
    _a("1002", "银行存款", "asset", "debit", is_bank_journal=True),
    _a("1012", "其他货币资金", "asset", "debit", is_bank_journal=True),
    _a("1101", "交易性金融资产", "asset", "debit"),
    _a("1121", "应收票据", "asset", "debit", aux_customer=True),
    _a("1122", "应收账款", "asset", "debit", aux_customer=True, is_controlled=True),
    _a("1123", "预付账款", "asset", "debit", aux_supplier=True),
    _a("1131", "应收股利", "asset", "debit"),
    _a("1132", "应收利息", "asset", "debit"),
    _a("1221", "其他应收款", "asset", "debit", aux_employee=True),
    _a("1231", "坏账准备", "asset", "credit"),
    _a("1471", "存货跌价准备", "asset", "credit"),
    _a("1501", "债权投资", "asset", "debit"),
    _a("1503", "其他债权投资", "asset", "debit"),
    _a("1511", "长期股权投资", "asset", "debit"),
    _a("1521", "投资性房地产", "asset", "debit"),
    _a("1531", "长期应收款", "asset", "debit"),
    _a("1601", "固定资产", "asset", "debit"),
    _a("1602", "累计折旧", "asset", "credit"),
    _a("1603", "固定资产减值准备", "asset", "credit"),
    _a("1604", "在建工程", "asset", "debit"),
    _a("1605", "工程物资", "asset", "debit"),
    _a("1606", "固定资产清理", "asset", "debit"),
    _a("1701", "无形资产", "asset", "debit"),
    _a("1702", "累计摊销", "asset", "credit"),
    _a("1703", "无形资产减值准备", "asset", "credit"),
    _a("1711", "商誉", "asset", "debit"),
    _a("1801", "长期待摊费用", "asset", "debit"),
    _a("1811", "递延所得税资产", "asset", "debit"),
    _a("1901", "待处理财产损溢", "asset", "debit"),
    _a("2001", "短期借款", "liability", "credit"),
    _a("2101", "交易性金融负债", "liability", "credit"),
    _a("2201", "应付票据", "liability", "credit", aux_supplier=True),
    _a("2202", "应付账款", "liability", "credit", aux_supplier=True, is_controlled=True),
    _a("2203", "预收账款", "liability", "credit", aux_customer=True),
    _a("2211", "应付职工薪酬", "liability", "credit"),
    _a("2221", "应交税费", "liability", "credit"),
    _a("2231", "应付利息", "liability", "credit"),
    _a("2232", "应付股利", "liability", "credit"),
    _a("2241", "其他应付款", "liability", "credit"),
    _a("2501", "长期借款", "liability", "credit"),
    _a("2502", "应付债券", "liability", "credit"),
    _a("2701", "长期应付款", "liability", "credit"),
    _a("2711", "专项应付款", "liability", "credit"),
    _a("2801", "预计负债", "liability", "credit"),
    _a("2901", "递延所得税负债", "liability", "credit"),
    _a("4001", "实收资本", "equity", "credit"),
    _a("4002", "资本公积", "equity", "credit"),
    _a("4101", "盈余公积", "equity", "credit"),
    _a("4103", "本年利润", "equity", "credit"),
    _a("4104", "利润分配", "equity", "credit"),
    _a("6001", "主营业务收入", "profit_loss", "credit", aux_customer=True),
    _a("6051", "其他业务收入", "profit_loss", "credit"),
    _a("6101", "公允价值变动损益", "profit_loss", "credit"),
    _a("6111", "投资收益", "profit_loss", "credit"),
    _a("6301", "营业外收入", "profit_loss", "credit"),
    _a("6401", "主营业务成本", "profit_loss", "debit"),
    _a("6402", "其他业务成本", "profit_loss", "debit"),
    _a("6403", "税金及附加", "profit_loss", "debit"),
    _a("6601", "销售费用", "profit_loss", "debit", aux_department=True),
    _a("6602", "管理费用", "profit_loss", "debit", aux_department=True),
    _a("6603", "财务费用", "profit_loss", "debit"),
    _a("6701", "资产减值损失", "profit_loss", "debit"),
    _a("6711", "营业外支出", "profit_loss", "debit"),
    _a("6801", "所得税费用", "profit_loss", "debit"),
    _a("6901", "以前年度损益调整", "profit_loss", "debit"),
]

_CAS_INVENTORY_MFG: List[Dict[str, Any]] = [
    _a("1401", "材料采购", "asset", "debit", is_controlled=True),
    _a("1402", "在途物资", "asset", "debit", is_controlled=True),
    _a("1403", "原材料", "asset", "debit", is_controlled=True),
    _a("1404", "材料成本差异", "asset", "debit"),
    _a("1405", "库存商品", "asset", "debit", is_controlled=True),
    _a("1406", "发出商品", "asset", "debit", is_controlled=True),
    _a("1408", "委托加工物资", "asset", "debit", is_controlled=True),
    _a("1411", "周转材料", "asset", "debit"),
]

_CAS_COST_MFG: List[Dict[str, Any]] = [
    _a("5001", "生产成本", "cost", "debit", aux_department=True, is_controlled=True),
    _a("5101", "制造费用", "cost", "debit", aux_department=True),
    _a("5201", "劳务成本", "cost", "debit"),
    _a("5301", "研发支出", "cost", "debit", aux_project=True),
]

_CAS_INVENTORY_COMMERCE: List[Dict[str, Any]] = [
    _a("1401", "材料采购", "asset", "debit", is_controlled=True),
    _a("1402", "在途物资", "asset", "debit", is_controlled=True),
    _a("1405", "库存商品", "asset", "debit", is_controlled=True),
    _a("1406", "发出商品", "asset", "debit", is_controlled=True),
    _a("1407", "商品进销差价", "asset", "credit"),
    _a("1411", "周转材料", "asset", "debit"),
]

_CAS_COST_SERVICE: List[Dict[str, Any]] = [
    _a("5201", "劳务成本", "cost", "debit", aux_department=True, is_controlled=True),
    _a("5301", "研发支出", "cost", "debit", aux_project=True),
]

_CAS_INVENTORY_SERVICE: List[Dict[str, Any]] = [
    _a("1405", "库存商品", "asset", "debit", is_controlled=True),
    _a("1411", "周转材料", "asset", "debit"),
]

# —— 小企业会计准则（一级科目编码与企业准则不同处按财政部小企科目表）——
_SBAS_ACCOUNTS: List[Dict[str, Any]] = [
    _a("1001", "库存现金", "asset", "debit", is_cash_journal=True),
    _a("1002", "银行存款", "asset", "debit", is_bank_journal=True),
    _a("1012", "其他货币资金", "asset", "debit", is_bank_journal=True),
    _a("1101", "短期投资", "asset", "debit"),
    _a("1121", "应收票据", "asset", "debit", aux_customer=True),
    _a("1122", "应收账款", "asset", "debit", aux_customer=True, is_controlled=True),
    _a("1123", "预付账款", "asset", "debit", aux_supplier=True),
    _a("1131", "应收股利", "asset", "debit"),
    _a("1132", "应收利息", "asset", "debit"),
    _a("1221", "其他应收款", "asset", "debit", aux_employee=True),
    _a("1401", "材料采购", "asset", "debit", is_controlled=True),
    _a("1402", "在途物资", "asset", "debit", is_controlled=True),
    _a("1403", "原材料", "asset", "debit", is_controlled=True),
    _a("1404", "材料成本差异", "asset", "debit"),
    _a("1405", "库存商品", "asset", "debit", is_controlled=True),
    _a("1407", "商品进销差价", "asset", "credit"),
    _a("1408", "委托加工物资", "asset", "debit", is_controlled=True),
    _a("1411", "周转材料", "asset", "debit"),
    _a("1421", "消耗性生物资产", "asset", "debit"),
    _a("1501", "长期债券投资", "asset", "debit"),
    _a("1511", "长期股权投资", "asset", "debit"),
    _a("1601", "固定资产", "asset", "debit"),
    _a("1602", "累计折旧", "asset", "credit"),
    _a("1604", "在建工程", "asset", "debit"),
    _a("1605", "工程物资", "asset", "debit"),
    _a("1606", "固定资产清理", "asset", "debit"),
    _a("1621", "生产性生物资产", "asset", "debit"),
    _a("1622", "生产性生物资产累计折旧", "asset", "credit"),
    _a("1701", "无形资产", "asset", "debit"),
    _a("1702", "累计摊销", "asset", "credit"),
    _a("1801", "长期待摊费用", "asset", "debit"),
    _a("1901", "待处理财产损溢", "asset", "debit"),
    _a("2001", "短期借款", "liability", "credit"),
    _a("2201", "应付票据", "liability", "credit", aux_supplier=True),
    _a("2202", "应付账款", "liability", "credit", aux_supplier=True, is_controlled=True),
    _a("2203", "预收账款", "liability", "credit", aux_customer=True),
    _a("2211", "应付职工薪酬", "liability", "credit"),
    _a("2221", "应交税费", "liability", "credit"),
    _a("2231", "应付利息", "liability", "credit"),
    _a("2232", "应付利润", "liability", "credit"),
    _a("2241", "其他应付款", "liability", "credit"),
    _a("2401", "递延收益", "liability", "credit"),
    _a("2501", "长期借款", "liability", "credit"),
    _a("2701", "长期应付款", "liability", "credit"),
    _a("4001", "实收资本", "equity", "credit"),
    _a("4002", "资本公积", "equity", "credit"),
    _a("4101", "盈余公积", "equity", "credit"),
    _a("4103", "本年利润", "equity", "credit"),
    _a("4104", "利润分配", "equity", "credit"),
    _a("4301", "生产成本", "cost", "debit", aux_department=True, is_controlled=True),
    _a("4401", "制造费用", "cost", "debit", aux_department=True),
    _a("4403", "研发支出", "cost", "debit", aux_project=True),
    _a("5001", "主营业务收入", "profit_loss", "credit", aux_customer=True),
    _a("5051", "其他业务收入", "profit_loss", "credit"),
    _a("5111", "投资收益", "profit_loss", "credit"),
    _a("5301", "营业外收入", "profit_loss", "credit"),
    _a("5401", "主营业务成本", "profit_loss", "debit"),
    _a("5402", "其他业务成本", "profit_loss", "debit"),
    _a("5403", "营业税金及附加", "profit_loss", "debit"),
    _a("5601", "销售费用", "profit_loss", "debit", aux_department=True),
    _a("5602", "管理费用", "profit_loss", "debit", aux_department=True),
    _a("5603", "财务费用", "profit_loss", "debit"),
    _a("5711", "营业外支出", "profit_loss", "debit"),
    _a("5801", "所得税费用", "profit_loss", "debit"),
]


def _merge(*groups: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    by_code: Dict[str, Dict[str, Any]] = {}
    for group in groups:
        for item in group:
            by_code[item["account_code"]] = deepcopy(item)
    return [by_code[k] for k in sorted(by_code.keys())]


def _tpl(
    key: str,
    name: str,
    *,
    standard: str,
    industry: str,
    description: str,
    accounts: List[Dict[str, Any]],
    recommended: bool = False,
) -> Dict[str, Any]:
    return {
        "key": key,
        "name": name,
        "standard": standard,
        "industry": industry,
        "description": description,
        "account_code_rule": "4-2-2-2",
        "account_count": len(accounts),
        "recommended": recommended,
        "accounts": accounts,
    }


COA_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "cas_manufacturing": _tpl(
        "cas_manufacturing",
        "企业会计准则（工业制造）",
        standard="cas",
        industry="manufacturing",
        description="财政部企业会计准则一级科目；含原材料、生产成本、制造费用，适合离散/流程制造。",
        accounts=_merge(_CAS_CORE, _CAS_INVENTORY_MFG, _CAS_COST_MFG),
        recommended=True,
    ),
    "cas_commerce": _tpl(
        "cas_commerce",
        "企业会计准则（商品流通）",
        standard="cas",
        industry="commerce",
        description="企业会计准则一级科目；突出库存商品与商品进销差价，弱化车间成本科目。",
        accounts=_merge(_CAS_CORE, _CAS_INVENTORY_COMMERCE),
    ),
    "cas_service": _tpl(
        "cas_service",
        "企业会计准则（服务业）",
        standard="cas",
        industry="service",
        description="企业会计准则一级科目；以劳务成本为主，存货科目精简。",
        accounts=_merge(_CAS_CORE, _CAS_INVENTORY_SERVICE, _CAS_COST_SERVICE),
    ),
    "sbas_general": _tpl(
        "sbas_general",
        "小企业会计准则（通用）",
        standard="sbas",
        industry="general",
        description="财政部小企业会计准则一级科目；编码与损益/成本科目与企业准则有差异，适合小微企业。",
        accounts=deepcopy(_SBAS_ACCOUNTS),
    ),
}

DEFAULT_COA_TEMPLATE_KEY = "cas_manufacturing"

# 兼容旧引用：默认工业制造模板科目
INDUSTRY_COA_SEED: List[Dict[str, Any]] = COA_TEMPLATES[DEFAULT_COA_TEMPLATE_KEY]["accounts"]


def list_coa_templates() -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for key, meta in COA_TEMPLATES.items():
        rows.append(
            {
                "key": key,
                "name": meta["name"],
                "standard": meta["standard"],
                "industry": meta["industry"],
                "description": meta["description"],
                "account_code_rule": meta["account_code_rule"],
                "account_count": meta["account_count"],
                "recommended": bool(meta.get("recommended")),
            }
        )
    rows.sort(key=lambda x: (0 if x.get("recommended") else 1, x["name"]))
    return rows


def get_coa_template(template_key: Optional[str]) -> Dict[str, Any]:
    key = (template_key or DEFAULT_COA_TEMPLATE_KEY).strip()
    if key in ("enterprise_accounting_standards", "industry", "default"):
        key = DEFAULT_COA_TEMPLATE_KEY
    meta = COA_TEMPLATES.get(key)
    if not meta:
        raise KeyError(key)
    return meta
