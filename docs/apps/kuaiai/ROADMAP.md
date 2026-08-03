# KU-AI 能力扩展路线图

> 嵌入业务场景的 AI 智能辅助引擎。聊天是入口，不是产品。

## 产品模块

| 模块 | 能力 | 波次 |
|------|------|------|
| KU-Ask | 自然语言查单、导航、解释 | Wave 1 |
| KU-Pulse | 异常/缺料/延误工作台卡片 | Wave 1 |
| KU-Draft | OCR/NL 生单、字段润色 | Wave 1 |
| KU-Suggest | 单据内推荐、半写回 | Wave 2 |
| KU-Know | SOP/知识 RAG 侧栏 | Wave 2 |
| KU-Act | 人审后 Agent 执行 | Wave 3 |

## Wave 1 — Assist 落地

- ContextBroker：顶栏助手感知当前页面/单据
- 挂载智能建议到工单、报工、库存、计划页
- AI 工作台（Pulse 汇总）
- OCR 生单平台化，扩展采购订单
- 质量字段 AI 润色

## Wave 2 — Recommend

- 统一 Suggestion DTO（code / severity / evidence / actions）
- 缺料替代、交期风险、插单仿真建议
- 工单工序 SOP 侧栏

## Wave 3 — Act

- ActionGateway（read / propose / execute）
- 审计与人审确认
- `kuaiai:act:execute` 权限
- 首批短链路 Agent（催交期草稿等）

## 治理契约

- 读：RBAC + DataScope，禁止旁路
- 写：HITL 确认 + 业务单据原权限
- 上下文：无权限 record 拒绝注入

## 工程落点

- Pro 包：`kuaigeyun-pro/backend|frontend/apps/kuaiai`
- 平台壳：`riveredge-frontend/src/components/ai-assistant`、`contexts/AiContext`
- 业务挂载：`kuaizhizao` 各业务页
