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
- InfluxDB 2.x OSS 短窗历史；入站幂等；MQTT 可选订阅；离线检测 Taskiq

## Wave 1.5 — MES 护栏与连接器遥测

- MES 写回护栏：停用/报废/校验中、未闭环故障、进行中维修时不覆盖 status/is_online
- 设备态归一化：入站 status 映射快制造枚举；未知值→待机；缺失 status 不默认运行中
- 点位模板：通用产线 / 注塑机 / CNC；创建设备可选套用
- ThingsBoard / JetLinks 遥测拉取 → ingest；手动 API + Taskiq 每 5 分钟

## Wave 2 — 边缘与业务填充

- 边缘 Agent 配置：Modbus TCP/RTU 寄存器映射 JSON + Agent 规格导出（HTTP ingest 发布）
- 告警规则：点位阈值 gt/lt/gte/lte/eq/ne → 告警记录；ingest 时评估；可选站内通知
- 业务填充：`fill_target`（sop_parameters.* / spot_check.*）+ `GET /fill-context`
- 报工 kiosk / 设备点检：按 MES 设备 UUID 自动预填采集值
- ThingsBoard / JetLinks：遥测拉取重试 + `POST /connectors/push-telemetry` 写回

## Wave 3 — 分析与可视化

- OEE Live：基于 `data_source=sensor` 监控分段计算可用率；仅在有 MES 良品率时合成 OEE Live（不造假）
- 数采链路：连接源 → 设备 → 点位 → MES 设备绑定可视化
- 快报表联动：`GET /analytics/equipment-ops-feed` 供 equipment-ops 大屏 HTTP 数据源消费
- InfluxDB 短窗历史已在 Wave 1 接入，Wave 3 不重做 TSDB 选型

## Wave 4 — 边缘运行时与租户运维

- Edge Runtime：Agent 通过 device token 拉取配置、上报心跳、检测 config_version 变更
- 批量续传：`POST /ingest/{device_token}/batch`，单批最多 100 条，幂等键去重
- 协议扩展：边缘配置支持 OPC UA / S7 映射校验（规格层，不含 Agent 二进制）
- 租户运维：`GET /ops/summary` 汇总连接健康、告警、Agent 在线、超时设备
- 定时任务：连接健康每 5 分钟探测；Agent 心跳超时每分钟标记 offline

## Wave 5 — 极轻量物联平台（无 ThingsBoard 场景）

- 产品物模型：租户可 CRUD 点位模板，一键导入内置 3 套产线模板
- 建设备按产品自动套点位；支持批量创建设备（<=100）并导出 token
- 离线告警规则：`rule_type=offline`，设备超时离线时产生告警与站内通知
- 设备数据抽屉：数值点位 InfluxDB 趋势折线图
- 接入调试面板：HTTP/MQTT/Edge Agent 指引 + 模拟上报 + 快照回显
- 非目标：不内置 MQTT Broker（部署层使用 mosquitto/EMQX）、不做完整规则引擎

## Wave 6 物模型事件指令 设备分组 消息追踪

- 产品物模型扩展 `events` / `functions` JSON；内置预设补充典型事件（fault / mold_change 等）
- Ingest 可选 `events` 数组；warning/critical 事件联动告警（rule_type=event）
- 指令下发闭环：pending → sent → success/failed/timeout；edge 心跳携带待执行指令 + command-result 回执
- ThingsBoard / JetLinks RPC 同步调用；Taskiq 每分钟检测指令超时
- 设备分组树 CRUD + 设备列表分组筛选
- 消息追踪日志：ingest / 事件 / 指令 / MES 写回结果；默认保留 14 天
- 前端：产品弹窗三段编辑（点位 / 事件 / 指令）；设备抽屉指令下发与消息轨迹 Tab

## 生产落地验收清单

| 项 | 验收方式 |
|----|----------|
| HTTP ingest 入站 | `python scripts/kuaiiot_smoke_e2e.py --device-token <token>` |
| 幂等去重 | 冒烟脚本同一 `idempotency_key` 重复 POST 不倍增 |
| 批量续传 | 冒烟脚本 batch 端点返回 accepted |
| 入站防护 | 冒烟脚本 201 个 tags 被拒绝 |
| Edge Agent | `riveredge-backend/src/apps/kuaiiot/edge-agent/` 连接 Modbus 模拟从站并成功 ingest |
| 告警通知 | 配置中心加载快数采预设，启用 `iot_alert` 规则后阈值触发可收站内信 |
| 数据留存 | Taskiq `kuaiiot_retention_tick` 清理过期 dedup 与已确认告警 |
| 运维概览 | 仪表盘 ops summary 与连接健康定时探测可用 |

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
  "events": [
    {"event_key": "fault", "data": {"message": "急停触发"}}
  ],
  "timestamp": "2026-08-06T07:00:00Z"
}
```

- `tags` 的 key 对应 TagDefinition 中的 `tag_key`
- `events` 可选；`event_key` 须在产品物模型 `events` 中定义；warning/critical 联动告警
- 未映射的 key 忽略；缺失 timestamp 时使用服务端当前时间

## 工程落点

- Pro 包：`kuaigeyun-pro/backend|frontend/apps/kuaiiot`
- 组装： `fast-deploy/tools/workspace/compose.py` → `riveredge-*/src/apps/kuaiiot`
- MES 写回：`apps.kuaizhizao.services.equipment_status_monitor_service`

## 治理边界

- 不改开源核心默认部署栈（HTTP ingest 即可演示，不强制 MQTT Broker）
- device token 可轮换；禁止跨租户 equipment 绑定
- 高频历史走 **InfluxDB 2.x OSS 自建**（IntegrationConfig code=`kuaiiot_tsdb`）；PG 仅保留最新快照，不再 append `tag_history`
- 许可与部署责任见 [COMPLIANCE.md](./COMPLIANCE.md)
