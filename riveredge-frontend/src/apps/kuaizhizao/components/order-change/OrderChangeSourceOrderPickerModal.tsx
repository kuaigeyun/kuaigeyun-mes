import React, { useCallback, useEffect, useState } from 'react';
import { App, Input, Modal, Space, Table, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { listSalesOrders } from '../../services/sales-order';
import { listPurchaseOrders } from '../../services/purchase';
import {
  isSourceOrderEligibleForChange,
  type OrderChangeSourceOrderOption,
} from '../../utils/orderChangeSourceOrder';
import { formatDateTime } from '../../../../utils/format';

export type OrderChangeSourceDocType = 'sales' | 'purchase';

interface OrderChangeSourceOrderPickerModalProps {
  open: boolean;
  docType: OrderChangeSourceDocType;
  onCancel: () => void;
  onSelect: (order: OrderChangeSourceOrderOption) => void;
}

export const OrderChangeSourceOrderPickerModal: React.FC<OrderChangeSourceOrderPickerModalProps> = ({
  open,
  docType,
  onCancel,
  onSelect,
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<OrderChangeSourceOrderOption[]>([]);
  const [selectedId, setSelectedId] = useState<number | undefined>();

  const loadCandidates = useCallback(
    async (searchKeyword?: string) => {
      setLoading(true);
      try {
        const kw = searchKeyword?.trim() || undefined;
        // 采购订单列表 API limit 上限为 100（销售为 1000）
        const listLimit = docType === 'purchase' ? 100 : 200;
        if (docType === 'sales') {
          const res = await listSalesOrders({ limit: listLimit, skip: 0, keyword: kw });
          const rows = (res.data ?? [])
            .filter((o) => isSourceOrderEligibleForChange(o.status, o.review_status))
            .map((o) => ({
              id: o.id!,
              order_code: o.order_code ?? '',
              partner_name: o.customer_name,
              status: o.status,
              total_amount: o.total_amount != null ? Number(o.total_amount) : undefined,
              order_date: o.order_date,
            }));
          setCandidates(rows);
        } else {
          const res = await listPurchaseOrders({ limit: listLimit, skip: 0, keyword: kw });
          const rows = (res.data ?? [])
            .filter((o) => isSourceOrderEligibleForChange(o.status, o.review_status))
            .map((o) => ({
              id: o.id!,
              order_code: o.order_code ?? '',
              partner_name: o.supplier_name,
              status: o.status,
              total_amount: o.total_amount != null ? Number(o.total_amount) : undefined,
              order_date: o.order_date,
            }));
          setCandidates(rows);
        }
      } catch (e: any) {
        setCandidates([]);
        const loadFailedKey =
          docType === 'sales'
            ? 'app.kuaizhizao.orderChange.loadSalesOrdersFailed'
            : 'app.kuaizhizao.orderChange.loadPurchaseOrdersFailed';
        message.error(e?.message ?? t(loadFailedKey));
      } finally {
        setLoading(false);
      }
    },
    [docType, message, t],
  );

  useEffect(() => {
    if (!open) return;
    setKeyword('');
    setSelectedId(undefined);
    void loadCandidates('');
  }, [open, loadCandidates]);

  const partnerLabel =
    docType === 'sales' ? t('path.customers') : t('path.suppliers');
  const orderLabel =
    docType === 'sales'
      ? t('app.kuaizhizao.salesOrderChange.salesOrderLabel')
      : t('app.kuaizhizao.orderChange.purchaseOrderLabel');

  return (
    <Modal
      title={t('app.kuaizhizao.orderChange.selectOrderTitle', { orderLabel })}
      open={open}
      width={960}
      onCancel={onCancel}
      onOk={() => {
        const picked = candidates.find((c) => c.id === selectedId);
        if (picked) onSelect(picked);
      }}
      okText={t('common.confirm')}
      okButtonProps={{ disabled: !selectedId }}
      destroyOnHidden
    >
      <Space orientation="vertical" style={{ width: '100%' }} size={12}>
        <Input.Search
          allowClear
          placeholder={t('app.kuaizhizao.orderChange.searchOrderPlaceholder', {
            orderLabel,
            partnerLabel,
          })}
          enterButton={t('app.kuaizhizao.orderChange.search')}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onSearch={(v) => void loadCandidates(v)}
        />
        <Table<OrderChangeSourceOrderOption>
          rowKey="id"
          size="small"
          loading={loading}
          pagination={false}
          scroll={{ y: 360 }}
          locale={{
            emptyText: keyword
              ? t('app.kuaizhizao.orderChange.emptyNoSearchResults', { orderLabel })
              : t('app.kuaizhizao.orderChange.emptyNoEligibleOrders', { orderLabel }),
          }}
          dataSource={candidates}
          rowSelection={{
            type: 'radio',
            selectedRowKeys: selectedId ? [selectedId] : [],
            onChange: (keys) => setSelectedId(keys[0] != null ? Number(keys[0]) : undefined),
          }}
          onRow={(record) => ({
            onClick: () => setSelectedId(record.id),
          })}
          columns={[
            { title: t('app.kuaizhizao.orderChange.colOrderCode'), dataIndex: 'order_code', width: 160 },
            { title: partnerLabel, dataIndex: 'partner_name', ellipsis: true },
            {
              title: t('app.kuaizhizao.salesOrder.orderDate'),
              dataIndex: 'order_date',
              width: 120,
              render: (v: string) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-'),
            },
            {
              title: t('app.kuaizhizao.orderChange.colAmount'),
              dataIndex: 'total_amount',
              width: 120,
              align: 'right',
              render: (v: number | undefined) =>
                v != null ? Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-',
            },
            {
              title: t('common.status'),
              dataIndex: 'status',
              width: 100,
              render: (v: string) => <Tag>{v || '-'}</Tag>,
            },
          ]}
        />
      </Space>
    </Modal>
  );
};
