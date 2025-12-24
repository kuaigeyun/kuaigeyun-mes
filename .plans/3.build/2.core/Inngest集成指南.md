# Inngest 集成指南

## 📋 概述

Inngest 已选定作为流程管理核心库，用于替代 APScheduler、Celery 等任务调度和流程编排工具。

**Inngest 定位**：后端工作流编排引擎（"骨"）
- 负责工作流的实际执行
- 处理任务调度、事件驱动
- 管理工作流状态和日志

**ProFlow 定位**：前端流程图可视化组件（"皮"）
- 负责工作流的可视化设计
- 展示工作流执行状态
- 与 Inngest 配合使用

**Inngest 功能覆盖**：
- ✅ 定时任务（替代 APScheduler）
- ✅ 审批流程（工作流编排，配合 ProFlow 可视化）
- ✅ 消息推送（事件驱动）
- ✅ 电子记录（工作流）
- ✅ 数据备份（定时任务）
- ✅ **AI 融入应用流程**（AI 任务编排、异步处理、多步骤 AI 工作流）

---

## 🔧 技术选型

### Inngest 优势

1. **统一的工作流平台**
   - 一个平台解决所有流程相关需求
   - 统一的任务监控和日志
   - 统一的重试和错误处理

2. **强大的工作流编排**
   - 支持复杂工作流设计
   - 支持条件分支、并行执行
   - 支持工作流状态管理

3. **事件驱动架构**
   - 支持事件触发工作流
   - 支持异步任务处理
   - 支持任务依赖关系

4. **多租户支持**
   - 支持组织隔离
   - 支持按组织过滤任务
   - 支持组织级任务监控

---

## 📦 安装与部署

### 1. Inngest 服务部署

**重要说明**：
- Inngest 服务器本身不是 Python 写的（可能是 Go/TypeScript）
- 我们使用 **Python SDK** 来编写工作流函数
- Inngest 服务器是独立服务，需要单独部署
- **部署方式**：直接运行，不使用 Docker，不使用官方云服务

**安装和运行 Inngest 服务器**

```bash
# 方式一：使用 npm 安装（推荐）
npm install -g inngest

# 运行 Inngest 服务器（开发环境）
inngest dev \
  --database-url=postgresql://user:password@localhost:5432/easthigh \
  --port=8288

# 运行 Inngest 服务器（生产环境）
inngest serve \
  --database-url=postgresql://user:password@localhost:5432/easthigh \
  --port=8288
```

```bash
# 方式二：下载二进制文件直接运行
# 从 Inngest 官方下载对应系统的二进制文件
# https://github.com/inngest/inngest/releases

# 运行
./inngest \
  --database-url=postgresql://user:password@localhost:5432/easthigh \
  --port=8288
```

**配置文件方式（可选）**

```yaml
# inngest.yaml
database:
  url: postgresql://user:password@localhost:5432/easthigh
server:
  port: 8288
```

```bash
# 使用配置文件运行
inngest serve --config inngest.yaml
```

### 2. Python SDK 安装

```bash
pip install inngest
```

**说明**：Python SDK 用于在 FastAPI 中编写工作流函数，不是 Inngest 服务器本身

### 3. 数据库配置

Inngest 需要独立的 PostgreSQL 数据库（或使用现有数据库的不同 schema）

```sql
CREATE DATABASE easthigh;
```

---

## 🔌 FastAPI 集成

### 1. 基础集成

```python
# riveredge-backend/src/soil/core/inngest_client.py
from inngest import Inngest, Event
from inngest.fast_api import serve

# 创建 Inngest 客户端
inngest_client = Inngest(
    app_id="riveredge",
    event_key="your-event-key",
    is_production=False,  # 开发环境
)

# 在 FastAPI 应用中注册
from fastapi import FastAPI

app = FastAPI()

# 注册 Inngest 服务
app.mount("/api/inngest", serve(inngest_client))
```

### 2. 多租户支持

```python
# 所有 Inngest 函数必须包含 tenant_id
@inngest_client.create_function(
    fn_id="send-email",
    trigger=inngest.TriggerEvent(event="email/send"),
)
async def send_email(
    ctx: inngest.Context,
    step: inngest.Step,
) -> dict:
    # 从事件数据中获取 tenant_id
    tenant_id = ctx.event.data.get("tenant_id")
    
    # 验证组织权限
    if not tenant_id:
        raise ValueError("tenant_id is required")
    
    # 执行任务（自动隔离组织数据）
    # ...
```

---

## 📝 功能实现示例

### 1. 定时任务（替代 APScheduler）

```python
# 定时发送邮件任务
@inngest_client.create_function(
    fn_id="scheduled-email",
    trigger=inngest.TriggerCron(cron="0 9 * * *"),  # 每天 9 点
)
async def scheduled_email(
    ctx: inngest.Context,
    step: inngest.Step,
) -> dict:
    tenant_id = ctx.event.data.get("tenant_id")
    
    # 查询需要发送邮件的用户
    users = await User.filter(tenant_id=tenant_id, is_active=True).all()
    
    # 发送邮件
    for user in users:
        await send_email_to_user(user)
    
    return {"success": True, "count": len(users)}
```

### 2. 审批流程（工作流编排）

```python
# 审批流程工作流
@inngest_client.create_function(
    fn_id="approval-workflow",
    trigger=inngest.TriggerEvent(event="approval/submit"),
)
async def approval_workflow(
    ctx: inngest.Context,
    step: inngest.Step,
) -> dict:
    tenant_id = ctx.event.data.get("tenant_id")
    approval_id = ctx.event.data.get("approval_id")
    
    # 步骤1：获取审批信息
    approval = await step.run("get-approval", lambda: get_approval(approval_id))
    
    # 步骤2：通知审批人
    await step.run("notify-approver", lambda: notify_approver(approval))
    
    # 步骤3：等待审批（条件分支）
    result = await step.wait_for_event(
        "approval/response",
        timeout="24h",
        match="data.approval_id",
    )
    
    # 步骤4：处理审批结果
    if result.data.get("approved"):
        await step.run("approve", lambda: process_approval(approval))
    else:
        await step.run("reject", lambda: process_rejection(approval))
    
    return {"success": True}
```

### 3. 消息推送（事件驱动）

```python
# 消息推送工作流
@inngest_client.create_function(
    fn_id="message-push",
    trigger=inngest.TriggerEvent(event="message/send"),
)
async def message_push(
    ctx: inngest.Context,
    step: inngest.Step,
) -> dict:
    tenant_id = ctx.event.data.get("tenant_id")
    message_type = ctx.event.data.get("type")
    recipient = ctx.event.data.get("recipient")
    content = ctx.event.data.get("content")
    
    # 根据消息类型选择发送方式
    if message_type == "email":
        await step.run("send-email", lambda: send_email(recipient, content))
    elif message_type == "sms":
        await step.run("send-sms", lambda: send_sms(recipient, content))
    elif message_type == "push":
        await step.run("send-push", lambda: send_push(recipient, content))
    
    return {"success": True}
```

### 4. AI 融入应用流程（工作流编排）

```python
# AI 文本生成工作流
@inngest_client.create_function(
    fn_id="ai-text-generation",
    trigger=inngest.TriggerEvent(event="ai/generate-text"),
)
async def ai_text_generation(
    ctx: inngest.Context,
    step: inngest.Step,
) -> dict:
    tenant_id = ctx.event.data.get("tenant_id")
    prompt = ctx.event.data.get("prompt")
    model = ctx.event.data.get("model", "gpt-4")
    
    # 步骤1：调用 AI 模型
    ai_response = await step.run(
        "call-ai-model",
        lambda: call_ai_model(prompt, model),
    )
    
    # 步骤2：后处理（格式化、验证等）
    processed_text = await step.run(
        "post-process",
        lambda: post_process_ai_response(ai_response),
    )
    
    # 步骤3：保存结果
    await step.run(
        "save-result",
        lambda: save_ai_result(tenant_id, processed_text),
    )
    
    # 步骤4：触发后续流程（可选）
    await inngest_client.send(
        Event(
            name="ai/result-ready",
            data={
                "tenant_id": tenant_id,
                "result_id": processed_text["id"],
            },
        ),
    )
    
    return {"success": True, "result": processed_text}
```

### 5. AI 多步骤处理流程

```python
# AI 文档分析工作流（多步骤）
@inngest_client.create_function(
    fn_id="ai-document-analysis",
    trigger=inngest.TriggerEvent(event="ai/analyze-document"),
)
async def ai_document_analysis(
    ctx: inngest.Context,
    step: inngest.Step,
) -> dict:
    tenant_id = ctx.event.data.get("tenant_id")
    document_id = ctx.event.data.get("document_id")
    
    # 步骤1：读取文档
    document = await step.run("read-document", lambda: read_document(document_id))
    
    # 步骤2：并行处理多个 AI 任务
    summary = await step.run("ai-summarize", lambda: ai_summarize(document))
    keywords = await step.run("ai-extract-keywords", lambda: ai_extract_keywords(document))
    sentiment = await step.run("ai-sentiment", lambda: ai_sentiment_analysis(document))
    
    # 步骤3：合并结果
    analysis_result = await step.run(
        "merge-results",
        lambda: merge_ai_results(summary, keywords, sentiment),
    )
    
    # 步骤4：保存分析结果
    await step.run("save-analysis", lambda: save_analysis(tenant_id, analysis_result))
    
    return {"success": True, "analysis": analysis_result}
```

### 6. AI 任务重试和错误处理

```python
# AI 任务带重试配置
@inngest_client.create_function(
    fn_id="ai-task-with-retry",
    trigger=inngest.TriggerEvent(event="ai/process"),
    retries=inngest.RetryConfig(
        max_attempts=3,  # AI API 可能不稳定，需要重试
        initial_interval="5s",
        max_interval="1m",
    ),
)
async def ai_task_with_retry(
    ctx: inngest.Context,
    step: inngest.Step,
) -> dict:
    tenant_id = ctx.event.data.get("tenant_id")
    task_data = ctx.event.data.get("data")
    
    try:
        # AI 处理（可能失败，Inngest 会自动重试）
        result = await step.run("ai-process", lambda: ai_process(task_data))
        return {"success": True, "result": result}
    except Exception as e:
        # 记录错误，Inngest 会自动重试
        await log_ai_error(tenant_id, str(e))
        raise  # 重新抛出，让 Inngest 处理重试
```

---

## 🗄️ 数据库设计

### Inngest 任务关联表

```python
# models/inngest_task.py
class InngestTask(BaseModel):
    """
    Inngest 任务关联表
    用于关联业务数据和 Inngest 任务
    """
    id = fields.IntField(pk=True)
    tenant_id = fields.IntField(null=False, index=True)
    
    # 业务关联
    task_type = fields.CharField(max_length=50)  # 任务类型：scheduled_task, approval, message等
    business_id = fields.IntField(null=True)  # 业务ID（如审批ID、消息ID等）
    
    # Inngest 关联
    inngest_function_id = fields.CharField(max_length=100)  # Inngest 函数ID
    inngest_run_id = fields.CharField(max_length=100, null=True)  # Inngest 运行ID
    
    # 任务状态
    status = fields.CharField(max_length=20)  # pending, running, completed, failed
    error_message = fields.TextField(null=True)
    
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)
    
    class Meta:
        table = "root_inngest_tasks"
        indexes = [
            ("tenant_id",),
            ("task_type", "business_id"),
            ("inngest_run_id",),
        ]
```

---

## 🔐 多租户支持

### 1. 事件数据包含 tenant_id

```python
# 发送事件时包含 tenant_id
await inngest_client.send(
    Event(
        name="email/send",
        data={
            "tenant_id": current_tenant_id,
            "recipient": "user@example.com",
            "content": "Hello",
        },
    ),
)
```

### 2. 函数中验证 tenant_id

```python
@inngest_client.create_function(...)
async def my_function(ctx: inngest.Context, step: inngest.Step):
    tenant_id = ctx.event.data.get("tenant_id")
    if not tenant_id:
        raise ValueError("tenant_id is required")
    
    # 所有数据库操作自动过滤 tenant_id
    # ...
```

### 3. 任务监控按组织过滤

```python
# 查询组织的任务
tasks = await InngestTask.filter(tenant_id=current_tenant_id).all()
```

---

## 📊 任务监控

### 1. Inngest Dashboard

- 访问 Inngest Dashboard（本地：http://localhost:8288）
- 查看任务执行状态
- 查看任务日志
- 查看任务重试情况

### 2. 自定义监控

```python
# 查询任务状态
async def get_task_status(run_id: str, tenant_id: int):
    task = await InngestTask.filter(
        inngest_run_id=run_id,
        tenant_id=tenant_id,
    ).first()
    
    if task:
        return {
            "status": task.status,
            "error": task.error_message,
        }
    
    # 从 Inngest API 获取状态
    # ...
```

---

## 🎨 ProFlow 与 Inngest 配合

### 1. 工作流设计流程

```
前端 ProFlow 设计
    ↓
转换为 Inngest 配置（JSON）
    ↓
保存到数据库
    ↓
注册到 Inngest
    ↓
Inngest 执行工作流
    ↓
ProFlow 展示执行状态
```

### 2. ProFlow 设计 → Inngest 配置

```typescript
// 前端：ProFlow 设计工作流
const workflowDesign = {
  nodes: [
    { id: 'start', type: 'start', label: '开始' },
    { id: 'approve1', type: 'approve', label: '审批节点1' },
    { id: 'approve2', type: 'approve', label: '审批节点2' },
    { id: 'end', type: 'end', label: '结束' },
  ],
  edges: [
    { source: 'start', target: 'approve1' },
    { source: 'approve1', target: 'approve2' },
    { source: 'approve2', target: 'end' },
  ],
};

// 转换为 Inngest 工作流配置
const inngestConfig = convertProFlowToInngest(workflowDesign);
// {
//   steps: [
//     { id: 'approve1', fn: 'approval-step', ... },
//     { id: 'approve2', fn: 'approval-step', ... },
//   ],
// }
```

### 3. Inngest 执行状态 → ProFlow 展示

```typescript
// 从 Inngest 获取执行状态
const executionStatus = await getInngestExecutionStatus(runId);

// ProFlow 展示执行状态
<ProFlow
  nodes={workflowDesign.nodes.map(node => ({
    ...node,
    status: executionStatus[node.id], // 执行状态
  }))}
  edges={workflowDesign.edges}
/>
```

### 4. 实时状态同步

```typescript
// 使用 WebSocket 或轮询获取 Inngest 执行状态
useEffect(() => {
  const interval = setInterval(async () => {
    const status = await getInngestExecutionStatus(runId);
    setExecutionStatus(status);
  }, 1000);
  
  return () => clearInterval(interval);
}, [runId]);
```

---

## 🚀 最佳实践

### 1. 函数命名规范

```python
# 推荐：使用业务领域前缀
@inngest_client.create_function(
    fn_id="email-send",  # 邮件发送
    ...
)

@inngest_client.create_function(
    fn_id="approval-process",  # 审批流程
    ...
)

@inngest_client.create_function(
    fn_id="backup-database",  # 数据备份
    ...
)
```

### 2. 错误处理

```python
@inngest_client.create_function(...)
async def my_function(ctx: inngest.Context, step: inngest.Step):
    try:
        # 执行任务
        result = await step.run("do-something", lambda: do_something())
        return result
    except Exception as e:
        # 记录错误
        await log_error(ctx.event.data.get("tenant_id"), str(e))
        # 重新抛出异常，让 Inngest 处理重试
        raise
```

### 3. 任务重试配置

```python
@inngest_client.create_function(
    fn_id="my-function",
    trigger=...,
    retries=inngest.RetryConfig(
        max_attempts=3,
        initial_interval="1m",
        max_interval="10m",
    ),
)
```

---

## 📚 相关文档

- [Inngest 官方文档](https://www.inngest.com/docs)
- [Inngest Python SDK](https://www.inngest.com/docs/sdk/python)
- [Inngest 工作流设计](https://www.inngest.com/docs/guides/workflows)

---

**最后更新**：2025-01-XX

