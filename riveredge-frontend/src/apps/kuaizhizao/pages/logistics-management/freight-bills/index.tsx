import React, { useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Form, Input, InputNumber, Modal, Select, Table, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MultiTabListPageTemplate } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import {
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
  UniTableStackedPrimaryCell,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { alignProColumns } from '../../sales-management/shared/documentFieldAlignment';
import {
  renderFreightBillReviewStatusTag,
  renderFreightOrderStatusTag,
} from '../shared/logisticsListPresentation';
import {
  createFreightBill,
  deleteFreightBill,
  listCarriers,
  listFreightBills,
  listPendingFreightOrdersForBill,
  type FreightBill,
  type FreightOrder,
} from '../../../services/logistics';

const FreightBillsPage: React.FC = () => {
  const { t } = useTranslation();
  const perms = useResourcePermissions('kuaizhizao:freight-bill');
  const [activeTabKey, setActiveTabKey] = useState('bills');
  const billsActionRef = useRef<ActionType>();
  const pendingActionRef = useRef<ActionType>();
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();
  const [carriers, setCarriers] = useState<{ label: string; value: number }[]>([]);
  const [billItems, setBillItems] = useState<{ freight_order_id: number; freight_order_code: string; amount: number }[]>([]);

  const billColumns: ProColumns<FreightBill>[] = useMemo(
    () =>
      alignProColumns<FreightBill>([
        {
          title: t('app.kuaizhizao.logistics.field.billCode'),
          dataIndex: 'bill_code',
          ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
          fixed: 'left',
          render: (_, row) => (
            <UniTableStackedPrimaryCell
              primary={String(row.bill_code ?? '').trim() || '-'}
              secondary={String(row.carrier_name ?? '').trim() || '-'}
              secondaryCopyable={false}
            />
          ),
        },
        {
          title: t('app.kuaizhizao.logistics.field.carrierName'),
          dataIndex: 'carrier_name',
          hideInTable: true,
        },
        {
          title: t('app.kuaizhizao.logistics.field.totalAmount'),
          dataIndex: 'total_amount',
          width: 120,
          minWidth: 120,
          uniTableKeepWidth: true,
          resizable: false,
          align: 'right',
          render: (_, row) => (row.total_amount != null ? row.total_amount : '-'),
        },
        {
          title: t('app.kuaizhizao.logistics.field.payableCode'),
          dataIndex: 'payable_code',
          width: 148,
          minWidth: 148,
          uniTableKeepWidth: true,
          resizable: false,
          render: (_, row) =>
            row.payable_id ? (
              <Link to={`/apps/kuaicaiwu/finance-management/payables/${row.payable_id}`}>{row.payable_code}</Link>
            ) : (
              '-'
            ),
        },
        {
          title: t('app.kuaizhizao.logistics.field.reviewStatus'),
          key: 'lifecycle',
          dataIndex: 'review_status',
          fixed: 'right',
          hideInSearch: true,
          render: (_, row) => renderFreightBillReviewStatusTag(t, row.review_status),
        },
      ]),
    [t],
  );

  const pendingColumns: ProColumns<FreightOrder>[] = useMemo(
    () =>
      alignProColumns<FreightOrder>([
        {
          title: t('app.kuaizhizao.logistics.field.orderCode'),
          dataIndex: 'order_code',
          ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
          fixed: 'left',
          render: (_, row) => (
            <UniTableStackedPrimaryCell
              primary={String(row.order_code ?? '').trim() || '-'}
              secondary={String(row.carrier_name ?? '').trim() || '-'}
              secondaryCopyable={false}
            />
          ),
        },
        {
          title: t('app.kuaizhizao.logistics.field.carrierName'),
          dataIndex: 'carrier_name',
          hideInTable: true,
        },
        {
          title: t('app.kuaizhizao.logistics.field.status'),
          key: 'lifecycle',
          dataIndex: 'status',
          fixed: 'right',
          hideInSearch: true,
          render: (_, row) => renderFreightOrderStatusTag(t, row.status),
        },
      ]),
    [t],
  );

  const openCreate = async () => {
    const res = await listCarriers({ limit: 200 });
    setCarriers(res.items.map((item) => ({ label: item.name, value: item.id })));
    setBillItems([]);
    form.resetFields();
    setCreateOpen(true);
  };

  const loadPendingOrders = async (carrierId: number) => {
    const res = await listPendingFreightOrdersForBill({ carrier_id: carrierId });
    setBillItems(
      res.items.map((item) => ({
        freight_order_id: item.id,
        freight_order_code: item.order_code,
        amount: 0,
      })),
    );
  };

  const handleCreate = async () => {
    const values = await form.validateFields();
    const items = billItems.filter((item) => item.amount > 0);
    if (!items.length) {
      message.warning(t('app.kuaizhizao.logistics.message.billItemRequired'));
      return;
    }
    await createFreightBill({
      carrier_id: values.carrier_id,
      remark: values.remark,
      items: items.map((item) => ({
        freight_order_id: item.freight_order_id,
        fee_type: 'base',
        amount: item.amount,
      })),
    });
    message.success(t('common.createSuccess'));
    setCreateOpen(false);
    billsActionRef.current?.reload();
  };

  return (
    <>
      <MultiTabListPageTemplate
        activeTabKey={activeTabKey}
        onTabChange={setActiveTabKey}
        preserveMounted
        tabs={[
          {
            key: 'bills',
            label: t('app.kuaizhizao.logistics.tab.freightBills'),
            children: (
              <UniTable<FreightBill>
                actionRef={billsActionRef}
                columns={billColumns}
                columnPersistenceId="apps.kuaizhizao.pages.logistics-management.freight-bills.v1"
                rowKey="id"
                request={async (params) => {
                  const res = await listFreightBills({
                    skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                    limit: params.pageSize,
                    keyword: params.keyword as string | undefined,
                  });
                  return { data: res.items, total: res.total, success: true };
                }}
                showCreateButton={perms.canCreate}
                createButtonText={t('app.kuaizhizao.logistics.action.createFreightBill')}
                onCreate={openCreate}
                enableRowSelection={perms.canDelete}
                showDeleteButton={perms.canDelete}
                onDelete={async (keys) => {
                  await Promise.all(keys.map((key) => deleteFreightBill(Number(key))));
                  message.success(t('common.batchDeleteSuccess', { count: keys.length }));
                  billsActionRef.current?.reload();
                }}
              />
            ),
          },
          {
            key: 'pending',
            label: t('app.kuaizhizao.logistics.tab.pendingFreightOrders'),
            children: (
              <UniTable<FreightOrder>
                actionRef={pendingActionRef}
                search={false}
                columns={pendingColumns}
                columnPersistenceId="apps.kuaizhizao.pages.logistics-management.freight-bills.pending.v1"
                rowKey="id"
                request={async () => {
                  const res = await listPendingFreightOrdersForBill({ limit: 100 });
                  return { data: res.items, total: res.total, success: true };
                }}
              />
            ),
          },
        ]}
      />

      <Modal
        open={createOpen}
        width={760}
        title={t('app.kuaizhizao.logistics.action.createFreightBill')}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="carrier_id" label={t('app.kuaizhizao.logistics.field.carrierName')} rules={[{ required: true }]}>
            <Select options={carriers} onChange={(value) => loadPendingOrders(Number(value))} />
          </Form.Item>
          <Form.Item name="remark" label={t('common.remark')}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
        <Table
          size="small"
          pagination={false}
          rowKey="freight_order_id"
          dataSource={billItems}
          columns={[
            { title: t('app.kuaizhizao.logistics.field.orderCode'), dataIndex: 'freight_order_code' },
            {
              title: t('app.kuaizhizao.logistics.field.amount'),
              dataIndex: 'amount',
              render: (_, row, index) => (
                <InputNumber
                  min={0}
                  value={row.amount}
                  onChange={(value) => {
                    const next = [...billItems];
                    next[index] = { ...next[index], amount: Number(value || 0) };
                    setBillItems(next);
                  }}
                />
              ),
            },
          ]}
        />
      </Modal>
    </>
  );
};

export default FreightBillsPage;
