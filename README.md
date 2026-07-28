# <img src="docs/screenshots/logo/kuaige.png" alt="Logo" height="36" align="absmiddle" /> 快格云制造

> **开源范围**：本仓库公开 **后端 API** 与 **PC Web 前端**（`riveredge-backend` + `riveredge-frontend`）。移动端 App、H5、企微/钉钉/飞书接入、触屏工位终端等源码在私仓维护。

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
- **更稳交付**：需求贯通计划、工单、采购与出入库，减少断点与交期偏差
- **更控质量**：来料到出货检验与追溯闭环，异常可定位、可复盘

---

## 立即体验与接入

> [!WARNING]
> 快格云制造仍在**积极开发中**，功能、数据模型与界面可能频繁变更；在线演示与本地部署**仅供预览与评估**，请勿用于正式生产或承载真实业务数据。

- **在线演示**：[https://kuaigeyun.com](https://kuaigeyun.com)（支持免注册体验，数据可能定期重置）
- **部署入口**：[fast-deploy/deploy.sh](fast-deploy/README.md)（Windows / Linux）
- **完整文档**：[docs/部署指南.md](docs/部署指南.md)

> [!CAUTION]
> **建议在独立空白服务器或虚拟机环境中进行安装与验证**，避免与既有业务系统产生端口、数据库或配置冲突。**不建议**在已承载生产业务的服务器上直接试装或试升级。
>
> 若因业务需要必须在生产服务器上部署或升级，**须事先完成完整备份**；**未备份即执行上述操作，可能导致数据不可恢复。**

### 微信沟通反馈群

<img src="docs/screenshots/wechat/wechat.png" alt="快格云 MES 交流群" width="280" />

扫码加入 **快格云 MES 交流群**，反馈问题与建议。

> [!IMPORTANT]
> **甄别声明**：网络上个别第三方渠道出现的 MES 收费推广或所谓「官方授权版」，**非快格云官方提供**，与本项目（快格云制造）无关联。请用户注意甄别，勿向非官方渠道付费购买。

---

## 为什么选择快格云制造

- **统一业务主线**：销售预测/销售订单统一进入 `Demand`，贯通需求计算、工单/采购、执行与出入库。
- **可渐进上线**：插件化应用按需启用，支持从最小可用到全流程协同的分阶段实施。
- **低运维负担**：默认 PostgreSQL + Taskiq，无 Redis 依赖；部署路径标准化。
- **高配置灵活性**：流程开关、自定义字段、打印与报表能力内建，适配多工厂差异流程。
- **可追溯与可审计**：从需求到执行全链路留痕，便于交付核对、异常定位与持续改进。

---

## 核心能力

### 业务域能力

覆盖 **快制造** 全流程，并与 **主数据**、**快财务**、**快研发** 插件协同（销售/采购/仓储能力已统一在快制造内，不再单独拆「进销存」「快车间」）。

| 业务域 | 关键能力 |
| --- | --- |
| 销售与 CRM | 客户池、报价/跟进/合同、销售预测、订单与变更、发货通知/退货、销售域看板与报表 |
| 计划与排程 | Demand 统一建模、需求计算（BOM/净需求）、需求变更、排程/滚动排程、甘特与缺料预警 |
| 采购协同 | 采购申请/询价、订单与变更、到货通知/退货、采购看板与执行报表 |
| 生产执行 | 工单、报工、返工、委外、装箱绑定、异常闭环；工位终端（Windows 触屏/移动车间） |
| 质量与追溯 | 来料/过程/成品/OQC、检验方案、8D、SPC、不合格台账、全链路追溯 |
| 仓储物流 | 入出库 Hub、批次/序列号、盘点/调拨、组装拆卸、线边仓/倒冲、条码映射、库存预警 |
| 设备与资材 | 设备点检/巡检/故障/维修/保养；模具/工装借还、维保、校准与备件 |
| 绩效与财务 | 班次排班、工作日历、技能/计件/KPI 汇总；应收应付、发票、对账与成本核算（快财务） |
| 主档与研发 | 工厂/物料/BOM/工艺/图纸/SOP、客户供应商价目；研发项目/NPI 阶段门/变更/FMEA（主数据/快研发） |

### 平台能力

**开源版（本仓库）**

- 多租户 SaaS、RBAC 权限、字段掩码与数据范围
- 插件化应用装配、配置中心、流程开关与单据动作策略
- 审批流、消息模板/提醒规则、编码规则与自定义字段
- 打印模板/打印设备、数据集与 API/应用连接集成
- 各业务域内置看板与报表、上线向导/启动检查、操作与登录审计
- 扫码与二维码（PC/移动 H5/工位终端，终端源码在私仓）

**高级版（私仓 kuaigeyun-pro，可选安装）**

- **快报表**：报表设计器、BI 看板、多源聚合分析
- **KU-AI**：顶栏智能助手、知识库 RAG、业务单据问答
- **快数采**：工业设备数采与集成（持续迭代）

---

## 插件应用矩阵

插件按需装配；**开源版**随本仓库发布，**高级版**在私仓 [`kuaigeyun-pro`](https://gitee.com/kuaigeyun/kuaigeyun-pro) 维护，经 `./fast-deploy/deploy.sh pro-apps` 或部署向导 **[4] 扩展应用** 安装。原「快车间」「进销存」拆分应用已并入 **快制造**，不再单独发布。

### 开源版（本仓库）

| 插件 | 定位 | 主要范围 |
| --- | --- | --- |
| **快制造** | 全流程制造 MES | 销售、计划、采购、执行、质量、设备、仓储、分析、绩效 |
| **主数据** | 主档中心 | 工厂建模、物料/BOM/工艺、客户/供应商 |
| **快财务** | 管理会计 | 应收应付、收付款、发票库、成本管理（不含总账） |
| **快研发** | 研发协同 | 研发项目 / NPI 阶段门、设计变更、知识中心 |

### 高级版（私仓 kuaigeyun-pro）

| 插件 | 定位 | 主要范围 |
| --- | --- | --- |
| **KU-AI** | 业务 AI 助手 | 顶栏智能问答、单据查询、知识库 RAG |
| **快报表** | 经营分析 | 报表设计、BI 看板、多源聚合 |
| **快数采** | 工业物联网 | 设备数采与集成（持续迭代中） |

---

## 技术架构

| 终端 | 技术栈 | 源码 |
| --- | --- | --- |
| **PC Web** | React 18 + TypeScript 5 + Vite 5 + Ant Design 6 / Pro Components | 本仓库 `riveredge-frontend`（**开源**） |
| **后端 API** | FastAPI 0.115 + Pydantic 2 + Tortoise ORM + PostgreSQL 15 + Taskiq | 本仓库 `riveredge-backend`（**开源**） |
| **移动端 App** | Expo 54 + React Native 0.81 + Expo Router 6 + Ant Design RN 5；Android APK / iOS | 私仓 `kuaigeyun-client`（`riveredge-app-mobile`） |
| **H5** | 与 App **同一套** Expo 源码，`expo export -p web` → `/mobile`；Caddy 托管 | 私仓（构建产物可随部署分发） |
| **企业微信 / 钉钉 / 飞书** | H5 内嵌工作台；企微 OAuth 登录；各平台 JS-SDK 调原生扫码 | 私仓 `mobile` 平台层（`hostScan` / `wecomAuth`） |
| **微信小程序** | 原生壳 `web-view` 打开 H5；扫码经小程序页桥接回 H5 | 私仓 `mini-program`（可选，业务仍走 H5） |
| **触屏工位机** | Windows + Electron 33 + Vite 5 + React 18 + Ant Design 6；复用 PC 前端业务模块 | 私仓 `riveredge-app-station` |

部署与平台：多租户 SaaS、插件化应用、Caddy 反向代理（Web `/`、H5 `/mobile`、API `/api`）。

- H5 与企微配置：见 [docs/部署指南.md](docs/部署指南.md)（扩展应用 / `install-h5`）；详细 H5 说明在私仓 `mobile/docs/H5.md`
- 第三方资源与许可：见 [NOTICE](NOTICE) 与系统内“关于 → 版权声明”

---

## 快速开始

环境要求：Node.js 22+、Python 3.12+（运行时由 uv 锁定 3.11）、PostgreSQL 15+、Caddy（生产）；默认无需 Redis。

```bash
git clone https://gitee.com/kuaigeyun/kuaigeyun.git
cd kuaigeyun

./fast-deploy/deploy.sh       # 生产模式（8 阶段向导）
./fast-deploy/deploy.sh dev   # 开发模式（Vite 热重载）
```

| 模式 | Web | API |
| --- | --- | --- |
| 生产 | `http://<服务器IP>:8080` | `/api`（经 Caddy 转发） |
| 开发 | `http://<服务器IP>:8100` | `http://<服务器IP>:8200` |

- 部署文档：[docs/部署指南.md](docs/部署指南.md)（含**开发预览**与**备份**警告）
- 脚本速查：[fast-deploy/README.md](fast-deploy/README.md)

---

## 文档导航

- [README](README.md)：产品定位、能力边界、快速启动
- [docs/部署指南.md](docs/部署指南.md)：环境准备、发布流程、运维排查
- [fast-deploy/README.md](fast-deploy/README.md)：部署脚本参数与速查

---

## 联系方式

- 官网：[https://kuaigeyun.com](https://kuaigeyun.com)
- 反馈：Issue 或内部渠道
- 邮箱：[ludingjie@live.cn](mailto:ludingjie@live.cn)
- 微信：`lu_dingjie`

---

## 许可证

见 [LICENSE](LICENSE)。
