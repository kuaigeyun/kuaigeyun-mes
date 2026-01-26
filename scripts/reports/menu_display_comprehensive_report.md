# 应用菜单显示全面检查报告

## 检查时间
2026-01-22

## 检查范围
1. ✅ 左侧菜单显示
2. ✅ UNITABS（标签栏）显示
3. ✅ 面包屑显示
4. ✅ 翻译文件（zh-CN.ts, en-US.ts）
5. ✅ manifest.json 配置
6. ✅ 数据库存储
7. ✅ 代码硬编码映射

## 菜单显示逻辑总结

### 1. 左侧菜单
- **位置**: `BasicLayout.tsx` -> `convertMenuTreeToMenuDataItem`
- **逻辑**: 
  - 应用菜单：使用 `translateAppMenuItemName(menu.name, menu.path, t)`
  - 系统菜单：使用 `translateMenuName(menu.name, t)`
- **数据源**: 从数据库获取菜单树（`getMenuTree`）
- **优先级**: 数据库名称 → 翻译 key → 硬编码映射

### 2. UNITABS（标签栏）
- **位置**: `UniTabs/index.tsx` -> `getTabTitle`
- **逻辑**: 使用 `findMenuTitleWithTranslation(path, menuConfig, t)`
- **数据源**: 从 `menuConfig`（包含系统菜单和应用菜单）查找
- **优先级**: 菜单配置中的名称 → 翻译 key → 硬编码映射

### 3. 面包屑
- **位置**: `BasicLayout.tsx` -> `generateBreadcrumb`
- **逻辑**: 
  - 使用 `translateAppMenuItemName` 或 `translateMenuName` 翻译
  - 使用 `findMenuTitleWithTranslation` 查找标题
- **数据源**: 从 `menuConfig` 查找
- **优先级**: 菜单配置中的名称 → 翻译 key → 硬编码映射

### 4. 翻译优先级（translateAppMenuItemName）
1. 如果 `name` 是翻译 key（包含点号），直接翻译
2. 尝试 `app.{app-code}.menu.{menu-path}` 格式的翻译 key
3. 尝试 `app.{app-code}.menu.{last-segment}` 格式的翻译 key
4. 尝试 `path.{relative-path}` 格式的翻译 key
5. 如果都找不到，返回原始 `name`（数据库中的名称）

## 当前菜单配置（已统一）

### 工厂数据
- ✅ 厂区管理
- ✅ 车间管理
- ✅ 产线管理
- ✅ 工位管理

### 仓库数据
- ✅ 仓库管理
- ✅ 库区管理
- ✅ 库位管理

### 物料数据
- ✅ 变体属性
- ✅ 物料管理
- ✅ 物料清单BOM
- ✅ 批号管理
- ✅ 序列号管理

### 工艺数据
- ✅ 不良品类型
- ✅ 工序
- ✅ 工艺路线
- ✅ 作业程序

### 供应链数据
- ✅ 客户
- ✅ 供应商

### 绩效数据
- ✅ 假期设置
- ✅ 技能管理

## 检查结果

✅ **所有菜单显示一致！**

所有菜单在以下位置显示统一：
- manifest.json ✅
- 数据库 ✅
- zh-CN 翻译文件 ✅
- en-US 翻译文件 ✅
- 硬编码映射 ✅

## 已完成的修复

1. ✅ 更新 BOM 为"物料清单BOM"
2. ✅ 统一菜单命名（添加"管理"后缀）
3. ✅ 补充缺失的翻译 key
4. ✅ 更新硬编码映射
5. ✅ 同步数据库菜单

## 注意事项

1. **前端缓存**: 如果菜单显示未更新，请清除浏览器 localStorage 缓存
2. **翻译优先级**: 翻译 key 会覆盖数据库中的名称，确保翻译 key 与数据库名称一致
3. **硬编码映射**: 作为最后的后备方案，只在翻译 key 不存在时使用
