# 快格轻MES 插件安装指南

## 前置条件

1. RiverEdge SaaS 平台已部署并运行
2. 数据库已初始化
3. 前端和后端服务正常运行

## 安装步骤

### 1. 后端安装

#### 1.1 注册数据库模型

在 `riveredge-backend/src/infra/infrastructure/database/database.py` 的 `TORTOISE_ORM` 配置中添加：

```python
"apps": {
    "models": {
        "models": [
            # ... 其他模型
            "kuaimes.models.order",  # 添加 MES 订单模型
        ],
    },
}
```

#### 1.2 注册 API 路由

在 `riveredge-backend/src/server/main.py` 中添加：

```python
# 添加插件路径到 Python 路径
plugin_backend_path = Path(__file__).parent.parent.parent.parent / "riveredge-apps" / "kuaimes" / "backend" / "src"
if plugin_backend_path.exists() and str(plugin_backend_path) not in sys.path:
    sys.path.insert(0, str(plugin_backend_path))

# 导入并注册插件路由
try:
    from kuaimes.api.orders.orders import router as kuaimes_orders_router
    app.include_router(kuaimes_orders_router, prefix="/api/v1")
except ImportError as e:
    print(f"警告: 无法加载 kuaimes 插件路由: {e}")
```

#### 1.3 执行数据库迁移

```bash
cd riveredge-backend
aerich upgrade
```

### 2. 前端安装

#### 2.1 构建插件前端

```bash
cd riveredge-apps/kuaimes/frontend
npm install
npm run build
```

#### 2.2 部署插件静态资源

将构建产物（`dist/` 目录）部署到前端静态资源服务器，确保可以通过 `/apps/kuaimes/index.js` 访问。

#### 2.3 在应用中心注册插件

1. 登录系统，进入"应用中心"
2. 点击"新建应用"
3. 填写应用信息：
   - **名称**: 快格轻MES
   - **代码**: kuaimes
   - **版本**: 1.0.0
   - **描述**: 轻量级制造执行系统
   - **路由路径**: /apps/kuaimes
   - **入口点**: /apps/kuaimes/index.js
   - **菜单配置**: 从 `manifest.json` 复制 `menu_config` 内容
4. 保存并安装应用
5. 启用应用

### 3. 验证安装

1. 刷新前端页面
2. 检查左侧菜单是否出现"快格轻MES"菜单项
3. 访问 `/apps/kuaimes/orders` 验证订单列表页面
4. 访问 `/apps/kuaimes/workorders` 验证工单列表页面
5. 访问 `/apps/kuaimes/progress` 验证生产进度页面

## 卸载步骤

1. 在应用中心禁用并卸载应用
2. 删除后端路由注册代码
3. 删除数据库模型注册（可选，保留数据）
4. 删除插件目录（可选）

## 故障排查

### 插件路由无法加载

- 检查插件路径是否正确
- 检查 Python 路径是否包含插件后端路径
- 检查插件模块导入是否正确

### 前端插件无法加载

- 检查 `entry_point` 路径是否正确
- 检查插件静态资源是否已部署
- 检查浏览器控制台是否有错误信息

### 数据库模型无法注册

- 检查模型路径是否正确
- 检查数据库迁移是否执行
- 检查表名是否符合规范（`seed_kuaimes_*`）

