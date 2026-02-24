# SQL 脚本说明

本目录为可在数据库直接执行的 SQL 脚本（PostgreSQL）。

## clean_orphan_demands.sql

**作用**：在数据库层面物理删除「孤儿需求」—— 来源单据（销售订单或销售预测）已删除或已软删，但需求主表及明细仍存在的记录。

**执行前建议**：

1. **预览**：先执行脚本内注释掉的「预览」查询（第 12–28 行），确认将要删除的 `demand_id`、`tenant_id`、`demand_code`、`source_type`、`source_id`。
2. **备份**：重要环境建议先备份 `apps_kuaizhizao_demands`、`apps_kuaizhizao_demand_items` 再执行删除。

**执行方式示例**：

```bash
# 使用 psql（需配置好连接）
psql "postgresql://user:pass@host:5432/dbname" -f clean_orphan_demands.sql

# 或登录后执行
psql "postgresql://..." -c "\i clean_orphan_demands.sql"
```

也可在 DBeaver、pgAdmin 等客户端中打开该文件，先运行预览查询，再按需执行两段 `DELETE`。

**仅预览（不删除）**：只执行 `preview_orphan_demands.sql` 即可。
