# 快格轻MES (Kuaimes)

快格轻MES 是 RiverEdge SaaS 平台的插件式应用，提供轻量级制造执行系统功能。

## 插件信息

- **名称**: 快格轻MES
- **代码**: kuaimes
- **版本**: 1.0.0
- **类型**: 业务应用插件

## 目录结构

```
kuaimes/
├── frontend/              # 前端代码
│   ├── src/
│   │   ├── pages/        # 页面组件
│   │   ├── components/   # 组件
│   │   ├── services/     # API 服务
│   │   └── index.tsx     # 插件入口
│   ├── package.json
│   └── vite.config.ts
├── backend/              # 后端代码
│   ├── src/
│   │   ├── api/          # API 路由
│   │   ├── models/        # 数据模型
│   │   ├── services/     # 业务服务
│   │   └── schemas/      # 数据模式
│   └── migrations/        # 数据库迁移
└── manifest.json          # 插件清单文件
```

## 功能模块

- 生产订单管理
- 工单管理
- 生产进度跟踪
- 质量检验
- 设备管理

## 安装说明

1. 将插件目录放置在 `riveredge-apps/` 下
2. 在后端注册插件路由
3. 在前端注册插件路由
4. 在应用中心安装并启用插件

