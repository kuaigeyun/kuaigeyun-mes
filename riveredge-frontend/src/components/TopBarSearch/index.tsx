import React, { useState, useMemo, useEffect } from 'react';
import { Input, Dropdown } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { MenuDataItem } from '@ant-design/pro-components';
import type { MenuProps } from 'antd';

export interface TopBarSearchProps {
    menuData: MenuDataItem[];
    isLightModeLightBg?: boolean;
    token?: any;
    placeholder?: string;
    /** 输入框高度（如侧栏 34px） */
    inputHeight?: number;
    /** 圆角（跟随系统传 token.borderRadius；胶囊形传 inputHeight/2 如 17） */
    borderRadius?: number;
    /** 右侧拟物按键提示，如 "/"（小尺寸灰色） */
    shortcutKey?: string;
    /** 侧栏模式：输入框透明背景、无聚焦光晕 */
    transparentBg?: boolean;
}

const TopBarSearch: React.FC<TopBarSearchProps> = ({
    menuData,
    isLightModeLightBg,
    token,
    placeholder,
    inputHeight = 32,
    borderRadius,
    shortcutKey,
    transparentBg,
}) => {
    const navigate = useNavigate();
    const [searchValue, setSearchValue] = useState('');
    const [open, setOpen] = useState(false);
    const [pinyinMatch, setPinyinMatch] = useState<((text: string, pattern: string) => any) | null>(null);

    // 动态加载 pinyin-pro，避免首屏同步引入
    useEffect(() => {
        import('pinyin-pro').then(m => { setPinyinMatch(() => m.match); }).catch(() => {});
    }, []);

    // Flatten the menu data into a searchable list
    const flatMenuData = useMemo(() => {
        const flatten = (items: MenuDataItem[], parentPath: string[] = []): { name: string; path: string; parentPath: string[] }[] => {
            return items.reduce((acc, item) => {
                if (!item) return acc;

                const currentPath = [...parentPath];
                if (item.name) {
                    // Only add if it has a valid path (is a leaf node or clickable) and name
                    if (item.path && !item.hideInMenu && !item.hideInSearch) {
                        acc.push({
                            name: item.name,
                            path: item.path,
                            parentPath: currentPath
                        });
                    }
                }

                if (item.children) {
                    // Push current name to parent path for children
                    if (item.name) {
                        currentPath.push(item.name);
                    }
                    acc.push(...flatten(item.children, currentPath));
                }

                return acc;
            }, [] as { name: string; path: string; parentPath: string[] }[]);
        };
        return flatten(menuData);
    }, [menuData]);

    const items: MenuProps['items'] = useMemo(() => {
        if (!searchValue) return [];
        const lowerValue = searchValue.toLowerCase();

        return flatMenuData
            .filter(item => {
                const name = item.name.toLowerCase();
                // Match by name or pinyin (including first letters, when pinyin-pro loaded)
                return name.includes(lowerValue) || (!!pinyinMatch && !!pinyinMatch(item.name, searchValue));
            })
            .slice(0, 10) // Limit results
            .map(item => ({
                key: item.path,
                label: (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 500 }}>{item.name}</span>
                        {item.parentPath.length > 0 && (
                            <span style={{ fontSize: '12px', color: '#888' }}>
                                {item.parentPath.join(' > ')}
                            </span>
                        )}
                    </div>
                ),
                onClick: () => {
                    navigate(item.path);
                    setOpen(false);
                    setSearchValue('');
                }
            }));
    }, [searchValue, flatMenuData, navigate, pinyinMatch]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchValue(value);
        setOpen(!!value.trim());
    };

    const resolvedRadius = borderRadius ?? (inputHeight >= 40 ? 8 : 16);
    const inputStyle: React.CSSProperties = {
        width: 220,
        height: inputHeight,
        borderRadius: resolvedRadius,
        backgroundColor: transparentBg ? 'transparent' : (isLightModeLightBg ? token?.colorFillTertiary : 'rgba(255, 255, 255, 0.1)'),
        color: isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)',
        border: 'none',
    };

    // 拟物按键：与键盘快捷键弹窗一致，浅灰底+细边框+底边阴影，不突兀
    const shortcutKeySuffix = shortcutKey ? (
        <span
            className="topbar-search-shortcut-key"
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 20,
                height: 20,
                padding: '0 5px',
                marginRight: 4,
                boxSizing: 'border-box',
                borderRadius: 4,
                background: token?.colorFillQuaternary ?? '#f5f5f5',
                border: `1px solid ${token?.colorBorder ?? '#d9d9d9'}`,
                boxShadow: `0 1px 0 ${token?.colorBorder ?? '#d9d9d9'}`,
                color: token?.colorTextSecondary ?? 'rgba(0,0,0,0.65)',
                fontSize: 11,
                fontWeight: 500,
            }}
        >
            {shortcutKey}
        </span>
    ) : null;

    return (
        <Dropdown
            menu={{ items }}
            open={open && (items?.length || 0) > 0}
            onOpenChange={(visible) => {
                if (!visible) setOpen(false);
            }}
            styles={{ root: { width: 220 } }}
            destroyOnHidden
        >
            <Input
                prefix={<SearchOutlined style={{ fontSize: 16 }} />}
                placeholder={placeholder ?? "搜索菜单、功能..."}
                suffix={shortcutKeySuffix}
                allowClear={!shortcutKey}
                style={inputStyle}
                value={searchValue}
                onChange={handleChange}
                onFocus={() => {
                    if (searchValue && items && items.length > 0) setOpen(true);
                }}
            />
        </Dropdown>
    );
};

export default TopBarSearch;
