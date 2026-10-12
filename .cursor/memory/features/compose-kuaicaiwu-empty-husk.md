---
title: Pro 应用空壳导致 ModuleNotFoundError
slug: compose-kuaicaiwu-empty-husk
status: delivered
domain: deploy
when: No module named apps.kuaicaiwu.models.receivable、定时任务 external_master_data_sync、compose 空目录
keywords:
  - kuaicaiwu
  - receivable
  - compose.py
  - workspace.yaml
  - external_master_data_sync
standard: PRO_ENABLED=1 时用 generate_workspace + compose 全量 PRO_APPS；禁止留下无 .py 的 apps/kuaicaiwu 空壳
---

# Pro 应用空壳导致 ModuleNotFoundError

## 目标

主仓 `riveredge-backend/src/apps/kuaicaiwu`（及其它 pro 包）必须是 pro 仓真源的 copy/junction，定时任务与开源侧对财务模型的 import 才能成功。

## 何时读 / 禁止另起

- 何时读：`No module named 'apps.kuaicaiwu.models.receivable'`；`kuaizhizao.external_master_data_sync` 失败；`models/` 只有 `__pycache__`
- 禁止：在主仓手写空 `kuaicaiwu` 包；改 import 旁路抹掉财务模型依赖

## 标准入口

| 步骤 | 命令 |
|------|------|
| 生成清单 | `python fast-deploy/tools/workspace/generate_workspace.py --pro-enabled 1 --custom-enabled 0 --pro-repo <pro路径> --mode copy --compose-scope pro` |
| 组装 | `python fast-deploy/tools/workspace/compose.py` |
| 校验 | `from apps.kuaicaiwu.models.receivable import Receivable` |

`deploy.env`：`PRO_ENABLED=1`，`PRO_REPO_PATH` 指向本机 pro 仓；`workspace.yaml` 的 `apps` 须含完整 `PRO_APPS`（含 `kuaicaiwu`），不能只剩 kuaiai/kuaiiot/kuaireport。

## 踩坑

- 空壳目录会让 Python 认到包名但缺子模块 → 定时任务/审批/销售链任意触及应收即炸
- `workspace.yaml` 被部分生成后，旧空壳不会自动消失，须重新 compose 覆盖
- compose 前端遇 WinError 5（IDE 锁文件）可重试；后端 kuaicaiwu 装好即可先恢复定时任务
- 组装后须**重启**后端 / Taskiq worker，旧进程仍可能缓存失败 import

## 关联

- `features/app-pro-migration-compose.md`
- `fast-deploy/tools/workspace/README.md`
