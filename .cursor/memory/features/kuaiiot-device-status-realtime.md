---
title: 设备连接/台账状态 MQTT 无感刷新
slug: kuaiiot-device-status-realtime
status: delivered
domain: kuaiiot
when: 设备状态实时、MQTT 无感更新、external_device_id 绑定、台账 status 联动
keywords:
  - kuaiiot.device.updated
  - external_device_id
  - last_seen_at
  - schedule_device_realtime
  - useKuaiiotDeviceRealtime
  - riveredge_realtime
  - MesGuard
standard: ingest/离线 → schedule_device_realtime（租户 kuaiiot 频道）→ 布局 Socket 转发 → 设备连接与台账列表 reload；绑定复用设备连接表单
---

# 设备连接/台账状态 MQTT 无感刷新

## 目标

MQTT 入站后，**设备连接**（在线/最后上报）与**设备台账**（设备状态）前台无感更新；绑定走现有设备连接新建/编辑（`external_device_id` 可改）。

## 何时读 / 禁止另起

- 何时读：设备态实时、MQTT→台账 status、跨进程推送
- 禁止：浏览器直连 MQTT；另起 WebSocket；台账页平行「绑定向导」；绕开 `_maybe_sync_mes` / MesGuard 写台账 status

## 标准入口

| 层 | 标准 |
|----|------|
| 绑定 UI | 快数采 → 设备连接 → 新建/编辑：`connection_id` + `external_device_id`（发现列表）+ `equipment_uuid` |
| 入站 | `IngestService.ingest` → `_maybe_sync_mes`（MesGuard + status/online 变化旁路节流） |
| 推送 | `schedule_device_realtime` → `schedule_tenant_realtime_event(scope=kuaiiot)` |
| Worker→API | Socket.IO 未初始化时 `pg_bridge.publish_realtime_via_pg`；API lifespan `start_realtime_pg_listener` |
| FE | `useRealtimeInbox` 收 `kuaiiot.device.*` → `window` 事件 → `useKuaiiotDeviceRealtime` → 列表 reload |

## 关键文件

| 角色 | 路径 |
|------|------|
| 推送封装 | `apps/kuaiiot/services/device_realtime.py` |
| 入站/写回 | `apps/kuaiiot/services/ingest_service.py`、`mes_guard_service.py` |
| 离线 | `apps/kuaiiot/services/device_lifecycle_service.py` |
| PG 桥 | `core/services/realtime/pg_bridge.py` |
| 房间 | `socketio_server.py` join `tenant_kuaiiot_channel` |
| FE hook | `hooks/useKuaiiotDeviceRealtime.ts`、`hooks/useRealtimeInbox.ts` |
| 列表 | `apps/kuaiiot/pages/devices`、`kuaizhizao/.../equipment` |
| Pro 真源 | `kuaigeyun-pro/{backend,frontend}/apps/kuaiiot/`（改完需回写） |

## 扩展点

1. 新租户实时 scope：`channels.tenant_*` + Socket.IO connect join + `schedule_tenant_realtime_event`
2. 事件字段：只扩 `device_realtime` payload，前后端契约同步

## 过程

1. MQTT Worker ingest 更新 `is_online`/`last_seen_at`，有绑定则 MesGuard 写台账
2. 推送 `kuaiiot.device.updated`（含 `equipment_status` 当 `synced_to_mes`）
3. 布局已有 Socket 连接自动进 kuaiiot 房间；列表页订阅 CustomEvent 刷新

## 踩坑

- MQTT 在 Taskiq Worker：本地 `get_socketio_server()` 为 None，必须走 PG NOTIFY 桥
- `external_device_id` ≠ 平台 `code` ≠ `device_token`；清零/指令报文用 `command_device_id`（默认同外部 ID，可改）
- 仅绑连接不绑 `equipment_uuid` 或点位无 `map_target=status` 时，台账 status 不会变
- Centrifugo 当前只订 personal 频道，租户 kuaiiot 事件与 andon 一样主要靠 socketio

## 关联

- `features/kuaiiot-phased-hardening.md`
- `features/iot-line-clear-mqtt.md`
- `docs/core/realtime-im.md`
- `principles/three-repo-map.md`（kuaiiot 行）
