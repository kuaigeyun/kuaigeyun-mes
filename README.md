# 快格云MES 制造执行系统

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.11+-green.svg)](https://www.python.org/)
[![Node.js](https://img.shields.io/badge/node.js-22.0+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-18.3.1-blue.svg)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/fastapi-0.115+-green.svg)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-15+-blue.svg)](https://www.postgresql.org/)

**快格云MES** 是一个功能完整的**制造执行系统**（Manufacturing Execution System），专为制造业数字化转型设计。基于现代化的技术栈（FastAPI + React + PostgreSQL），提供生产计划、工单管理、质量追溯、设备监控等核心功能，支持私有化部署和 SaaS 多租户模式。

## 🎯 核心功能

### 🏭 MES 制造执行系统（核心功能）

#### 📋 生产计划与排程
- ✅ **生产计划制定**: 支持多工厂、多产线的生产计划制定
- ✅ **动态排程**: 基于设备能力、物料库存的智能排程
- ✅ **资源分配**: 设备、人员、物料等资源的优化分配
- ✅ **计划调整**: 支持计划变更和紧急插单

#### 🎯 工单管理
- ✅ **工单下发**: 从生产计划自动生成工单
- ✅ **工单跟踪**: 完整的工单生命周期管理（待开工、进行中、完工、暂停等）
- ✅ **进度监控**: 实时跟踪工单执行进度
- ✅ **异常处理**: 工单异常记录和处理流程

#### 🔍 质量追溯
- ✅ **正向追溯**: 从原材料到成品的完整追溯链
- ✅ **反向追溯**: 从成品追溯到原材料批次
- ✅ **质量记录**: 检验数据、不合格品处理记录
- ✅ **批次管理**: 支持批次号、序列号管理

#### 📊 生产看板
- ✅ **实时监控**: 生产进度、设备状态、质量指标实时展示
- ✅ **数据可视化**: 产量统计、效率分析、质量趋势图表
- ✅ **多维度展示**: 支持按车间、产线、设备等维度查看

#### 🔌 设备集成
- ✅ **工业协议支持**: OPC UA、Modbus、MQTT 等主流工业协议
- ✅ **设备数据采集**: 实时采集设备运行数据
- ✅ **设备状态监控**: 设备运行、停机、故障等状态实时监控
- ✅ **告警管理**: 设备异常告警和处理

#### 📱 移动端支持
- ✅ **现场数据采集**: 支持移动端扫码、数据录入
- ✅ **工单查看**: 移动端查看工单信息和操作
- ✅ **质量检验**: 移动端质量数据录入

### 🛠️ 技术架构

- ✅ **后端**: FastAPI + Tortoise ORM + PostgreSQL
- ✅ **前端**: React 18 + TypeScript + Ant Design
- ✅ **任务调度**: Inngest 工作流引擎
- ✅ **缓存**: Redis 缓存提升性能
- ✅ **部署**: Kubernetes

### 🏢 多组织架构
- ✅ **多租户数据隔离**: 每个组织的数据完全隔离
- ✅ **动态租户切换**: 支持平台管理员跨租户管理
- ✅ **租户级权限控制**: 精细化的权限管理

### 🔌 插件化架构
- ✅ **热插拔应用**: 支持应用动态安装/卸载
- ✅ **扩展性**: 易于添加新的业务模块

## 📦 其他业务模块

除核心 MES 功能外，还包含以下业务模块（持续优化中）：

- **APS** - 高级排产系统
- **QMS** - 质量管理系统
- **EAM** - 设备资产管理
- **WMS** - 仓库管理系统
- **CRM** - 客户关系管理
- **SCM** - 供应链协同
- 以及其他 10+ 业务模块

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
- **Inngest控制台**: http://localhost:8300

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
│   │   │   ├── kuaimes/        # 快格轻MES
│   │   │   ├── kuaicrm/        # 快格轻CRM
│   │   │   └── ...             # 其他应用模块
│   │   ├── core/               # 核心功能
│   │   │   ├── api/            # API路由
│   │   │   ├── models/         # 数据模型
│   │   │   ├── services/       # 业务服务
│   │   │   └── schemas/        # 数据验证
│   │   ├── infra/              # 基础设施
│   │   │   ├── config/         # 配置管理
│   │   │   ├── models/         # 基础模型
│   │   │   └── services/       # 基础服务
│   │   └── server/             # 服务器配置
│   ├── migrations/             # 数据库迁移
│   └── pyproject.toml          # 项目配置
│
├── riveredge-frontend/         # 前端应用 (React)
│   ├── src/
│   │   ├── apps/               # 业务应用页面
│   │   ├── pages/              # 系统页面
│   │   ├── components/         # 通用组件
│   │   ├── services/           # API服务
│   │   ├── layouts/            # 页面布局
│   │   └── utils/              # 工具函数
│   └── package.json            # 项目配置
│
├── bin/                        # 第三方工具
│   ├── inngest.exe             # Inngest 可执行文件
│   └── inngest.config.json     # Inngest 配置
│
├── plans/                      # 项目文档
│   ├── 1.stack/                # 技术栈说明
│   ├── 2.rules/                # 开发规范
│   └── 3.build/                # 构建计划
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

# Inngest 配置
INNGEST_HOST=127.0.0.1
INNGEST_PORT=8300
```

### 前端配置

编辑 `riveredge-frontend/.env` 文件：

```bash
# API 基础地址
VITE_API_BASE_URL=http://localhost:8200

# 后端服务地址
VITE_BACKEND_HOST=127.0.0.1
VITE_BACKEND_PORT=8200

# Inngest 服务地址
VITE_INNGEST_HOST=127.0.0.1
VITE_INNGEST_PORT=8300
```

## 🎨 其他功能特性

### 🔐 安全特性
- ✅ **JWT 身份认证**: 安全的 Token 认证机制
- ✅ **多租户隔离**: 数据级别的租户隔离
- ✅ **权限控制**: 基于角色的访问控制 (RBAC)
- ✅ **审计日志**: 完整的操作审计记录

### 🎯 用户体验
- ✅ **响应式设计**: 支持桌面端和移动端
- ✅ **国际化**: 中英文双语支持
- ✅ **主题定制**: 深色/浅色主题切换

### 📊 数据管理
- ✅ **实时同步**: WebSocket 实时数据更新
- ✅ **缓存优化**: Redis 缓存提升性能
- ✅ **数据导出**: 支持多种格式导出

### 🔄 工作流引擎
- ✅ **任务调度**: 灵活的任务调度系统
- ✅ **流程编排**: 可视化流程设计

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

## 🚢 部署

### Kubernetes 部署

```bash
# 应用部署
kubectl apply -f k8s/

# 查看服务状态
kubectl get pods
kubectl get services
```

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

**快格云MES 制造执行系统** © 2025. 由 [无锡快格信息技术有限公司](https://www.kuaige.com.cn) 开发并维护。

</div>
