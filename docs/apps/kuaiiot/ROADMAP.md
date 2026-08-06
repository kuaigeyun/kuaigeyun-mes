# 快数采（kuaiiot）能力扩展路线图

> 工业物联网数采与集成层。连接现场设备/平台，采集实时数据，写回 MES 设备态与业务参数。

## 产品模块

| 模块 | 能力 | 波次 |
|------|------|------|
| IoT-Hub | 连接源（MQTT / ThingsBoard / JetLinks / HTTP Webhook）、凭证、健康检查 | Wave 1 |
| Device-Bind | IoT 设备 ↔ MES 设备绑定；在线状态 | Wave 1 |
| Tag-Map | 点位定义、单位、写回字段映射 | Wave 1 |
| Ingest | HTTP/MQTT 入站、device token 鉴权、幂等 | Wave 1 |
| Snapshot | 最新值快照 + 短窗历史；仪表盘 | Wave 1 |
| Status-Sync | 写回快制造 `EquipmentStatusMonitor`（`data_source=sensor`） | Wave 1 |
| Alert | 阈值规则 → 告警列表（可选挂 KU-Pulse） | Wave 2 |
| Edge-Agent | Modbus/OPC UA/S7 协议适配、本地缓冲 | Wave 2 |
| Report-Fill | 报工 kiosk `sop_parameters` / 点检数值自动填充 | Wave 2 |
| OEE-Live | 运行/停机信号 enrich OEE | Wave 3 |
| Pipeline-UI | 可视化数采链路 | Wave 3 |

## Wave 1 — 云侧接入

- 连接源 CRUD：MQTT / ThingsBoard / JetLinks / HTTP Webhook
- IoT 设备注册、device token、MES 设备绑定
- 点位映射（status / temperature / pressure / vibration / is_online / other_parameters.*）
- HTTP ingest：`POST /api/v1/apps/kuaiiot/ingest/{device_token}`
- 最新值快照 + 仪表盘汇总
- 节流写回设备状态监控（≥5s/设备）

## Wave 2 — 边缘与业务填充

- 边缘 Agent（Modbus / OPC UA / S7 → MQTT）
- 告警规则与通知
- 报工参数 / 点检数值自动填充
- ThingsBoard / JetLinks 双向同步加固

## Wave 3 — 分析与可视化

- OEE 实时信号
- 可视化数采链路
- 可选外部 TSDB（Influx 等）
- 与快报表联动

## MES 集成契约

- **设备主数据**：只读快制造 `apps_kuaizhizao_equipment`，kuaiiot 不维护第二套台账
- **绑定键**：`equipment.uuid`
- **写回表**：`apps_kuaizhizao_equipment_status_monitors`
- **写回字段**：`status` / `is_online` / `temperature` / `pressure` / `vibration` / `other_parameters`
- **data_source**：固定 `sensor`
- **节流**：同一设备 ≥5 秒才写一条 monitor 记录
- **权限**：ingest 用 device token；控制面走租户 RBAC + Pro License

## HTTP Ingest Payload 约定

```json
{
  "tags": {
    "temp": 25.5,
    "status": "运行中",
    "online": true
  },
  "timestamp": "2026-08-06T07:00:00Z"
}
```

- `tags` 的 key 对应 TagDefinition 中的 `tag_key`
- 未映射的 key 忽略；缺失 timestamp 时使用服务端当前时间

## 工程落点

- Pro 包：`kuaigeyun-pro/backend|frontend/apps/kuaiiot`
- 组装： `fast-deploy/tools/workspace/compose.py` → `riveredge-*/src/apps/kuaiiot`
- MES 写回：`apps.kuaizhizao.services.equipment_status_monitor_service`

## 治理边界

- 不改开源核心默认部署栈（HTTP ingest 即可演示，不强制 MQTT Broker）
- device token 可轮换；禁止跨租户 equipment 绑定
- 高频历史首期用 PG 快照，Wave 3 再接外部 TSDB
