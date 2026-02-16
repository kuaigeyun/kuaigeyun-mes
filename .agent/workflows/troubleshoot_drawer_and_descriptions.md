---
description: Fix common errors in Drawers and Description components (require not defined, deprecated contentStyle)
---

# Troubleshooting Drawer and Descriptions Errors

## 1. ReferenceError: require is not defined

**Symptoms:**

- App crashes when opening a Drawer.
- Console error: `ReferenceError: require is not defined`.
- Often happens when formatting dates inside a component: `const dayjs = require('dayjs')`.

**Cause:**

- The project uses Vite (ESM), which does not support CommonJS `require()` calls in the browser code.

**Solution:**

1.  **Remove `require()` calls** from inside the component.
2.  **Add top-level import:** `import dayjs from 'dayjs';`
3.  **Use the imported module:** `dayjs(value).format(...)`

## 2. Warning: [antd: Descriptions] `contentStyle` is deprecated

**Symptoms:**

- Console warning: `[antd: Descriptions] contentStyle is deprecated. Please use styles.content instead.`
- Often occurs when using `ProDescriptions` from `@ant-design/pro-components`.

**Solution A (Quick Fix for ProDescriptions):**
Add the `styles` prop to pass the config to the underlying component:

```tsx
<ProDescriptions
  styles={{ content: {} }}
  // ... other props
/>
```

**Solution B (Replace with Ant Design Descriptions):**
If Solution A doesn't work or you want to reduce dependencies/overhead, replace `ProDescriptions` with standard `Descriptions` and manually handle the rendering.

```tsx
import { Descriptions } from "antd";
import dayjs from "dayjs";

// ... inside component
<Descriptions
  column={column}
  items={columns.map((col, index) => {
    // 1. Get value
    const value = dataSource ? dataSource[col.dataIndex] : undefined;
    let content = value;

    // 2. Handle valueTypes (dateTime, date, select/valueEnum)
    if (col.valueType === "dateTime" && value) {
      content = dayjs(value).format("YYYY-MM-DD HH:mm:ss");
    } else if (col.valueType === "date" && value) {
      content = dayjs(value).format("YYYY-MM-DD");
    } else if (col.valueEnum && value) {
      const enumItem = col.valueEnum[value];
      content = enumItem?.text || enumItem || value;
    }

    // 3. Handle custom render function
    if (col.render) {
      content = col.render(content, dataSource, index, {}, col);
    }

    // 4. Return Description Item
    return {
      key: col.key || index,
      label: col.title,
      children: content ?? "-",
      span: col.span || 1,
    };
  })}
/>;
```
