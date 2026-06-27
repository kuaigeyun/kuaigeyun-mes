import React, { useMemo, useState } from 'react';
import { Button, Empty, Input, Popover, Space, Tooltip, Typography } from 'antd';
import { CloseCircleOutlined, SearchOutlined } from '@ant-design/icons';
import { ManufacturingIcons } from '../../utils/manufacturingIcons';

export const MENU_ICON_KEYS = Object.keys(ManufacturingIcons).sort((a, b) =>
  a.localeCompare(b, undefined, { sensitivity: 'base' }),
);

export function renderMenuIconByKey(icon?: string | null, size = 16): React.ReactNode {
  if (!icon) return null;
  const Icon = ManufacturingIcons[icon as keyof typeof ManufacturingIcons];
  if (!Icon) return null;
  return <Icon size={size} />;
}

type MenuIconPickerProps = {
  value?: string;
  onChange?: (value?: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  clearText?: string;
  emptyText?: string;
  size?: 'small' | 'middle' | 'large';
  style?: React.CSSProperties;
};

const MenuIconPicker: React.FC<MenuIconPickerProps> = ({
  value,
  onChange,
  placeholder = '点击选择图标',
  searchPlaceholder = '搜索图标',
  clearText = '清除',
  emptyText = '无匹配图标',
  size = 'middle',
  style,
}) => {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');

  const filteredKeys = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return MENU_ICON_KEYS;
    return MENU_ICON_KEYS.filter((key) => key.toLowerCase().includes(q));
  }, [keyword]);

  const handleSelect = (key: string) => {
    onChange?.(key);
    setOpen(false);
    setKeyword('');
  };

  const handleClear = (event: React.MouseEvent) => {
    event.stopPropagation();
    onChange?.(undefined);
  };

  const pickerPanel = (
    <div style={{ width: 520 }}>
      <Input
        allowClear
        size="small"
        prefix={<SearchOutlined />}
        placeholder={searchPlaceholder}
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          gap: 8,
          marginTop: 10,
          maxHeight: 300,
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingRight: 2,
        }}
      >
        {filteredKeys.length === 0 ? (
          <div style={{ gridColumn: '1 / -1' }}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
          </div>
        ) : (
          filteredKeys.map((key) => {
            const selected = value === key;
            return (
              <Tooltip key={key} title={key}>
                <button
                  type="button"
                  onClick={() => handleSelect(key)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    minHeight: 56,
                    padding: '6px 4px',
                    borderRadius: 8,
                    border: selected
                      ? '2px solid var(--ant-color-primary)'
                      : '1px solid var(--ant-color-border-secondary)',
                    background: selected ? 'var(--ant-color-primary-bg)' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  {renderMenuIconByKey(key, 18)}
                  <Typography.Text
                    ellipsis
                    style={{ fontSize: 10, lineHeight: 1.2, maxWidth: '100%' }}
                  >
                    {key}
                  </Typography.Text>
                </button>
              </Tooltip>
            );
          })
        )}
      </div>
      <Space style={{ marginTop: 10 }}>
        <Button size="small" onClick={() => onChange?.(undefined)}>
          {clearText}
        </Button>
      </Space>
    </div>
  );

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomLeft"
      overlayStyle={{ minWidth: 520 }}
      content={pickerPanel}
    >
      <Input
        readOnly
        size={size}
        value={value || ''}
        placeholder={placeholder}
        style={{ cursor: 'pointer', width: '100%', ...style }}
        prefix={value ? renderMenuIconByKey(value, size === 'small' ? 14 : 16) : null}
        suffix={
          value ? (
            <CloseCircleOutlined
              style={{ color: 'var(--ant-color-text-quaternary)', cursor: 'pointer' }}
              onClick={handleClear}
            />
          ) : null
        }
      />
    </Popover>
  );
};

export default MenuIconPicker;
