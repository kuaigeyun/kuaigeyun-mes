# 应用菜单显示全面检查报告

## 检查范围
1. 左侧菜单显示
2. UNITABS（标签栏）显示
3. 面包屑显示
4. 翻译文件（zh-CN.ts, en-US.ts）
5. manifest.json 配置
6. 数据库存储
7. 代码硬编码

## 菜单显示逻辑

### 1. 左侧菜单
- **位置**: `BasicLayout.tsx` -> `convertMenuTreeToMenuDataItem`
- **逻辑**: 
  - 使用 `translateAppMenuItemName(menu.name, menu.path, t)` 翻译应用菜单
  - 使用 `translateMenuName(menu.name, t)` 翻译系统菜单
- **数据源**: 从数据库获取菜单树（`getMenuTree`）

### 2. UNITABS（标签栏）
- **位置**: `UniTabs/index.tsx` -> `getTabTitle`
- **逻辑**: 
  - 使用 `findMenuTitleWithTranslation(path, menuConfig, t)`
  - 内部调用 `translateAppMenuItemName` 或 `translateMenuName`
- **数据源**: 从 `menuConfig`（包含系统菜单和应用菜单）查找

### 3. 面包屑
- **位置**: `BasicLayout.tsx` -> `generateBreadcrumb`
- **逻辑**: 
  - 使用 `translateAppMenuItemName` 或 `translateMenuName` 翻译
  - 使用 `findMenuTitleWithTranslation` 查找标题
- **数据源**: 从 `menuConfig` 查找

### 4. 翻译优先级
`translateAppMenuItemName` 的翻译优先级：
1. 如果 `name` 是翻译 key（包含点号），直接翻译
2. 尝试 `app.{app-code}.menu.{menu-path}` 格式的翻译 key
3. 尝试 `app.{app-code}.menu.{last-segment}` 格式的翻译 key
4. 尝试 `path.{relative-path}` 格式的翻译 key
5. 如果都找不到，返回原始 `name`（数据库中的名称）

## 当前菜单配置

### manifest.json 中的菜单
- 厂区管理
- 车间
- 产线
- 工位
- 仓库管理
- 库区管理
- 库位管理
- 变体属性
- 物料管理
- 物料清单BOM
- 批号管理
- 序列号管理
- 不良品
- 工序
- 工艺路线
- 作业程序
- 客户
- 供应商
- 假期
- 技能

### 数据库中的菜单
✅ 所有菜单名称与 manifest.json 一致

### 翻译文件检查
需要检查每个菜单的翻译 key 是否存在且正确
