#!/bin/bash

# 批量替换脚本：将所有 ProFormSelect 替换为 SafeProFormSelect

echo "开始批量替换 ProFormSelect 为 SafeProFormSelect..."

# 查找所有使用 ProFormSelect 的文件
files=$(find src -name "*.tsx" -exec grep -l "ProFormSelect" {} \;)

for file in $files; do
    echo "处理文件: $file"

    # 检查是否已经导入了 SafeProFormSelect
    if ! grep -q "SafeProFormSelect" "$file"; then
        # 添加导入
        sed -i '/import.*@ant-design\/pro-components/a import SafeProFormSelect from '\''@/components/SafeProFormSelect'\'';' "$file"
        echo "  添加 SafeProFormSelect 导入"
    fi

    # 替换 ProFormSelect 为 SafeProFormSelect
    sed -i 's/<ProFormSelect /<SafeProFormSelect /g' "$file"
    echo "  替换 ProFormSelect 使用"
done

echo "批量替换完成！"
echo ""
echo "请运行以下命令检查和构建："
echo "npm run build"
