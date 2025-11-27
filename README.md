# RiverEdge SaaS 多组织框架

**RiverEdge SaaS Multi-tenant Framework** - 一个现代化的 SaaS 多组织框架，支持插件化架构和动态功能扩展。

## ⚠️ 重要锁定声明

**前端采用纯React生态最佳实践，基于Vite 5.4.8 + Zustand 5.0.0 + TanStack Query 5.51.1构建。**
详见：[前端技术栈说明](Farming Plan/1.plan/1.最终技术选型.md)

## 📋 项目概述

RiverEdge 是一个基于自然/植物生态哲学的 SaaS 多组织框架，采用模块化设计，支持动态插件加载和功能扩展。

### 框架模块

- **riveredge-root** (根) - 系统级后端，提供基础支撑
- **riveredge-stem** (茎) - 系统级前端框架，承载应用
- **riveredge-seed** (种子) - 应用插件，可生长的功能模块
- **riveredge-land** (土地) - 着陆页/官网，展示和生长的土壤
- **riveredge-leaf** (叶子) - 移动端应用，轻量灵活的终端

## 🚀 快速开始

### 后端开发

#### 智能部署（推荐）
```bash
cd riveredge-root
# 完整部署（包含环境检查、依赖安装、数据库迁移、服务启动）
./scripts/deploy.sh --deploy

# 或者手动部署
python -m venv venv311
source venv311/bin/activate  # Windows: venv311\Scripts\activate
pip install -r requirements.txt
python scripts/start_backend.py
```

#### 服务管理
```bash
cd riveredge-root
./scripts/deploy.sh --start   # 启动服务
./scripts/deploy.sh --stop    # 停止服务
./scripts/deploy.sh --check   # 健康检查
./scripts/deploy.sh --monitor # 系统监控
./scripts/deploy.sh --logs    # 查看日志
```

### 前端开发

```bash
cd riveredge-stem
npm install --legacy-peer-deps
npm run dev
```

### 环境配置

复制 `.env.example` 为 `.env` 并配置数据库和 Redis 连接信息。

### 监控和运维

#### 健康检查
```bash
# 基础健康检查
curl http://localhost:8000/health

# 详细健康检查（包含数据库、Redis状态）
curl http://localhost:8000/health/detailed
```

#### 系统监控
```bash
cd riveredge-root
python scripts/monitor_system.py --json  # JSON格式输出
python scripts/monitor_system.py --output report.json  # 保存报告
```

## 📚 文档

详细文档位于 `Farming Plan/` 目录：

- **开发计划**: `Farming Plan/1.plan/4.框架开发计划.md`
- **架构设计**: `Farming Plan/1.plan/2.架构设计文档.md`
- **开发规范**: `Farming Plan/2.rules/AGENTS.md`

## 🌿 分支策略

- `main` - 生产分支
- `develop` - 开发分支
- `feature/xxx` - 功能分支
- `fix/xxx` - 修复分支
- `hotfix/xxx` - 热修复分支
- `release/xxx` - 发布分支

详细说明请参考 `Farming Plan/2.rules/8.Git工作流规范.md`

## 📝 提交规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建/工具相关

### 开发环境建议

**重要**：为了避免中文编码问题，建议**完全避免使用 PowerShell**。

**推荐方案**：
1. **使用 VS Code Git 面板**（最简单，推荐）⭐
   - 所有 Git 操作在 VS Code 界面中完成
   - 提交信息在编辑器中输入，完全避免编码问题

2. **使用 Git Bash 终端**
   - VS Code 已配置为默认使用 Git Bash
   - 在 Git Bash 中运行：`bash riveredge-core/.gitconfig.sh`

详细说明请参考 `DEVELOPMENT_GUIDE.md`

## 📄 许可证

[待定]
