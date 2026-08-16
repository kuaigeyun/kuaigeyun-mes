# 敏感词库（不入库）

本目录**禁止**向 Git 提交任何词库内容（明文 `.txt` 与 `lexicon.pack` 均在 `.gitignore` 中）。

运行时在本机或部署机生成 `lexicon.pack`：

1. 从第三方开源仓库下载词表到本目录（仅本地保留，勿提交）：
   - https://github.com/pokemonchw/Dirty （MIT，`Insult.txt`）
   - https://github.com/konsheng/Sensitive-lexicon （MIT，选用 Vocabulary 下成人类词表）
2. 可选：维护本地 `extra.txt` 补词
3. 执行：

```bash
cd riveredge-backend
uv run python scripts/pack_sensitive_words.py
```

`fast-deploy` 的 migrate / 启动后端会在缺失时自动执行上述脚本。也可设 `FORCE_LEXICON_REPACK=1` 强制重建。

生成 `lexicon.pack` 后重启后端。许可文件（`LICENSE.*`）与白名单 `allowlist.txt` 可提交。
