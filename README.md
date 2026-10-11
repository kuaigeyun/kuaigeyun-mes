# <img src="docs/screenshots/logo/kuaige.png" alt="Logo" height="36" align="absmiddle" /> 快格云制造


![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite)
![Ant Design](https://img.shields.io/badge/Ant%20Design-6-0170FE?style=flat-square&logo=antdesign)
![Expo](https://img.shields.io/badge/Expo-54-000020?style=flat-square&logo=expo)
![Electron](https://img.shields.io/badge/Electron-33-47848F?style=flat-square&logo=electron)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python)
![Pydantic](https://img.shields.io/badge/Pydantic-2-E92063?style=flat-square&logo=pydantic)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?style=flat-square&logo=postgresql)

---

## 15 秒了解快格云制造

为离散制造企业打造的轻量级 MES：以统一需求模型贯通「销售-研发-计划-执行-质量-设备-仓储」，帮助企业在可控成本下快速上线并持续扩展。

**一句话价值**：用一套可渐进实施的制造系统，替代 Excel + 纸单 + 多系统割裂流程。

**适合谁**

- 10–200 人离散制造企业
- 多品种小批量，按单/按库混合生产
- 需要先跑通核心执行，再逐步扩展全流程协同

**你将获得**

- **更快上线**：插件按需启用，先跑通执行再扩展全流程，降低首期投入
- **更稳交付**：销售预测/订单进入统一需求，贯通计划、工单、采购与出入库，减少断点与交期偏差
- **更控质量**：来料到出货检验与追溯闭环，异常可定位、可复盘
- **更轻运维**：流程开关、自定义字段、打印与报表内建；默认 PostgreSQL + Taskiq，**无需 Redis**
- **更可追溯**：需求到执行全链路留痕，便于核对与复盘

---

## 立即体验与接入

- **在线演示**：[https://kuaigeyun.com](https://kuaigeyun.com)（建议使用 Gitee 快捷登录或自行注册；数据可能定期重置）
- **部署入口**：[fast-deploy/deploy.sh](fast-deploy/README.md)（Windows / Linux）
- **完整文档**：[docs/部署指南.md](docs/部署指南.md)

### 微信沟通反馈群

<img src="docs/screenshots/wechat/wechat.png" alt="快格云 MES 交流群" width="280" />

扫码加入 **快格云 MES 交流群**，反馈问题与建议。

### 支持我们

快格云制造持续开源迭代，离不开社区关注与支持。若项目对你有帮助，欢迎：

- 在 [Gitee](https://gitee.com/kuaigeyun/kuaigeyun) / [GitHub](https://github.com/kuaigeyun/kuaigeyun-mes) 给仓库点一颗 **Star**，方便更多制造同行发现
- 关注更新、提交 Issue / PR，一起把产品打磨得更好
- 有条件时通过捐赠支持持续维护

> 你的每一个 Star，都是我们继续更新的动力。

> **开源范围（本仓库）**：公开 **后端 API** 与 **PC Web 前端**（`riveredge-backend` + `riveredge-frontend`），随仓发布的应用以 **主数据、快制造、快质量、快设备** 等基础能力为主。
>
> **专业版应用**（快研发、快交付、轻办公、轻财务、快报表、快数采、快连接、KU-AI 及行业增值包）源码在私仓 [kuaigeyun-pro](https://gitee.com/kuaigeyun/kuaigeyun-pro)，经 [工作区组装](fast-deploy/tools/workspace/README.md) 或部署向导 **扩展应用** 链入本机，**不在**开源主仓内提交完整源码。
>
> **多端终端**（移动 App、H5、企微/钉钉/飞书、触屏工位、TV 看板）在私仓 [kuaigeyun-client](https://gitee.com/kuaigeyun/kuaigeyun-client)。**客户定制**页面在 [kuaigeyun-custom](https://gitee.com/kuaigeyun/kuaigeyun-custom)（可选组装）。

> [!WARNING]
> 产品仍在**积极开发**，功能与数据模型可能频繁变更；在线演示与本地部署**仅供预览评估**，勿用于正式生产或承载真实业务数据。
>
> **安装与升级**请在独立空白服务器或虚拟机中验证，避免与既有系统端口、数据库或配置冲突；**勿**在已承载生产业务的服务器上直接试装。若必须在生产环境部署，**须先完整备份**，否则可能导致数据不可恢复。

> [!CAUTION]
> **渠道甄别**：版权方**未**在小红书、闲鱼等第三方平台销售或授权所谓「官方版」。若出现以 **快格云 / RiverEdge 官方授权** 名义的 MES 收费推广，或暗示与本项目（快格云制造）有关，**均非版权方提供或背书**。
>
> 本仓库开源部分采用 Apache 2.0，他人在**保留版权与 LICENSE、不冒用商标**等前提下可合规再分发（含有偿服务），但这**不代表官方渠道**。付费前请核实销售主体、交付物与开源声明是否完整，谨防冒充官方或夸大私仓未开源能力。

---

## 核心能力

业务以 **快制造** 执行闭环为主，**主数据** 统一工厂与物料/BOM/工艺；与 **专业版** 插件（研发、交付、办公、财务、报表、数采、连接、AI）及 **行业包** 按需组合。


| 业务域     | 能力要点                                                  |
| ------- | ----------------------------------------------------- |
| 销售与 CRM | 客户池、报价/跟进/合同、预测、订单与变更、发货/退货、销售看板                      |
| 计划与排程   | 统一需求、需求计算（BOM/净需求）、变更、排程/甘特、缺料预警                      |
| 采购协同    | 申请/询价、订单与变更、到货/退货、采购执行与报表                             |
| 生产执行    | 工单、报工、返工、委外、装箱、异常闭环；工位/移动端执行（终端见私仓）                   |
| 质量与追溯   | 来料/过程/成品/OQC、检验方案、8D、SPC、不合格与全链路追溯                    |
| 仓储物流    | 入出库、批次/序列号、盘点/调拨、组装拆卸、线边仓/倒冲、库存预警                     |
| 设备与资材   | 点检/巡检/故障/维修/保养；模具工装借还、维保、校准与备件                        |
| 绩效      | 班次排班、工作日历、技能/计件/KPI                                   |
| 财务      | 开源仓含快制造侧 **财务管理** 菜单与页面；完整 **轻财务**（独立应用与后端 API）需组装专业版 |
| 主档与研发   | **主数据**（工厂/物料/BOM/工艺等）开源；NPI、设计变更、知识中心等 **快研发** 为专业版  |


**平台（本仓库开源）**：多租户与 RBAC、插件装配、配置中心、审批与消息、编码与自定义字段、打印、内置看板报表、上线检查与审计。

**专业版平台能力**（需 [kuaigeyun-pro](https://gitee.com/kuaigeyun/kuaigeyun-pro) 组装后启用）：**快连接**（连接器/接口/数据源/数据集）、**快报表** BI、**快数采**、**KU-AI** 等。未组装时在应用中心展示占位说明，不影响开源核心制造流程。

---

### 插件应用

应用中心按 **基础 / 专业 / 行业 / 定制** 分层展示。**已扫描入库** 的应用方可启用菜单；专业版与行业包源码在私仓，通过组装链入工作区。


| 分层         | 插件 / 包             | 源码位置             | 说明                                    |
| ---------- | ------------------ | ---------------- | ------------------------------------- |
| **基础（开源）** | 主数据                | 本仓库              | 工厂建模、物料/BOM/工艺、客户/供应商                 |
| **基础（开源）** | 快制造                | 本仓库              | 销售、计划、采购、执行、质量、设备、仓储、分析、绩效；含财务管理入口 UI |
| **基础（开源）** | 快质量 / 快设备          | 本仓库              | 质量、设备域菜单与导航（核心单据能力由快制造提供）             |
| **专业**     | 快研发、快交付、轻办公、轻财务    | kuaigeyun-pro    | 需 License；组装后完整菜单与 API                |
| **专业**     | 快报表、快数采、快连接、KU-AI  | kuaigeyun-pro    | 需 License；报表 BI、设备数采、集成连接、AI 助手       |
| **行业**     | 机械、注塑、电子、汽配、食品等增值包 | kuaigeyun-pro    | 需 License；原主仓行业免费包已并入专业行业目录           |
| **定制**     | 客户专属应用             | kuaigeyun-custom | 可选；按 `CUSTOM_PROJECTS` 仅组装声明项目        |


组装说明：[fast-deploy/tools/workspace/README.md](fast-deploy/tools/workspace/README.md)。生产环境亦可通过 `./fast-deploy/deploy.sh` 向导 **[4] 扩展应用** 配置私仓与 Token。

---

### 终端形态

同一套后端 API 与业务模型，按岗位与现场组合部署。本仓库开源 **PC Web + 后端**；其余终端源码在私仓 [kuaigeyun-client](https://gitee.com/kuaigeyun/kuaigeyun-client)。


| 终端               | 技术栈                                         | 源码      | 典型场景                      |
| ---------------- | ------------------------------------------- | ------- | ------------------------- |
| **PC Web**       | React 18 + TS + Vite 5 + Ant Design 6       | 本仓库（开源） | 计划、主数据、销售/采购/制造执行、审批、内置报表 |
| **后端 API**       | FastAPI + Tortoise + PostgreSQL 15 + Taskiq | 本仓库（开源） | 全终端共用业务与权限                |
| **移动 App**       | Expo 54 + React Native                      | 私仓      | 工业 PDA 扫码、移动报工、收发货、巡检     |
| **H5 / 小程序**     | 与 App 同仓导出；小程序为 web-view 壳                  | 私仓      | 轻量访问、iOS 过渡、外协/访客         |
| **企微 / 钉钉 / 飞书** | 办公平台内嵌 H5 + OAuth / JS-SDK                  | 私仓      | 待办审批、消息触达、移动审单与扫码         |
| **触屏工位**         | Windows Electron；可复用 PC 业务模块                | 私仓      | 固定工位过站、戴手套触屏、可选刷脸共享       |
| **TV 看板**        | Android TV + WebView                        | 私仓      | 车间大屏 KPI，开机直达、免登录         |


**选型建议**：办公室计划/物控 → PC；仓库 PDA / 无微信现场 → App；已用企微钉钉飞书 → 办公 H5；产线固定工序 → 触屏工位；班组巡视 → TV 看板。

部署默认 Caddy 反向代理（Web `/`、H5 `/mobile`、API `/api`）。H5 / 企微配置见 [docs/部署指南.md](docs/部署指南.md)；第三方许可见 [NOTICE](NOTICE)。

---

## 快速开始

环境要求：Node.js 22+、Python 3.12+（运行时由 uv 锁定 3.11）、PostgreSQL 15+、Caddy（生产）；默认无需 Redis。

```bash
# Gitee（国内推荐）
git clone https://gitee.com/kuaigeyun/kuaigeyun.git
# GitHub
git clone https://github.com/kuaigeyun/kuaigeyun-mes.git
cd kuaigeyun   # 或 kuaigeyun-mes，取决于 clone 目录名

./fast-deploy/deploy.sh       # 生产模式（8 阶段向导）
./fast-deploy/deploy.sh dev   # 开发模式（Vite 热重载）
```


| 模式  | Web                   | API                   |
| --- | --------------------- | --------------------- |
| 生产  | `http://<服务器IP>:8080` | `/api`（经 Caddy 转发）    |
| 开发  | `http://<服务器IP>:8100` | `http://<服务器IP>:8200` |


- 部署文档：[docs/部署指南.md](docs/部署指南.md)（含**开发预览**与**备份**警告）
- 脚本速查：[fast-deploy/README.md](fast-deploy/README.md)

### 本地启用专业版应用（可选）

仅克隆本仓库即可运行 **开源基础包**。若要调试快研发、轻财务、行业包等：

1. 将 [kuaigeyun-pro](https://gitee.com/kuaigeyun/kuaigeyun-pro) 克隆到与主仓**同级**目录（分支 `develop`）。
2. 复制并编辑 `fast-deploy/tools/workspace/workspace.example.yaml` → `workspace.yaml`。
3. 执行 `python fast-deploy/tools/workspace/compose.py`，重启后端与前端。

详见 [fast-deploy/tools/workspace/README.md](fast-deploy/tools/workspace/README.md)。开源 CI 会运行 `scan_pro_oss_layout.py`，确保专业应用源码不以普通目录形式提交进主仓。

---

### 推荐配置

单机部署（PostgreSQL 与后端、Taskiq、Caddy 同机）时的硬件参考；详细说明见 [docs/部署指南.md](docs/部署指南.md#硬件建议)。


| 档位       | 适用场景                 | CPU  | 内存    | 磁盘                       |
| -------- | -------------------- | ---- | ----- | ------------------------ |
| **最低配置** | 开发调试、POC 试用、≤10 并发用户 | 2 核+ | 4 GB+ | 20 GB+（系统 + 库 + 日志）      |
| **推荐配置** | 中小团队生产、日常业务与报表       | 4 核+ | 8 GB+ | 50 GB+ SSD（含数据库、附件与日志余量） |


**软件环境（与快速开始一致）**：Node.js 22+、Python 3.12+（运行时由 uv 锁定 3.11）、PostgreSQL 15+；生产模式需 Caddy。**不需要 Redis。**

> 内存 ≤2 GB 的云主机易在 Taskiq 启动阶段因 swap 变慢，部署脚本可自动创建 swap；更稳妥请按**推荐配置**或启用 [低配模式](fast-deploy/README.md) 说明。

---

## 文档导航

- [README](README.md)：产品定位、核心能力、插件与终端、快速启动、推荐配置
- [docs/部署指南.md](docs/部署指南.md)：环境准备、发布流程、运维排查
- [fast-deploy/README.md](fast-deploy/README.md)：部署脚本参数与速查
- [fast-deploy/tools/workspace/README.md](fast-deploy/tools/workspace/README.md)：专业版/定制应用组装

---

## 联系方式

- 官网：[https://kuaigeyun.com](https://kuaigeyun.com)
- 反馈：Issue 或内部渠道
- 邮箱：[ludingjie@live.cn](mailto:ludingjie@live.cn)
- 微信：`lu_dingjie`

---

## 捐赠鸣谢

感谢以下朋友对项目的支持（按捐赠时间先后排列）：


| 捐赠人     | 金额（元） |
| ------- | ----- |
| lvlijun | 500   |
| Mike猫空  | 66    |


如需出现在名单中，可通过微信 `lu_dingjie` 或邮箱 [ludingjie@live.cn](mailto:ludingjie@live.cn) 联系，并备注展示名称。名单将不定期更新。

---

## 许可证

见 [LICENSE](LICENSE)。