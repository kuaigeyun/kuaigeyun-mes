# 第二阶段：核心配置建设

## 📋 概述

第二阶段是系统级功能建设的核心配置阶段，建立系统核心配置功能，为业务功能提供配置基础。

**建设时间**：8-12 周  
**状态**：⏳ **待开始**

---

## 📁 本文件夹内容

本文件夹包含第二阶段建设所需的所有规划文档：

1. **最佳实践文档**：
   - [1.数据字典最佳实践.md](./1.数据字典最佳实践.md)
   - [2.参数设置最佳实践.md](./2.参数设置最佳实践.md)
   - [3.编码规则最佳实践.md](./3.编码规则最佳实践.md)
   - [4.自定义字段最佳实践.md](./4.自定义字段最佳实践.md)
   - [5.站点设置最佳实践.md](./5.站点设置最佳实践.md)
   - [6.语言管理最佳实践.md](./6.语言管理最佳实践.md)
   - [7.应用中心最佳实践.md](./7.应用中心最佳实践.md)
   - [8.集成设置最佳实践.md](./8.集成设置最佳实践.md)

2. **规范文档**：
   - [前端页面布局规范.md](./前端页面布局规范.md)（复用第一阶段规范）
   - [系统级功能文件结构规划.md](./系统级功能文件结构规划.md)（复用第一阶段规范）

3. **技术选型文档**：
   - [库选择评估总结.md](./库选择评估总结.md)（各模块库选择评估汇总）

4. **开发计划**：
   - [建设进度.md](./建设进度.md)（开发进度跟踪）

5. **建设总结**：
   - [第二阶段建设总结.md](./第二阶段建设总结.md)（待建设完成后填写）

---

## 🚀 建设顺序

### 1. 数据字典（第1优先级）

**预计时间**：1 周  
**状态**：⏳ 待开始

**依赖**：无（独立功能）

**文件位置**：
- 后端：`riveredge-backend/src/tree-root/api/data_dictionaries/`
- 前端：`riveredge-frontend/src/tree-stem/pages/system/data-dictionaries/`

**建设步骤**：
1. ⏳ 创建数据库模型（DataDictionary、DictionaryItem）
2. ⏳ 创建 Schema（数据验证）
3. ⏳ 创建 Service（业务逻辑）
4. ⏳ 创建 API（路由）
5. ⏳ 创建前端页面
6. ⏳ 创建前端服务

---

### 2. 参数设置（第2优先级）

**预计时间**：1 周  
**状态**：⏳ 待开始

**依赖**：无（独立功能）

**文件位置**：
- 后端：`riveredge-backend/src/tree-root/api/system_parameters/`
- 前端：`riveredge-frontend/src/tree-stem/pages/system/system-parameters/`

**建设步骤**：
1. ⏳ 创建数据库模型（SystemParameter）
2. ⏳ 创建 Schema（数据验证）
3. ⏳ 创建 Service（业务逻辑，包含 Redis 缓存）
4. ⏳ 创建 API（路由）
5. ⏳ 创建前端页面
6. ⏳ 创建前端服务

---

### 3. 编码规则（第3优先级）

**预计时间**：1-2 周  
**状态**：⏳ 待开始

**依赖**：数据字典（可能需要字典支持）

**文件位置**：
- 后端：`riveredge-backend/src/tree-root/api/code_rules/`
- 前端：`riveredge-frontend/src/tree-stem/pages/system/code-rules/`

**建设步骤**：
1. ⏳ 创建数据库模型（CodeRule）
2. ⏳ 创建 Schema（数据验证）
3. ⏳ 创建 Service（业务逻辑，包含编码生成服务）
4. ⏳ 创建 API（路由）
5. ⏳ 创建前端页面
6. ⏳ 创建前端服务

---

### 4. 自定义字段（第4优先级）

**预计时间**：2-3 周  
**状态**：⏳ 待开始

**依赖**：数据字典（字段类型可能需要字典）

**文件位置**：
- 后端：`riveredge-backend/src/tree-root/api/custom_fields/`
- 前端：`riveredge-frontend/src/tree-stem/pages/system/custom-fields/`

**建设步骤**：
1. ⏳ 创建数据库模型（CustomField）
2. ⏳ 创建 Schema（数据验证）
3. ⏳ 创建 Service（业务逻辑，包含动态字段扩展服务）
4. ⏳ 创建 API（路由）
5. ⏳ 创建前端页面
6. ⏳ 创建前端服务

---

### 5. 站点设置（第5优先级）

**预计时间**：1-2 周  
**状态**：⏳ 待开始

**依赖**：参数设置（站点设置本质是参数）

**文件位置**：
- 后端：`riveredge-backend/src/tree-root/api/site_settings/`
- 前端：`riveredge-frontend/src/tree-stem/pages/system/site-settings/`

**建设步骤**：
1. ⏳ 创建数据库模型（SiteSettings）
2. ⏳ 创建 Schema（数据验证）
3. ⏳ 创建 Service（业务逻辑，包含邀请码生成和验证）
4. ⏳ 创建 API（路由）
5. ⏳ 创建前端页面
6. ⏳ 创建前端服务

---

### 6. 语言管理（第6优先级）

**预计时间**：1-2 周  
**状态**：⏳ 待开始

**依赖**：无（独立功能）

**文件位置**：
- 后端：`riveredge-backend/src/tree-root/api/languages/`
- 前端：`riveredge-frontend/src/tree-stem/pages/system/languages/`

**建设步骤**：
1. ⏳ 创建数据库模型（Language）
2. ⏳ 创建 Schema（数据验证）
3. ⏳ 创建 Service（业务逻辑，包含多语言服务）
4. ⏳ 创建 API（路由）
5. ⏳ 创建前端页面
6. ⏳ 创建前端服务

---

### 7. 应用中心（第7优先级）

**预计时间**：2-3 周  
**状态**：⏳ 待开始

**依赖**：菜单管理（应用需要菜单）

**文件位置**：
- 后端：`riveredge-backend/src/tree-root/api/applications/`
- 前端：`riveredge-frontend/src/tree-stem/pages/system/applications/`

**建设步骤**：
1. ⏳ 创建数据库模型（Application）
2. ⏳ 创建 Schema（数据验证）
3. ⏳ 创建 Service（业务逻辑，包含插件式应用加载服务）
4. ⏳ 创建 API（路由）
5. ⏳ 创建前端页面
6. ⏳ 创建前端服务

---

### 8. 集成设置（第8优先级）

**预计时间**：2-3 周  
**状态**：⏳ 待开始

**依赖**：参数设置（集成配置本质是参数）

**文件位置**：
- 后端：`riveredge-backend/src/tree-root/api/integration_configs/`
- 前端：`riveredge-frontend/src/tree-stem/pages/system/integration-configs/`

**建设步骤**：
1. ⏳ 创建数据库模型（IntegrationConfig）
2. ⏳ 创建 Schema（数据验证）
3. ⏳ 创建 Service（业务逻辑，包含测试连接功能）
4. ⏳ 创建 API（路由）
5. ⏳ 创建前端页面
6. ⏳ 创建前端服务

---

## 📚 相关文档

- [系统级功能建设计划.md](../系统级功能建设计划.md)
- [系统级功能实施路线图.md](../系统级功能实施路线图.md)
- [第一阶段建设规范](../sys第一阶段/)

---

## 🎯 第二阶段核心目标

### 1. 核心配置体系
- ✅ 数据字典管理（统一数据项管理）
- ✅ 参数设置（系统参数配置）
- ✅ 编码规则（自动编码生成）
- ✅ 自定义字段（动态字段扩展）

### 2. 站点与集成
- ✅ 站点设置（组织基本信息、邀请注册）
- ✅ 语言管理（多语言支持）
- ✅ 应用中心（插件式应用管理）
- ✅ 集成设置（第三方系统集成）

### 3. 统一的设计规范
- ✅ 复用第一阶段的设计规范（混合ID方案、API设计规范、数据库设计规范）
- ✅ 保持代码规范（命名、注释、错误处理）
- ✅ 多租户隔离（所有数据自动过滤 tenant_id）

---

**最后更新**：2025-01-XX

