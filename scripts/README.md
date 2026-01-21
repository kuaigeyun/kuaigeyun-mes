# 脚本目录说明

本目录包含 RiverEdge 项目的各种工具脚本，按用途分类组织。

## 目录结构

```
scripts/
├── tools/          # 工具脚本（检查、诊断等）
├── init/           # 初始化脚本
├── tests/          # 测试脚本
├── sql/            # SQL 脚本
└── ...             # 其他脚本（路由重载、测试等）
```

## 脚本分类

### tools/ - 工具脚本
- `check_apps.py` - 检查数据库中的应用记录
- `check_apps_db.py` - 检查数据库中的应用记录（详细版）

### init/ - 初始化脚本
- `init_apps.py` - 初始化应用数据（使用 ApplicationService）

### tests/ - 测试脚本
- `test-all-api-routes.py` - 测试所有 API 路由
- `test-api-routes.py` - API 路由测试工具（从 scripts/tests 目录运行）
- `test-modules-automated.py` - 自动化模块测试
- `test-sales-order-page.py` - 销售订单页面测试

### sql/ - SQL 脚本
- `init_apps.sql` - 初始化应用数据的 SQL 脚本

### 其他脚本
- `reload-app-routes.sh` - 重载应用路由（Shell 脚本）
- `reload-kuaizhizao-routes.js` - 重载快格轻制造路由（JavaScript）
- `reload-master-data-routes.js` - 重载主数据路由（JavaScript）
- `reload-routes-now.js` - 立即重载路由（JavaScript）
- `reload-routes.html` - 路由重载工具（HTML 页面）
- `run-full-stack-tests.sh` - 运行全栈测试

## 归档脚本

已过期的脚本已移动到 `archive/scripts/` 目录：
- `init_apps_simple.py` - 使用 SQLite 的初始化脚本（已过期，项目使用 PostgreSQL）
- `fix_sales_delivery_demand_id.sql` - 修复脚本（已有对应的迁移文件）

## 使用说明

### 检查应用
```bash
# 检查数据库中的应用
python scripts/tools/check_apps.py
python scripts/tools/check_apps_db.py
```

### 初始化应用
```bash
# 初始化应用数据
python scripts/init/init_apps.py
```

### 运行测试
```bash
# 测试所有 API 路由
python scripts/tests/test-all-api-routes.py

# 自动化模块测试
python scripts/tests/test-modules-automated.py
```

### 重载路由
```bash
# 重载应用路由
bash scripts/reload-app-routes.sh

# 或使用 HTML 工具
# 在浏览器中打开 scripts/reload-routes.html
```

## 注意事项

1. 运行脚本前请确保已正确配置环境变量
2. 数据库相关脚本需要先连接到数据库
3. 测试脚本可能需要启动后端服务
4. 归档目录中的脚本仅供参考，不建议在生产环境使用
