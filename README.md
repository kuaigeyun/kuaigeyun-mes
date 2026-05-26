# <img src="docs/screenshots/logo/kuaige.png" alt="Logo" height="36" align="absmiddle" /> 快格云制造

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite)
![Ant Design](https://img.shields.io/badge/Ant%20Design-6-0170FE?style=flat-square&logo=antdesign)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?style=flat-square&logo=postgresql)
![Pydantic](https://img.shields.io/badge/Pydantic-2-E92063?style=flat-square&logo=pydantic)
![UV](https://img.shields.io/badge/UV-1.x-FFD43B?style=flat-square)
![Tortoise ORM](https://img.shields.io/badge/Tortoise%20ORM-0.21-2E7D32?style=flat-square)
![Taskiq](https://img.shields.io/badge/Taskiq-PostgreSQL-6366F1?style=flat-square)

**移动端**：![Expo](https://img.shields.io/badge/Expo-54-000020?style=flat-square&logo=expo) ![React Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB?style=flat-square&logo=react) ![Ant Design RN](https://img.shields.io/badge/Ant%20Design%20RN-5-0170FE?style=flat-square&logo=antdesign) ![Expo Router](https://img.shields.io/badge/Expo%20Router-6-000020?style=flat-square)

面向离散制造场景的轻量级 MES。基于 RiverEdge 多租户 SaaS 内核，采用统一需求模型驱动计划与执行，支持 MTS / MTO 一体化运行。

---

## 价值主张

- **统一业务主线**：销售预测/销售订单统一进入 `Demand`，贯通需求计算、工单/采购、执行与出入库。
- **模块化上线**：插件化应用按需启用，支持从“最小可用”到“全流程协同”分阶段落地。
- **低运维复杂度**：默认 PostgreSQL + Taskiq，无 Redis 依赖；`fast-deploy` 支持 Windows / Linux 快速部署。
- **高适配性**：业务蓝图、流程开关、自定义字段、打印与报表设计能力内建，适配多工厂差异流程。

---

## 适用场景

- 10–200 人离散制造企业，多品种小批量，典型流程为按单/按库混合生产。
- 需要以系统替代 Excel 与纸单，优先建设工单、报工、领料、入库、追溯等核心执行闭环。
- 需要在不引入重型实施成本的前提下，逐步扩展到采购、质量、设备、绩效与经营分析。

---

## 核心能力

### 业务域能力

| 业务域 | 关键能力 |
| --- | --- |
| 销售与需求 | 报价、试样、销售预测、销售订单、需求统一建模 |
| 计划与排程 | 需求计算（BOM 展开/净需求）、生产计划、工单排程 |
| 采购与仓储 | 采购申请/订单/到货、入出库、盘点、调拨、批次与条码 |
| 生产执行 | 工单、报工、返工、委外、异常处理、工位终端 |
| 质量与追溯 | 来料/过程/成品检验、全链路追溯与影响分析 |
| 设备与绩效 | 设备/模具/工装台账、保养提醒、KPI 与绩效汇总 |

### 平台能力

- 多租户与 RBAC 权限体系
- 插件化应用装配与业务蓝图
- 流程开关、自定义字段、审批流
- 打印模板与 BI 大屏设计
- 外部数据/应用连接、定时任务消息
- 上线检查助手、二维码、甘特排程

---

## 插件应用矩阵

| 插件 | 定位 | 主要范围 |
| --- | --- | --- |
| **快制造** | 全流程制造 MES | 销售、计划、采购、执行、质量、设备、仓储、分析、绩效 |
| **快车间** | 车间执行版 | 计划、执行、质量、设备、仓储、绩效 |
| **进销存** | 供销存协同 | 销售、采购、仓储 |
| **快财务** | 管理会计 | 应收应付、收付款、发票库、成本管理（不含总账） |
| **主数据** | 主档中心 | 工厂建模、物料/BOM/工艺、客户/供应商 |
| **快报表** | 经营分析 | 报表设计、BI 看板、多源聚合 |

---

## 技术架构

| 层级 | 技术栈 |
| --- | --- |
| 前端 Web | React 18 + TypeScript + Vite + Ant Design Pro |
| 移动端 | Expo 54 + React Native 0.81 + Expo Router |
| 后端 | FastAPI + Tortoise ORM + PostgreSQL + Taskiq |
| 部署与架构 | 多租户 SaaS、插件化架构、Caddy 反向代理 |

- 3D 拓扑模型素材： [Kenney City Kit (Industrial)](https://kenney.nl/assets/city-kit-industrial)（CC0）
- 第三方资源与许可：见 [NOTICE](NOTICE) 与系统内“关于 → 版权声明”

---

## 演示环境

- 地址：<https://kuaigeyun.com>
- 体验：支持免注册体验，也可自行注册用户/租户
- 说明：演示环境持续迭代，功能与数据不作为生产承诺

---

## 微信沟通反馈群

<img src="docs/screenshots/wechat/wechat.png" alt="微信沟通反馈群" width="280" />

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

- 部署文档：[docs/部署指南.md](docs/部署指南.md)
- 脚本速查：[fast-deploy/README.md](fast-deploy/README.md)

---

## 文档导航

- [README](README.md)：产品定位、能力边界、快速启动
- [docs/部署指南.md](docs/部署指南.md)：环境准备、发布流程、运维排查
- [fast-deploy/README.md](fast-deploy/README.md)：部署脚本参数与速查

---

## 联系方式

- 官网：<https://kuaigeyun.com>
- 反馈：Issue 或内部渠道
- 邮箱：ludingjie@live.cn
- 微信：`lu_dingjie`

---

## 许可证

见 [LICENSE](LICENSE)。
