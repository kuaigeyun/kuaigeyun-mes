---
title: 快视觉 P3 样本模型与运维
slug: kuaivision-p3-governance
status: delivered
domain: kuaivision
when: 改视觉样本库、模型制品、保留策略、节点运维告警
keywords:
  - kuaivision
  - sample
  - model_artifact
  - retention
  - promote-sample
  - VISION_AGENT_OPS_ALERT
standard: Pro kuaivision samples/models + 迁移 895 + Taskiq retention
---

# 快视觉 P3 治理

## 目标

样本闭环、模型绑定发布、原图/事件保留、节点缓冲磁盘告警。

## 标准入口

| 层 | 路径 |
|----|------|
| 样本 | `api/samples.py`、`services/sample_service.py`、`pages/samples` |
| 模型 | `api/models.py`、`services/model_artifact_service.py`、`pages/models` |
| 入库 | `POST /inspections/{uuid}/promote-sample` |
| 清理 | `retention_service` + `kuaivision_retention_tick` |
| 告警 | `ops_alert_service` + 模板 `VISION_AGENT_OPS_ALERT` |

## 踩坑

- 步骤方案 `require_model=true` 时未绑模型禁止发布
- 导出包为 JSON（object_key + label），训练在仓外
- 改 manifest 后须 sync 并勾选 sample/model 权限

## 关联

- `docs/apps/kuaivision/ROADMAP.md`
- `docs/apps/kuaivision/现场联调手册.md`
- `features/kuaivision-p2-edge.md`
