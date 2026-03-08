# 时区使用规范

## 配置

- **USE_TZ**（infra_config）：`False`，Tortoise ORM 使用 naive datetime，避免 naive/aware 混用导致 OperationalError
- **TIMEZONE**（infra_config）：`UTC`，数据库连接与存储统一使用 UTC

## 统一工具

所有需要写入数据库的 datetime 应通过 `core.timezone_utils`：

```python
from core.timezone_utils import now_utc, today_str, to_naive_utc

# 数据库写入（created_at、updated_at、deleted_at 等）
now = now_utc()

# 单据编码日期
today = today_str("%Y%m%d")

# 与 now_utc() 比较（处理 aware/naive）
dt_utc = to_naive_utc(some_datetime)
```

## 禁止

- 直接使用 `datetime.now()`、`datetime.utcnow()` 写入数据库
- 混用 `tortoise.timezone` 与 `datetime` 模块
