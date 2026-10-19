---
title: KU-AI 信任中心下线
slug: kuaiai-trust-offline
status: delivered
domain: frontend
when: 改 KU-AI 信任中心/可信执行入口或恢复该页
keywords:
  - kuaiai
  - 信任中心
  - trust
  - KU-Act
standard: 无侧栏/能力矩阵/路由；pages/trust 已删；act:execute 与 propose_action 可留
---

# KU-AI 信任中心下线

## 何时读 / 禁止另起

- 何时读：要恢复信任中心说明页或可信执行矩阵入口
- 禁止：留 `/trust` 重定向路由；能力矩阵再挂 act→trust

## 标准入口

| 层 | 标准 |
|----|------|
| 菜单 | manifest 无 trust |
| 路由 | `index.tsx` 无 trust；页面目录已删 |
| 能力矩阵 | BE `CAPABILITY_SPECS` 无 `act`；FE hub `OFFLINE_CAPABILITY_CODES` 含 `act`/`pulse` 防旧 API |
| 执行 | `kuaiai:act:execute` + 助手 `propose_action` 仍可用；矩阵不单独占「可信执行」卡 |
