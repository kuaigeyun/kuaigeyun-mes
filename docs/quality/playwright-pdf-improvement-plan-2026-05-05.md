# Playwright 现有能力盘点与 PDF 流水线改进建议

> 评估范围：`riveredge-backend/src/apps/kuaizhizao/services/print_service.py`、`riveredge-backend/src/core/services/print/print_template_service.py`
> 评估视角：在已经把 Playwright + Chromium 装上生产的前提下，复盘当前用法只覆盖了哪一层能力，以及还能榨出哪些边际价值
> 评估时间：2026-05-05
> 选型背景：当前 HTML→PDF 仅用了 Playwright 的 `launch / new_page / set_content / emulate_media / pdf` 五个 API，本质上把 Chromium 当 PDF 引擎使用。其余测试自动化、网络拦截、追踪、a11y 等能力均未利用。

---

## 一、当前用法回顾

`_html_to_pdf_bytes_playwright_async`（`print_service.py` 246–311）的真实工作量：

1. `chromium.launch(headless=True, args=launch_args)` —— 每次请求启停一次浏览器；
2. `page.set_content(html, wait_until="networkidle")` —— 注入 HTML；
3. `page.emulate_media("print")` —— 触发 `@page` / `@media print`；
4. `page.evaluate(() => document.fonts.ready)` —— 等字体；
5. `page.pdf(print_background=True, prefer_css_page_size=True, ...)` —— 输出 PDF。

为了让 Chromium 能拿到后端本地资源，代码额外做了：

- `_inline_local_file_images_in_html`（行 172–209）：正则扫 `<img src="/api/...">`，把后端文件 UUID 内联成 base64 data URL；
- `_inject_base_href_for_playwright`（行 212–238）：注入 `<base href>` 让相对路径解析；
- `_run_playwright_with_dedicated_loop`（行 314–332）：Windows 下用独立线程 + ProactorEventLoop 规避 subprocess `NotImplementedError`。

这些都是绕过 Playwright 高级能力得来的"补丁"，下面的建议会指出哪些能用 Playwright 原生能力直接替掉。

---

## 二、第一档：直接改善现有 PDF 流水线

### 1. 用 `page.route()` 拦截网络请求，替代正则内联图片

**现状**：`_inline_local_file_images_in_html` 只能识别 `<img>` 标签，CSS `background-image: url(...)`、`<link rel="stylesheet">`、二维码 SVG 引用等都覆盖不到；并且需要先 `_inject_base_href_for_playwright` 把相对路径补全。

**改进方案**：

```python
async def _serve_local_files(route, request):
    parts = urlsplit(request.url)
    m = _FILE_DOWNLOAD_PATH_RE.search(parts.path or "")
    if m:
        file_uuid = m.group("uuid")
        try:
            file = await FileService.get_file_by_uuid(tenant_id, file_uuid)
            body = await FileService.get_file_content(tenant_id, file_uuid)
            await route.fulfill(
                status=200,
                content_type=file.file_type or "application/octet-stream",
                body=body,
            )
            return
        except Exception as e:
            logger.warning("PDF route 拦截但读文件失败 uuid={}: {}", file_uuid, e)
    await route.continue_()

await page.route("**/*", _serve_local_files)
```

**收益**：

- 一次拦截 `<img>`、`<link>`、CSS `url(...)` 全部场景；
- 不再修改 HTML，原 src 在调试时还能看清楚；
- 不再依赖 `<base href>` 注入；
- 可以在拦截层做 tenant 归属校验，避免越权读文件。

### 2. 复用 Browser，不要每次 `chromium.launch()`

**现状**：每张 PDF 都要 800ms–3s 的冷启动，Windows 上更慢。

**改进方案**（仅生产 Linux 路径，Windows 保留现有 per-request 启动作兜底）：

```python
class _PWPool:
    _playwright = None
    _browser = None
    _lock = asyncio.Lock()

    @classmethod
    async def get_browser(cls):
        async with cls._lock:
            if cls._browser is None or not cls._browser.is_connected():
                cls._playwright = await async_playwright().start()
                cls._browser = await cls._playwright.chromium.launch(
                    headless=True, args=launch_args,
                )
            return cls._browser
```

每次请求只 `browser.new_context()` + `context.new_page()`，结束 `context.close()`。

**收益**：单台 PDF 服务器并发 10 单时，单次延迟从 ~2.5s 降到 ~600ms。

**风险点**：

- Windows ProactorEventLoop 路径与长生命周期 browser 不兼容，需保留 `_run_playwright_with_dedicated_loop` 作 fallback；
- 进程退出时要注册 atexit 关闭 browser，避免遗留 Chromium 进程。

### 3. 监听 `console` / `pageerror` / `requestfailed`

**现状**：图裂、字体回退、CSS 报错全都静默，工单复现成本高。

**改进方案**：

```python
page.on("console", lambda msg: logger.warning("PDF console.{}: {}", msg.type, msg.text))
page.on("pageerror", lambda err: logger.error("PDF JS error: {}", err))
page.on("requestfailed", lambda req: logger.warning(
    "PDF request failed: {} reason={}", req.url, req.failure
))
```

**收益**：白送的可观测性，零额外开销。

### 4. `context.tracing` 按需录制 —— 复现客户问题

**现状**：只有 `RIVEREDGE_PRINT_DEBUG` 落最终 HTML，无法回放渲染过程。

**改进方案**：

```python
trace_enabled = os.environ.get("RIVEREDGE_PRINT_TRACE", "").strip().lower() in ("1", "true", "yes")
if trace_enabled:
    await context.tracing.start(screenshots=True, snapshots=True, sources=False)
try:
    # ...生成 PDF
finally:
    if trace_enabled:
        path = f"/tmp/print-trace-{int(time.time())}.zip"
        await context.tracing.stop(path=path)
        logger.info("Playwright trace 已落 {}", path)
```

生成的 `.zip` 可以拖到 https://trace.playwright.dev 像 Chrome DevTools 一样回放，包含网络、控制台、DOM 快照、截图。

---

## 三、第二档：新增产品能力（Chromium 自带，白拿白不拿）

### 5. `page.pdf(tagged=True, outline=True)` —— 真·结构化 PDF

**现状**：未传这两个参数，输出的是普通栅格化 PDF。

**改进**：

- `tagged=True`：生成 PDF 1.7 Tagged PDF，包含 h1/h2/p/table 结构标签；屏幕阅读器可读、可对接 PDF/UA 合规；
- `outline=True`：把 `<h1>/<h2>` 自动转 PDF 大纲，左侧书签栏可点击跳转。

**适用场景**：报价单、销售订单这种长单据。客户用 Acrobat 打开能直接跳到"商品明细 / 付款条款 / 备注"。

**改造成本**：增加两个参数，约 5 分钟。

### 6. `page.screenshot()` —— 单据/模板缩略图

**适用场景**：

- 报价单/销售订单列表 hover 预览；
- 邮件附件的客户端预览缩略图；
- 设计器模板列表卡片的缩略图（保存时重新生成）。

```python
png_bytes = await page.screenshot(full_page=True, type="png", scale="device")
```

可以与 PDF 生成共用同一份 HTML 渲染过程，不增加新的浏览器开销。

### 7. `header_template` / `footer_template` —— 灵活页眉页脚

**现状**：`display_header_footer=False`，靠 `compile_designer_schema` 里的 `@page @bottom-center { content: counter(page) }` 实现页码（`print_template_service.py` 932–956），并配合 `@media print { .print-page-counter { display: none } }` 隐藏 body 中的页脚原文。

**Playwright 原生方案**：

```python
await page.pdf(
    display_header_footer=True,
    header_template='<div style="font-size:10px;width:100%;text-align:center;color:#666;">'
                    '<img src="data:image/png;base64,..."/></div>',
    footer_template='<div style="font-size:10px;width:100%;text-align:center;color:#666;">'
                    '<span class="pageNumber"></span> / <span class="totalPages"></span>'
                    '</div>',
    margin={"top": "20mm", "bottom": "15mm", "left": "0", "right": "0"},
)
```

**优势**：

- 支持完整 HTML/CSS，不只是 CSS `content` 字符串；
- 内置 token：`pageNumber` / `totalPages` / `date` / `title` / `url`；
- 可以放图片（公司 Logo 在每页页眉）、二维码、印章；
- body DOM 不再需要 `.print-page-counter` 这种"渲染时显示、打印时隐藏"的 hack，编译产物更干净。

**取舍**：现有 CSS counter 方案的好处是"完全靠模板自描述"，不依赖特定 PDF 引擎，理论上换 WeasyPrint 也能跑。如果未来确定锁定 Playwright，再改这一项也不迟。

### 8. `page.pdf(page_ranges="3,5-7")` —— 按页重打 / 拆分

**适用场景**：

- "把第 3 页单独打出来"；
- 一份长报价拆成多份分别寄给不同部门；
- 重打污损页。

Chromium 原生能力，加几行参数即可。

### 9. `launch_persistent_context()` —— 缓存字体和外链 CSS

**适用场景**：高频打同一个模板（比如批量出库）时，HTTP 缓存、字体缓存、CSS 缓存都能跨请求复用。

```python
context = await p.chromium.launch_persistent_context(
    user_data_dir="/var/cache/riveredge-pdf-profile",
    headless=True,
    args=launch_args,
)
```

**收益**：和"复用 Browser"叠加之后，能把 Chromium 启动开销和资源加载开销同时压到最低。

**风险点**：

- 持久化目录的磁盘占用要监控；
- 多进程并发写同一目录会冲突，可以按 worker pid 分目录。

---

## 四、第三档：架构层的新场景

### 10. Excel/Word/PPT 预览的服务端渲染

**思路**：上传后用 Playwright 加载 SheetJS / docx-preview / mammoth.js 这类纯前端 Office 库，截图或转 PDF。

**对比**：比 LibreOffice headless 渲染中文样式更接近 Office 原生，部署也省一个 LibreOffice。

**前置**：`FilePreviewService` 现在大概率只支持图片和 PDF，需要扩展。

### 11. ECharts / Mermaid / 复杂图表的服务端渲染

**痛点**：未来报价单/经营报表如果要嵌图表，Python 端的 matplotlib 渲染中文 + 商务样式很丑。

**方案**：让 Playwright 加载一个内置 ECharts 的 HTML，`page.evaluate` 注入数据，`page.locator(".chart").screenshot()` 拿 PNG/SVG，再嵌进 PDF 模板。这是业界主流做法。

### 12. 真·E2E 测试（Playwright 本职工作）

**思路**：开发/CI 环境用同一份 Playwright 跑 E2E：

- 报价单创建 → 审核 → 打印 PDF → 验签链路；
- 设计器拖拽块 → 编译 → 渲染 → 视觉回归；
- 多租户隔离的 UI 验证。

**优势**：生产环境已经装了 Chromium，开发环境复用零额外资源。

### 13. 视觉回归测试 —— 给打印模板"上保险"

**痛点**：`compile_designer_schema` 里的 HTML 拼接逻辑是高频改动区。每次改都可能让历史模板渲染走样，但目前没有自动化护栏。

**方案**：

1. 抓 10–20 个典型模板（报价单、销售订单、出入库单、借料单等）做基准 PDF/PNG；
2. CI 里跑一遍重新生成 + `pixelmatch` / ImageMagick `compare` 像素 diff；
3. 阈值（比如 0.1%）超出就 fail，并产出 diff 图。

**收益**：把"flex/字体/边距细节翻车"从"用户报工单"前置到"PR 阶段拦截"。

### 14. `page.evaluate(...)` 在渲染前注入运行时数据

**适用场景**：

- 打印时根据 PDF 实际页数调整封面信息；
- 动态计算最长 SKU 列宽再 reflow；
- 客户端聚合/过滤后再打印。

这是 WeasyPrint 永远做不到、Playwright 白送的能力。

### 15. `page.accessibility.snapshot()` —— a11y 扫描

**适用场景**：未来对接欧美客户，PDF/UA 合规是硬要求。配合 `tagged=True` 可以做基础合规扫描。

---

## 五、改造优先级建议

按"投入/回报比"排序：

| 顺序 | 项目 | 预估工作量 | 主要收益 |
|---|---|---|---|
| 1 | `page.route()` 拦截图片 | 0.5 天 | 替代正则内联，覆盖 CSS / link / SVG 引用，不污染 HTML |
| 2 | console/pageerror/requestfailed 监听 | 0.5 小时 | 白送的可观测性，工单复现成本骤降 |
| 3 | Browser 复用 + persistent context | 1 天 | 每张 PDF 省 1–2s，并发能力提升 |
| 4 | `tagged=True` + `outline=True` | 5 分钟 | 客户端 PDF 体验立刻"专业一档" |
| 5 | 缩略图（page.screenshot） | 0.5–1 天 | 列表/邮件 UX 显著提升 |
| 6 | `tracing` 按需录制 | 0.5 小时 | 客户问题可回放，替代当前的 HTML dump |
| 7 | 视觉回归测试 | 1–2 天 | 把打印模板回归风险压到很低 |
| 8 | E2E 测试栈 | 长期项目 | 生产已装 Chromium，写多少都不亏 |

后续若要进一步减少浏览器依赖，再讨论"PDF 渲染抽成 Gotenberg 微服务"或"WeasyPrint 替代"的路线（前者推荐，后者会要求模板和设计器一起重构）。

---

## 六、参考资料

- Playwright Python 文档：https://playwright.dev/python/docs/api/class-page
- `page.pdf()` 全部参数：https://playwright.dev/python/docs/api/class-page#page-pdf
- `page.route()` 网络拦截：https://playwright.dev/python/docs/network#handle-requests
- Tracing 回放工具：https://trace.playwright.dev
- Chromium `printToPDF` CDP 命令（page.pdf 的底层）：https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-printToPDF
