import React, { useState } from 'react';
import { Button, Dropdown, Space, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { DownOutlined, ImportOutlined, ThunderboltOutlined } from '@ant-design/icons';
import SerialNumbersImportModal from './SerialNumbersImportModal';

export interface SerialNumbersImportTriggerProps {
  serials?: string[];
  expectedCount?: number;
  materialLabel?: string;
  size?: 'small' | 'middle';
  generateLoading?: boolean;
  onSerialsChange: (serials: string[]) => void;
  onGenerate?: () => Promise<string[] | void>;
  disabled?: boolean;
}

const SerialNumbersImportTrigger: React.FC<SerialNumbersImportTriggerProps> = ({
  serials = [],
  expectedCount,
  materialLabel,
  size = 'small',
  generateLoading = false,
  onSerialsChange,
  onGenerate,
  disabled = false,
}) => {
  const [importOpen, setImportOpen] = useState(false);
  const count = serials.length;

  const menuItems: MenuProps['items'] = [
    ...(onGenerate
      ? [
          {
            key: 'generate',
            label: '规则生成',
            icon: <ThunderboltOutlined />,
            onClick: () => void onGenerate().then((list) => list?.length && onSerialsChange(list)),
          },
        ]
      : []),
    {
      key: 'import',
      label: '批量导入…',
      icon: <ImportOutlined />,
      onClick: () => setImportOpen(true),
    },
  ];

  const openImport = () => {
    if (!disabled) setImportOpen(true);
  };

  return (
    <>
      <Space
        size={4}
        align="center"
        wrap={false}
        style={{ flexWrap: 'nowrap', whiteSpace: 'nowrap' }}
      >
        <Dropdown menu={{ items: menuItems }} disabled={disabled} trigger={['click']}>
          <Button type="link" size={size} disabled={disabled} style={{ padding: 0, height: 'auto' }}>
            序列号 <DownOutlined style={{ fontSize: 10 }} />
          </Button>
        </Dropdown>
        <Typography.Text
          type={count > 0 ? 'success' : 'secondary'}
          style={{ fontSize: 12, cursor: count > 0 ? 'pointer' : 'default' }}
          onClick={openImport}
        >
          {count > 0 ? `已${count}个` : '未录入'}
        </Typography.Text>
      </Space>

      <SerialNumbersImportModal
        open={importOpen}
        onCancel={() => setImportOpen(false)}
        onConfirm={(next) => {
          onSerialsChange(next);
          setImportOpen(false);
        }}
        expectedCount={expectedCount}
        initialSerials={serials}
        materialLabel={materialLabel}
        onGenerate={onGenerate}
        generateLoading={generateLoading}
      />
    </>
  );
};

export default SerialNumbersImportTrigger;
