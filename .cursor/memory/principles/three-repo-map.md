---
title: 三仓职责与跨端功能落点
slug: three-repo-map
status: active
domain: principle
when: 跨 PC/移动/工位/Pro 包改功能、分不清真源在哪仓、要补跨端对照
keywords:
  - kuaigeyun-client
  - kuaigeyun-pro
  - 三仓
  - 跨端
  - Junction
  - X-Client-Channel
  - riveredge-app
standard: 主仓记跨端总表；client/pro 薄入口指路；AOCI 分仓不合并
---

# 三仓职责与跨端功能落点

- 写入：2026-10-07
- Vault 图谱：`E:\AI-Memory\30-Knowledge\MES-Codebase\architecture-map.md`
- AOCI：三仓各自索引，互不合并；正式资产按 `principles/aoci-git-commit.md` 提交
- AOCI MCP：单进程只能绑一个 `--repo`，本机须挂三个服务——`aoci`（主仓）、`aoci-client`、`aoci-pro`；配置见用户级 `~/.cursor/mcp.json` 与各仓 `.cursor/mcp.json`（均 gitignore）

## 三仓职责

| 仓库 | 路径 | 职责 |
|------|------|------|
| 主仓 | `D:\kuaigeyun-pro\kuaigeyun` | FastAPI + PC Web；平台契约与跨端记忆枢纽（本目录） |
| 终端私仓 | `D:\kuaigeyun-pro\kuaigeyun-client` | Mobile / Station / TV / 小程序真源 |
| Pro 私仓 | `f:/dev/kuaigeyun-pro`（或 `D:\kuaigeyun-pro\kuaigeyun-pro`） | kuaipd/kuaiplm/kuaicaiwu/kuaioa、kuaiai/kuaiiot/kuaireport、kuaiconnect、全部行业 `ind-*` 与 spoke-wheel |

### 真源与组装

- 终端：主仓 `riveredge-app/{mobile,station,tv,mini-program}` 为 Junction → client；见 `features/riveredge-app-client-junctions.md`
- Pro 包：真源在 `kuaigeyun-pro/{backend,frontend}/apps/<app>/`；组装进主仓 `riveredge-*/src/apps/<app>` 时被主仓 gitignore，改完必须回写 Pro
- 禁止：在主仓再拷一份终端或 Pro 源码当第二真源

### 记忆怎么读

1. 跨端 / 分仓不清 → **本篇**
2. 调用链与 D/E 边界 → Vault `architecture-map.md` + `principles/mes-vault-index.md`
3. 单功能标准入口 → 主仓 `features/<slug>.md`（下表「记忆」列）
4. client/pro 本仓独有坑 → 各仓 `.cursor/memory/`（薄入口，不复制主仓 features）

## 功能落点表（首批）

路径以 D 工作区为准。未核到的格填 `-`。交付触及多端时更新对应行或新开 feature 并链回本表。

| 功能 | 主仓（API / PC） | client | pro | 渠道 / 权限要点 | 记忆 |
|------|------------------|--------|-----|-----------------|------|
| 点检/保养方案绑定执行 | BE：`EquipmentSchemeBinding`、点检计划生成、保养计划 `maintenance_scheme_id`；PC 计划页 | mobile：`spot-check-conduct` / `maintenance-execution-conduct`；station：`EquipmentStatusPanel` + 点检/保养 Modal | - | `equipment-spot-check:create` / `maintenance-plan` 执行；渠道 pc/mobile/station | `features/equip-ops-scheme-bind-clients.md` |
| 工位 ST2 安全与报工 | BE：`/apps/kuaizhizao/station/...`；头 `X-Station-Operator`；交班摘要见 `features/station-shift-handover-summary.md` | `riveredge-app-station/`（IPC `station:apiFetch`、FaceEngine、SharedReport）；齐套缺料预警见 `features/station-shortage-andon-call.md` | - | 渠道 `station`；文档/打印走工位鉴权路径；报工 `device_info.workstation_id` | `features/station-st2-security-contract.md` |
| 移动端 S2 门禁 | BE 对照：报工 `:assign`、仓储 `.../confirm`（勿在移动端另写闸门语义） | `riveredge-app-mobile/`（`useResourcePermissions`、`tokenRefresh`、mes/report） | - | 渠道 `android`/`ios`/`mobile_h5`/`miniprogram` | `features/mobile-v2-s2-contract-fixes.md` |
| API 写防护 / 渠道头 | `interactive_client_guard`、`client_channel.py`；手册 `riveredge-backend/docs/api-write-protection-ops.md` | 各端写请求带 `X-Client-Channel` | 经主仓 API，同白名单 | `pc\|station\|android\|ios\|mobile_h5\|miniprogram\|integration` | `principles/api-write-protection.md` |
| 快数采 kuaiiot | 组装态 `riveredge-*/src/apps/kuaiiot/`（gitignore）；单测可在主仓 `tests/apps/kuaiiot/`；实时桥在主仓 `core/services/realtime/` | - | `{backend,frontend}/apps/kuaiiot/` 真源 | 权限见前后端 `manifest.json`；MES 写回走 MesGuard；设备态实时见下 | `features/kuaiiot-phased-hardening.md`、`features/kuaiiot-device-status-realtime.md` |
| 产线 MQTT 清零 | BE：`LineClearService` + `ind_relay` 自动报工钩子；迁移 `855_..._auto_clear`；PC 自动报工页 | - | kuaiiot 接入配置方向 + 设备指令下发清零 UI | `kuaiiot:device:update` / `ind-relay:auto-report:update`；发送型 MQTT publish | `features/iot-line-clear-mqtt.md` |
| 主仓↔client 组装 | `riveredge-app/`（gitignore）+ Junction | `riveredge-app-{mobile,station,tv,mini-program}/`（四端源码默认一并入库，见 client `client-terminals-checkin.mdc`） | - | 部署 H5 见 fast-deploy | `features/riveredge-app-client-junctions.md` |
| 移动 H5 构建部署 | `fast-deploy/build.mobile.web.sh`、`deploy.sh install-h5` | 构建产物 `riveredge-app-mobile/web-dist`（默认不进主仓） | - | Caddy `/mobile` | `features/fast-deploy-scripts.md` |

## 交付时回写

- **多端改动**（例如改 API 且改移动/工位/Pro）：更新本表对应行，或新增/更新主仓 feature 并在本表加链
- **单端内部改动**：不必动本表
- 规则全文：`.cursor/rules/feature-delivery-checklist.mdc` 第 6 节

## 关联

- `principles/mes-vault-index.md`
- `principles/aoci-git-commit.md`
- `features/riveredge-app-client-junctions.md`
- client：`D:\kuaigeyun-pro\kuaigeyun-client\.cursor\memory\README.md`
- pro：`D:\kuaigeyun-pro\kuaigeyun-pro\.cursor\memory\README.md`
