"""
集成配置 type 真源：允许值 + 历史伞型别名归一。

连接器从「品牌伞型」拆成具体产品后，库内可能仍残留 yonyou / kingdee 等旧 type；
列表序列化必须先归一，再按当前允许集校验。
"""

from __future__ import annotations

from typing import FrozenSet, Mapping

from core.config.data_source_type_spec import DATA_SOURCE_TYPES

# 历史伞型 → 当前具体产品 type（与拆分时默认产品对齐）
LEGACY_INTEGRATION_TYPE_ALIASES: Mapping[str, str] = {
    "yonyou": "yonyou_yonbip",
    "kingdee": "kingdee_galaxy",
    "sap": "sap_s4hana",
    "inspur": "inspur_gs",
    "dsc": "digiwin_t100",
    "grasp_erp": "grasp_huihuang",
}

APPLICATION_CONNECTOR_TYPES: tuple[str, ...] = (
    "feishu",
    "dingtalk",
    "wecom",
    "kingdee_galaxy",
    "kingdee_xingchen",
    "kingdee_kis_cloud",
    "kingdee_kis",
    "yonyou_yonbip",
    "yonyou_u8",
    "yonyou_u9",
    "yonyou_nc",
    "sap_s4hana",
    "sap_b1",
    "oracle_netsuite",
    "odoo",
    "inspur_gs",
    "inspur_ps",
    "digiwin_t100",
    "digiwin_yifei",
    "digiwin_yizhu",
    "digiwin_yituo",
    "digiwin_e10",
    "chanjet_tplus",
    "grasp_huihuang",
    "super_erp",
    "erpnext",
    "sunlike_erp",
    "teamcenter",
    "windchill",
    "caxa",
    "sanpin_plm",
    "sunlike_plm",
    "sipm",
    "inteplm",
    "salesforce",
    "xiaoshouyi",
    "fenxiang",
    "qidian",
    "supra_crm",
    "weaver",
    "seeyon",
    "landray",
    "cloudhub",
    "tongda_oa",
    "rootcloud",
    "casicloud",
    "alicloud_iot",
    "huaweicloud_iot",
    "thingsboard",
    "jetlinks",
    "flux_wms",
    "kejian_wms",
    "digiwin_wms",
    "openwms",
    "alicloud_oss",
    "tencent_cos",
    "huaweicloud_obs",
    "aws_s3",
    "minio",
    "qiniu_kodo",
    "nas_webdav",
    "nas_smb",
    "deepseek",
    "openai",
    "qwen",
    "zhipu",
    "moonshot",
    "siliconflow",
)

GENERIC_INTEGRATION_TYPES: tuple[str, ...] = (
    "OAuth",
    "API",
    "Webhook",
    "Database",
    "api",
)

ALLOWED_INTEGRATION_TYPES_ORDERED: tuple[str, ...] = (
    GENERIC_INTEGRATION_TYPES + tuple(DATA_SOURCE_TYPES) + APPLICATION_CONNECTOR_TYPES
)
ALLOWED_INTEGRATION_TYPES: FrozenSet[str] = frozenset(ALLOWED_INTEGRATION_TYPES_ORDERED)


def normalize_integration_type(raw: str) -> str:
    """将历史伞型 type 归一为当前具体产品 type；未知原样返回。"""
    value = (raw or "").strip()
    if not value:
        return value
    return LEGACY_INTEGRATION_TYPE_ALIASES.get(value, value)


def assert_allowed_integration_type(raw: str) -> str:
    """归一后校验；返回归一后的 type。"""
    normalized = normalize_integration_type(raw)
    if normalized not in ALLOWED_INTEGRATION_TYPES:
        raise ValueError(
            "集成类型必须是以下之一: "
            + ", ".join(ALLOWED_INTEGRATION_TYPES_ORDERED)
        )
    return normalized
