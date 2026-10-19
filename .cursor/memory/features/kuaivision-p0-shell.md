---
title: 快视觉 P0 壳与入站
slug: kuaivision-p0-shell
status: delivered
domain: kuaivision
when: 改快视觉应用、边缘入站、检测记录、视觉中心、Agent 节点
keywords:
  - kuaivision
  - 快视觉
  - VisionAgent
  - ingest
  - device_token
  - thickness_mm
standard: Pro 仓 kuaivision + compose；入站 POST /api/v1/apps/kuaivision/ingest/{device_token}
---

# 快视觉 P0 壳与入站

## 目标

专业 APP「快视觉」：边缘节点 Token 入站检测结果，PC 可看视觉中心 / 检测记录 / 节点台账。

## 何时读 / 禁止另起

- 何时读：扩展相机方案、复核、边缘 Agent、冒烟入站
- 禁止：把视觉塞进 kuaiiot；另起第二套 OCR/CV 平台；安灯/模具防错进本 app

## 标准入口

| 层 | 标准 |
|----|------|
| FE | `kuaigeyun-pro/frontend/apps/kuaivision` → compose → `riveredge-frontend/src/apps/kuaivision` |
| BE | `kuaigeyun-pro/backend/apps/kuaivision`；迁移 `891_..._kuaivision_p0_tables` |
| 权限 | `kuaivision:workspace|inspection|agent:*`（manifest） |
| 入站 | `POST /api/v1/apps/kuaivision/ingest/{device_token}`（写门禁豁免前缀） |

## 关键文件

| 角色 | 路径 |
|------|------|
| 路线图 | `docs/apps/kuaivision/ROADMAP.md` |
| 模型 | `backend/apps/kuaivision/models/vision.py` |
| 冒烟 | `riveredge-backend/scripts/kuaivision_smoke_e2e.py` |
| 目录 | `pro_app_catalog.py` / `proAppCatalog.ts` sort **322**（快数采之后） |

## 扩展点

1. P1（已交付）：相机、方案版本发布、复核队列、入站 published 开关 — 见迁移 `892`
2. P2：边缘 Recipe（激光厚度优先）
3. 测量名 `thickness_mm` 列表列由服务端从 measurements 投影

## 踩坑

- 入站路径对齐 kuaiiot：`/ingest/{token}`，勿挂在 `/agents/{token}/ingest`（与节点 CRUD 前缀冲突且难豁免）
- UniTable 行缓存只写 `onTableDataChange`
- 页面规范：ModuleCenterLayout / UniTable / FormModalTemplate / MasterDataDetailDrawer

## 关联

- `docs/apps/kuaivision/ROADMAP.md`
- `features/kuaiiot-phased-hardening.md`（边缘模式对照，不合并代码）
