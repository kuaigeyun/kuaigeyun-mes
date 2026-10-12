# Top5 菜单性能基线（Network）

度量口径：浏览器 DevTools Network；同一租户暖库；记录关键 GET 的 Waiting (TTFB) + 总时长。

| 菜单 path | 进页关键 API | 详情关键 API | 重 Tab |
|-----------|-------------|-------------|--------|
| `/apps/kuaizhizao/sales-management/sales-orders` | `GET .../sales-orders` | `GET .../sales-orders/{id}` | `.../trace`、`.../attachment-center` |
| `/apps/kuaizhizao/production-execution/work-orders` | `GET .../work-orders` | `GET .../work-orders/{id}` | 同上（document-relations） |
| `/apps/kuaizhizao/purchase-management/purchase-orders` | `GET .../purchase-orders` | `GET .../purchase-orders/{id}` | 同上 |
| `/apps/kuaizhizao/sales-management/outbound` | 出库列表 API | 出库详情 | 同上 |
| `/apps/kuaizhizao/sales-management/quotations` | `GET .../quotations` | 报价详情 | 全链路（若有） |

## API 预算（暖库 p95 目标）

| 场景 | 预算 |
|------|------|
| 列表首屏 GET | &lt; 800ms |
| 详情 GET | &lt; 1500ms |
| trace / attachment-center（简单链） | &lt; 1500ms |
| trace / attachment-center（富链） | &lt; 3000ms |
| 进页 statistics（可延后） | 不阻塞列表首绘 |

## 已测样本（本机 2026-10-13，tenant≈18）

| API | 样例 | 改前 | 改后 |
|-----|------|------|------|
| sales-orders/{id} include_items | XS202610120002 | ~5338ms | ~1000ms |
| document-relations/.../trace | SO 1885 简单 | ~2000ms | ~900ms |
| document-relations/.../trace | SO 1873 富链 | ~10700ms | ~4600–6000ms |
| attachment-center | 随 trace | 略高于 trace | 接近 trace |

## 复测命令（后端墙钟，只读）

```powershell
$env:PYTHONUTF8='1'; $env:PYTHONPATH='D:\kuaigeyun-pro\kuaigeyun\riveredge-backend\src'
# 见 .cursor/memory/features/frontend-perf-baseline.md 与 sales-order-detail-api-perf / document-trace-attach-perf
```

## Chunk 复测

```bash
cd riveredge-frontend && ANALYZE=1 npm run build:analyze
# 打开 dist/stats.html：确认 Top5 列表 chunk 未静态含 univer / libredwg / echarts / xlsx
```

## 自检清单

1. 进页：列表请求是否先于 statistics（`useDeferAfterPaint`；SO/WO/PO 已落地）
2. 详情：是否先开抽屉壳再取数；Tab 是否懒挂载（`DetailDrawerTemplate`）
3. 新建：报价/合同/SO 是否无 `loadMaterialFormReferenceList` 进页预拉
