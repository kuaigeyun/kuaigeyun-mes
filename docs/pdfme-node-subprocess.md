# pdfme 服务端成稿（可选 · 同部署单元）

在**不单独部署模板微服务**的前提下，若必须由后端产出与浏览器一致的 pdfme PDF（附件、集成方只调 API），可在**同一应用主机**上通过 **Node 子进程**调用 `@pdfme/generator`，与前端共用模板 JSON 与插件契约。

## 契约（建议）

- **输入**：stdin 或临时文件 JSON  
  `{ "template": { ... }, "inputs": [ ... ], "pluginsProfile": "riveredge-v1" }`
- **输出**：stdout 为 PDF 二进制；或 base64 行 + 退出码 0。
- **依赖**：与前端相同版本的 `@pdfme/common`、`@pdfme/generator`、`@pdfme/schemas`；插件需与 [`PDFME_PLUGINS`](../riveredge-frontend/src/components/pdfme-doc/plugins.ts) 保持同步（可考虑从 monorepo 共享构建产物）。
- **运维**：`NODE_OPTIONS=--max-old-space-size=...`、子进程超时（如 60s）、并发限制。

## 占位脚本

仓库提供 [`scripts/pdfme-generate.mjs`](../scripts/pdfme-generate.mjs) 作为后续接线的参考入口；默认未接入 FastAPI，避免在未安装 Node 依赖的环境中失败。

## 与 Python 集成草图

```python
# 伪代码：subprocess.run(["node", "scripts/pdfme-generate.mjs"], input=json_bytes, timeout=60)
```

**注意**：自定义表格插件若依赖浏览器 API，需在 Node 侧验证；图片 `data:` URL 一般可用。
