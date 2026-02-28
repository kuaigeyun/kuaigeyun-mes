# RiverEdge 项目规范

## 一、前端 (riveredge-frontend)

### 1.1 目录结构

- **config/**：统一配置目录，所有业务配置集中于此
- **apps/{app}/pages/**：按业务域组织，如 `plan-management`、`production-execution`
- **apps/{app}/services/**：API 服务，kebab-case 命名
- **apps/{app}/components/**：应用级组件，通过 `index.ts` 统一导出

### 1.2 命名约定

| 类型 | 约定 | 示例 |
|------|------|------|
| 目录 | kebab-case | `purchase-management`, `work-orders` |
| 服务文件 | kebab-case | `sales-forecast.ts`, `document-relation.ts` |
| 组件文件 | PascalCase | `ProcessInspectionModal.tsx`, `StationBinder.tsx` |
| 页面入口 | `index.tsx` | `pages/demand-management/index.tsx` |
| 配置文件 | camelCase | `printTemplateSchemas.ts`, `codeRulePages.ts` |

### 1.3 Barrel 文件

- `apps/kuaizhizao/services/index.ts`：导出所有服务
- `apps/kuaizhizao/components/index.ts`：导出应用级组件
- 支持 `import { GanttSchedulingChart } from '../components'` 等形式

---

## 二、后端 (riveredge-backend)

### 2.1 目录结构

- **models/**：数据模型，snake_case
- **services/**：业务服务，`{entity}_service.py`
- **schemas/**：Pydantic 验证，按模块分组
- **api/**：路由层，子目录对应资源

### 2.2 命名约定

| 类型 | 约定 | 示例 |
|------|------|------|
| Python 文件 | snake_case | `purchase_order.py`, `sales_service.py` |
| 模型类 | PascalCase | `PurchaseOrder`, `SalesForecast` |
| API 目录 | 复数形式（推荐） | `purchases`, `sales_orders` |

### 2.3 工具链

- **Black**：代码格式化
- **Ruff**：Lint + import 排序
- 配置见 `pyproject.toml`

---

## 三、通用

### 3.1 EditorConfig

项目根目录 `.editorconfig` 统一：

- 缩进：2 空格（TS/JS），4 空格（Python）
- 换行符：LF
- 删除行尾空格
- 文件末尾保留空行

### 3.2 新增规范

- 新增配置：放入 `config/`，勿新建 `configs/`
- 新增应用级组件：在 `components/index.ts` 中补充导出
