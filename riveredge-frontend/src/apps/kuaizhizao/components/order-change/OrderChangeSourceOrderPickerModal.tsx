import React, { useCallback, useEffect, useState } from 'react';
import { App, Input, Modal, Space, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { listSalesOrders } from '../../services/sales-order';
import { listPurchaseOrders } from '../../services/purchase';
import {
  isSourceOrderEligibleForChange,
  type OrderChangeSourceOrderOption,
} from '../../utils/orderChangeSourceOrder';

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
        message.error(e?.message ?? `加载${docType === 'sales' ? '销售' : '采购'}订单失败`);
      } finally {
        setLoading(false);
      }
    },
    [docType, message],
  );

  useEffect(() => {
    if (!open) return;
    setKeyword('');
    setSelectedId(undefined);
    void loadCandidates('');
  }, [open, loadCandidates]);

  const partnerLabel = docType === 'sales' ? '客户' : '供应商';
  const orderLabel = docType === 'sales' ? '销售订单' : '采购订单';

  return (
    <Modal
      title={`选择${orderLabel}`}
      open={open}
      width={960}
      onCancel={onCancel}
      onOk={() => {
        const picked = candidates.find((c) => c.id === selectedId);
        if (picked) onSelect(picked);
      }}
      okText="确定"
      okButtonProps={{ disabled: !selectedId }}
      destroyOnClose
    >
      <Space orientation="vertical" style={{ width: '100%' }} size={12}>
        <Input.Search
          allowClear
          placeholder={`搜索${orderLabel}（单号/${partnerLabel}）`}
          enterButton="搜索"
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
          locale={{ emptyText: keyword ? `未找到可变更的${orderLabel}` : `暂无可变更的${orderLabel}` }}
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
            { title: '订单号', dataIndex: 'order_code', width: 160 },
            { title: partnerLabel, dataIndex: 'partner_name', ellipsis: true },
            {
              title: '订单日期',
              dataIndex: 'order_date',
              width: 120,
              render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD') : '-'),
            },
            {
              title: '金额',
              dataIndex: 'total_amount',
              width: 120,
              align: 'right',
              render: (v: number | undefined) =>
                v != null ? Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-',
            },
            {
              title: '状态',
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
