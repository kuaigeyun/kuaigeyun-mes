import React, { useState, useMemo, useLayoutEffect, useRef, useCallback } from 'react';
import { Input, Dropdown } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { MenuDataItem } from '@ant-design/pro-components';
import type { MenuProps } from 'antd';

import { useTranslation } from 'react-i18next';

export interface TopBarSearchProps {
    menuData: MenuDataItem[];
    /** 聚焦未输入时展示的固定常用菜单路径（按顺序）；不传则取菜单前 8 项 */
    hotMenuPaths?: string[];
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

const DEFAULT_HOT_LIMIT = 8;
const DEFAULT_INPUT_WIDTH = 220;

const TopBarSearch: React.FC<TopBarSearchProps> = ({
    menuData,
    hotMenuPaths,
    isLightModeLightBg,
    token,
    placeholder,
    inputHeight = 32,
    borderRadius,
    shortcutKey,
    transparentBg,
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchValue, setSearchValue] = useState('');
    const [open, setOpen] = useState(false);
    const [pinyinMatch, setPinyinMatch] = useState<((text: string, pattern: string) => any) | null>(null);
    const triggerRef = useRef<HTMLDivElement | null>(null);
    const [triggerWidth, setTriggerWidth] = useState(DEFAULT_INPUT_WIDTH);
    const pinyinWarmupRef = useRef(false);

    const warmupPinyin = useCallback(() => {
        if (pinyinWarmupRef.current) return;
        pinyinWarmupRef.current = true;
        import('../../utils/pinyin').then(({ ensurePinyinMatchLoaded }) => {
            ensurePinyinMatchLoaded()
                .then((fn) => {
                    if (fn) setPinyinMatch(() => fn);
                })
                .catch(() => {});
        });
    }, []);

    // 让下拉菜单宽度始终与输入框等宽
    useLayoutEffect(() => {
        const el = triggerRef.current;
        if (!el) return;

        const update = () => {
            const w = el.getBoundingClientRect().width;
            if (w && Number.isFinite(w)) setTriggerWidth(Math.round(w));
        };

        update();

        if (typeof ResizeObserver !== 'undefined') {
            const ro = new ResizeObserver(() => update());
            ro.observe(el);
            return () => ro.disconnect();
        }

        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
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

    // 未输入时的固定常用菜单（按 hotMenuPaths 顺序，未传则取前 N 项）
    const hotItems: MenuProps['items'] = useMemo(() => {
        const pathSet = hotMenuPaths?.length
            ? new Set(hotMenuPaths)
            : null;
        let list: { name: string; path: string; parentPath: string[] }[];
        if (pathSet) {
            const ordered = hotMenuPaths!
                .map(p => flatMenuData.find(m => m.path === p))
                .filter(Boolean) as { name: string; path: string; parentPath: string[] }[];
            // 如果当前租户菜单里缺少这些固定路由，回退到扁平菜单前 N 项，避免只显示“常用”标题
            list = ordered.length > 0 ? ordered : flatMenuData.slice(0, DEFAULT_HOT_LIMIT);
        } else {
            list = flatMenuData.slice(0, DEFAULT_HOT_LIMIT);
        }
        const renderLabel = (item: { name: string; path: string; parentPath: string[] }) => (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 500 }}>{item.name}</span>
                {item.parentPath.length > 0 && (
                    <span style={{ fontSize: '12px', color: '#888' }}>
                        {item.parentPath.join(' > ')}
                    </span>
                )}
            </div>
        );
        const makeClick = (path: string) => () => {
            navigate(path);
            setOpen(false);
            setSearchValue('');
        };
        return [
            { key: '__hot_title__', label: <span style={{ fontSize: 12, color: '#888' }}>{t('ui.common.frequentlyUsed')}</span>, disabled: true },
            ...list.map(item => ({
                key: item.path,
                label: renderLabel(item),
                onClick: makeClick(item.path)
            }))
        ];
    }, [flatMenuData, hotMenuPaths, navigate]);

    const items: MenuProps['items'] = useMemo(() => {
        if (!searchValue.trim()) return hotItems;
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
    }, [searchValue, flatMenuData, hotItems, navigate, pinyinMatch]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchValue(value);
        setOpen(true); // 有内容显示搜索结果，清空后显示常用列表
    };

    const resolvedRadius = borderRadius ?? (inputHeight >= 40 ? 8 : 16);
    const inputStyle: React.CSSProperties = {
        width: '100%',
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
                padding: '0',
                marginRight: 0,
                boxSizing: 'border-box',
                borderRadius: 4,
                background: token?.colorFillQuaternary ?? '#f5f5f5',
                border: '1px solid var(--river-border-color)',
                boxShadow: `0 1px 0 ${token?.colorBorder ?? '#d9d9d9'}`,
                color: '#8c8c8c', // 灰度色
                fontSize: 12,
                fontFamily: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
                fontWeight: 500,
            }}
        >
            {shortcutKey}
        </span>
    ) : null;

    return (
        <Dropdown
            menu={{ items, style: { width: triggerWidth } }}
            // 未输入时：避免仅渲染“常用”标题而无可点击项
            open={
                open && (searchValue.trim()
                    ? (items?.length || 0) > 0
                    : (hotItems?.length || 0) > 1)
            }
            onOpenChange={(visible) => {
                if (!visible) setOpen(false);
            }}
            styles={{ root: { width: '100%', minWidth: 0 } }}
            destroyOnHidden
        >
            <div ref={triggerRef} style={{ width: '100%', minWidth: 0 }}>
                <Input
                    prefix={
                        <SearchOutlined
                            style={{
                                fontSize: 16,
                                color: transparentBg && !isLightModeLightBg ? 'rgba(255,255,255,0.65)' : undefined,
                            }}
                        />
                    }
                    placeholder={placeholder ?? t('ui.placeholder.searchMenu')}
                    suffix={shortcutKeySuffix}
                    allowClear={!shortcutKey}
                    style={inputStyle}
                    value={searchValue}
                    onChange={handleChange}
                    onFocus={() => {
                        warmupPinyin();
                        setOpen(true);
                    }}
                />
            </div>
        </Dropdown>
    );
};

export default TopBarSearch;
