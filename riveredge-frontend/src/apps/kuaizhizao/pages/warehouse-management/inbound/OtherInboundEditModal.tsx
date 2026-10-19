/**
 * 其他入库编辑弹窗（入库 Hub 列表「编辑」）。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App, Input, InputNumber, Table, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  FormModalTemplate,
  MODAL_CONFIG,
  WAREHOUSE_FORM_DETAIL_TABLE_FRAME_STYLES,
} from '../../../../../components/layout-templates';
import { warehouseApi } from '../../../services/production';
import { formatQuantity } from '../../../../../utils/format';
import { useNumericPrecisionPlaces } from '../../../../../hooks/useNumericPrecision';
import { appendWarehouseLineAmountColumns } from '../shared/warehouseAmountDisplay';
import {
  isInboundEditable,
  inboundUpdateCapabilityReasonMessage,
  type InboundHubOrder,
} from './inboundHubTypes';
import { normalizeInboundHubDetail } from './inboundHubNormalize';
import { normalizeDocumentAttachments } from '../../../utils/documentAttachments';

type OtherInboundLineItem = {
  id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_unit?: string;
  inbound_quantity?: number;
  unit_price?: number;
  location_code?: string;
  batch_number?: string;
  serial_numbers?: string[];
  status?: string;
};

type OtherInboundDetail = InboundHubOrder & {
  inbound_code?: string;
  reason_type?: string;
  reason_desc?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  review_status?: string;
  notes?: string;
  attachments?: unknown;
  items?: OtherInboundLineItem[];
};

export type OtherInboundEditModalProps = {
  open: boolean;
  record: { id?: number; receipt_type?: string } | null;
  onClose: () => void;
  onSuccess?: () => void;
};

export const OtherInboundEditModal: React.FC<OtherInboundEditModalProps> = ({
  open,
  record,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const quantityDecimals = useNumericPrecisionPlaces('quantity');
  const { message: messageApi } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<OtherInboundDetail | null>(null);
  const [reasonDesc, setReasonDesc] = useState('');
  const [notes, setNotes] = useState('');
  const [editableQuantities, setEditableQuantities] = useState<Record<number, number>>({});
  const [editableUnitPrices, setEditableUnitPrices] = useState<Record<number, number>>({});

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const loadKey =
    open && record?.id && record.receipt_type === 'other_inbound' ? String(record.id) : null;

  const resetState = useCallback(() => {
    setDetail(null);
    setReasonDesc('');
    setNotes('');
    setEditableQuantities({});
    setEditableUnitPrices({});
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
        const detailData = (await warehouseApi.otherInbound.get(loadKey)) as OtherInboundDetail;
        const merged = normalizeInboundHubDetail(
          'other_inbound',
          detailData as Record<string, unknown>,
          { id: Number(loadKey), receipt_type: 'other_inbound' },
        ) as OtherInboundDetail;
        if (cancelled) return;
        if (!isInboundEditable(merged)) {
          messageApi.warning(
            inboundUpdateCapabilityReasonMessage(merged, t) || t('common.saveFailed'),
          );
          onCloseRef.current();
          return;
        }
        setDetail({ ...merged, ...detailData, items: detailData.items ?? merged.items });
        setReasonDesc(String(detailData.reason_desc ?? '').trim());
        setNotes(String(detailData.notes ?? '').trim());
        const qtyMap: Record<number, number> = {};
        const priceMap: Record<number, number> = {};
        (detailData.items || []).forEach((it) => {
          if (it?.id == null) return;
          qtyMap[Number(it.id)] = Number(it.inbound_quantity ?? 0);
          priceMap[Number(it.id)] = Number(it.unit_price ?? 0);
        });
        setEditableQuantities(qtyMap);
        setEditableUnitPrices(priceMap);
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
    if (!detail.reason_type || !detail.warehouse_id || !detail.warehouse_name) {
      messageApi.error(t('common.saveFailed'));
      return;
    }

    const mappedItems = items
      .filter((it) => it.material_id != null)
      .map((it) => {
        const rowId = Number(it.id);
        const qty = Number(editableQuantities[rowId] ?? it.inbound_quantity ?? 0);
        if (!(qty > 0)) {
          throw new Error(
            t('app.kuaizhizao.warehouseInbound.msg.actualQtyMustBePositive', {
              material: it.material_code || it.material_name || '-',
            }),
          );
        }
        const unitPrice = Number(editableUnitPrices[rowId] ?? it.unit_price ?? 0);
        return {
          material_id: Number(it.material_id),
          material_code: it.material_code || '',
          material_name: it.material_name || '',
          material_unit: it.material_unit || '个',
          inbound_quantity: qty,
          unit_price: unitPrice,
          total_amount: Number((qty * unitPrice).toFixed(2)),
          location_code: it.location_code || undefined,
          batch_number: it.batch_number || undefined,
          status: it.status || detail.status || '待入库',
        };
      });

    setSaving(true);
    try {
      await warehouseApi.otherInbound.update(String(detail.id), {
        reason_type: detail.reason_type,
        reason_desc: reasonDesc.trim() || undefined,
        warehouse_id: Number(detail.warehouse_id),
        warehouse_name: detail.warehouse_name,
        status: detail.status || '待入库',
        review_status: detail.review_status || '待审核',
        notes: notes.trim() || undefined,
        attachments: normalizeDocumentAttachments(detail.attachments),
        items: mappedItems,
      });
      messageApi.success(t('common.saveSuccess'));
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
    const code = String(detail?.inbound_code ?? detail?.receipt_code ?? '').trim();
    return `${t('common.edit')} ${t('app.kuaizhizao.warehouseInbound.receiptType.other_inbound')}${code ? ` - ${code}` : ''}`;
  }, [detail?.inbound_code, detail?.receipt_code, t]);

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
            title: t('app.kuaizhizao.warehouseOtherInbound.col.inboundQty'),
            dataIndex: 'inbound_quantity',
            width: 140,
            align: 'right' as const,
            render: (_: unknown, row: OtherInboundLineItem) => {
              if (row.id == null) return formatQuantity(row.inbound_quantity);
              const rid = Number(row.id);
              return (
                <InputNumber
                  min={0.01}
                  precision={quantityDecimals}
                  value={editableQuantities[rid] ?? Number(row.inbound_quantity ?? 0)}
                  onChange={(v) =>
                    setEditableQuantities((prev) => ({ ...prev, [rid]: Number(v) || 0 }))
                  }
                  style={{ width: 110 }}
                  size="small"
                />
              );
            },
          },
          {
            title: t('app.kuaizhizao.warehouseOtherInbound.col.unitPrice'),
            dataIndex: 'unit_price',
            width: 120,
            align: 'right' as const,
            render: (_: unknown, row: OtherInboundLineItem) => {
              if (row.id == null) return formatQuantity(row.unit_price);
              const rid = Number(row.id);
              return (
                <InputNumber
                  min={0}
                  precision={2}
                  value={editableUnitPrices[rid] ?? Number(row.unit_price ?? 0)}
                  onChange={(v) =>
                    setEditableUnitPrices((prev) => ({ ...prev, [rid]: Number(v) || 0 }))
                  }
                  style={{ width: 100 }}
                  size="small"
                />
              );
            },
          },
          {
            title: t('common.unit'),
            dataIndex: 'material_unit',
            width: 72,
            render: (_: unknown, row: OtherInboundLineItem) => row.material_unit || '-',
          },
        ],
        t,
        true,
        -3,
      ),
    [editableQuantities, editableUnitPrices, quantityDecimals, t],
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
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        {t('app.kuaizhizao.warehouseOtherInbound.col.reasonType')}：{detail?.reason_type ?? '-'}
        {' '}
        {t('app.kuaizhizao.warehouseOtherInbound.col.warehouse')}：{detail?.warehouse_name ?? '-'}
      </Typography.Text>
      <div style={{ marginBottom: 12 }}>
        <Typography.Text style={{ display: 'block', marginBottom: 4 }}>
          {t('app.kuaizhizao.warehouseOtherInbound.field.reasonDesc')}
        </Typography.Text>
        <Input.TextArea
          value={reasonDesc}
          onChange={(e) => setReasonDesc(e.target.value)}
          rows={2}
          placeholder={t('app.kuaizhizao.warehouseOtherInbound.field.optional')}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <Typography.Text style={{ display: 'block', marginBottom: 4 }}>
          {t('common.notes')}
        </Typography.Text>
        <Input.TextArea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder={t('app.kuaizhizao.warehouseOtherInbound.field.optional')}
        />
      </div>
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

export default OtherInboundEditModal;
