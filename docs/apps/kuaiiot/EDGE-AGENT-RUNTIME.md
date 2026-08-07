# 边缘 Agent 运行时对接

Wave 4 提供云侧运行时 API，供现场 Agent（自研或第三方）通过 device token 拉配置、报心跳、批量续传缓冲数据。

## 鉴权

所有 Edge Runtime 与 Ingest API 使用 IoT 设备的 `device_token`，无需用户登录。

## 配置下发

```
GET /api/v1/apps/kuaiiot/edge-runtime/{device_token}/config/{edge_config_code}
```

响应包含：

| 字段 | 说明 |
|------|------|
| `config_version` | 云侧配置版本，变更后 Agent 须重新拉取 |
| `protocol` | modbus_tcp / modbus_rtu / opc_ua / s7 |
| `config` | 寄存器或节点映射 JSON |
| `ingest_path` | 单条 HTTP ingest 路径 |
| `batch_ingest_path` | 批量续传路径 |
| `heartbeat_path` | 心跳路径 |

## 心跳

```
POST /api/v1/apps/kuaiiot/edge-runtime/{device_token}/heartbeat
```

```json
{
  "edge_config_code": "line1-modbus",
  "config_version": 3,
  "agent_version": "1.0.0",
  "buffer_pending_count": 12,
  "status": "online"
}
```

响应 `config_changed=true` 时 Agent 应重新拉取配置。

## 批量续传

```
POST /api/v1/apps/kuaiiot/ingest/{device_token}/batch
```

```json
{
  "items": [
    {
      "tags": { "temp": 26.1, "status": "运行中" },
      "timestamp": "2026-08-07 12:00:00",
      "idempotency_key": "buf-001"
    }
  ]
}
```

单批最多 100 条；每条可带独立 `idempotency_key` 防断网重传倍增。

## 离线判定

- 设备 ingest：5 分钟无上报 → IoT 设备 offline
- Agent 心跳：3 分钟无心跳 → `agent_status=offline`（Taskiq 每分钟检测）

## 协议映射

| 协议 | config 关键字段 |
|------|----------------|
| modbus_tcp/rtu | `host`, `port`, `unit_id`, `registers[]` |
| opc_ua | `endpoint`, `nodes[]` |
| s7 | `host`, `rack`, `slot`, `db_blocks[]` |

所有协议均需 `publish.mode = http_ingest` 或 `mqtt`。

### Modbus registers[] 字段

| 字段 | 必填 | 说明 |
|------|------|------|
| `tag_key` | 是 | 对应 TagDefinition.tag_key |
| `address` | 是 | 保持寄存器起始地址（非负整数） |
| `data_type` | 是 | `int16` / `uint16` / `int32` / `uint32` / `float32` / `bool` |
| `scale` | 否 | 数值缩放系数，默认 1.0 |

Agent 参考实现见仓库 `riveredge-backend/src/apps/kuaiiot/edge-agent/`，当前支持 `modbus_tcp` 保持寄存器轮询与断网缓冲续传。

## 无 IoT 平台直连

客户不部署 ThingsBoard 时，设备/Edge Agent 可直接 HTTP ingest 到快数采；MQTT 接入需自建 Broker（如 mosquitto、EMQX），快数采仅作订阅客户端。
