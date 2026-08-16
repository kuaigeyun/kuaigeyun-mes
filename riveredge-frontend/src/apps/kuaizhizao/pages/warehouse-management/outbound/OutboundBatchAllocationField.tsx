/**
 * 出库/领料 — 批号多选并按批填写数量（合计对齐本次发料）
 */

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Checkbox,
  Empty,
  Input,
  InputNumber,
  Modal,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { InventoryPickOption } from './outboundConfirmInventoryOptions';
import {
  allocateBatchQuantitiesFifo,
  sumBatchAllocationQty,
  type OutboundBatchAllocation,
} from './outboundBatchAllocation';
import { MODAL_ISOLATE_POINTER_PROPS } from '../../../../../utils/modalEventIsolation';
import { formatBusinessDateOnly, formatQuantity } from '../../../../../utils/format';

export type OutboundBatchAllocationFieldProps = {
  value?: OutboundBatchAllocation[];
  onChange?: (value: OutboundBatchAllocation[]) => void;
  options: InventoryPickOption[];
  /** 本次发料数量：分摊合计应对齐该值 */
  totalQuantity: number;
  loading?: boolean;
  disabled?: boolean;
  materialLabel?: string;
};

const OutboundBatchAllocationField: React.FC<OutboundBatchAllocationFieldProps> = ({
  value,
  onChange,
  options,
  totalQuantity,
  loading = false,
  disabled = false,
  materialLabel,
}) => {
  const { t } = useTranslation();
  const selected = Array.isArray(value) ? value : [];
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<OutboundBatchAllocation[]>([]);
  const [keyword, setKeyword] = useState('');

  const selectedNos = useMemo(
    () => draft.map((a) => a.batchNo).filter(Boolean),
    [draft],
  );
  const selectedSet = useMemo(() => new Set(selectedNos), [selectedNos]);

  const showDateCols = useMemo(
    () => options.some((o) => o.productionDate || o.expiryDate),
    [options],
  );

  const filteredOptions = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(kw) || o.value.toLowerCase().includes(kw),
    );
  }, [keyword, options]);

  const draftSum = sumBatchAllocationQty(draft);
  const target = Number(totalQuantity) || 0;
  const sumMismatch = target > 0 && Math.abs(draftSum - target) > 1e-6;

  const openPicker = () => {
    if (disabled || loading) return;
    setDraft(selected.length ? selected.map((a) => ({ ...a })) : []);
    setKeyword('');
    setOpen(true);
  };

  const closePicker = () => {
    setOpen(false);
    setKeyword('');
  };

  const applyDraft = () => {
    onChange?.(draft.filter((a) => String(a.batchNo).trim() && Number(a.quantity) > 0));
    closePicker();
  };

  const toggleBatch = (batchNo: string, checked: boolean) => {
    setDraft((prev) => {
      const nos = checked
        ? prev.some((a) => a.batchNo === batchNo)
          ? prev.map((a) => a.batchNo)
          : [...prev.map((a) => a.batchNo), batchNo]
        : prev.map((a) => a.batchNo).filter((b) => b !== batchNo);
      return allocateBatchQuantitiesFifo(target, nos, options, prev);
    });
  };

  const setBatchQty = (batchNo: string, quantity: number | null) => {
    const qty = Math.max(0, Number(quantity) || 0);
    setDraft((prev) =>
      prev.map((a) => (a.batchNo === batchNo ? { ...a, quantity: qty } : a)),
    );
  };

  const redistributeFifo = () => {
    setDraft((prev) =>
      allocateBatchQuantitiesFifo(
        target,
        prev.map((a) => a.batchNo),
        options,
        [],
      ),
    );
  };

  const clearDraft = () => setDraft([]);

  const summaryText = (() => {
    if (!selected.length) {
      return t('app.kuaizhizao.warehouseOutbound.field.selectBatch');
    }
    if (selected.length === 1) {
      return selected[0].batchNo;
    }
    return t('app.kuaizhizao.warehouseOutbound.confirm.batchPicker.summary', {
      count: selected.length,
      qty: formatQuantity(sumBatchAllocationQty(selected)),
    });
  })();

  return (
    <>
      <Space size={4} wrap style={{ width: '100%' }}>
        <Typography.Text
          type={selected.length ? undefined : 'secondary'}
          ellipsis
          style={{ maxWidth: 140 }}
        >
          {summaryText}
        </Typography.Text>
        <Button size="small" type="link" disabled={disabled || loading} onClick={openPicker}>
          {t('app.kuaizhizao.warehouseOutbound.confirm.batchPicker.open')}
        </Button>
      </Space>
      <Modal
        {...MODAL_ISOLATE_POINTER_PROPS}
        title={
          materialLabel
            ? t('app.kuaizhizao.warehouseOutbound.confirm.batchPicker.titleWithMaterial', {
                material: materialLabel,
              })
            : t('app.kuaizhizao.warehouseOutbound.confirm.batchPicker.title')
        }
        open={open}
        onCancel={closePicker}
        onOk={applyDraft}
        okText={t('app.kuaizhizao.warehouseOutbound.confirm.batchPicker.confirm')}
        okButtonProps={{ disabled: sumMismatch && target > 0 }}
        width={showDateCols ? 720 : 560}
        destroyOnHidden
      >
        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Text type="secondary">
            {t('app.kuaizhizao.warehouseOutbound.confirm.batchPicker.hint', {
              qty: formatQuantity(target),
            })}
          </Typography.Text>
          <Space wrap>
            <Input
              allowClear
              size="small"
              style={{ width: 220 }}
              placeholder={t('app.kuaizhizao.warehouseOutbound.confirm.batchPicker.searchPlaceholder')}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <Button size="small" onClick={redistributeFifo} disabled={!selectedNos.length || !(target > 0)}>
              {t('app.kuaizhizao.warehouseOutbound.confirm.batchPicker.autoAllocate')}
            </Button>
            <Button size="small" onClick={clearDraft} disabled={!draft.length}>
              {t('app.kuaizhizao.warehouseOutbound.confirm.batchPicker.clear')}
            </Button>
          </Space>
          <Spin spinning={loading}>
            {!filteredOptions.length ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={t('app.kuaizhizao.warehouseOutbound.confirm.noBatchAvailable')}
              />
            ) : (
              <Table
                size="small"
                rowKey="value"
                pagination={false}
                dataSource={filteredOptions}
                scroll={{ y: 280 }}
                columns={[
                  {
                    title: t('app.kuaizhizao.warehouseOutbound.confirm.batchPicker.colSelect'),
                    key: 'select',
                    width: 56,
                    render: (_: unknown, opt: InventoryPickOption) => (
                      <Checkbox
                        checked={selectedSet.has(opt.value)}
                        onChange={(e) => toggleBatch(opt.value, e.target.checked)}
                      />
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.warehouseOutbound.col.batchNo'),
                    dataIndex: 'value',
                    ellipsis: true,
                    render: (bn: string, opt: InventoryPickOption) => (
                      <Space size={4} wrap>
                        <span>{bn}</span>
                        {opt.fifoRecommended ? (
                          <Tag color="processing" variant="filled">
                            {t('app.kuaizhizao.warehouseOutbound.confirm.batchPicker.fifoRecommended')}
                          </Tag>
                        ) : null}
                      </Space>
                    ),
                  },
                  ...(showDateCols
                    ? [
                        {
                          title: t(
                            'app.kuaizhizao.warehouseOutbound.confirm.batchPicker.colProductionDate',
                          ),
                          key: 'productionDate',
                          width: 110,
                          render: (_: unknown, opt: InventoryPickOption) =>
                            opt.productionDate
                              ? formatBusinessDateOnly(opt.productionDate)
                              : '—',
                        },
                        {
                          title: t(
                            'app.kuaizhizao.warehouseOutbound.confirm.batchPicker.colExpiryDate',
                          ),
                          key: 'expiryDate',
                          width: 110,
                          render: (_: unknown, opt: InventoryPickOption) =>
                            opt.expiryDate ? formatBusinessDateOnly(opt.expiryDate) : '—',
                        },
                      ]
                    : []),
                  {
                    title: t('app.kuaizhizao.warehouseOutbound.confirm.batchPicker.colAvailable'),
                    key: 'available',
                    width: 88,
                    render: (_: unknown, opt: InventoryPickOption) =>
                      formatQuantity(Number(opt.quantity) || 0),
                  },
                  {
                    title: t('app.kuaizhizao.warehouseOutbound.entry.thisIssue'),
                    key: 'qty',
                    width: 120,
                    render: (_: unknown, opt: InventoryPickOption) => {
                      const row = draft.find((a) => a.batchNo === opt.value);
                      const max = Number(opt.quantity) || 0;
                      return (
                        <InputNumber
                          size="small"
                          min={0}
                          max={max > 0 ? max : undefined}
                          disabled={!selectedSet.has(opt.value)}
                          value={row?.quantity ?? 0}
                          onChange={(v) => setBatchQty(opt.value, v)}
                          style={{ width: '100%' }}
                        />
                      );
                    },
                  },
                ]}
              />
            )}
          </Spin>
          <Typography.Text type={sumMismatch ? 'danger' : 'secondary'}>
            {t('app.kuaizhizao.warehouseOutbound.confirm.batchPicker.totalLine', {
              selected: formatQuantity(draftSum),
              required: formatQuantity(target),
            })}
          </Typography.Text>
        </Space>
      </Modal>
    </>
  );
};

export default OutboundBatchAllocationField;
