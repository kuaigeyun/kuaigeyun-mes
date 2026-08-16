import React, { useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns, ProFormInstance } from '@ant-design/pro-components';
import { ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Col, Form, InputNumber, Row, theme } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { FormModalTemplate, MODAL_CONFIG, MultiTabListPageTemplate } from '../../../../../components/layout-templates';
import { MODAL_NESTED_ABOVE_PARENT_OFFSET } from '../../../../../components/layout-templates/constants';
import { UniTable } from '../../../../../components/uni-table';
import {
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
  UniTableStackedPrimaryCell,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import { UniPullQueryModal, useUniPullQuery } from '../../../../../components/uni-pull-query';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { alignProColumns } from '../../sales-management/shared/documentFieldAlignment';
import {
  renderFreightBillReviewStatusTag,
  renderFreightOrderStatusTag,
} from '../shared/logisticsListPresentation';
import { CarrierSelectDropdown } from '../shared/CarrierSelectDropdown';
import {
  createFreightBill,
  deleteFreightBill,
  listFreightBills,
  listPendingFreightOrdersForBill,
  type FreightBill,
  type FreightOrder,
} from '../../../services/logistics';

type FreightBillFormItem = {
  freight_order_id: number;
  freight_order_code: string;
  tracking_number?: string;
  amount?: number;
};

function BillItemReadonlyText({ value }: { value?: string }) {
  return <>{String(value ?? '').trim() || '-'}</>;
}

const FreightBillsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const perms = useResourcePermissions('kuaizhizao:freight-bill');
  const [activeTabKey, setActiveTabKey] = useState('bills');
  const billsActionRef = useRef<ActionType>();
  const pendingActionRef = useRef<ActionType>();
  const formRef = useRef<ProFormInstance>();
  const [createOpen, setCreateOpen] = useState(false);
  const pullModalZIndex = token.zIndexPopupBase + MODAL_NESTED_ABOVE_PARENT_OFFSET;

  const selectedOrderIds = () => {
    const items = (formRef.current?.getFieldValue('items') ?? []) as FreightBillFormItem[];
    return new Set(items.map((item) => item.freight_order_id));
  };

  const pullFreightOrders = useUniPullQuery<FreightOrder>({
    rowKey: 'id',
    selectionType: 'checkbox',
    loadData: async ({ keyword, page, pageSize }) => {
      const carrierId = formRef.current?.getFieldValue('carrier_id');
      if (!carrierId) {
        return { data: [], total: 0 };
      }
      const res = await listPendingFreightOrdersForBill({
        carrier_id: Number(carrierId),
        keyword: keyword.trim() || undefined,
        skip: (page - 1) * pageSize,
        limit: pageSize,
      });
      return { data: res.items ?? [], total: res.total ?? 0 };
    },
    onConfirm: async (_keys, rows) => {
      if (!rows.length) {
        messageApi.warning(t('app.kuaizhizao.logistics.message.selectFreightOrder'));
        return;
      }
      const existing = (formRef.current?.getFieldValue('items') ?? []) as FreightBillFormItem[];
      const existingIds = new Set(existing.map((item) => item.freight_order_id));
      const appended = rows
        .filter((row) => !existingIds.has(row.id))
        .map((row) => ({
          freight_order_id: row.id,
          freight_order_code: row.order_code,
          tracking_number: row.tracking_number,
          amount: undefined,
        }));
      formRef.current?.setFieldsValue({ items: [...existing, ...appended] });
      pullFreightOrders.closeModal();
    },
    isRowDisabled: (row) => selectedOrderIds().has(row.id),
  });

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
              secondary={String(row.tracking_number ?? '').trim() || '-'}
              secondaryCopyable={Boolean(String(row.tracking_number ?? '').trim())}
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

  const pullColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.logistics.field.orderCode'),
        dataIndex: 'order_code',
        width: 168,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.logistics.field.trackingNumber'),
        dataIndex: 'tracking_number',
        ellipsis: true,
        render: (_: unknown, row: FreightOrder) => String(row.tracking_number ?? '').trim() || '-',
      },
      {
        title: t('app.kuaizhizao.logistics.field.status'),
        dataIndex: 'status',
        width: 100,
        ellipsis: true,
        render: (_: unknown, row: FreightOrder) => renderFreightOrderStatusTag(t, row.status),
      },
    ],
    [t],
  );

  const billItemColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.logistics.field.orderCode'),
        dataIndex: 'freight_order_code',
        width: 168,
        ellipsis: true,
        render: (_: unknown, __: unknown, index: number) => (
          <Form.Item name={[index, 'freight_order_code']} noStyle>
            <BillItemReadonlyText />
          </Form.Item>
        ),
      },
      {
        title: t('app.kuaizhizao.logistics.field.trackingNumber'),
        dataIndex: 'tracking_number',
        ellipsis: true,
        render: (_: unknown, __: unknown, index: number) => (
          <Form.Item name={[index, 'tracking_number']} noStyle>
            <BillItemReadonlyText />
          </Form.Item>
        ),
      },
      {
        title: t('app.kuaizhizao.logistics.field.amount'),
        dataIndex: 'amount',
        width: 140,
        render: (_: unknown, __: unknown, index: number) => (
          <Form.Item name={[index, 'amount']} rules={[{ required: true }]} style={{ margin: 0 }}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        ),
      },
    ],
    [t],
  );

  const openCreate = () => {
    setCreateOpen(true);
  };

  const openPull = () => {
    const carrierId = formRef.current?.getFieldValue('carrier_id');
    if (!carrierId) {
      messageApi.warning(t('app.kuaizhizao.logistics.message.selectCarrierFirst'));
      return;
    }
    pullFreightOrders.openModal();
  };

  const handleCreate = async (values: {
    carrier_id: number;
    remark?: string;
    items?: FreightBillFormItem[];
  }) => {
    const items = (values.items ?? []).filter((item) => Number(item.amount) > 0);
    if (!items.length) {
      messageApi.warning(t('app.kuaizhizao.logistics.message.billItemRequired'));
      return;
    }
    try {
      await createFreightBill({
        carrier_id: values.carrier_id,
        remark: values.remark,
        items: items.map((item) => ({
          freight_order_id: item.freight_order_id,
          fee_type: 'base',
          amount: item.amount,
        })),
      });
      messageApi.success(t('common.createSuccess'));
      setCreateOpen(false);
      billsActionRef.current?.reload();
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.createFailed')));
    }
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
                  messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
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
                columnPersistenceId="apps.kuaizhizao.pages.logistics-management.freight-bills.pending.v2"
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

      <FormModalTemplate
        title={t('app.kuaizhizao.logistics.action.createFreightBill')}
        open={createOpen}
        isEdit={false}
        grid={false}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        initialValues={{ items: [] }}
        onClose={() => setCreateOpen(false)}
        onFinish={handleCreate}
        onValuesChange={(changed) => {
          if ('carrier_id' in changed) {
            formRef.current?.setFieldsValue({ items: [] });
          }
        }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="carrier_id"
              label={t('app.kuaizhizao.logistics.field.carrierName')}
              rules={[{ required: true }]}
            >
              <CarrierSelectDropdown modalZIndex={token.zIndexPopupBase} />
            </Form.Item>
          </Col>
        </Row>
        <UniTableDetail
          name="items"
          title={t('app.kuaizhizao.logistics.section.billItems')}
          required
          requiredMessage={t('app.kuaizhizao.logistics.message.billItemRequired')}
          disabledAdd
          headerExtra={
            <Button type="dashed" onClick={openPull}>
              {t('app.kuaizhizao.logistics.action.pullSelectFreightOrder')}
            </Button>
          }
          columns={billItemColumns}
          tableProps={{
            size: 'small',
            style: { width: '100%', margin: 0 },
          }}
        />
        <Row gutter={16}>
          <Col span={24}>
            <ProFormTextArea name="remark" label={t('common.remark')} fieldProps={{ rows: 2 }} />
          </Col>
        </Row>
      </FormModalTemplate>

      <UniPullQueryModal<FreightOrder>
        open={pullFreightOrders.open}
        title={t('app.kuaizhizao.logistics.action.pullSelectFreightOrder')}
        onCancel={pullFreightOrders.closeModal}
        onOk={pullFreightOrders.handleConfirm}
        rowKey="id"
        columns={pullColumns}
        dataSource={pullFreightOrders.dataSource}
        loading={pullFreightOrders.loading}
        confirmLoading={pullFreightOrders.confirmLoading}
        selectionType={pullFreightOrders.selectionType}
        selectedRowKeys={pullFreightOrders.selectedRowKeys}
        selectedRows={pullFreightOrders.selectedRows}
        getRowLabel={(row) => String(row.tracking_number || row.order_code || '').trim()}
        onSelectedRowKeysChange={pullFreightOrders.handleSelectedRowKeysChange}
        searchDraft={pullFreightOrders.searchDraft}
        onSearchDraftChange={pullFreightOrders.setSearchDraft}
        onSearchApply={pullFreightOrders.handleSearchApply}
        onSearchClear={pullFreightOrders.handleSearchClear}
        appliedKeyword={pullFreightOrders.appliedKeyword}
        searchPlaceholder={t('app.kuaizhizao.logistics.tracking.filterKeyword')}
        page={pullFreightOrders.page}
        pageSize={pullFreightOrders.pageSize}
        total={pullFreightOrders.total}
        onPageChange={pullFreightOrders.handlePageChange}
        isRowDisabled={(row) => selectedOrderIds().has(row.id)}
        zIndex={pullModalZIndex}
      />
    </>
  );
};

export default FreightBillsPage;
