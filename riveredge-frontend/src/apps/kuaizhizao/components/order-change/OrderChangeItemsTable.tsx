import React, { useMemo } from 'react';
import { Button, DatePicker, InputNumber, Space, Table, Tag } from 'antd';
import { DeleteOutlined, PlusOutlined, RollbackOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { UniMaterialSelect } from '../../../../components/uni-material-select';
import type { Material } from '../../../master-data/types/material';
import type { OrderChangeItem } from '../../services/sales-order-change';
import { formatDateTime } from '../../../../utils/format';

interface OrderChangeItemsTableProps {
  items: OrderChangeItem[];
  editable?: boolean;
  onChange?: (items: OrderChangeItem[]) => void;
}

function rowKey(row: OrderChangeItem, index: number): string {
  return String(row.id ?? row.source_item_id ?? `new-${row.line_no ?? index}`);
}

function calcDelta(row: OrderChangeItem): number {
  const bq = Number(row.before_quantity ?? 0);
  const aq = Number(row.after_quantity ?? 0);
  const bp = Number(row.before_unit_price ?? 0);
  const ap = Number(row.after_unit_price ?? 0);
  return Number((aq * ap - bq * bp).toFixed(2));
}

export const OrderChangeItemsTable: React.FC<OrderChangeItemsTableProps> = ({ items, editable, onChange }) => {
  const { t } = useTranslation();

  const changeTypeLabel = (value: string) => {
    const labels: Record<string, string> = {
      QUANTITY: t('app.kuaizhizao.orderChange.changeTypeQuantity'),
      DELIVERY_DATE: t('app.kuaizhizao.orderChange.changeTypeDeliveryDate'),
      UNIT_PRICE: t('app.kuaizhizao.orderChange.changeTypeUnitPrice'),
      LINE_CANCEL: t('app.kuaizhizao.orderChange.changeTypeLineCancel'),
      LINE_ADD: t('app.kuaizhizao.orderChange.changeTypeLineAdd'),
    };
    return labels[value] ?? value ?? '-';
  };

  const updateItem = (index: number, patch: Partial<OrderChangeItem>) => {
    if (!onChange) return;
    const next = items.map((row, i) => {
      if (i !== index) return row;
      const merged = { ...row, ...patch };
      return { ...merged, delta_amount: calcDelta(merged) };
    });
    onChange(next);
  };

  const removeNewLine = (index: number) => {
    if (!onChange) return;
    onChange(items.filter((_, i) => i !== index));
  };

  const cancelLine = (index: number) => {
    const row = items[index];
    updateItem(index, {
      change_type: 'LINE_CANCEL',
      after_quantity: 0,
      after_unit_price: row.before_unit_price,
      after_delivery_date: row.before_delivery_date,
    });
  };

  const restoreLine = (index: number) => {
    const row = items[index];
    updateItem(index, {
      change_type: 'QUANTITY',
      after_quantity: row.before_quantity,
      after_unit_price: row.before_unit_price,
      after_delivery_date: row.before_delivery_date,
    });
  };

  const addLine = () => {
    if (!onChange) return;
    const lineNo = items.length + 1;
    onChange([
      ...items,
      {
        line_no: lineNo,
        change_type: 'LINE_ADD',
        before_quantity: 0,
        after_quantity: 1,
        before_unit_price: 0,
        after_unit_price: 0,
        after_delivery_date: formatDateTime(dayjs(), 'YYYY-MM-DD'),
        delta_amount: 0,
      },
    ]);
  };

  const onMaterialPick = (index: number, material: Material | null) => {
    if (!material) return;
    updateItem(index, {
      material_id: material.id,
      material_code: material.code,
      material_name: material.name,
      material_spec: material.spec,
      material_unit: material.unit,
    });
  };

  const columns = useMemo(() => {
    const cols: any[] = [
      { title: t('app.kuaizhizao.orderChange.colLineNo'), dataIndex: 'line_no', width: 56 },
      {
        title: t('app.kuaizhizao.orderChange.colMaterial'),
        width: 220,
        render: (_: unknown, row: OrderChangeItem, index: number) => {
          if (row.change_type === 'LINE_ADD' && editable) {
            return (
              <UniMaterialSelect
                style={{ width: '100%' }}
                value={row.material_id}
                onChange={(_id, material) => onMaterialPick(index, material as Material)}
              />
            );
          }
          return (
            <div>
              <div>{row.material_code || '-'}</div>
              <div style={{ color: 'var(--ant-color-text-secondary)', fontSize: 12 }}>{row.material_name}</div>
            </div>
          );
        },
      },
      {
        title: t('app.kuaizhizao.orderChange.colChangeType'),
        dataIndex: 'change_type',
        width: 88,
        render: (v: string) => <Tag>{changeTypeLabel(v)}</Tag>,
      },
      {
        title: t('app.kuaizhizao.orderChange.colBeforeQuantity'),
        dataIndex: 'before_quantity',
        width: 96,
        render: (v: number) => v ?? '-',
      },
      {
        title: t('app.kuaizhizao.orderChange.colAfterQuantity'),
        dataIndex: 'after_quantity',
        width: 110,
        render: (v: number, row: OrderChangeItem, index: number) => {
          if (!editable || row.change_type === 'LINE_CANCEL') return v ?? '-';
          return (
            <InputNumber
              min={0}
              value={v}
              style={{ width: '100%' }}
              onChange={(val) => updateItem(index, { after_quantity: val ?? undefined, change_type: row.change_type === 'LINE_ADD' ? 'LINE_ADD' : undefined })}
            />
          );
        },
      },
      {
        title: t('app.kuaizhizao.orderChange.colBeforeUnitPrice'),
        dataIndex: 'before_unit_price',
        width: 96,
        render: (v: number) => v ?? '-',
      },
      {
        title: t('app.kuaizhizao.orderChange.colAfterUnitPrice'),
        dataIndex: 'after_unit_price',
        width: 110,
        render: (v: number, row: OrderChangeItem, index: number) => {
          if (!editable || row.change_type === 'LINE_CANCEL') return v ?? '-';
          return (
            <InputNumber
              min={0}
              value={v}
              style={{ width: '100%' }}
              onChange={(val) => updateItem(index, { after_unit_price: val ?? undefined })}
            />
          );
        },
      },
      {
        title: t('app.kuaizhizao.orderChange.colAfterDeliveryDate'),
        dataIndex: 'after_delivery_date',
        width: 130,
        render: (v: string, row: OrderChangeItem, index: number) => {
          if (!editable || row.change_type === 'LINE_CANCEL') return v ?? '-';
          return (
            <DatePicker
              value={v ? dayjs(v) : undefined}
              onChange={(d) => updateItem(index, { after_delivery_date: d ? d.format('YYYY-MM-DD') : undefined })}
            />
          );
        },
      },
      {
        title: t('app.kuaizhizao.salesOrderChange.colDeltaAmount'),
        dataIndex: 'delta_amount',
        width: 88,
        render: (_: number, row: OrderChangeItem) => calcDelta(row).toFixed(2),
      },
    ];

    if (editable) {
      cols.push({
        title: t('common.actions'),
        width: 120,
        fixed: 'right' as const,
        render: (_: unknown, row: OrderChangeItem, index: number) => (
          <Space size={4}>
            {row.change_type === 'LINE_ADD' ? (
              <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => removeNewLine(index)}>
                {t('common.delete')}
              </Button>
            ) : row.change_type === 'LINE_CANCEL' ? (
              <Button type="link" size="small" icon={<RollbackOutlined />} onClick={() => restoreLine(index)}>
                {t('app.kuaizhizao.orderChange.restore')}
              </Button>
            ) : (
              <Button type="link" size="small" danger onClick={() => cancelLine(index)}>
                {t('app.kuaizhizao.orderChange.cancelLine')}
              </Button>
            )}
          </Space>
        ),
      });
    }

    return cols;
  }, [editable, items, t]);

  return (
    <>
      {editable && (
        <div style={{ marginBottom: 8 }}>
          <Button type="dashed" icon={<PlusOutlined />} onClick={addLine}>
            {t('app.kuaizhizao.orderChange.addLine')}
          </Button>
        </div>
      )}
      <Table
        rowKey={(r, index) => rowKey(r, index ?? 0)}
        size="small"
        pagination={false}
        scroll={{ x: 1200 }}
        dataSource={items}
        columns={columns}
        rowClassName={(row) => (row.change_type === 'LINE_CANCEL' ? 'order-change-row-cancelled' : '')}
      />
      {editable && (
        <style>{`.order-change-row-cancelled td { opacity: 0.55; text-decoration: line-through; }`}</style>
      )}
    </>
  );
};
