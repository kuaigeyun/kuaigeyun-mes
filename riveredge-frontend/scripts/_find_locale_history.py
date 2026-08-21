from pathlib import Path
import json
from datetime import datetime, timezone

hist = Path(r"C:/Users/Kuaige/AppData/Roaming/Cursor/User/History")
hits = []
for folder in hist.iterdir():
    meta = folder / "entries.json"
    if not meta.exists():
        continue
    try:
        data = json.loads(meta.read_text(encoding="utf-8"))
    except Exception:
        continue
    res = data.get("resource", "")
    res_n = res.replace("\\", "/").replace("%2F", "/").replace("%5C", "/")
    if "locales/zh-CN.ts" in res_n or res_n.endswith("zh-CN.ts"):
        hits.append((folder, res_n, data))

print("zh-CN history folders", len(hits))
for folder, res, data in hits:
    ents = data.get("entries", [])
    print("---", folder.name, "n=", len(ents))
    print(" resource:", res)
    for e in ents[-12:]:
        ts = e.get("timestamp")
        if isinstance(ts, (int, float)):
            # vscode timestamps are often ms
            try:
                dt = datetime.fromtimestamp(ts / 1000 if ts > 1e12 else ts)
                ts_s = dt.strftime("%Y-%m-%d %H:%M:%S")
            except Exception:
                ts_s = str(ts)
        else:
            ts_s = str(ts)
        snap = folder / e.get("id", "")
        size = snap.stat().st_size if snap.exists() else -1
        print(f"  {ts_s}  id={e.get('id')}  bytes={size}  source={e.get('source')}")
