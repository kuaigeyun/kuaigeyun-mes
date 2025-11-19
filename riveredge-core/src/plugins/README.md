# RiverEdge 后端插件系统

RiverEdge SaaS 多租户框架的后端插件系统，支持系统功能插件的动态加载和管理。

## 📁 目录结构

```
riveredge-core/src/plugins/
├── __init__.py          # 插件系统入口
├── base.py              # 插件基类和元数据定义
├── registry.py          # 插件注册器
├── loader.py            # 插件加载器
├── hooks.py             # 插件钩子系统（待实现）
├── builtin/             # 自制插件目录
│   └── example_plugin/  # 示例自制插件
└── thirdparty/          # 第三方插件目录
    └── vendor_plugin/   # 示例第三方插件
```

## 🔧 插件类型区分

### 系统功能插件（位于 `riveredge-core/src/plugins/`）
- **自制插件**: 放在 `builtin/` 目录下
- **第三方插件**: 放在 `thirdparty/` 目录下

### 业务应用插件（位于 `riveredge-seeds/`）
- ERP、MES、CRM 等业务模块
- 保持原有架构不变

## 📦 插件文件结构

每个插件目录应包含以下文件：

```
plugin_name/
├── plugin.json          # 插件配置和元数据（必需）
├── __init__.py          # 插件主模块（可选）
├── plugin.py            # 插件实现（可选）
├── requirements.txt     # 依赖列表（可选）
└── README.md           # 插件说明（可选）
```

### plugin.json 配置示例

```json
{
  "name": "example_plugin",
  "version": "1.0.0",
  "description": "示例插件",
  "author": "RiverEdge Team",
  "dependencies": [],
  "requires": ["fastapi", "tortoise-orm"],
  "provides": ["example_service"],
  "tags": ["example", "demo"],
  "homepage": "https://github.com/riveredge/example_plugin",
  "license": "MIT",
  "config_schema": {
    "enabled": {
      "type": "boolean",
      "default": true,
      "description": "是否启用插件"
    }
  }
}
```

## 🚀 快速开始

### 1. 创建自制插件

```bash
# 在 builtin 目录下创建插件
mkdir -p riveredge-core/src/plugins/builtin/my_plugin
cd riveredge-core/src/plugins/builtin/my_plugin

# 创建配置文件
cat > plugin.json << EOF
{
  "name": "my_plugin",
  "version": "1.0.0",
  "description": "我的自制插件",
  "author": "Your Name",
  "dependencies": [],
  "provides": ["my_service"]
}
EOF

# 创建插件主文件
cat > plugin.py << EOF
from plugins.base import Plugin, PluginMetadata

class MyPlugin(Plugin):
    def on_activate(self):
        super().on_activate()
        print("My plugin activated!")

    def get_services(self):
        return {
            "my_service": "MyServiceInstance"
        }
EOF
```

### 2. 安装第三方插件

```bash
# 在 thirdparty 目录下安装第三方插件
cd riveredge-core/src/plugins/thirdparty/

# 方式1：直接复制插件目录
cp -r /path/to/vendor_plugin ./

# 方式2：通过包管理器（如果支持）
pip install vendor-plugin
# 然后将插件文件复制到 thirdparty 目录
```

### 3. 插件管理

```python
from plugins import plugin_registry, plugin_loader

# 加载所有插件
plugin_loader.load_all_directories(plugin_registry)

# 激活所有插件
plugin_registry.activate_all()

# 查看已加载的插件
plugins = plugin_registry.list_plugins()
for plugin in plugins:
    print(f"{plugin['name']} v{plugin['version']}: {plugin['description']}")
```

## 🔌 插件开发指南

### 继承 Plugin 基类

```python
from plugins.base import Plugin, PluginMetadata

class MyPlugin(Plugin):
    def on_load(self):
        # 插件加载时的初始化
        pass

    def on_activate(self):
        # 插件激活时的处理
        super().on_activate()

    def on_deactivate(self):
        # 插件停用时的处理
        super().on_deactivate()

    def on_unload(self):
        # 插件卸载时的清理
        pass

    # 可选：提供API路由
    def get_api_routes(self):
        # 返回 FastAPI 路由对象
        return None

    # 可选：提供数据模型
    def get_models(self):
        # 返回模型类列表
        return []

    # 可选：提供服务
    def get_services(self):
        # 返回服务字典
        return {"service_name": service_instance}

    # 可选：提供中间件
    def get_middlewares(self):
        # 返回中间件列表
        return []

    # 可选：提供命令
    def get_commands(self):
        # 返回命令字典
        return {"command_name": command_function}
```

### 插件生命周期

1. **加载 (Load)**: 读取配置，初始化资源
2. **激活 (Activate)**: 启动功能，注册服务
3. **运行 (Run)**: 正常运行状态
4. **停用 (Deactivate)**: 暂停功能，保持资源
5. **卸载 (Unload)**: 清理资源，完全移除

### 插件依赖管理

```json
{
  "dependencies": ["base_plugin", "auth_plugin"],
  "requires": ["fastapi", "redis"]
}
```

## 📚 API 参考

### PluginRegistry

```python
# 注册插件
registry.register(plugin_instance)

# 激活插件
registry.activate_plugin("plugin_name")

# 停用插件
registry.deactivate_plugin("plugin_name")

# 获取插件
plugin = registry.get_plugin("plugin_name")

# 列出所有插件
plugins = registry.list_plugins()
```

### PluginLoader

```python
# 加载目录中的插件
count = loader.load_from_directory(Path("/path/to/plugins"), registry)

# 加载所有目录的插件
total = loader.load_all_directories(registry)

# 重新加载插件
success = loader.reload_plugin("plugin_name", registry)
```

## 🔒 安全注意事项

1. **插件来源验证**: 只从可信任来源安装第三方插件
2. **权限控制**: 插件应遵循最小权限原则
3. **依赖检查**: 定期检查插件依赖的安全性
4. **版本管理**: 及时更新插件到最新安全版本
5. **审计日志**: 记录插件的加载、激活等操作

## 📞 支持

如需帮助，请参考：
- [插件开发规范](../../docs/plugin-development.md)
- [系统架构文档](../../../Farming Plan/1.plan/2.架构设计文档.md)
- [问题反馈](https://github.com/riveredge/framework/issues)
