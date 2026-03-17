# 移动端 PWA 说明

本项目已配置为支持 PWA（Progressive Web App），可在浏览器中“安装到主屏幕”并部分离线使用。

## 已配置内容

- **Web App Manifest**（`public/manifest.json`）：应用名称、图标、主题色、`display: standalone`、`start_url` 等。
- **入口 HTML**（`public/index.html`）：已添加 `<link rel="manifest">`、`theme-color`、Apple 端 meta 与 Service Worker 注册脚本。
- **PWA 图标**：`public/logo192.png`、`public/logo512.png`（当前由 `assets/icon.png` 复制，可按需替换为 192×192 / 512×512 专用图）。

## 构建与部署

```bash
# 仅导出 Web
npm run export:web

# 或
npm run build:web
```

导出产物在 `dist/`，部署时需保证：

1. 使用 **HTTPS**（本地可用 localhost）。
2. 静态资源与 `manifest.json`、`logo192.png`、`logo512.png` 可从同一域名访问（与 `app.json` 中 `experiments.baseUrl` 一致，默认 `/mobile`）。

## 可选：离线与缓存（Service Worker）

当前已在 `index.html` 中注册 Service Worker：`/mobile/sw.js`。若需离线与缓存，可配合 [Workbox](https://developer.chrome.com/docs/workbox/) 生成 `sw.js`：

1. 先构建：`npm run export:web`。
2. 在项目根目录执行：`npx workbox-cli wizard`，根目录选 `dist`（或 `dist` 下对应输出目录），按提示生成 `workbox-config.js` 与 `dist/mobile/sw.js`（或你配置的路径）。
3. 之后可增加脚本：`"build:web:pwa": "expo export -p web && npx workbox-cli generateSW workbox-config.js"`。

未提供 `sw.js` 时，注册会失败并在控制台打出警告，不影响正常在线使用与“安装到主屏幕”。

## 图标建议

- `logo192.png`：192×192 像素。
- `logo512.png`：512×512 像素（可选带 padding 的 maskable）。

可使用 `assets/icon.png` 用图像工具导出上述尺寸，或替换 `public/` 下现有文件。
