# 快数采与快报表联动

Wave 3 提供 equipment-ops 大屏数据馈送 API，供快报表 HTTP 数据源或自定义脚本消费。

## 端点

```
GET /api/v1/apps/kuaiiot/analytics/equipment-ops-feed?hours=24
```

需 RBAC：`kuaiiot:analytics:read`

## 响应结构

| 字段 | 用途 |
|------|------|
| `equipment_list` | 对应模板 `ca_equipment_list` |
| `ops_metrics` | 对应模板 `ca_equipment_ops_metrics` |
| `status_dist` | 对应模板 `ca_equipment_status_dist` |
| `workshop_stats` | 对应模板 `ca_equipment_workshop_stats` |
| `spot_check_recent` | 对应模板 `ca_equipment_spot_check_recent` |

## 快报表配置示例

1. 在快报表数据源新增 **HTTP** 类型
2. URL 填 `{MES_BASE}/api/v1/apps/kuaiiot/analytics/equipment-ops-feed`
3. 请求头携带租户 Token
4. 大屏组件绑定 JSON 路径，例如 `ops_metrics[].oee_live`

## OEE Live 说明

- `availability_rate` 仅来自 sensor 状态分段，不含估算计划工时
- `oee_live` 仅在同时存在 sensor 可用率与 MES 已审核报工良品率时返回
- 禁止用默认值填充缺失指标
