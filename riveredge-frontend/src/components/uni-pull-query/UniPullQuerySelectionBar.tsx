import React from 'react';
import { Button, Flex, Tag, Typography, theme } from 'antd';
import { useTranslation } from 'react-i18next';
import { ThemedSegmented } from '../themed-segmented';

export type UniPullQueryCrossPageMode = 'page' | 'cross';

export type UniPullQueryPreviewItem = {
  key: React.Key;
  label: string;
};

export type UniPullQuerySelectionBarProps = {
  crossPageMode: UniPullQueryCrossPageMode;
  onCrossPageModeChange: (mode: UniPullQueryCrossPageMode) => void;
  items: UniPullQueryPreviewItem[];
  onRemove: (key: React.Key) => void;
  onClear: () => void;
  /** 多选才显示「仅本页 / 跨页」；单选不传或 false */
  showCrossPage?: boolean;
};

/**
 * 取单 / 选产品弹窗共用：跨页选择分段 + 已选预览（筛选项下方）。
 */
export const UniPullQuerySelectionBar: React.FC<UniPullQuerySelectionBarProps> = ({
  crossPageMode,
  onCrossPageModeChange,
  items,
  onRemove,
  onClear,
  showCrossPage = true,
}) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();

  return (
    <div
      style={{
        padding: '10px 12px',
        marginBottom: 12,
        background: token.colorFillAlter,
        borderRadius: token.borderRadius,
        border: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Flex align="center" gap={12} wrap="wrap">
        {showCrossPage ? (
          <Flex align="center" gap={8} style={{ flexShrink: 0 }}>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              {t('components.uniPullQuery.crossPageLabel')}
            </Typography.Text>
            <ThemedSegmented
              surfaceBackground
              value={crossPageMode}
              options={[
                { label: t('components.uniPullQuery.crossPageOff'), value: 'page' },
                { label: t('components.uniPullQuery.crossPageOn'), value: 'cross' },
              ]}
              onChange={(value) => onCrossPageModeChange(String(value) as UniPullQueryCrossPageMode)}
            />
          </Flex>
        ) : null}
        <Typography.Text type="secondary" style={{ fontSize: 13, flexShrink: 0 }}>
          {t('components.uniPullQuery.selectedPreview')}
        </Typography.Text>
        <Flex gap={6} wrap="wrap" style={{ flex: 1, minWidth: 0 }}>
          {items.length === 0 ? (
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              {t('components.uniPullQuery.selectedEmpty')}
            </Typography.Text>
          ) : (
            items.map((item) => (
              <Tag
                key={String(item.key)}
                closable
                onClose={(event) => {
                  event.preventDefault();
                  onRemove(item.key);
                }}
                style={{ marginInlineEnd: 0 }}
              >
                {item.label}
              </Tag>
            ))
          )}
        </Flex>
        <Button
          type="link"
          size="small"
          disabled={items.length === 0}
          onClick={onClear}
          style={{ paddingInline: 0, flexShrink: 0 }}
        >
          {t('components.uniPullQuery.clearSelection')}
        </Button>
      </Flex>
    </div>
  );
};
