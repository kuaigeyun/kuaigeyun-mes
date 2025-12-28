# Inngest 架构说明

## Inngest vs Redis 架构对比

### Redis 架构（完全独立）

```
┌─────────────────┐
│  Redis Server   │  ← 独立服务，可以完全独立运行
│  (端口 6379)    │
└────────┬────────┘
         │
         │ 客户端连接（应用主动连接）
         │
         ↓
┌─────────────────┐
│   应用代码      │  ← 使用 redis 客户端库
│  (FastAPI)      │     连接 Redis，读写数据
└─────────────────┘
```

**特点**：
- Redis Server 完全独立，不依赖应用
- 应用通过客户端库连接 Redis
- 应用主动发起操作（读/写）

### Inngest 架构（需要应用配合）

```
┌─────────────────────────┐
│  Inngest Dev Server     │  ← 独立服务，可以独立启动
│  (端口 8288)            │     但需要知道应用的地址
└──────────┬──────────────┘
           │
           │ HTTP 调用（Inngest 主动调用）
           │ GET /api/inngest/serve
           │ POST /api/inngest/function/run
           ↓
┌─────────────────────────┐
│   应用代码 (FastAPI)     │  ← 必须集成 Inngest SDK
│                         │     必须注册 /api/inngest 端点
│  - 集成 inngest SDK     │     必须定义工作流函数
│  - 注册服务端点         │
│  - 定义工作流函数        │
└─────────────────────────┘
```

**特点**：
- Inngest Dev Server 可以独立启动
- **但应用必须运行**，因为 Inngest 需要调用应用的 HTTP 端点
- Inngest Dev Server **主动调用**应用的端点来执行函数

## 关键区别

| 特性 | Redis | Inngest |
|------|-------|---------|
| **服务独立性** | ✅ 完全独立 | ⚠️ 服务独立，但需要应用运行 |
| **通信方向** | 应用 → Redis | Inngest → 应用 |
| **应用集成** | 只需客户端库 | 需要 SDK + 注册端点 + 定义函数 |
| **应用必须运行** | ❌ 不需要（Redis 可单独运行） | ✅ **必须运行**（Inngest 需要调用应用） |

## Inngest 的工作流程

### 1. 启动阶段

```bash
# 1. 启动应用（必须）
./Launch.sh backend
# 应用启动后，注册 /api/inngest 端点

# 2. 启动 Inngest Dev Server（独立启动）
./bin/inngest/start-inngest.sh start
# Inngest 启动后，会调用应用的 /api/inngest/serve 端点
# 发现并注册所有工作流函数
```

### 2. 运行时流程

```
1. 应用发送事件到 Inngest
   POST http://127.0.0.1:8288/api/events
   {
     "name": "test/integration",
     "data": {"message": "Hello"}
   }

2. Inngest Dev Server 接收事件
   → 根据事件名称匹配工作流函数
   → 将函数加入执行队列

3. Inngest Dev Server 调用应用端点执行函数
   POST http://127.0.0.1:8200/api/inngest/function/run
   {
     "function_id": "test-integration",
     "event": {...}
   }

4. 应用执行函数
   → 处理业务逻辑
   → 返回结果

5. Inngest Dev Server 记录执行结果
   → 更新执行状态
   → 处理重试（如果失败）
```

## 为什么应用必须运行？

1. **函数定义在应用中**：工作流函数是在应用代码中定义的，不在 Inngest 中
2. **Inngest 需要调用应用**：Inngest Dev Server 通过 HTTP 调用应用的端点来执行函数
3. **应用提供执行环境**：函数需要访问应用的数据库、服务等资源

## 类比理解

### Redis（数据存储）
- 像"仓库"：应用可以随时存取数据
- 应用不运行时，Redis 仍然可以存储数据
- 应用启动后，可以读取之前存储的数据

### Inngest（工作流引擎）
- 像"任务调度器"：需要"工人"（应用）来执行任务
- 应用不运行时，Inngest 无法执行任务（没有"工人"）
- Inngest 可以接收事件并排队，但必须等应用运行才能执行

## 总结

**Inngest Dev Server** 可以独立启动（类似 Redis），但：

1. ✅ **服务本身独立**：Inngest Dev Server 是一个独立的进程
2. ⚠️ **需要应用配合**：应用必须运行并注册端点
3. ⚠️ **应用必须集成 SDK**：应用代码必须集成 Inngest SDK，定义函数，注册端点

**所以**：
- Inngest Dev Server **可以独立启动**（不依赖应用启动顺序）
- 但应用**必须运行**，否则 Inngest 无法执行工作流
- 应用**必须集成 SDK**，否则 Inngest 无法发现和执行函数

## 实际部署建议

### 开发环境
```bash
# 1. 启动应用
./Launch.sh backend

# 2. 启动 Inngest Dev Server（独立启动）
./bin/inngest/start-inngest.sh start
```

### 生产环境
```bash
# 方式1：使用 Inngest Cloud（推荐）
# - Inngest Cloud 是托管服务，无需自己部署
# - 应用仍然需要集成 SDK 和注册端点

# 方式2：自托管 Inngest Server
# - 部署 Inngest Server（独立服务）
# - 应用部署时集成 SDK 和注册端点
# - Inngest Server 调用应用的端点执行函数
```

## 关键要点

1. **Inngest Dev Server 是独立的**：可以单独启动和管理
2. **但应用必须运行**：因为 Inngest 需要调用应用的 HTTP 端点
3. **应用必须集成 SDK**：需要定义函数、注册端点
4. **这是"反向调用"模式**：Inngest 调用应用，而不是应用调用 Inngest

