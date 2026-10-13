---
title: 首次组织初始化
slug: tenant-bootstrap-initialization
status: delivered
domain: core
when: 改首次登录初始化、应用扫描注册、消息模板预设、初始化失败重试
updated: 2026-10-13
---

# 首次组织初始化

- 入口：`components/tenant-bootstrap-modal` → `/core/tenant-init/run-bootstrap-step` → `TenantInitDataService.run_single`。
- 应用扫描成功预取空集合也必须复用，不能再逐应用查询；已安装应用无安装操作，不重复检查安装许可。元数据未变不重复 update，定制标记未变不重复写入。用户关闭的已安装应用保持关闭。
- 清单查找优先已知目录，保留 code 与目录名不同的扫描回退；直接目录查找不接受路径分隔符或 `.`/`..`。
- 消息模板加载按租户一次查询已有有效 code，保留自定义已有模板、应用筛选及幂等。并发创建的重复 code 可以跳过，真实存储或校验失败必须向调用方抛出，不能仅日志警告后返回成功。
- 必选步骤失败时不能调用 complete-bootstrap；界面显示具体原因、真实进度，重试跳过本轮成功步骤。完成接口自身失败也可重试。
- 原报障的消息模板失败未复现；2026-10-13 当前组织 1/3 重跑成功。已通过空通知规则的事务回滚探测、70 个模板全量加载、隔离应用扫描和浏览器失败重试回归。不把恢复后的通过反推为原失败原因已经确定。
- 验证脚本、截图和日志位于 `D:\pytest\d-kuaigeyun\tenant-init`。浏览器回归使用实际组件和模拟接口；当前既有测试账号登录失败，未改密码或权限。
- 快研发既有 `test_load_presets_creates_rules_when_empty` 固定断言 7 条，当前预设实际 10 条；该历史测试失败不能表述为通过。
