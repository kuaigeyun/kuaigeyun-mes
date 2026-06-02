# @riveredge/hmi-ui

RiverEdge 工业 HMI 设计体系：Design Token + 触屏组件 + 布局壳。

## 使用

在应用入口：

```tsx
import '@riveredge/hmi-ui/styles/hmi.css';
// 工位客户端 additionally:
import '@riveredge/hmi-ui/styles/station.css';

document.documentElement.classList.add('hmi-root');
```

Vite alias（两个子项目均已配置）：

```ts
'@riveredge/hmi-ui': resolve(__dirname, '../riveredge-hmi-ui/src')
```

## 导出

| 模块 | 内容 |
|------|------|
| `@riveredge/hmi-ui/tokens` | `HMI_DESIGN_TOKENS`, `HMI_LAYOUT`, `HMI_TOUCH`, `createHmiTheme()` |
| `@riveredge/hmi-ui` | `HmiButton`, `HmiInput`, `HmiCard`, `HmiChip`, `HmiActionBar`, `HmiMetricsBar`, `HmiWorkbench` 等 |

## 规范

- 状态色、触控尺寸对齐 ISA-101 / 主流 MES 工位 HMI
- 根节点 class `hmi-root` 启用样式作用域
- Web 生产终端 kiosk 与 Electron 工位端共用同一 Token 源
