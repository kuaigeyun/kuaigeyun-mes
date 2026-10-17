---
title: 租户登录密码策略（简易/加强）
slug: tenant-password-policy
status: delivered
domain: core-platform
when: 改站点安全设置、创建/改密/重置密码、登录强制改密、密码校验规则
keywords:
  - password_mode
  - password_policy
  - PasswordPolicyService
  - get_password_policy
  - requires_password_change
  - must_change_password
standard: 策略真源 settings.security.password_* + PasswordPolicyService.get_policy / validate_login_password
---

# 租户登录密码策略（简易/加强）

## 目标

租户在站点设置选择简易或加强模式；加强模式下长度、字符类别、弱口令、更换周期、重置指引均可配置，业务代码不得硬编码 8/3/90。

## 何时读 / 禁止另起

- 何时读：任何写登录密码、站点安全保存、登录后强制改密、用户重置密码。
- 禁止：在 schema/页面再写死 min_length=8 作为策略；禁止旁路校验只 hash。

## 标准入口

| 层 | 标准 |
|----|------|
| 配置默认 | `core/domain/security/password_policy.py` → `default_password_security()` |
| 读取/合并 | `PasswordPolicyService.get_policy` / `merge_security_dict`（站点 PUT security） |
| 校验写入 | `validate_login_password` + `apply_login_password_to_user` |
| 公开 API | `GET /core/site-settings/password-policy` |
| FE 策略 | `getPasswordPolicy()` + `utils/passwordPolicy.ts` |
| UI 配置 | 站点设置 → 系统设置 →「登录密码策略」卡片 |
| 强制改密 | 登录 `requires_password_change` → `/personal/profile?forcePasswordChange=1` |

## 扩展点

- 写密路径：`UserService.create/update/import`、`reset_password`、`user_profile.change_password`
- 切加强：回填空 `password_changed_at`；切简易：清 `must_change_password`
- 重置：加强 → `generate_temporary_password` + `must_change_password`；简易 → 默认 123456

## 踩坑

- 系统设置 Tab 保存须把 `password_*` 一并写入 `settings.security`，否则仅靠后端 merge 也会丢未传字段。
- 迁移号 `894_20261016140100_user_password_lifecycle`（勿与 893 kuaivision 冲突）。
