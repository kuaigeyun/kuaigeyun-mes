import React, { useState, useMemo } from 'react';
import { Input, Dropdown } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { MenuDataItem } from '@ant-design/pro-components';
import type { MenuProps } from 'antd';
import { match } from 'pinyin-pro';

export interface TopBarSearchProps {
    menuData: MenuDataItem[];
    isLightModeLightBg?: boolean;
    token?: any;
    placeholder?: string;
}

const TopBarSearch: React.FC<TopBarSearchProps> = ({
    menuData,
    isLightModeLightBg,
    token,
    placeholder
}) => {
    const navigate = useNavigate();
    const [searchValue, setSearchValue] = useState('');
    const [open, setOpen] = useState(false);

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
                // Match by name or pinyin (including first letters)
                return name.includes(lowerValue) || !!match(item.name, searchValue);
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
    }, [searchValue, flatMenuData, navigate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchValue(value);
        setOpen(!!value.trim());
    };

    // Styles based on the existing BasicLayout input styles
    const inputStyle: React.CSSProperties = {
        width: 280,
        height: 32,
        borderRadius: '16px',
        backgroundColor: isLightModeLightBg ? token?.colorFillTertiary : 'rgba(255, 255, 255, 0.1)',
        color: isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)',
        border: 'none',
    };

    return (
        <Dropdown
            menu={{ items }}
            open={open && (items?.length || 0) > 0}
            onOpenChange={(visible) => {
                // Close if user clicks outside
                if (!visible) setOpen(false);
            }}
            overlayStyle={{ width: 280 }}
            destroyPopupOnHide
        >
            <Input
                prefix={<SearchOutlined style={{ fontSize: 16 }} />}
                placeholder={placeholder || "搜索菜单、功能..."}
                allowClear
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
