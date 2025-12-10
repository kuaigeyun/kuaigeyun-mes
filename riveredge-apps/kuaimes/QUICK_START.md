# 快格轻MES 快速开始指南

## 方式一：通过应用中心创建（推荐）

1. **登录系统**
   - 访问应用中心页面：`/system/applications`

2. **创建应用**
   - 点击"新建应用"按钮
   - 填写以下信息：
     ```
     应用名称: 快格轻MES
     应用代码: kuaimes
     应用描述: 轻量级制造执行系统，提供生产订单管理、工单管理、生产进度跟踪等功能。
     应用版本: 1.0.0
     路由路径: /apps/kuaimes
     入口点: /apps/kuaimes/index.js
     权限代码: app:kuaimes
     菜单配置（JSON）: 
     {
       "title": "快格轻MES",
       "icon": "AppstoreOutlined",
       "path": "/apps/kuaimes",
       "children": [
         {
           "title": "生产订单",
           "path": "/apps/kuaimes/orders",
           "permission": "kuaimes:order:view"
         },
         {
           "title": "工单管理",
           "path": "/apps/kuaimes/workorders",
           "permission": "kuaimes:workorder:view"
         },
         {
           "title": "生产进度",
           "path": "/apps/kuaimes/progress",
           "permission": "kuaimes:progress:view"
         }
       ]
     }
     是否启用: 是
     排序顺序: 1
     ```
   - 点击"确定"保存

3. **安装应用**
   - 在应用列表中，找到刚创建的"快格轻MES"应用
   - 点击"安装"按钮
   - 应用安装后会自动生成菜单

4. **启用应用**
   - 确保应用的"启用状态"开关已打开
   - 应用启用后，左侧菜单会显示"快格轻MES"菜单项

## 方式二：通过脚本创建（快速）

1. **运行初始化脚本**
   ```bash
   cd riveredge-backend
   python scripts/init_kuaimes_application.py
   ```

2. **在应用中心安装**
   - 访问应用中心页面
   - 找到"快格轻MES"应用
   - 点击"安装"按钮
   - 启用应用

## 验证安装

1. **检查菜单**
   - 刷新页面
   - 左侧菜单应该显示"快格轻MES"菜单项
   - 展开后应该看到：生产订单、工单管理、生产进度

2. **访问应用**
   - 点击"生产订单"菜单项
   - 应该能正常访问 `/apps/kuaimes/orders` 页面

3. **检查控制台**
   - 打开浏览器控制台（F12）
   - 应该没有错误信息
   - 插件应该正常加载

## 故障排查

### 应用列表为空
- **原因**: 数据库中没有应用数据
- **解决**: 按照上述方式创建应用

### 应用创建失败
- **检查**: 应用代码是否已存在
- **解决**: 使用不同的应用代码，或先删除已存在的应用

### 菜单未显示
- **检查**: 应用是否已安装并启用
- **检查**: 菜单配置格式是否正确（JSON 格式）
- **解决**: 重新安装应用，或检查菜单配置

### 插件路由无法访问
- **检查**: 前端插件是否已构建并部署
- **检查**: `entry_point` 路径是否正确
- **解决**: 参考 `INSTALL.md` 中的前端部署步骤

