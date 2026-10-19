---
title: PC 业务消息推送到企业微信
keywords:
  - wecom
  - 企业微信
  - message_config
  - push
  - business_notification
  - message_sender
  - contact_info.wecom_userid
  - multi-tenant
  - agent_id
when: 配置或排查「消息提醒推企微」「push provider wecom」「站内信不进企微」「多租户工作台」
---

## 何时读 / 禁止另起

- PC **站内信**（`MessageConfig type=internal`）与 **企微应用消息** 是两条通道；站内信后的 FCM/极光仅服务移动端，**不是**企微。
- 企微出站：`wecom_message_service`（text / textcard）+ 应用连接器 `IntegrationConfig type=wecom`。
- 禁止为未绑定用户猜 userid；禁止 ambiguous `(corp_id, agent_id)` 反查时默认租户。

## 多租户同一域名

| 能力 | 真源 |
|------|------|
| 每租户凭证 | `IntegrationConfig` 按 `tenant_id` |
| 部署说明 URL | `GET /core/application-connections/wecom/deployment-guide` → `wecom_connector_guidance.build_wecom_deployment_guide` |
| 跨租户 Agent 冲突 | `assert_wecom_corp_agent_unique_across_tenants`（保存连接器时） |
| CorpId+AgentId → 租户 | `GET /auth/wecom/resolve-tenant`；`bootstrap-tenant?corp_id&agent_id` |
| 推荐工作台主页 | `{origin}/{tenant.domain}` |
| 可选登录入口 | `{origin}/login?provider=wecom_work&corp_id=&agent_id=` |

PC 登录 [`resolveWecomLoginTenantId`](riveredge-frontend/src/pages/login/index.tsx) 已支持 URL 中 corp_id/agent_id。

## 管理员配置顺序

1. 应用连接器：启用企业微信，复制表单内「部署说明」到企微后台。
2. 用户绑定：`contact_info.wecom_userid`。
3. 消息配置：`type=push`，`provider=wecom`；可选 `wecom_use_textcard`。
4. 业务配置 → 消息提醒：勾选 push 渠道（业务单据触发）。
5. **审批待办**：`approval_instance_service._send_internal_to_user`（`message_category=approval`）站内信成功后，`approval_wecom_push_service.schedule_approval_wecom_push` 自动走步骤 3 的企微 push（无需单独业务规则）；采购申请等同所有 uni-audit 审批。
6. Taskiq worker 处理 `message/send`（push 类型；站内信本身不依赖 worker）。

## 代码真源

| 步骤 | 路径 |
|------|------|
| 规则多通道 | `business_notification_service.py` |
| document_url 变量 | `notification_document_url.ensure_notification_document_url` |
| 异步发送 | `message_sender._send_push_notification`（读 `MessageLog.variables`） |
| user_id → userid | `wecom_message_service.resolve_wecom_recipient_userids` |
| 卡片 | `wecom_message_service.send_wecom_textcard_message` |

## 踩坑

- 两组织相同 CorpId+AgentId → 保存连接器失败；resolve 返回 409，须手动选组织。
- 卡片需 `document_url` + 渠道 `wecom_use_textcard`（或变量 `wecom_msgtype=textcard`）。
- 未映射的 `trigger_document` 不会自动生成 document_url。
