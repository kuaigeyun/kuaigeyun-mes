# RiverEdge 前端 Monorepo

RiverEdge SaaS 多组织框架的前端 Monorepo，包含平台前端和租户前端。

## 📁 目录结构

```
riveredge-frontend/
├── src/              # 源代码目录
│   ├── maintree/     # 主入口（统一入口）⭐ 推荐
│   │   ├── routes/   # 路由配置（根据运行模式加载）
│   │   ├── config/   # 运行模式配置
│   │   ├── ...       # 主树源代码（直接在此目录）
│   │   └── vite.config.ts # 项目特定配置（支持运行模式）
│   └── tree-stem/    # 租户前端（系统级）
│       ├── ...       # 租户前端源代码（直接在此目录）
│       └── vite.config.ts # 项目特定配置（仅端口号）
├── package.json      # Monorepo 根配置（共享依赖）
├── vite.config.ts    # 共享 Vite 配置
├── tsconfig.json     # 共享 TypeScript 配置
├── tsconfig.node.json # 共享 Node TypeScript 配置
├── index.html        # 共享 HTML 模板
├── .gitignore        # 共享 Git 忽略规则
├── .eslintrc.json    # 共享 ESLint 配置
└── .prettierrc       # 共享 Prettier 配置
```

## 🎯 共享策略

**共享内容**（除 `src` 外）：
- ✅ 所有依赖（`package.json` 中的 `dependencies` 和 `devDependencies`）
- ✅ Vite 配置（`vite.config.ts`）
- ✅ TypeScript 配置（`tsconfig.json`, `tsconfig.node.json`）
- ✅ HTML 模板（`index.html`）
- ✅ 代码规范配置（`.eslintrc.json`, `.prettierrc`）
- ✅ Git 配置（`.gitignore`）

**独立内容**（每个子项目）：
- ✅ `src/` 目录（源代码）
- ✅ `vite.config.ts`（仅覆盖端口号等特定配置）

## 🚀 快速开始

### 安装依赖

```bash
# 在根目录安装所有依赖（共享依赖）
npm install
```

### 开发

**方式1：使用 npm 脚本（推荐）**
```bash
# 启动主入口（maintree）- 端口 8000 ⭐ 推荐
# 单体模式（默认，包含所有功能）
npm run dev:maintree
# 或
cd src/maintree && npm run dev

# SaaS 模式（仅平台级功能）
npm run dev:maintree:saas
# 或
cd src/maintree && npm run dev:saas

# 启动租户前端（tree-stem）- 端口 8001
npm run dev:stem

# 同时启动所有前端
npm run dev
```

**方式2：使用启动脚本（更便捷）**
```bash
# Linux/Mac/Git Bash
./start-maintree-monolithic.sh  # 单体模式
./start-maintree-saas.sh        # SaaS 模式

# Windows
start-maintree-monolithic.bat    # 单体模式
start-maintree-saas.bat         # SaaS 模式
```

### 构建

```bash
# 构建主入口（maintree）
cd src/maintree && npm run build:monolithic  # 单体模式
cd src/maintree && npm run build:saas         # SaaS 模式

# 构建租户前端（tree-stem）
npm run build:stem

# 构建所有前端
npm run build
```

## 📦 依赖管理

### 共享依赖

所有公共依赖（React、Ant Design、TanStack Query 等）都在根目录的 `package.json` 中管理，子项目会自动继承这些依赖。

### 添加新依赖

**添加共享依赖（所有子项目都使用）：**
```bash
# 在根目录添加
npm install <package-name> -w .
```

**添加子项目特定依赖：**
```bash
# 为 maintree 添加依赖
npm install <package-name> -w src/maintree

# 为 tree-stem 添加依赖
npm install <package-name> -w src/tree-stem
```

## 🔧 技术栈

- **React**: 18.3.1
- **TypeScript**: 5.6.3
- **Vite**: 5.4.8
- **Ant Design**: 5.17.0
- **Ant Design Pro Components**: 2.7.10
- **TanStack Query**: 5.51.1
- **Zustand**: 5.0.0
- **React Router DOM**: 6.26.2
- **React Hook Form**: 7.53.0

## 📝 注意事项

1. **依赖共享**：所有公共依赖都在根目录管理，子项目的 `package.json` 中 `dependencies` 和 `devDependencies` 为空对象，依赖会自动从根目录继承。

2. **独立构建**：每个子项目都可以独立构建和部署，互不影响。

3. **端口配置**：
   - `maintree`: 8000（主入口）
   - `tree-stem`: 8001（租户前端，包含系统级 + 平台级功能）

4. **运行模式**：
   - **单体模式**（默认）：`maintree` 包含所有功能（系统级 + 平台级）
   - **SaaS 模式**：`maintree` 作为平台宿主，仅运行平台级功能；系统级功能由 `tree-stem` 提供

5. **清理依赖**：
   ```bash
   npm run clean
   ```

## 🌳 maintree 主入口

`maintree` 是 RiverEdge SaaS 多组织框架的统一入口，支持两种运行模式：

### 单体模式（Monolithic Mode）

**适用场景**：单组织部署、开发环境、小型项目

**特点**：
- 包含所有功能（系统级 + 平台级）
- 所有服务运行在同一个应用实例中
- 简化部署和维护

**启动方式**：
```bash
cd src/maintree
npm run dev  # 默认单体模式
# 或
npm run dev:monolithic
```

### SaaS 模式（SaaS Mode）

**适用场景**：多组织 SaaS 平台、生产环境

**特点**：
- 作为平台运行的宿主
- 主要运行平台级功能（运营中心）
- 系统级功能由独立的 `tree-stem` 提供

**启动方式**：
```bash
cd src/maintree
npm run dev:saas
```

详细说明请参考：[src/maintree/README.md](./src/maintree/README.md)
