---
title: 快视觉 P2 Edge Agent 与厚度/步骤 POC
slug: kuaivision-p2-edge
status: delivered
domain: kuaivision
when: 改视觉边缘心跳、配置拉取、本机 pipeline、Agent 在线判定
keywords:
  - kuaivision
  - edge-agent
  - heartbeat
  - thickness_measure
  - step_compliance
  - bump-config
standard: Pro 仓 kuaivision + edge-agent；主仓 compose 组装；迁移 893
---

# 快视觉 P2 Edge

## 目标

单节点实验室跑通：拉配置、心跳在线、厚度/步骤 mock 判定、断网 batch 续传。

## 何时读 / 禁止另起

- 何时读：改视觉边缘、Agent 在线、方案触发、检测耗时
- 禁止：把视觉帧塞进 kuaiiot；另起第二套 DeviceToken 鉴权

## 标准入口

| 层 | 标准 |
|----|------|
| Edge 进程 | `kuaigeyun-pro/backend/apps/kuaivision/edge-agent/` |
| 云侧 Edge API | `GET/POST .../edge/{token}/config|heartbeat` |
| 入站 | 既有 `ingest/{token}` + batch |
| PC | Agent 在线/bump；方案 trigger；检测 agent/duration；中心离线秒数 |

## 关键文件

| 角色 | 路径 |
|------|------|
| Edge | `.../kuaivision/edge-agent/agent.py` + `pipeline.py` |
| 运行时 | `services/edge_runtime_service.py`、`api/edge.py` |
| 在线判定 | `agent_service.is_online` + `settings.offline_timeout_seconds` |
| 迁移 | `893_..._kuaivision_p2_edge.py` |

## 扩展点

1. 新采集适配器：在 edge-agent 侧加模块，勿改云侧契约
2. 触发：`manual` / `interval` / `gpio`（gpio 先软件模拟）

## 踩坑

- 行缓存仍禁止写在 `request`
- compose 后主仓 `src/apps/kuaivision` 为 junction/copy，真源在 Pro
- 写门禁豁免：`/api/v1/apps/kuaivision/edge/` 与 ingest

## 关联

- `docs/apps/kuaivision/ROADMAP.md`
- `features/kuaivision-p0-shell.md`
