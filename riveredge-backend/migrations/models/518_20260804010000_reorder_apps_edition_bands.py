"""
按应用中心编号规则重排 core_applications.sort_order。

规则（步进 10）：
  基础 1xx：110 主数据 / 120 快制造 / 121 进销存 / 122 快车间 / 130 快研发 / 140 快财务
  专业 2xx：210 KU-AI / 220 快报表 / 230 快数采 / 240 快能源 / 250 快协同
  行业 3xx：310…460（行业清单顺序）
  定制 5xx：510 好力 GO

同时清除上述 code 的 is_custom_sort，避免扫描/同步被旧自定义排序挡住。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_ORDER = {
    "master-data": 110,
    "kuaizhizao": 120,
    "kuaierp": 121,
    "kuaimes": 122,
    "kuaiplm": 130,
    "kuaicaiwu": 140,
    "kuaiai": 210,
    "kuaireport": 220,
    "kuaiiot": 230,
    "kuaiems": 240,
    "kuaisrm": 250,
    "kuaimachinery": 310,
    "kuaimolding": 320,
    "kuaielectronics": 330,
    "kuaiautoparts": 340,
    "kuaimedical": 350,
    "kuaifood": 360,
    "kuaipackaging": 370,
    "kuaihardware": 380,
    "kuaidiecasting": 390,
    "kuaiwiring": 400,
    "kuaimotor": 410,
    "kuaibattery": 420,
    "kuainewequipment": 430,
    "kuaisheetmetal": 440,
    "kuaimold": 450,
    "kuaisemiconductor": 460,
    "haoligo": 510,
}


async def upgrade(db: BaseDBAsyncClient) -> str:
    statements = [
        f"UPDATE core_applications SET sort_order = {so}, is_custom_sort = FALSE, updated_at = NOW() "
        f"WHERE code = '{code}' AND deleted_at IS NULL;"
        for code, so in _ORDER.items()
    ]
    return "\n".join(statements)


async def downgrade(db: BaseDBAsyncClient) -> str:
    # 回退到迁移 212 / 占位清单时代的近似值；主数据回到靠后位置
    legacy = {
        "master-data": 70,
        "kuaizhizao": 20,
        "kuaierp": 21,
        "kuaimes": 22,
        "kuaiplm": 25,
        "kuaicaiwu": 30,
        "kuaiai": 80,
        "kuaireport": 60,
        "kuaiiot": 55,
        "kuaiems": 103,
        "kuaisrm": 104,
        "kuaimachinery": 200,
        "kuaimolding": 201,
        "kuaielectronics": 202,
        "kuaiautoparts": 203,
        "kuaimedical": 204,
        "kuaifood": 205,
        "kuaipackaging": 206,
        "kuaihardware": 207,
        "kuaidiecasting": 208,
        "kuaiwiring": 209,
        "kuaimotor": 210,
        "kuaibattery": 211,
        "kuainewequipment": 212,
        "kuaisheetmetal": 213,
        "kuaimold": 214,
        "kuaisemiconductor": 215,
        "haoligo": 220,
    }
    statements = [
        f"UPDATE core_applications SET sort_order = {so}, updated_at = NOW() "
        f"WHERE code = '{code}' AND deleted_at IS NULL;"
        for code, so in legacy.items()
    ]
    return "\n".join(statements)
