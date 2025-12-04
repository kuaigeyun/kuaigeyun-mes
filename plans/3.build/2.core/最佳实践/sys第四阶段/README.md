# 第四阶段：流程管理建设（以 Inngest 为核心）

## 📋 概述

第四阶段是系统级功能建设的流程管理阶段，**以 Inngest 为核心**，建立流程管理和自动化功能。

**建设时间**：12-18 周  
**状态**：⏳ **待开始**

**核心原则**：
- ✅ **Inngest 是流程管理的核心引擎**，所有流程相关功能都基于 Inngest
- ✅ **统一使用 Inngest** 处理定时任务、工作流编排、事件驱动等功能
- ✅ **ProFlow 作为前端可视化组件**，与 Inngest 配合使用

---

## 📁 本文件夹内容

本文件夹包含第四阶段建设所需的所有规划文档：

1. **最佳实践文档**：
   - [1.消息管理最佳实践.md](./1.消息管理最佳实践.md)（基于 Inngest 事件驱动）
   - [2.定时任务最佳实践.md](./2.定时任务最佳实践.md)（基于 Inngest 定时触发器）
   - [3.审批流程最佳实践.md](./3.审批流程最佳实践.md)（基于 Inngest 工作流编排 + ProFlow）
   - [4.电子记录最佳实践.md](./4.电子记录最佳实践.md)（基于 Inngest 工作流）
   - [5.脚本管理最佳实践.md](./5.脚本管理最佳实践.md)
   - [6.打印模板最佳实践.md](./6.打印模板最佳实践.md)
   - [7.打印设备最佳实践.md](./7.打印设备最佳实践.md)

2. **规范文档**：
   - [前端页面布局规范.md](./前端页面布局规范.md)（复用第三阶段规范）
   - [系统级功能文件结构规划.md](./系统级功能文件结构规划.md)（复用第三阶段规范）

3. **技术选型文档**：
   - [库选择评估总结.md](./库选择评估总结.md)（各模块库选择评估汇总）
   - [Inngest 集成指南.md](./Inngest集成指南.md)（Inngest 详细集成说明）

4. **开发计划**：
   - [建设进度.md](./建设进度.md)（开发进度跟踪）

5. **建设总结**：
   - [第四阶段建设总结.md](./第四阶段建设总结.md)（待建设完成后填写）

---

## 🚀 建设顺序

### 1. 消息管理（第1优先级）

**预计时间**：2-3 周  
**状态**：⏳ 待开始

**依赖**：无（独立功能）

**核心特点**：
- ✅ **基于 Inngest 事件驱动**：消息推送通过 Inngest 事件触发
- ✅ **工作流编排**：邮件、短信、站内信、推送通知都通过 Inngest 工作流处理
- ✅ **异步处理**：所有消息发送都是异步的，通过 Inngest 执行

**文件位置**：
- 后端：`riveredge-backend/src/tree_root/api/messages/`
- 前端：`riveredge-frontend/src/tree-stem/pages/system/messages/`

**建设步骤**：
1. ⏳ 创建数据库模型（MessageConfig、MessageTemplate）
2. ⏳ 创建 Schema（数据验证）
3. ⏳ 创建 Service（业务逻辑，包含 Inngest 事件触发）
4. ⏳ 创建 Inngest 函数（消息发送工作流）
5. ⏳ 创建 API（路由）
6. ⏳ 创建数据库迁移
7. ⏳ 创建前端页面和服务

**关键技术**：
- Inngest（事件驱动、工作流编排）
- aiosmtplib（异步邮件发送）
- websockets（WebSocket 支持）

---

### 2. 定时任务（第2优先级）

**预计时间**：2-3 周  
**状态**：⏳ 待开始

**依赖**：无（独立功能）

**核心特点**：
- ✅ **完全基于 Inngest**：替代 APScheduler，所有定时任务都通过 Inngest 执行
- ✅ **支持多种触发器**：cron、interval、date
- ✅ **任务持久化**：任务状态保存在 Inngest 数据库中
- ✅ **任务监控**：通过 Inngest API 监控任务执行状态

**文件位置**：
- 后端：`riveredge-backend/src/tree_root/api/scheduled_tasks/`
- 前端：`riveredge-frontend/src/tree-stem/pages/system/scheduled-tasks/`

**建设步骤**：
1. ⏳ 创建数据库模型（ScheduledTask）
2. ⏳ 创建 Schema（数据验证）
3. ⏳ 创建 Service（业务逻辑，包含 Inngest 函数注册）
4. ⏳ 创建 Inngest 函数（定时任务执行函数）
5. ⏳ 创建 API（路由）
6. ⏳ 创建数据库迁移
7. ⏳ 创建前端页面和服务

**关键技术**：
- Inngest（定时触发器、任务执行）

---

### 3. 审批流程（第3优先级）

**预计时间**：3-4 周  
**状态**：⏳ 待开始

**依赖**：用户管理、消息管理（审批需要通知）

**核心特点**：
- ✅ **基于 Inngest 工作流编排**：所有审批流程都通过 Inngest 工作流执行
- ✅ **ProFlow 可视化设计**：前端使用 ProFlow 设计审批流程
- ✅ **工作流转换**：ProFlow 设计转换为 Inngest 工作流配置
- ✅ **状态同步**：Inngest 工作流状态同步到数据库

**文件位置**：
- 后端：`riveredge-backend/src/tree_root/api/approval_processes/`
- 前端：`riveredge-frontend/src/tree-stem/pages/system/approval-processes/`

**建设步骤**：
1. ⏳ 安装 ProFlow：`npm install @ant-design/pro-flow`
2. ⏳ 创建数据库模型（ApprovalProcess、ApprovalInstance）
3. ⏳ 创建 Schema（数据验证）
4. ⏳ 创建 Service（业务逻辑，包含 Inngest 工作流注册）
5. ⏳ 创建 Inngest 函数（审批工作流执行函数）
6. ⏳ 创建 API（路由）
7. ⏳ 创建数据库迁移
8. ⏳ 创建前端页面（ProFlow 流程设计器、审批实例管理）
9. ⏳ 创建前端服务

**关键技术**：
- Inngest（工作流编排引擎，"骨"）
- @ant-design/pro-flow（流程图可视化组件，"皮"）

**工作流程**：
1. **设计阶段**：使用 ProFlow 在前端可视化设计审批流程
2. **配置阶段**：将 ProFlow 设计的流程转换为 Inngest 工作流配置
3. **注册阶段**：将工作流配置注册到 Inngest
4. **执行阶段**：Inngest 执行工作流，ProFlow 展示执行状态
5. **监控阶段**：ProFlow 实时展示工作流执行进度和结果

---

### 4. 电子记录（第4优先级）

**预计时间**：2-3 周  
**状态**：⏳ 待开始

**依赖**：文件管理（电子记录可能需要附件）、Inngest（工作流）

**核心特点**：
- ✅ **基于 Inngest 工作流**：签名、归档流程都通过 Inngest 工作流执行
- ✅ **生命周期管理**：记录的生命周期通过 Inngest 工作流管理

**文件位置**：
- 后端：`riveredge-backend/src/tree_root/api/electronic_records/`
- 前端：`riveredge-frontend/src/tree-stem/pages/system/electronic-records/`

**建设步骤**：
1. ⏳ 创建数据库模型（ElectronicRecord）
2. ⏳ 创建 Schema（数据验证）
3. ⏳ 创建 Service（业务逻辑，包含 Inngest 工作流注册）
4. ⏳ 创建 Inngest 函数（签名、归档工作流）
5. ⏳ 创建 API（路由）
6. ⏳ 创建数据库迁移
7. ⏳ 创建前端页面和服务

**关键技术**：
- Inngest（工作流编排）

---

### 5. 脚本管理（第5优先级）

**预计时间**：1-2 周  
**状态**：⏳ 待开始

**依赖**：无（独立功能）

**核心特点**：
- ✅ **可选集成 Inngest**：脚本执行可以通过 Inngest 异步执行（可选）
- ✅ **支持多种脚本类型**：JavaScript、Python等

**文件位置**：
- 后端：`riveredge-backend/src/tree_root/api/scripts/`
- 前端：`riveredge-frontend/src/tree-stem/pages/system/scripts/`

**建设步骤**：
1. ⏳ 创建数据库模型（Script）
2. ⏳ 创建 Schema（数据验证）
3. ⏳ 创建 Service（业务逻辑，可选集成 Inngest）
4. ⏳ 创建 API（路由）
5. ⏳ 创建数据库迁移
6. ⏳ 创建前端页面和服务

**关键技术**：
- PyExecJS（JavaScript 执行）
- Inngest（可选，异步脚本执行）

---

### 6. 打印模板（第6优先级）

**预计时间**：2-3 周  
**状态**：⏳ 待开始

**依赖**：无（独立功能）

**核心特点**：
- ✅ **可选集成 Inngest**：打印任务可以通过 Inngest 异步执行（可选）

**文件位置**：
- 后端：`riveredge-backend/src/tree_root/api/print_templates/`
- 前端：`riveredge-frontend/src/tree-stem/pages/system/print-templates/`

**建设步骤**：
1. ⏳ 创建数据库模型（PrintTemplate）
2. ⏳ 创建 Schema（数据验证）
3. ⏳ 创建 Service（业务逻辑，可选集成 Inngest）
4. ⏳ 创建 API（路由）
5. ⏳ 创建数据库迁移
6. ⏳ 创建前端页面和服务

**关键技术**：
- reportlab（PDF 生成）
- weasyprint（可选，HTML 转 PDF）
- Inngest（可选，异步打印任务）

---

### 7. 打印设备（第7优先级）

**预计时间**：1-2 周  
**状态**：⏳ 待开始

**依赖**：打印模板（打印需要模板）

**核心特点**：
- ✅ **可选集成 Inngest**：打印任务可以通过 Inngest 异步执行（可选）

**文件位置**：
- 后端：`riveredge-backend/src/tree_root/api/print_devices/`
- 前端：`riveredge-frontend/src/tree-stem/pages/system/print-devices/`

**建设步骤**：
1. ⏳ 创建数据库模型（PrintDevice）
2. ⏳ 创建 Schema（数据验证）
3. ⏳ 创建 Service（业务逻辑，可选集成 Inngest）
4. ⏳ 创建 API（路由）
5. ⏳ 创建数据库迁移
6. ⏳ 创建前端页面和服务

**关键技术**：
- pycups（可选，Linux 打印支持）
- Inngest（可选，异步打印任务）

---

## 📚 相关文档

- [系统级功能建设计划.md](../系统级功能建设计划.md)
- [第三阶段建设规范](../sys第三阶段/)
- [第二阶段建设规范](../sys第二阶段/)
- [第一阶段建设规范](../sys第一阶段/)

---

## 🎯 第四阶段核心目标

### 1. 以 Inngest 为核心的流程管理

- ✅ **定时任务**：完全基于 Inngest，替代 APScheduler
- ✅ **审批流程**：基于 Inngest 工作流编排 + ProFlow 可视化
- ✅ **消息推送**：基于 Inngest 事件驱动
- ✅ **电子记录**：基于 Inngest 工作流
- ✅ **脚本管理**：可选集成 Inngest 异步执行
- ✅ **打印功能**：可选集成 Inngest 异步执行

### 2. 统一的设计规范

- ✅ 复用第一、第二、第三阶段的设计规范（混合ID方案、API设计规范、数据库设计规范）
- ✅ 保持代码规范（命名、注释、错误处理）
- ✅ 多租户隔离（所有数据自动过滤 tenant_id）
- ✅ 前端页面布局规范（UniTable、Modal、Drawer 标准用法）

### 3. 经验教训应用

- ✅ **禁止假设和猜测**：必须直接查看实际代码，使用完全相同的值
- ✅ **禁止擅作主张**：只做用户明确要求的事，不做额外"优化"
- ✅ **数据库迁移规范**：必须使用 Aerich 迁移系统，禁止直接使用 SQL
- ✅ **前端搜索规范**：必须使用高级搜索（`showAdvancedSearch={true}`），使用 `searchFormValues` 获取搜索条件
- ✅ **UniTable 规范**：`request` 函数必须接收四个参数：`(params, sort, _filter, searchFormValues)`

---

## ⚠️ 重要注意事项

### 1. Inngest 是核心

**必须遵守的原则**：
1. ✅ **所有流程相关功能都基于 Inngest**：定时任务、工作流编排、事件驱动
2. ✅ **统一使用 Inngest**：不要混用其他任务调度库（如 APScheduler）
3. ✅ **Inngest 函数必须包含 tenant_id**：确保多租户隔离
4. ✅ **Inngest 工作流状态同步**：工作流执行状态需要同步到数据库

### 2. ProFlow 与 Inngest 配合

**工作流程**：
1. **设计阶段**：ProFlow 可视化设计工作流
2. **转换阶段**：ProFlow 设计转换为 Inngest 工作流配置
3. **注册阶段**：Inngest 工作流配置注册到 Inngest
4. **执行阶段**：Inngest 执行工作流
5. **监控阶段**：ProFlow 展示 Inngest 工作流执行状态

### 3. 开发顺序

**严格按照依赖关系开发**：
1. **消息管理**（第1优先级）- 无依赖，可立即开始
2. **定时任务**（第2优先级）- 无依赖，可并行开发
3. **审批流程**（第3优先级）- 依赖消息管理，需等待消息管理完成后开始
4. **电子记录**（第4优先级）- 依赖文件管理和 Inngest，需等待文件管理和 Inngest 集成完成后开始
5. **脚本管理**（第5优先级）- 无依赖，可并行开发
6. **打印模板**（第6优先级）- 无依赖，可并行开发
7. **打印设备**（第7优先级）- 依赖打印模板，需等待打印模板完成后开始

---

**最后更新**：2025-01-XX

