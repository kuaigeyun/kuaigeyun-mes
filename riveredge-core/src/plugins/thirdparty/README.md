# 第三方插件目录

此目录用于存放第三方系统功能插件。

## 📦 第三方插件安装方式

### 方式1：直接复制插件目录

```bash
# 将第三方插件复制到此目录
cp -r /path/to/vendor_plugin ./

# 确保插件目录结构正确
vendor_plugin/
├── plugin.json      # 插件配置（必需）
├── plugin.py        # 插件实现（可选）
├── __init__.py      # 包初始化（可选）
└── requirements.txt # 依赖文件（可选）
```

### 方式2：通过包管理器

如果第三方插件提供了安装包：

```bash
# 安装插件包（如果支持）
pip install vendor-plugin-package

# 然后复制插件文件到此目录
cp -r /path/to/installed/plugin ./
```

### 方式3：从源码构建

```bash
# 克隆插件仓库
git clone https://github.com/vendor/plugin-repo.git temp_plugin

# 构建和安装
cd temp_plugin
pip install -e .

# 复制到插件目录
cp -r plugin_files ../thirdparty/vendor_plugin
```

## 🔒 安全注意事项

安装第三方插件时请注意：

1. **来源验证**: 只从可信任的来源安装插件
2. **代码审查**: 检查插件代码的安全性
3. **依赖检查**: 验证插件依赖的安全性
4. **权限控制**: 插件应遵循最小权限原则
5. **版本锁定**: 使用固定版本避免意外更新

## 📝 插件配置

第三方插件必须提供 `plugin.json` 配置文件：

```json
{
  "name": "vendor_plugin",
  "version": "1.0.0",
  "description": "第三方插件描述",
  "author": "Vendor Name",
  "license": "MIT",
  "homepage": "https://vendor.com/plugin",
  "dependencies": [],
  "provides": ["vendor_service"],
  "requires": ["fastapi"],
  "config_schema": {
    "api_key": {
      "type": "string",
      "description": "API密钥"
    }
  }
}
```

## 🚀 插件管理

安装插件后，可以通过超级管理员API进行管理：

```bash
# 查看已安装插件
curl -H "Authorization: Bearer <token>" \
     http://localhost:8000/api/v1/superadmin/plugins/list

# 激活插件
curl -X POST -H "Authorization: Bearer <token>" \
     http://localhost:8000/api/v1/superadmin/plugins/vendor_plugin/activate
```

## 📞 支持

如果遇到第三方插件相关问题，请：

1. 检查插件文档
2. 联系插件提供商
3. 查看 RiverEdge 插件系统文档
