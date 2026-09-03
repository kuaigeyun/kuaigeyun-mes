import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns, ProFormInstance } from '@ant-design/pro-components';
import { ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Col, Form, Input, InputNumber, Modal, Popconfirm, Row, theme } from 'antd';
import { CheckOutlined, CloseOutlined, SendOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  DetailDrawerActions,
  FormModalTemplate,
  MODAL_CONFIG,
  MultiTabListPageTemplate,
} from '../../../../../components/layout-templates';
import { MODAL_NESTED_ABOVE_PARENT_OFFSET } from '../../../../../components/layout-templates/constants';
import { rowActionKind } from '../../../../../components/uni-action';
import { UniTable } from '../../../../../components/uni-table';
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import { UniPullQueryModal, useUniPullQuery } from '../../../../../components/uni-pull-query';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { hasReviewPermission } from '../../../../../utils/permissionContract';
import { useCurrentUser } from '../../../../../hooks/useCurrentUser';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { alignProColumns } from '../../sales-management/shared/documentFieldAlignment';
import {
  renderFreightBillReviewStatusTag,
  renderFreightOrderStatusTag,
} from '../shared/logisticsListPresentation';
import { CarrierSelectDropdown } from '../shared/CarrierSelectDropdown';
import {
  auditFreightBill,
  createFreightBill,
  deleteFreightBill,
  getFreightBill,
  listFreightBills,
  listPendingFreightOrdersForBill,
  rejectFreightBill,
  submitFreightBill,
  updateFreightBill,
  type FreightBill,
  type FreightOrder,
} from '../../../services/logistics';
import { FreightBillDetailDrawer } from './components/FreightBillDetailDrawer';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';

const RESOURCE = 'kuaizhizao:freight-bill';

type FreightBillFormItem = {
  freight_order_id: number;
  freight_order_code: string;
  tracking_number?: string;
  amount?: number;
};

function BillItemReadonlyText({ value }: { value?: string }) {
  return <>{String(value ?? '').trim() || '-'}</>;
}

function canEditFreightBill(reviewStatus?: string | null) {
  return reviewStatus === 'draft' || reviewStatus === 'rejected';
}

const FreightBillsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const perms = useResourcePermissions(RESOURCE);
  const currentUser = useCurrentUser();
  const canReview = hasReviewPermission(currentUser ?? undefined, RESOURCE);
  const [activeTabKey, setActiveTabKey] = useState('bills');
  const billsActionRef = useRef<ActionType>();
  const pendingActionRef = useRef<ActionType>();
  const formRef = useRef<ProFormInstance>();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FreightBill | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<FreightBill | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryIdRef = useRef<number | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectRemarks, setRejectRemarks] = useState('');
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

  const loadDetail = useCallback(
    async (id: number) => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        setDetail(await getFreightBill(id));
      } catch (error) {
        setDetail(null);
        setDetailError(getApiErrorMessage(error, t('app.kuaizhizao.logistics.message.loadBillDetailFailed')));
      } finally {
        setDetailLoading(false);
      }
    },
    [t],
  );

  const openDetail = (row: FreightBill) => {
    detailRetryIdRef.current = row.id;
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    void loadDetail(row.id);
  };

  const refreshDetail = async (id: number) => {
    setDetail(await getFreightBill(id));
    billsActionRef.current?.reload();
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = async (row: FreightBill) => {
    try {
      const full = await getFreightBill(row.id);
      setEditing(full);
      setFormOpen(true);
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.logistics.message.loadBillDetailFailed')));
    }
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const openPull = () => {
    const carrierId = formRef.current?.getFieldValue('carrier_id');
    if (!carrierId) {
      messageApi.warning(t('app.kuaizhizao.logistics.message.selectCarrierFirst'));
      return;
    }
    pullFreightOrders.openModal();
  };

  const handleSave = async (values: {
    carrier_id: number;
    remark?: string;
    items?: FreightBillFormItem[];
  }) => {
    const items = (values.items ?? []).filter((item) => Number(item.amount) > 0);
    if (!items.length) {
      messageApi.warning(t('app.kuaizhizao.logistics.message.billItemRequired'));
      return;
    }
    const payload = {
      carrier_id: values.carrier_id,
      remark: values.remark,
      items: items.map((item) => ({
        freight_order_id: item.freight_order_id,
        fee_type: 'base',
        amount: item.amount,
      })),
    };
    try {
      if (editing) {
        await updateFreightBill(editing.id, payload);
        messageApi.success(t('common.saveSuccess'));
      } else {
        await createFreightBill(payload);
        messageApi.success(t('common.createSuccess'));
      }
      closeForm();
      billsActionRef.current?.reload();
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, editing ? t('common.saveFailed') : t('common.createFailed')));
    }
  };

  const billColumns: ProColumns<FreightBill>[] = useMemo(
    () =>
      alignProColumns<FreightBill>([
        {
          title: t('app.kuaizhizao.logistics.field.billCode'),
          dataIndex: 'bill_code',
          width: 148,
          minWidth: 148,
          uniTableKeepWidth: true,
          resizable: false,
          fixed: 'left',
          copyable: true,
        },
        {
          title: t('app.kuaizhizao.logistics.field.carrierName'),
          dataIndex: 'carrier_name',
          minWidth: 140,
          uniTableRemainderFlex: true,
          uniTablePrimaryFlex: true,
          resizable: false,
          ellipsis: true,
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
        {
          title: t('common.action'),
          key: 'option',
          fixed: 'right',
          hideInSearch: true,
          render: (_, row) => {
            const nodes: React.ReactNode[] = [
              <Button key="read" {...rowActionKind('read')} onClick={() => openDetail(row)} />,
            ];
            if (perms.canUpdate && canEditFreightBill(row.review_status)) {
              nodes.push(
                <Button key="edit" {...rowActionKind('update')} onClick={() => void openEdit(row)} />,
              );
            }
            if (perms.canAction?.('submit') && canEditFreightBill(row.review_status)) {
              nodes.push(
                <Button
                  key="submit"
                  {...rowActionKind('submit')}
                  onClick={async () => {
                    try {
                      await submitFreightBill(row.id);
                      messageApi.success(t('app.kuaizhizao.logistics.message.submitBillSuccess'));
                      billsActionRef.current?.reload();
                    } catch (error) {
                      messageApi.error(getApiErrorMessage(error, t('common.saveFailed')));
                    }
                  }}
                />,
              );
            }
            if (perms.canDelete && canEditFreightBill(row.review_status)) {
              nodes.push(
                <Popconfirm
                  key="delete"
                  title={t('common.confirmDelete')}
                  onConfirm={async (e) => {
                    e?.stopPropagation();
                    await deleteFreightBill(row.id);
                    messageApi.success(t('common.deleteSuccess'));
                    billsActionRef.current?.reload();
                  }}
                  onCancel={(e) => e?.stopPropagation()}
                >
                  <Button {...rowActionKind('delete')} onClick={(e) => e.stopPropagation()} />
                </Popconfirm>,
              );
            }
            return nodes;
          },
        },
      ]),
    [messageApi, perms, t],
  );

  const pendingColumns: ProColumns<FreightOrder>[] = useMemo(
    () =>
      alignProColumns<FreightOrder>([
        {
          title: t('app.kuaizhizao.logistics.field.orderCode'),
          dataIndex: 'order_code',
          width: 148,
          minWidth: 148,
          uniTableKeepWidth: true,
          resizable: false,
          fixed: 'left',
          copyable: true,
        },
        {
          title: t('app.kuaizhizao.logistics.field.trackingNumber'),
          dataIndex: 'tracking_number',
          width: 148,
          minWidth: 148,
          uniTableKeepWidth: true,
          resizable: false,
          ellipsis: true,
          copyable: true,
        },
        {
          title: t('app.kuaizhizao.logistics.field.carrierName'),
          dataIndex: 'carrier_name',
          minWidth: 140,
          uniTableRemainderFlex: true,
          uniTablePrimaryFlex: true,
          resizable: false,
          ellipsis: true,
        },
        {
          title: t('common.status'),
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
        title: t('common.status'),
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

  const formInitialValues = useMemo(() => {
    if (!editing) return { items: [] as FreightBillFormItem[] };
    return {
      carrier_id: editing.carrier_id,
      remark: editing.remark,
      items: (editing.items ?? []).map((item) => ({
        freight_order_id: item.freight_order_id,
        freight_order_code: item.freight_order_code ?? '',
        tracking_number: item.tracking_number ?? undefined,
        amount: item.amount != null ? Number(item.amount) : undefined,
      })),
    };
  }, [editing]);

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
                columnPersistenceId="apps.kuaizhizao.pages.logistics-management.freight-bills.v4"
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
                columnPersistenceId="apps.kuaizhizao.pages.logistics-management.freight-bills.pending.v4"
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
        key={editing?.id ?? 'create'}
        title={
          editing
            ? t('app.kuaizhizao.logistics.action.editFreightBill')
            : t('app.kuaizhizao.logistics.action.createFreightBill')
        }
        open={formOpen}
        isEdit={Boolean(editing)}
        grid={false}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        initialValues={formInitialValues}
        onClose={closeForm}
        onFinish={handleSave}
        onValuesChange={(changed) => {
          if ('carrier_id' in changed && !editing) {
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
              <CarrierSelectDropdown modalZIndex={token.zIndexPopupBase} disabled={Boolean(editing)} />
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

      <FreightBillDetailDrawer
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetail(null);
          setDetailError(null);
        }}
        bill={detail}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          const id = detailRetryIdRef.current;
          if (id != null) void loadDetail(id);
        }}
        extra={
          <DetailDrawerActions
            items={[
              {
                key: 'edit',
                visible: Boolean(detail && perms.canUpdate && canEditFreightBill(detail.review_status)),
                render: (
                  <Button
                    onClick={() => {
                      if (!detail) return;
                      void openEdit(detail);
                    }}
                  >
                    {t('common.edit')}
                  </Button>
                ),
              },
              {
                key: 'submit',
                visible: Boolean(detail && perms.canAction?.('submit') && canEditFreightBill(detail.review_status)),
                render: (
                  <Button
                    icon={<SendOutlined />}
                    onClick={async () => {
                      if (!detail) return;
                      await submitFreightBill(detail.id);
                      await refreshDetail(detail.id);
                      messageApi.success(t('app.kuaizhizao.logistics.message.submitBillSuccess'));
                    }}
                  >
                    {t('components.uniAction.submit')}
                  </Button>
                ),
              },
              {
                key: 'audit',
                visible: Boolean(detail && detail.review_status === 'pending' && canReview),
                render: (
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={async () => {
                      if (!detail) return;
                      await auditFreightBill(detail.id);
                      await refreshDetail(detail.id);
                      messageApi.success(t('app.kuaizhizao.logistics.message.auditBillSuccess'));
                    }}
                  >
                    {t('components.uniAction.audit')}
                  </Button>
                ),
              },
              {
                key: 'reject',
                visible: Boolean(detail && detail.review_status === 'pending' && canReview),
                render: (
                  <Button
                    danger
                    icon={<CloseOutlined />}
                    onClick={() => {
                      setRejectRemarks('');
                      setRejectOpen(true);
                    }}
                  >
                    {t('components.uniAction.reject')}
                  </Button>
                ),
              },
            ]}
          />
        }
      />

      <Modal
        open={rejectOpen}
        title={t('app.kuaizhizao.logistics.action.rejectFreightBill')}
        onCancel={() => setRejectOpen(false)}
        onOk={async () => {
          if (!detail) return;
          await rejectFreightBill(detail.id, rejectRemarks);
          setRejectOpen(false);
          await refreshDetail(detail.id);
          messageApi.success(t('app.kuaizhizao.logistics.message.rejectBillSuccess'));
        }}
        destroyOnHidden
      >
        <Input.TextArea
          rows={3}
          value={rejectRemarks}
          onChange={(e) => setRejectRemarks(e.target.value)}
          placeholder={t('app.kuaizhizao.logistics.message.rejectBillPlaceholder')}
        />
      </Modal>

      <UniPullQueryModal<FreightOrder>
        open={pullFreightOrders.open}
        title={t('app.kuaizhizao.logistics.action.pullSelectFreightOrder')}
        onCancel={pullFreightOrders.closeModal}
        onOk={pullFreightOrders.handleConfirm}
        rowKey="id"
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.freightBill)}
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
