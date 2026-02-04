# 数据连接/数据源统一 — 迁移执行顺序

## 顺序（必须严格按此执行）

1. **执行迁移 70**：为 `core_datasets` 增加 `integration_config_id` 列。
2. **运行数据迁移脚本**：把 `core_data_sources` 数据同步到 `core_integration_configs`，并回填 `core_datasets.integration_config_id`。
3. **执行迁移 71**：删除 `core_datasets.data_source_id`，将 `integration_config_id` 设为 NOT NULL。
4. **执行迁移 72**：删除表 `core_data_sources`。

## 命令示例

在 `riveredge-backend` 目录下执行（按你项目实际方式设置 PYTHONPATH 或使用 `uv run`）：

```bash
cd riveredge-backend

# 1. 仅应用迁移 70（若尚未应用）
#    若使用 aerich 且 70/71/72 均未应用，可先只执行到 70，再执行下面脚本，再继续 71、72。
export PYTHONPATH=$PWD:$PWD/src:$PYTHONPATH
uv run aerich upgrade

# 2. 数据迁移（在 70 已应用、71 未应用时执行；若 70/71 已应用且数据已迁移过可跳过）
uv run python migrations/apply_data_sources_to_integration_configs_migration.py

# 3. 继续应用迁移 71、72（若尚未应用）
uv run aerich upgrade
```

**说明**：若你使用 `aerich upgrade` 一次会应用所有未执行迁移，则需先确保只执行到 70，再跑脚本，再执行 71、72。若 70 和 71 已应用且数据已迁移，只需再执行一次 `aerich upgrade` 应用 72 即可。

## 已应用过 70+71 且数据已迁移

若之前已执行 70、71 并跑过数据迁移脚本，只需应用 72 删除旧表：

```bash
cd riveredge-backend
export PYTHONPATH=$PWD:$PWD/src:$PYTHONPATH
uv run aerich upgrade
```

## 回滚

- 72 的 downgrade 会重新创建 `core_data_sources` 表结构（不恢复数据）。
- 71 的 downgrade 会恢复 `core_datasets.data_source_id` 列。
- 数据需自行从备份或 IntegrationConfig 逆写回 DataSource（若有逆脚本）。
