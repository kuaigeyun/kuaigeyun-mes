---
title: 产线 MQTT 清零（接入/发送 + 手动/自动）
slug: iot-line-clear-mqtt
status: delivered
domain: kuaiiot
when: 产线清零、zscl 清 0、接入配置发送方向、报工后自动清零、command_code t0/c0/z0
keywords:
  - line_clear
  - publish_topic
  - command_code
  - z0
  - c0
  - t0
  - auto_clear
  - LineClearService
  - 发送型 MQTT
standard: 发送型 IotConnection + LineClearService.dispatch；手动走设备指令下发；自动挂 ind_relay 报工成功后
---

# 产线 MQTT 清零（接入/发送 + 手动/自动）

## 目标

MES 经 MQTT **publish** 清零指令到上位机（再转 PLC）。分手动与报工后自动；报文统一。

## 何时读 / 禁止另起

- 何时读：清零、下发主题、自动报工清 zscl
- 禁止：另起第二套 MQTT 客户端或平行「清零面板」；勿把 ingest 订阅主题当下行主题混用

## 标准入口

| 层 | 标准 |
|----|------|
| 连接 | `config.direction=ingest\|publish\|callback`；发送须 `publish_topic`；ingest+callback 被 Worker 订阅 |
| 下发 | `LineClearService.dispatch` → `mqtt_publisher.publish_once` |
| 手动 FE | 设备连接 → 指令下发 → 产线清零表单 → `POST .../devices/{uuid}/line-clear` |
| 自动 | `AutoReportService._maybe_dispatch_auto_clear`（报工成功且绑定开关开；连接取设备侧发送/回调 MQTT，`source=auto`） |
| 权限 | `kuaiiot:device:update` / `ind-relay:auto-report:update` |

## 关键文件

| 角色 | 路径 |
|------|------|
| 常量 | `kuaiiot/constants.py`（`CONNECTION_DIRECTIONS`、`LINE_CLEAR_COMMAND_CODES`） |
| 发布 | `kuaiiot/services/mqtt_publisher.py`、`line_clear_service.py` |
| API | `kuaiiot/api/devices.py`（`/line-clear`）、`connections.py`（`direction` 筛选） |
| Pro 源 | `kuaigeyun-pro/{backend,frontend}/apps/kuaiiot/`（组装态 gitignore，改完回写） |
| 绑定 | `ind_relay` binding：`auto_clear_*`；迁移 `855_..._ind_relay_auto_clear` |
| FE 自动报工 | `riveredge-frontend/src/apps/ind-relay/pages/auto-report` |

## 报文

```json
{
  "timestamp": "2026-10-09 16:47:00",
  "device_id": "<command_device_id 或回落 external_device_id>",
  "command_code": "t0|c0|z0",
  "value": true
}
```

## 回调

- 方向 `callback` 的 MQTT 连接：订阅回执主题，不走产量 ingest
- `LineClearService.handle_callback_inbound`：按 `device_id` / `command_code` 匹配最近清零指令，写入 `command.result.callback`
- 设备「指令下发」表展示「回调数据」列

## 扩展点

1. 新清零码：加入 `LINE_CLEAR_COMMAND_CODES` + 前后端下拉
2. 自动清零：绑定只留 `auto_clear_enabled` 开关；发送/回调 MQTT 与主题以 kuaiiot 接入配置为准，勿在自动报工页再配一套
3. 回调字段名兼容：`device_id`/`command_code`/`success`（见 `_extract_callback_fields`）

## 踩坑

- 发送连接不要被 `MqttSubscriberService` 订阅（已按 direction 过滤）
- publish 用短连接独立 client_id，避免踢掉订阅会话
- `device_id` 用 `DeviceService.resolve_command_device_id`（`command_device_id` 优先，否则 `external_device_id`），不是 MES 展示编码
- 自动清零不在自动报工页配 MQTT：须已有发送型连接（及可选回调连接）；指令码沿用该设备最近一次清零，否则 z0
- 指令 `params.source` / `dispatch_type`：`manual`=设备页手动，`auto`=报工后自动；运行日志合并 `IotDeviceCommand`
- 主仓 kuaiiot 与 Pro 需双向同步，勿只改组装态
- **指令表空白但后端已有记录**：`devices/index.tsx` 的 `reloadDeviceData` 曾用 `listTags(page_size:200)`，tags API `le=100` → 422，Promise.all 整批失败、`setCommands` 不执行；须 `page_size≤100` 且各接口独立 catch

## 关联

- `features/kuaiiot-phased-hardening.md`
- `principles/three-repo-map.md`（kuaiiot Pro 源）
