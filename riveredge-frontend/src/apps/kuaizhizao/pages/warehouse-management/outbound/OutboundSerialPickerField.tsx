/**
 * 出库确认 — 序列号弹窗多选（支持搜索、全选、上限）
 */

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Empty, Input, Modal, Space, Spin, Typography } from 'antd';
import type { InventoryPickOption } from './outboundConfirmInventoryOptions';

export type OutboundSerialPickerFieldProps = {
  value?: string[];
  onChange?: (value: string[]) => void;
  options: InventoryPickOption[];
  maxCount?: number;
  loading?: boolean;
  disabled?: boolean;
  materialLabel?: string;
};

const OutboundSerialPickerField: React.FC<OutboundSerialPickerFieldProps> = ({
  value,
  onChange,
  options,
  maxCount,
  loading = false,
  disabled = false,
  materialLabel,
}) => {
  const { t } = useTranslation();
  const selected = Array.isArray(value) ? value : [];
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [keyword, setKeyword] = useState('');

  const filteredOptions = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return options;
    return options.filter((o) => o.label.toLowerCase().includes(kw) || o.value.toLowerCase().includes(kw));
  }, [keyword, options]);

  const openPicker = () => {
    setDraft([...selected]);
    setKeyword('');
    setOpen(true);
  };

  const closePicker = () => {
    setOpen(false);
    setKeyword('');
  };

  const applyDraft = () => {
    onChange?.(draft);
    closePicker();
  };

  const toggleSerial = (sn: string, checked: boolean) => {
    setDraft((prev) => {
      if (checked) {
        if (prev.includes(sn)) return prev;
        if (maxCount != null && maxCount > 0 && prev.length >= maxCount) {
          return prev;
        }
        return [...prev, sn];
      }
      return prev.filter((x) => x !== sn);
    });
  };

  const selectAllFiltered = () => {
    const pool = filteredOptions.map((o) => o.value);
    if (!pool.length) return;
    if (maxCount != null && maxCount > 0) {
      setDraft(pool.slice(0, maxCount));
      return;
    }
    setDraft([...pool]);
  };

  const clearDraft = () => setDraft([]);

  const required = maxCount != null && maxCount > 0 ? maxCount : undefined;
  const atMax = required != null && draft.length >= required;

  return (
    <>
      <Space size={4} wrap style={{ width: '100%' }}>
        <Typography.Text type={selected.length ? undefined : 'secondary'} ellipsis style={{ maxWidth: 120 }}>
          {required != null
            ? t('app.kuaizhizao.warehouseOutbound.confirm.serialPicker.selectedCount', {
                selected: selected.length,
                required,
              })
            : selected.length
              ? t('app.kuaizhizao.warehouseOutbound.confirm.serialPicker.summary', { count: selected.length })
              : t('app.kuaizhizao.warehouseOutbound.field.selectSerial')}
        </Typography.Text>
        <Button size="small" type="link" disabled={disabled || loading} onClick={openPicker}>
          {t('app.kuaizhizao.warehouseOutbound.confirm.serialPicker.open')}
        </Button>
      </Space>

      <Modal
        title={t('app.kuaizhizao.warehouseOutbound.confirm.serialPicker.title')}
        open={open}
        width={640}
        destroyOnHidden
        okText={t('app.kuaizhizao.warehouseOutbound.confirm.serialPicker.confirm')}
        cancelText={t('app.kuaizhizao.warehouseOutbound.action.cancel')}
        onCancel={closePicker}
        onOk={applyDraft}
      >
        {materialLabel ? (
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            {materialLabel}
          </Typography.Text>
        ) : null}

        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Input.Search
            allowClear
            placeholder={t('app.kuaizhizao.warehouseOutbound.confirm.serialPicker.searchPlaceholder')}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />

          <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space wrap>
              <Button size="small" onClick={selectAllFiltered} disabled={!filteredOptions.length}>
                {t('app.kuaizhizao.warehouseOutbound.confirm.serialPicker.selectAll')}
              </Button>
              <Button size="small" onClick={clearDraft} disabled={!draft.length}>
                {t('app.kuaizhizao.warehouseOutbound.confirm.serialPicker.clear')}
              </Button>
            </Space>
            <Typography.Text type="secondary">
              {required != null
                ? t('app.kuaizhizao.warehouseOutbound.confirm.serialPicker.selectedCount', {
                    selected: draft.length,
                    required,
                  })
                : t('app.kuaizhizao.warehouseOutbound.confirm.serialPicker.summary', { count: draft.length })}
            </Typography.Text>
          </Space>

          {atMax ? (
            <Typography.Text type="warning" style={{ fontSize: 12 }}>
              {t('app.kuaizhizao.warehouseOutbound.confirm.serialPicker.maxReached', { max: required })}
            </Typography.Text>
          ) : null}

          <Spin spinning={loading}>
            <div
              style={{
                maxHeight: 360,
                overflowY: 'auto',
                border: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
                borderRadius: 6,
                padding: '8px 12px',
              }}
            >
              {!filteredOptions.length ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    loading
                      ? t('app.kuaizhizao.warehouseOutbound.confirm.loadingSerials')
                      : keyword.trim()
                        ? t('app.kuaizhizao.warehouseOutbound.confirm.serialPicker.noMatch')
                        : t('app.kuaizhizao.warehouseOutbound.confirm.noSerialAvailable')
                  }
                />
              ) : (
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  {filteredOptions.map((opt) => {
                    const checked = draft.includes(opt.value);
                    const disableUnchecked = !checked && atMax;
                    return (
                      <Checkbox
                        key={opt.value}
                        checked={checked}
                        disabled={disableUnchecked}
                        onChange={(e) => toggleSerial(opt.value, e.target.checked)}
                      >
                        <Typography.Text code style={{ wordBreak: 'break-all' }}>
                          {opt.label}
                        </Typography.Text>
                      </Checkbox>
                    );
                  })}
                </Space>
              )}
            </div>
          </Spin>
        </Space>
      </Modal>
    </>
  );
};

export default OutboundSerialPickerField;
