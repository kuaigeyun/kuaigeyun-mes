# Inngest 函数清理建议

## 📋 当前状态分析

### 已注册的 Inngest 函数（共10个）

#### ✅ 系统级核心功能（建议保留）

1. **`message_sender_function`** - 消息发送工作流
   - **状态**: ✅ 正在使用
   - **调用位置**: `MessageService.send_message()` 发送 `message/send` 事件
   - **建议**: **保留** - 系统级核心功能，消息系统必需

2. **`approval_workflow_function`** - 审批流程工作流
   - **状态**: ✅ 系统级功能
   - **事件**: `approval/submit`
   - **建议**: **保留** - 审批流程是系统级核心功能

3. **`approval_action_workflow_function`** - 审批动作工作流
   - **状态**: ✅ 系统级功能
   - **事件**: `approval/action`
   - **建议**: **保留** - 审批流程的一部分

4. **`scheduled_task_executor_function`** - 定时任务执行
   - **状态**: ⚠️ 可能未使用
   - **事件**: `scheduled-task/execute`
   - **建议**: **保留** - 定时任务系统的基础功能，未来可能需要

5. **`scheduled_task_scheduler_function`** - 定时任务调度器
   - **状态**: ⚠️ 可能未使用
   - **触发**: Cron `* * * * *`（每分钟）
   - **建议**: **保留** - 定时任务系统的基础功能，未来可能需要

#### ⚠️ 应用级功能（根据新计划评估）

6. **`sop_execution_workflow_function`** - SOP执行流程工作流
   - **状态**: ✅ master_data 应用功能
   - **事件**: `sop/start`
   - **建议**: **保留** - master_data 应用的核心功能，新计划中需要

7. **`sop_node_complete_workflow_function`** - SOP节点完成工作流
   - **状态**: ✅ master_data 应用功能
   - **事件**: `sop/node-complete`
   - **建议**: **保留** - master_data 应用的核心功能

#### ❓ 可能不需要的功能（建议清理）

8. **`test_integration_function`** - 测试集成函数
   - **状态**: ⚠️ 仅用于测试
   - **事件**: `test/integration`
   - **建议**: **可选保留** - 可以保留用于开发测试，或移动到测试目录

9. **`data_backup_executor_function`** - 数据备份执行
   - **状态**: ❌ 可能未使用
   - **事件**: `backup/execute`
   - **建议**: **清理** - 如果当前不需要数据备份功能，可以清理

10. **`scheduled_backup_scheduler_function`** - 数据备份调度器
    - **状态**: ❌ 可能未使用
    - **触发**: Cron（需要检查）
    - **建议**: **清理** - 如果当前不需要数据备份功能，可以清理

---

## 🎯 新开发计划需要的 Inngest 工作流

根据 `详细功能点开发清单-优化版.md`，新计划需要以下工作流：

### kuaizhizao（快智造）应用需要：

1. **工单状态流转工作流** - ❌ 未实现
   - 事件: `work-order/status-change`
   - 功能: 工单状态变更时的自动化处理

2. **MRP/LRP运算工作流** - ❌ 未实现
   - 事件: `mrp/calculate` 或 `lrp/calculate`
   - 功能: 物料需求计划/生产计划运算

3. **报工数据采集工作流** - ❌ 未实现
   - 事件: `work-report/submit`
   - 功能: 报工数据提交后的处理

4. **库存更新工作流** - ❌ 未实现
   - 事件: `inventory/update`
   - 功能: 库存变更后的相关处理

5. **报表生成工作流** - ❌ 未实现
   - 事件: `report/generate`
   - 功能: 异步报表生成

---

## 📝 清理建议

### 方案一：保守清理（推荐）

**清理的函数：**
- `data_backup_executor_function` - 数据备份执行
- `scheduled_backup_scheduler_function` - 数据备份调度器

**保留的函数：**
- 所有系统级核心功能（消息、审批、定时任务）
- master_data 应用功能（SOP执行流程）
- `test_integration_function` - 保留用于开发测试

**优点：**
- 保留所有可能需要的功能
- 只清理明确不需要的功能
- 风险低

**缺点：**
- 可能保留了一些暂时不用的函数

### 方案二：激进清理

**清理的函数：**
- `data_backup_executor_function` - 数据备份执行
- `scheduled_backup_scheduler_function` - 数据备份调度器
- `test_integration_function` - 移动到测试目录或删除
- `scheduled_task_executor_function` - 如果确认不需要定时任务
- `scheduled_task_scheduler_function` - 如果确认不需要定时任务

**保留的函数：**
- 消息发送工作流
- 审批流程工作流
- SOP执行流程工作流

**优点：**
- 代码更简洁
- 只保留当前需要的功能

**缺点：**
- 如果未来需要定时任务，需要重新实现
- 风险较高

---

## 🔧 清理步骤

### 1. 备份当前代码

```bash
# 创建备份分支
git checkout -b backup/inngest-functions-$(date +%Y%m%d)
git add .
git commit -m "备份：Inngest函数清理前的状态"
git checkout main
```

### 2. 清理不需要的函数文件

```bash
# 删除数据备份相关函数
rm riveredge-backend/src/core/inngest/functions/data_backup_executor.py

# （可选）移动测试函数到测试目录
mkdir -p riveredge-backend/tests/inngest
mv riveredge-backend/src/core/inngest/functions/test_function.py riveredge-backend/tests/inngest/
```

### 3. 更新 `__init__.py`

从 `riveredge-backend/src/core/inngest/functions/__init__.py` 中移除已删除函数的导入。

### 4. 更新 `main.py`

从 `riveredge-backend/src/server/main.py` 中移除已删除函数的注册。

### 5. 检查数据库

如果数据备份功能有相关的数据库表或记录，也需要清理。

---

## ✅ 推荐方案

**建议采用方案一（保守清理）**：

1. **清理**：
   - `data_backup_executor_function`
   - `scheduled_backup_scheduler_function`

2. **保留**：
   - 所有系统级核心功能
   - master_data 应用功能
   - `test_integration_function`（用于开发测试）

3. **后续开发**：
   - 根据 kuaizhizao 开发进度，逐步添加新的工作流函数
   - 保持代码整洁，及时清理不需要的功能

---

## 📅 清理时间表

- **立即清理**：数据备份相关函数（如果确认不需要）
- **开发过程中**：根据实际使用情况，逐步清理未使用的函数
- **新功能开发**：为 kuaizhizao 应用添加新的工作流函数

---

## ⚠️ 注意事项

1. **清理前确认**：
   - 确认数据备份功能是否真的不需要
   - 检查是否有其他代码依赖这些函数

2. **清理后验证**：
   - 启动服务，确认没有导入错误
   - 测试保留的功能是否正常工作
   - 检查 Inngest Dashboard 中的函数注册情况

3. **版本控制**：
   - 使用 Git 分支进行清理
   - 保留清理前的备份
   - 清理后立即测试

