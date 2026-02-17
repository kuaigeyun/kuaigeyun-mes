# Univer 编辑器修复说明

## 问题描述

编辑页面能看到工具栏，但编辑区无法进行编辑，无法进行任何输入。

## 修复内容

### 1. 修复了插件注册顺序

根据 Univer 官方文档，正确的插件注册顺序应该是：

1. `UniverRenderEnginePlugin` - 渲染引擎
2. `UniverFormulaEnginePlugin` - 公式引擎
3. `UniverUIPlugin` - UI 插件（需要 container 配置）
4. `UniverDocsPlugin` - 文档插件
5. `UniverDocsUIPlugin` - 文档 UI 插件

### 2. 移除了不必要的插件

- 移除了 `UniverNetworkPlugin`，因为文档编辑器不需要网络插件

### 3. 移除了可能导致问题的配置

- 移除了 `disableAutoFocus` 配置
- 移除了 `UniverDocsPlugin` 的 `hasScroll` 配置
- 移除了 `UniverDocsUIPlugin` 的 `container` 配置

### 4. 简化了文档实例创建

- 移除了 `makeCurrent` 选项，使用默认行为

## 测试步骤

1. **启动开发服务器**（已完成）

   - 服务器运行在：http://localhost:8101/

2. **登录系统**

   - 打开浏览器访问 http://localhost:8101/
   - 使用你的账号登录

3. **导航到打印模板设计页面**

   - 在菜单中找到"系统管理" -> "打印模板"
   - 选择一个模板，点击"设计"按钮
   - 或者直接访问：http://localhost:8101/system/print-templates/design/{uuid}

4. **测试编辑功能**

   - 等待编辑器加载完成（应该能看到工具栏和编辑区域）
   - 尝试在编辑区域点击
   - 尝试输入文字
   - 尝试使用工具栏的功能（加粗、斜体等）
   - 尝试从右侧变量面板插入变量

5. **检查控制台**
   - 按 F12 打开浏览器开发者工具
   - 查看 Console 标签，检查是否有错误信息
   - 如果有错误，请记录下来

## 预期结果

✅ 编辑器应该能够正常加载
✅ 点击编辑区域后应该能看到光标
✅ 应该能够正常输入文字
✅ 工具栏功能应该正常工作
✅ 变量插入功能应该正常工作
✅ 控制台不应该有错误信息

## 如果仍然无法输入

如果修复后仍然无法输入，请检查以下几点：

1. **浏览器兼容性**

   - 确保使用的是现代浏览器（Chrome、Edge、Firefox 最新版本）
   - 尝试清除浏览器缓存并刷新页面（Ctrl+Shift+R）

2. **CSS 样式冲突**

   - 检查是否有全局 CSS 样式影响了编辑器
   - 检查容器的 `pointer-events` 属性是否被设置为 `none`

3. **JavaScript 错误**

   - 查看浏览器控制台是否有 JavaScript 错误
   - 特别注意与 Univer 相关的错误

4. **版本兼容性**
   - 当前使用的 Univer 版本是 0.12.4
   - 确保所有 Univer 相关包的版本一致

## 额外的调试步骤

如果问题仍然存在，可以尝试以下调试方法：

1. **添加调试日志**
   在 `editor.tsx` 的 `init` 函数中添加：

   ```typescript
   console.log("Univer instance created:", univer);
   console.log("Document created:", docWithPageSize);
   ```

2. **检查文档是否正确创建**
   在浏览器控制台中运行：

   ```javascript
   // 查看 Univer 实例
   window.univer = univerRef.current;
   ```

3. **测试简单的文本插入**
   使用右侧的变量面板点击插入变量，看是否能成功插入

## 相关文件

- `riveredge-frontend/src/components/univer-doc/editor.tsx` - 编辑器组件
- `riveredge-frontend/src/components/univer-doc/preview.tsx` - 预览组件
- `riveredge-frontend/src/pages/system/print-templates/design/index.tsx` - 设计页面

## 参考文档

- [Univer 官方文档 - Plugin Mode](https://docs.univer.ai/guides/docs/getting-started/installation#setting-up-via-plugin-mode)
- [Univer GitHub Issues](https://github.com/dream-num/univer/issues)
