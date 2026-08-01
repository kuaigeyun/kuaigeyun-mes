"""核销表缺失等数据库环境问题的识别（登记收/付款、手动核销共用）。"""

SETTLEMENTS_TABLE_MISSING_HINT = (
    "核销表 apps_kuaicaiwu_settlements 不存在（数据库未完成迁移）。"
    "请在 riveredge-backend 目录执行：PYTHONPATH=src uv run aerich upgrade，并重启 API 服务。"
)


def is_settlements_table_missing(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return "apps_kuaicaiwu_settlements" in msg and "does not exist" in msg
