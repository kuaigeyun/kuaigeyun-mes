---
title: 用户偏好 JSON 原子深合并
keywords:
  - user preference
  - theme
  - uni_tabs_state
  - jsonb merge
  - core_jsonb_merge_preferences
  - 个性化主题
updated: 2026-10-12
---

# 用户偏好并发写入

## 何时读

主题保存后又变回跟随系统/深色；标签云端同步与主题/列偏好互相冲掉。

## 禁止

- 应用层对 `preferences` **先读后写**整包 JSON（含 `select_for_update` 串行化当「解竞态」）
- 前端 `updatePreferences` 用接口返回的**整包** preferences 覆盖本地（响应乱序会冲兄弟键）
- 前端写队列/锁协调掩盖竞态

## 真源

| 层 | 做法 |
|----|------|
| DB | `core_jsonb_merge_preferences(existing, patch)`；`INSERT … ON CONFLICT DO UPDATE SET preferences = core_jsonb_merge_preferences(...)` |
| 语义 | 与 `merge_preferences_patch` 一致；`theme_config` / `uni_tabs_state` / `columns*` 整段替换，其余对象深合并 |
| 前端 | 成功后 `mergePreferencesPatch(local, patch)` 只合入本次 patch |

迁移：`860_*_user_preference_jsonb_merge_fn.py`。
