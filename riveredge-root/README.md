# RiverEdge Root - 系统级后端

**RiverEdge SaaS 多组织框架**的系统级后端（根），提供 API 服务、数据持久化、认证授权、核心基础设施等系统级功能。

## 📋 技术栈

- **编程语言**: Python 3.11 LTS
- **Web 框架**: FastAPI 0.104.1
- **数据验证**: Pydantic 2.8.0
- **ORM**: Tortoise ORM 0.20.1
- **数据库**: PostgreSQL 15+
- **缓存**: Redis 7.2+
- **迁移工具**: Aerich 0.7.1

## 🚀 快速开始

### 1. 安装依赖

```bash
# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
# 复制环境变量示例文件
cp .env.example .env

# 编辑 .env 文件，配置数据库、Redis 等信息
```

### 3. 初始化数据库

```bash
# 初始化 Aerich 迁移
aerich init -t app.core.database.TORTOISE_ORM

# 初始化数据库
aerich init-db

# 运行迁移
aerich upgrade
```

### 4. 启动服务

```bash
# 开发模式
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 或使用 Python
python -m uvicorn app.main:app --reload
```

### 5. 访问 API 文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 📁 项目结构

```
riveredge-core/
├── src/
│   ├── app/              # FastAPI 应用配置
│   ├── api/              # API 路由层
│   ├── core/             # 核心功能模块
│   ├── models/           # 数据模型
│   ├── schemas/          # Pydantic Schema
│   ├── services/         # 业务逻辑层
│   └── utils/            # 工具函数
├── migrations/           # 数据库迁移
├── tests/                # 测试代码
├── requirements.txt       # Python 依赖
└── README.md            # 项目说明
```

## 📚 相关文档

详细开发计划和规范请参考 `Farming Plan/` 目录。
