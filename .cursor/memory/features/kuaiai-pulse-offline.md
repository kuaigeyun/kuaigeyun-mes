---
title: KU-AI 异常感知下线
slug: kuaiai-pulse-offline
status: delivered
domain: frontend
when: 改 KU-AI Pulse/异常感知菜单、能力矩阵或恢复该入口
keywords:
  - kuaiai
  - 异常感知
  - pulse
  - KU-Pulse
standard: 无侧栏/能力矩阵/路由；页面目录已删；API get_pulse_summary 可保留给助手
---

# KU-AI 异常感知下线

## 何时读 / 禁止另起

- 何时读：要恢复异常感知页，或改 Pulse 相关菜单/能力
- 禁止：只改组装态不回写 Pro；留 Navigate 假路由冒充下线

## 标准入口

| 层 | 标准 |
|----|------|
| 菜单 | `kuaiai` FE/BE `manifest.json` 无 pulse 项 |
| 路由 | `index.tsx` 无 `pulse`；`pages/pulse` 已删除 |
| 能力矩阵 | `catalog/capabilities.py` 无 pulse |
| 助手 | `get_pulse_summary` 工具可保留（计划员等） |

## 关键文件

| 角色 | 路径 |
|------|------|
| Pro FE | `kuaigeyun-pro/frontend/apps/kuaiai/` |
| Pro BE | `kuaigeyun-pro/backend/apps/kuaiai/catalog/` + `manifest.json` |
| 单测 | `riveredge-backend/tests/apps/kuaiai/test_catalog_registry.py`（能力数 8） |
