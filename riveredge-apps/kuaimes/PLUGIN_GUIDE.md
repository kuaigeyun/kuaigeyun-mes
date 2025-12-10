# 快格轻MES 插件开发指南

## 插件结构说明

### 前端结构

```
frontend/
├── src/
│   ├── pages/          # 页面组件
│   ├── components/     # 组件
│   ├── services/      # API 服务
│   └── index.tsx      # 插件入口（必须导出路由组件）
├── package.json
└── vite.config.ts
```

### 后端结构

```
backend/
├── src/
│   ├── api/           # API 路由
│   ├── models/        # 数据模型（表名必须以 seed_kuaimes_ 开头）
│   ├── services/      # 业务服务
│   └── schemas/      # 数据模式
└── migrations/        # 数据库迁移
```

## 插件注册流程

### 1. 后端注册

在 `riveredge-backend/src/server/main.py` 中注册插件路由：

```python
# 添加插件路径到 Python 路径
plugin_backend_path = Path(__file__).parent.parent.parent.parent / "riveredge-apps" / "kuaimes" / "backend" / "src"
if plugin_backend_path.exists() and str(plugin_backend_path) not in sys.path:
    sys.path.insert(0, str(plugin_backend_path))

# 导入并注册插件路由
from kuaimes.api.orders.orders import router as kuaimes_orders_router
app.include_router(kuaimes_orders_router, prefix="/api/v1")
```

### 2. 前端注册

前端插件会自动通过 `DynamicPluginRoutes` 组件加载，需要：

1. 在应用中心创建应用记录
2. 设置 `entry_point` 为插件前端构建后的入口文件路径
3. 设置 `route_path` 为插件路由路径（如 `/apps/kuaimes`）
4. 安装并启用应用

### 3. 数据库模型注册

在 `riveredge-backend/src/infra/infrastructure/database/database.py` 中注册插件模型：

```python
"apps": {
    "models": {
        "models": [
            # ... 其他模型
            "kuaimes.models.order",  # 注册插件模型
        ],
    },
}
```

## 开发注意事项

1. **表名规范**: 插件表名必须以 `seed_插件代码_` 开头（如 `seed_kuaimes_orders`）
2. **多组织隔离**: 所有模型必须包含 `tenant_id` 字段
3. **路由前缀**: 插件 API 路由建议使用 `/api/v1/插件代码/` 前缀
4. **权限控制**: 插件功能需要定义相应的权限代码
5. **菜单配置**: 在 `manifest.json` 中配置菜单结构

## 构建和部署

### 前端构建

```bash
cd riveredge-apps/kuaimes/frontend
npm install
npm run build
```

构建产物会输出到 `dist/` 目录，需要将入口文件部署到可访问的静态资源路径。

### 后端部署

后端代码需要确保：
1. 插件路径在 Python 路径中
2. 数据库模型已注册
3. API 路由已注册

## 测试

1. 启动后端服务
2. 在应用中心创建应用记录
3. 安装并启用应用
4. 访问插件路由验证功能

