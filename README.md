# RiverEdge SaaS 多租户框架

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.11+-green.svg)](https://www.python.org/)
[![Node.js](https://img.shields.io/badge/node.js-22.0+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-18.3.1-blue.svg)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/fastapi-0.115+-green.svg)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-15+-blue.svg)](https://www.postgresql.org/)

**RiverEdge** 是一个基于多租户 SaaS 架构的企业级应用框架，采用前后端分离设计，支持动态应用管理和插件化扩展。当前重点聚焦**快智造（kuaizhizao）**轻量级MES系统和**主数据管理（master_data）**应用，专为中小型制造业企业数字化转型设计。

> 💡 **版本说明**
> - **当前版本**: MVP版本，聚焦核心功能，快速上线
> - **完整版规划**: 后期将推出完整版功能APP，包含更多高级功能（高级排产、质量管理、财务协同等）
> - **性能优化**: 后期将推出基于 Rust + Axum 框架的高性能版本，满足超大规模企业需求

## 🎯 核心功能

### 🏭 快智造（kuaizhizao）- 轻量级MES系统

**定位：** 超轻量MES系统，面向中小型制造业企业，易实施、快速上线

> ⚠️ **版本说明**
> - **当前版本**: MVP版本，包含核心MES功能（工单、报工、仓储、看板）
> - **完整版规划**: 后期将推出完整版功能APP，包含高级排产、质量管理、财务协同等完整功能模块
> - **适用场景**: MVP版本适合中小型制造业企业快速上线，完整版适合中大型企业复杂业务场景

#### 📋 MVP阶段核心功能（当前开发中）

**生产执行（MES核心）**
- ✅ **工单管理**: 工单创建、下达、执行、完工，支持MTS/MTO模式
- ✅ **报工管理**: 扫码报工、进度汇报、工时记录（移动端优化）
- ✅ **仓储操作**: 生产领料、成品入库、库存查询
- ✅ **生产看板**: 实时监控工单进度、状态统计（WebSocket实时推送）

**计划管理（第一阶段扩展）**
- ⏳ **需求管理**: 销售预测（MTS模式）、销售订单（MTO模式）
- ⏳ **计划排程**: MRP运算（MTS）、LRP运算（MTO）
- ⏳ **高级排产**: 可视化排产甘特图（拖拽调整）

**质量管理（第二阶段扩展）**
- ⏳ **来料检验**: 采购到货物料检验
- ⏳ **过程检验**: 生产报工环节关键工序检验
- ⏳ **成品检验**: 生产完工成品最终检验

**财务协同（第二阶段扩展）**
- ⏳ **应付管理**: 采购入库后自动生成应付单
- ⏳ **应收管理**: 销售出库后自动生成应收单

#### 📱 移动端支持
- ✅ **扫码报工**: 支持二维码、条形码扫码（移动端优化）
- ✅ **语音输入**: 报工备注支持语音输入
- ✅ **离线功能**: 网络不稳定场景支持离线报工

### 📦 主数据管理（master_data）- 基础数据管理

**定位：** 统一管理所有基础数据，为快智造等业务应用提供数据支撑

#### 📋 核心功能

**工厂建模**
- ✅ **车间管理**: 车间创建、查询、管理
- ✅ **工作中心管理**: 工作中心创建、查询、管理
- ✅ **产线管理**: 产线创建、查询、管理

**产品与工艺**
- ✅ **物料主数据**: 物料创建、查询、管理（支持Excel批量导入）
- ✅ **BOM管理**: BOM创建、多层级展开、扁平化查询（支持10层+ BOM）
- ✅ **物料变体管理**: 颜色、尺寸、规格等变体属性管理
- ✅ **物料批次号管理**: 批次号自动生成、正向/反向追溯、有效期管理

**仓库管理**
- ✅ **仓库设置**: 仓库、库区、库位管理
- ✅ **库存查询**: 实时库存查询（支持拼音搜索）

**供应链主数据**
- ✅ **供应商管理**: 供应商创建、查询、管理
- ✅ **客户管理**: 客户创建、查询、管理

**API优化**
- ✅ **批量查询接口**: 根据UUID列表批量获取数据
- ✅ **简化查询接口**: 只返回必要字段，支持拼音搜索
- ✅ **数据验证接口**: 数据完整性验证、存在性验证

### 🛠️ 技术架构

**后端技术栈（当前版本）**
- ✅ **框架**: FastAPI + Tortoise ORM + PostgreSQL
- ✅ **任务调度**: Inngest 工作流引擎（异步任务、定时任务、事件驱动）
- ✅ **缓存**: Redis 6.x+ 缓存提升性能
- ✅ **包管理**: UV（Python包管理器）
- ✅ **代码质量**: Ruff（代码检查）、Black（格式化）、MyPy（类型检查）

> 🚀 **性能优化规划**
> - **当前版本**: Python + FastAPI，适合中小型企业和快速开发
> - **高性能版本**: 后期将推出基于 **Rust + Axum** 框架的高性能版本
> - **性能提升**: Rust版本预计性能提升3-5倍，支持超大规模企业（10万+用户、百万级数据）
> - **迁移策略**: 提供平滑迁移方案，确保现有数据和应用无缝迁移

**前端技术栈**
- ✅ **框架**: React 18 + TypeScript + Vite
- ✅ **UI组件**: Ant Design + Pro Components
- ✅ **状态管理**: Zustand + React Query
- ✅ **路由**: React Router DOM
- ✅ **国际化**: i18next（中英文双语支持）

**架构特性**
- ✅ **多租户数据隔离**: 每个组织的数据完全隔离
- ✅ **动态应用管理**: 支持应用动态注册、路由管理、菜单配置
- ✅ **服务接口层**: 依赖注入、服务注册表、接口抽象
- ✅ **插件化扩展**: 易于添加新的业务模块

### 🏢 系统级功能

**平台级（infra/）**
- ✅ **租户管理**: 组织创建、激活、停用
- ✅ **套餐管理**: 套餐配置、权限分配
- ✅ **认证服务**: 用户登录、注册、体验登录
- ✅ **平台超级管理员**: 平台级管理员管理

**系统级（core/）**
- ✅ **用户管理**: 用户创建、查询、权限分配
- ✅ **角色权限**: 基于角色的访问控制（RBAC）
- ✅ **部门管理**: 部门树形结构管理
- ✅ **菜单管理**: 动态菜单配置
- ✅ **编码规则**: 自定义编码规则（支持中文前缀）
- ✅ **文件管理**: 文件上传、下载、预览
- ✅ **消息系统**: 站内消息、消息模板
- ✅ **审批流程**: 可视化流程设计器

## 🚀 快速开始

### 📋 系统要求

- **Python**: 3.11+
- **Node.js**: 22.0+
- **PostgreSQL**: 15+
- **Redis**: 6.2.6+ (推荐 6.x 版本，BSD 3-Clause 许可证，完全免费商业使用)
- **操作系统**: Windows 10+ / macOS / Linux

### ⚡ 一键启动

```bash
# 克隆项目
git clone https://gitee.com/riveredge/riveredge.git
cd riveredge

# 一键启动所有服务（推荐）
./Launch.sh

# 或分别启动
./Launch.sh backend  # 启动后端服务
./Launch.sh frontend # 启动前端服务
./Launch.sh inngest  # 启动任务调度服务
```

启动成功后，访问：
- **前端应用**: http://localhost:8100
- **后端API**: http://localhost:8200
- **API文档**: http://localhost:8200/docs
- **Inngest控制台**: http://localhost:${INNGEST_PORT:-8300}（端口通过环境变量INNGEST_PORT配置，默认8300避免Windows端口保留问题）

### 🛠️ 手动安装

#### 后端环境配置

```bash
cd riveredge-backend

# 使用 UV 管理依赖（推荐）
uv sync

# 或使用 pip
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件配置数据库等信息

# 数据库迁移
aerich upgrade

# 启动后端服务
./start-backend.sh
```

#### 前端环境配置

```bash
cd riveredge-frontend

# 安装依赖
npm install

# 启动开发服务器
./start-frontend.sh
```

#### 任务调度服务

```bash
# 启动 Inngest 服务
cd bin
./inngest.exe dev --config inngest.config.json
```

## 📚 项目结构

```
riveredge/
├── riveredge-backend/          # 后端服务 (FastAPI)
│   ├── src/
│   │   ├── apps/               # 业务应用模块
│   │   │   ├── master_data/    # 主数据管理（基础数据）
│   │   │   │   ├── api/        # API路由
│   │   │   │   ├── models/     # 数据模型
│   │   │   │   ├── services/   # 业务服务
│   │   │   │   └── schemas/    # 数据验证
│   │   │   └── kuaizhizao/     # 快智造（MES核心，开发中）
│   │   ├── core/               # 系统级核心功能
│   │   │   ├── api/            # 系统级API路由
│   │   │   ├── models/         # 系统级数据模型
│   │   │   ├── services/       # 系统级业务服务
│   │   │   ├── schemas/        # 系统级数据验证
│   │   │   └── utils/          # 工具函数（搜索、编码等）
│   │   ├── infra/              # 平台级基础设施
│   │   │   ├── api/            # 平台级API路由
│   │   │   ├── models/         # 平台级数据模型
│   │   │   ├── services/       # 平台级服务
│   │   │   └── config/         # 配置管理
│   │   └── server/             # 服务器配置
│   │       └── main.py         # FastAPI应用入口
│   ├── migrations/             # 数据库迁移
│   └── pyproject.toml          # 项目配置
│
├── riveredge-frontend/         # 前端应用 (React)
│   ├── src/
│   │   ├── apps/               # 业务应用页面
│   │   │   ├── master-data/    # 主数据管理页面
│   │   │   └── kuaizhizao/     # 快智造页面（开发中）
│   │   ├── pages/              # 系统级页面
│   │   │   ├── system/         # 系统管理页面
│   │   │   └── personal/       # 个人中心页面
│   │   ├── components/         # 通用组件
│   │   │   ├── uni-table/      # 统一表格组件
│   │   │   ├── uni-import/     # Excel导入组件
│   │   │   └── riveredge-query/# 高级搜索组件
│   │   ├── services/           # API服务
│   │   ├── layouts/            # 页面布局
│   │   └── utils/              # 工具函数
│   └── package.json            # 项目配置
│
├── bin/                        # 第三方工具
│   ├── inngest.exe             # Inngest 可执行文件
│   └── inngest.config.json     # Inngest 配置
│
├── docs/                       # 项目文档
│   ├── 1.stack/                # 技术栈说明
│   ├── 2.rules/                # 开发规范
│   ├── 3.build/                # 构建计划
│   │   └── 4.sys-app dev/      # 系统级/应用级协同开发计划
│   └── 4.optimise/             # 优化文档
│
├── archive/                    # 归档文件
│   ├── apps/                   # 归档的应用代码
│   └── scripts/                # 归档的脚本
│
└── Launch.sh                   # 一键启动脚本
```

## 🔧 配置说明

### 数据库配置

编辑 `riveredge-backend/.env` 文件：

```bash
# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=riveredge

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT 配置
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Inngest 配置（可通过环境变量覆盖）
INNGEST_HOST=127.0.0.1
INNGEST_PORT=8300  # Inngest服务端口（可通过环境变量INNGEST_PORT覆盖，默认8300避免Windows端口保留问题）
```

### 前端配置

编辑 `riveredge-frontend/.env` 文件：

```bash
# API 基础地址
VITE_API_BASE_URL=http://localhost:8200

# 后端服务地址
VITE_BACKEND_HOST=127.0.0.1
VITE_BACKEND_PORT=8200

# Inngest 服务地址（可通过环境变量覆盖）
VITE_INNGEST_HOST=127.0.0.1
VITE_INNGEST_PORT=8300  # Inngest服务端口（可通过环境变量VITE_INNGEST_PORT覆盖，默认8300避免Windows端口保留问题）
```

## 🎨 核心功能特性

### 🔐 安全特性
- ✅ **JWT 身份认证**: 安全的 Token 认证机制
- ✅ **多租户数据隔离**: 数据级别的租户隔离
- ✅ **权限控制**: 基于角色的访问控制（RBAC）
- ✅ **审计日志**: 完整的操作审计记录

### 🎯 用户体验优化（符合中国制造业实情）

**搜索体验**
- ✅ **拼音搜索**: 所有搜索框支持拼音搜索（首字母、全拼）
- ✅ **高级搜索**: 多字段组合搜索、快速筛选、条件保存
- ✅ **快速筛选**: 常用筛选条件快速选择

**导入导出体验**
- ✅ **Excel导入**: 使用Univer Sheet进行Excel数据导入（支持预览、编辑、验证）
- ✅ **Excel导出**: 支持大数据量导出（10万+记录）、格式自定义、中文支持
- ✅ **模板下载**: 支持Excel模板下载

**移动端体验**
- ✅ **响应式设计**: 报工界面移动端优化（大按钮、扫码、语音输入）
- ✅ **离线功能**: 网络不稳定场景支持离线报工
- ✅ **扫码功能**: 支持二维码、条形码扫码（工单、物料）

**实时数据体验**
- ✅ **WebSocket推送**: 生产看板、设备看板实时更新（延迟<100ms）
- ✅ **断线重连**: 网络不稳定场景自动重连
- ✅ **数据更新提示**: Toast提示、平滑动画

**打印体验**
- ✅ **打印模板**: 支持打印模板自定义、预览、格式调整
- ✅ **批量打印**: 支持批量打印功能

### 📊 数据管理

**大数据量支持**
- ✅ **高效查询**: 支持10万+记录查询（<2秒）
- ✅ **BOM展开**: 支持10层+ BOM展开（<2秒）
- ✅ **MRP运算**: 支持1000+物料MRP运算（<30秒）
- ✅ **游标分页**: 支持大数据量分页查询

> 🚀 **性能优化规划**
> - **当前版本**: Python + FastAPI，已优化支持10万+记录查询
> - **高性能版本**: 后期Rust + Axum版本将支持百万级数据查询（<1秒）
> - **适用场景**: 当前版本适合中小型企业，Rust版本适合超大规模企业

**数据实时性**
- ✅ **实时更新**: 生产数据、库存数据、看板数据实时更新（WebSocket）
- ✅ **缓存优化**: Redis缓存提升查询性能（命中率>80%）

**数据格式优化（符合中国制造业习惯）**
- ✅ **日期格式**: 支持多种日期格式（默认中文格式）
- ✅ **数字格式**: 支持千分位分隔符、小数位控制
- ✅ **编码格式**: 支持中文前缀（工单-、采购-等）、日期+序号格式

### 🔄 Inngest工作流引擎

**工作流类型**
- ✅ **异步任务**: MRP/LRP运算、报表生成、数据导入（大数据量处理）
- ✅ **定时任务**: 看板数据更新、库存盘点、报表调度
- ✅ **事件驱动**: 工单状态流转、库存更新、报工数据处理（实时响应）

**工作流特性**
- ✅ **幂等性**: 支持重复执行
- ✅ **可重试**: 失败后自动重试（最多3次）
- ✅ **可监控**: 执行状态可监控
- ✅ **租户隔离**: 支持多租户隔离

## 🧪 测试

```bash
# 后端测试
cd riveredge-backend
uv run pytest

# 前端测试
cd riveredge-frontend
npm run test
```

## 📖 API 文档

启动服务后，访问以下地址查看 API 文档：

- **Swagger UI**: http://localhost:8200/docs
- **ReDoc**: http://localhost:8200/redoc
- **OpenAPI Schema**: http://localhost:8200/openapi.json

## 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

### 开发规范

- 📝 **代码规范**: 遵循 [PEP 8](https://pep8.org/) (Python) 和 [ESLint](https://eslint.org/) (JavaScript)
- 🔄 **Git 工作流**: 采用 [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/)
- 📚 **文档**: 所有功能必须有完整的文档
- 🧪 **测试**: 核心功能必须有单元测试

## 🗺️ 版本规划

### 📋 功能版本规划

**MVP版本（当前）**
- ✅ 核心MES功能：工单管理、报工管理、仓储操作、生产看板
- ✅ 基础数据管理：工厂建模、物料管理、BOM管理、仓库管理
- ✅ 适用场景：中小型制造业企业（<500人，<10万条记录）

**完整版功能APP（规划中）**
- ⏳ 高级排产：可视化排产甘特图、智能排程算法
- ⏳ 质量管理：来料检验、过程检验、成品检验、质量追溯
- ⏳ 财务协同：应付管理、应收管理、成本核算
- ⏳ 设备管理：设备监控、维护计划、故障管理
- ⏳ 适用场景：中大型制造业企业（500-5000人，10万-100万条记录）

### 🚀 性能版本规划

**当前版本（Python + FastAPI）**
- ✅ 开发效率高，快速迭代
- ✅ 支持10万+记录查询（<2秒）
- ✅ 支持1000+物料MRP运算（<30秒）
- ✅ 适合中小型企业和快速开发

**高性能版本（Rust + Axum，规划中）**
- ⏳ 性能提升3-5倍
- ⏳ 支持百万级数据查询（<1秒）
- ⏳ 支持万级物料MRP运算（<10秒）
- ⏳ 支持10万+并发用户
- ⏳ 适合超大规模企业（5000+人，百万级数据）
- ⏳ 提供平滑迁移方案，确保数据和应用无缝迁移

### 📅 时间规划

- **MVP版本**: 2025年12月 - 2026年6月（当前开发中）
- **完整版功能APP**: 2026年7月 - 2026年12月（规划中）
- **Rust高性能版本**: 2027年（规划中）

## 📄 许可证

本项目采用 **Apache License 2.0** 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

感谢以下开源项目为 RiverEdge 提供支持：

- [FastAPI](https://fastapi.tiangolo.com/) - 高性能 Web 框架
- [React](https://reactjs.org/) - 前端框架
- [Ant Design](https://ant.design/) - UI 组件库
- [Inngest](https://inngest.com/) - 任务调度系统
- [PostgreSQL](https://www.postgresql.org/) - 数据库
- [Redis](https://redis.io/) - 缓存数据库



---

<div align="center">

**RiverEdge SaaS 多租户框架** © 2025. 由 [无锡快格信息技术有限公司](https://www.kuaige.com.cn) 开发并维护。

</div>
