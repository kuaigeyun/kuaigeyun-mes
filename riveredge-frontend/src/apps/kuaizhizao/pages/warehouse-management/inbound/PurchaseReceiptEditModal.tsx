/**
 * 采购入库编辑弹窗（Hub 列表「编辑」）。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App, InputNumber, Table, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { FormModalTemplate, MODAL_CONFIG, WAREHOUSE_FORM_DETAIL_TABLE_FRAME_STYLES } from '../../../../../components/layout-templates';
import { warehouseApi } from '../../../services/production';
import { formatQuantity } from '../../../../../utils/format';
import { appendWarehouseLineAmountColumns } from '../shared/warehouseAmountDisplay';
import {
  isInboundEditable,
  inboundUpdateCapabilityReasonMessage,
  type InboundHubOrder,
} from './inboundHubTypes';
import { normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { normalizeInboundHubDetail } from './inboundHubNormalize';

type InboundLineItem = {
  id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  material_unit?: string;
  unit?: string;
  receipt_quantity?: number;
  unit_price?: number;
  qualified_quantity?: number;
  unqualified_quantity?: number;
  purchase_order_item_id?: number;
  batch_number?: string;
  location_code?: string;
  serial_numbers?: string[];
  status?: string;
  notes?: string;
};

type PurchaseReceiptDetail = InboundHubOrder & {
  items?: InboundLineItem[];
  attachments?: unknown;
};

export type PurchaseReceiptEditModalProps = {
  open: boolean;
  record: { id?: number; receipt_type?: string } | null;
  onClose: () => void;
  onSuccess?: () => void;
};

export const PurchaseReceiptEditModal: React.FC<PurchaseReceiptEditModalProps> = ({
  open,
  record,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<PurchaseReceiptDetail | null>(null);
  const [editableReceiptQuantities, setEditableReceiptQuantities] = useState<Record<number, number>>({});

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const loadKey = open && record?.id && record.receipt_type === 'purchase' ? String(record.id) : null;

  const resetState = useCallback(() => {
    setDetail(null);
    setEditableReceiptQuantities({});
  }, []);

  useEffect(() => {
    if (!open) {
      resetState();
      setLoading(false);
    }
  }, [open, resetState]);

  useEffect(() => {
    if (!loadKey) return;

    let cancelled = false;
    setLoading(true);
    setDetail(null);

    void (async () => {
      try {
        const detailData = (await warehouseApi.purchaseReceipt.get(loadKey)) as PurchaseReceiptDetail;
        const merged = normalizeInboundHubDetail(
          'purchase',
          detailData as Record<string, unknown>,
          { id: Number(loadKey), receipt_type: 'purchase' },
        );
        if (cancelled) return;
        if (!isInboundEditable(merged)) {
          messageApi.warning(
            inboundUpdateCapabilityReasonMessage(merged, t) || t('common.saveFailed'),
          );
          onCloseRef.current();
          return;
        }
        setDetail(merged);
        const quantities: Record<number, number> = {};
        (merged.items || []).forEach((it) => {
          if (it?.id != null) quantities[Number(it.id)] = Number(it.receipt_quantity ?? 0);
        });
        setEditableReceiptQuantities(quantities);
      } catch (e: unknown) {
        if (cancelled) return;
        const err = e as { message?: string };
        messageApi.error(err?.message || t('app.kuaizhizao.warehouseInbound.msg.loadDetailFailed'));
        onCloseRef.current();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadKey, messageApi, t]);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSubmit = async () => {
    if (!detail?.id) return;
    const items = detail.items || [];
    if (!items.length) {
      messageApi.warning(t('app.kuaizhizao.warehouseInbound.msg.noEditableLines'));
      return;
    }
    const mappedItems = items
      .filter((it) => it.material_id != null)
      .map((it) => {
        const rowId = Number(it.id);
        const qty = Number(editableReceiptQuantities[rowId] ?? it.receipt_quantity ?? 0);
        if (!(qty > 0)) {
          throw new Error(
            t('app.kuaizhizao.warehouseInbound.msg.actualQtyMustBePositive', {
              material: it.material_code || it.material_name || '-',
            }),
          );
        }
        const unitPrice = Number(it.unit_price ?? 0);
        const qualified = Number(it.qualified_quantity ?? it.receipt_quantity ?? qty);
        const unqualified = Number(it.unqualified_quantity ?? 0);
        return {
          purchase_order_item_id: Number(it.purchase_order_item_id ?? 0),
          material_id: Number(it.material_id),
          material_code: it.material_code || '',
          material_name: it.material_name || '',
          material_spec: it.material_spec || undefined,
          material_unit: it.material_unit || it.unit || '个',
          receipt_quantity: qty,
          unit_price: unitPrice,
          total_amount: Number((qty * unitPrice).toFixed(2)),
          qualified_quantity: Number((qualified + unqualified > qty ? qty : qualified).toFixed(2)),
          unqualified_quantity: Number((qualified + unqualified > qty ? 0 : unqualified).toFixed(2)),
          batch_number: it.batch_number || undefined,
          location_code: it.location_code || undefined,
          serial_numbers: it.serial_numbers?.length ? it.serial_numbers : undefined,
          status: it.status || detail.status || '草稿',
          notes: it.notes || undefined,
        };
      });

    setSaving(true);
    try {
      await warehouseApi.purchaseReceipt.update(String(detail.id), {
        purchase_order_id: Number(detail.purchase_order_id || 0),
        purchase_order_code: detail.purchase_order_code || '',
        supplier_id: Number(detail.supplier_id || 0),
        supplier_name: detail.supplier_name || '',
        warehouse_id: Number(detail.warehouse_id || 0),
        warehouse_name: detail.warehouse_name || '',
        status: detail.status || '草稿',
        review_status: detail.review_status || '待审核',
        notes: detail.notes || undefined,
        attachments: normalizeDocumentAttachments(detail.attachments),
        items: mappedItems,
      });
      messageApi.success(t('app.kuaizhizao.warehouseInbound.msg.actualQtySaved'));
      handleClose();
      onSuccess?.();
    } catch (error: unknown) {
      const err = error as { message?: string; response?: { data?: { detail?: string } } };
      messageApi.error(err?.message || err?.response?.data?.detail || t('common.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const modalTitle = useMemo(() => {
    const code = String(detail?.receipt_code ?? record?.receipt_code ?? '').trim();
    return `${t('common.edit')} ${t('app.kuaizhizao.warehouseInbound.receiptType.purchase')}${code ? ` - ${code}` : ''}`;
  }, [detail?.receipt_code, record?.receipt_code, t]);

  const lineColumns = useMemo(
    () =>
      appendWarehouseLineAmountColumns(
        [
          {
            title: t('app.kuaizhizao.warehouseInbound.col.materialCode'),
            dataIndex: 'material_code',
            width: 120,
            ellipsis: true,
          },
          {
            title: t('app.kuaizhizao.warehouseInbound.col.materialName'),
            dataIndex: 'material_name',
            width: 150,
            ellipsis: true,
          },
          {
            title: t('app.kuaizhizao.warehouseInbound.col.actualQty'),
            dataIndex: 'receipt_quantity',
            width: 140,
            align: 'right' as const,
            render: (_: unknown, row: InboundLineItem) => {
              if (row.id == null) return formatQuantity(row.receipt_quantity);
              const rid = Number(row.id);
              return (
                <InputNumber
                  min={0.01}
                  precision={2}
                  value={editableReceiptQuantities[rid] ?? Number(row.receipt_quantity ?? 0)}
                  onChange={(v) =>
                    setEditableReceiptQuantities((prev) => ({ ...prev, [rid]: Number(v) || 0 }))
                  }
                  style={{ width: 110 }}
                  size="small"
                />
              );
            },
          },
          {
            title: t('common.unit'),
            dataIndex: 'material_unit',
            width: 72,
            render: (_: unknown, row: InboundLineItem) => row.material_unit || row.unit || '-',
          },
        ],
        t,
        true,
        -3,
      ),
    [editableReceiptQuantities, t],
  );

  return (
    <FormModalTemplate
      title={modalTitle}
      open={open}
      onClose={handleClose}
      onFinish={handleSubmit}
      isEdit
      loading={saving}
      width={MODAL_CONFIG.LARGE_WIDTH}
      grid={false}
    >
      <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
        {t('app.kuaizhizao.warehouseInbound.section.detailInfo')}
      </Typography.Text>
      <style>{WAREHOUSE_FORM_DETAIL_TABLE_FRAME_STYLES}</style>
      <div className="warehouse-form-detail-table-frame">
        <Table
          className="warehouse-detail-table"
          size="small"
          pagination={false}
          loading={loading}
          rowKey={(row) => String(row.id ?? row.material_code)}
          dataSource={detail?.items || []}
          columns={lineColumns}
          scroll={{ x: 'max-content' }}
          style={{ width: '100%', margin: 0 }}
        />
      </div>
    </FormModalTemplate>
  );
};

export default PurchaseReceiptEditModal;
