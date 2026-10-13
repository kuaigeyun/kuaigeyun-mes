/**
 * 付款申请单
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns, ProFormInstance } from '@ant-design/pro-components';
import { ProFormDatePicker, ProFormSelect, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Col, Descriptions, Form, InputNumber, Row, Select, Space, Table } from 'antd';
import type { FormListFieldData } from 'antd/es/form/FormList';
import dayjs from '../../../../../config/dayjs';
import { useTranslation } from 'react-i18next';
import { rowActionKind } from '../../../../../components/uni-action';
import { UniTable } from '../../../../../components/uni-table';
import {
  ListPageTemplate,
  DetailDrawerTemplate,
  FormModalTemplate,
  DRAWER_CONFIG,
  MODAL_CONFIG,
} from '../../../../../components/layout-templates';
import { UniAuditBatchMenuButton } from '../../../../../components/uni-batch';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { UniTableStackedPrimaryCell } from '../../../../../components/uni-table/stackedPrimaryColumn';
import { renderDocumentStatusTag } from '../../../../../utils/documentLifecycleStatusTag';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { financeDocCodePartnerSearchColumns } from '../../../utils/financeListCore';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { formatCurrencyAmount, formatDateBySiteSetting } from '../../../../../utils/format';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { coerceFormDate, toApiDateString } from '../../../../../utils/formDate';
import { normalizeFormListItems } from '../../../../../utils/formListItems';
import {
  KUAIZHIZAO_DOC_HOST,
  loadSupplierFormReferenceList,
} from '../../../../../utils/documentFormReferenceLoad';
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import {
  listPaymentApplications,
  getPaymentApplication,
  createPaymentApplication,
  updatePaymentApplication,
  deletePaymentApplication,
  submitPaymentApplication,
  approvePaymentApplication,
  pushPaymentApplicationToPayment,
  listPayablesForPaymentApplication,
  type PaymentApplication,
  type PaymentApplicationLine,
} from '../../../services/payment-application';

const RESOURCE = 'kuaizhizao:payment-application';

const PaymentApplicationsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>();
  const tableRowsRef = useRef<PaymentApplication[]>([]);
  const perms = useResourcePermissions(RESOURCE);
  const auditEnabled = useAuditRequired('payment_application', true);
  const paymentApplicationWorkflowStatuses = useMemo(
    () => ({
      draftStatuses: ['草稿', 'draft', 'DRAFT'],
      pendingStatuses: ['待审核', 'pending_review', 'PENDING_REVIEW', 'PENDING'],
      approvedStatuses: ['已批准', '部分付款', '已通过', 'APPROVED', 'AUDITED', '已审核'],
      rejectedStatuses: ['已驳回', 'rejected', 'REJECTED'],
    }),
    [],
  );
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const selectedApplicationsForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is PaymentApplication => row != null),
    [selectedRowKeys],
  );

  const paymentApplicationAuditBatchHandlers = useMemo(
    () => ({
      submit: (id: number) => submitPaymentApplication(id),
      approve: (id: number) => approvePaymentApplication(id, { approved: true }),
    }),
    [],
  );

  const handlePaymentApplicationAuditBatchSuccess = useCallback(() => {
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  }, []);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<PaymentApplication | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const formRef = useRef<ProFormInstance>();
  const [supplierOptions, setSupplierOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [payableOptions, setPayableOptions] = useState<
    Array<{ payableId: number; payableCode: string; maxRequestAmount: number }>
  >([]);
  const [payableSupplierId, setPayableSupplierId] = useState<number | null>(null);
  const [payablesLoading, setPayablesLoading] = useState(false);

  const onSupplierChange = useCallback(
    async (supplierId: number) => {
      if (!Number.isFinite(supplierId) || supplierId <= 0) {
        setPayableSupplierId(null);
        setPayableOptions([]);
        return;
      }
      setPayableSupplierId(supplierId);
      setPayablesLoading(true);
      try {
        const res = await listPayablesForPaymentApplication(supplierId, { limit: 200 });
        const options = (res.data ?? []).map((row) => ({
          payableId: Number(row.payable_id),
          payableCode: String(row.payable_code ?? ''),
          maxRequestAmount: Number(row.max_request_amount ?? 0),
        }));
        setPayableOptions(options.filter((o) => o.payableId > 0 && o.maxRequestAmount > 0));
        if (options.length === 0) {
          messageApi.info(t('app.kuaizhizao.paymentApplication.noPayablesForSupplier'));
        }
      } catch (err: unknown) {
        setPayableOptions([]);
        const msg = err instanceof Error ? err.message : t('common.loadFailed');
        messageApi.error(msg);
      } finally {
        setPayablesLoading(false);
      }
    },
    [messageApi, t],
  );

  const openDetail = useCallback(async (record: PaymentApplication) => {
    const full = await getPaymentApplication(record.id);
    setDetail(full);
    setDetailOpen(true);
  }, []);

  const openEdit = useCallback(
    async (record: PaymentApplication) => {
      if (record.capabilities?.update?.allowed === false) {
        messageApi.warning(t('common.updateFailed'));
        return;
      }
      const full = await getPaymentApplication(record.id);
      const suppliers = await loadSupplierFormReferenceList(KUAIZHIZAO_DOC_HOST.paymentApplication);
      setSupplierOptions(suppliers.map((s) => ({ id: s.id, name: s.name })));
      setEditId(full.id);
      await onSupplierChange(full.supplierId);
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({
        supplierId: full.supplierId,
        applicationDate: coerceFormDate(full.applicationDate) ?? dayjs(),
        expectedPaymentDate: coerceFormDate(full.expectedPaymentDate),
        notes: full.notes,
        items: (full.items ?? []).map((line) => ({
          lineKind: line.lineKind ?? 'goods',
          payableId: line.payableId ?? line.sourceId,
          requestAmount: line.requestAmount,
        })),
      });
      setEditOpen(true);
    },
    [messageApi, onSupplierChange, t],
  );

  const columns: ProColumns<PaymentApplication>[] = useMemo(
    () =>
      alignProColumns<PaymentApplication>(
        [
          ...financeDocCodePartnerSearchColumns({
            docCodeLabel: t('app.kuaizhizao.paymentApplication.applicationCode'),
            docCodeField: 'applicationCode',
            partnerLabel: t('app.kuaizhizao.paymentApplication.supplierName'),
            partnerIdField: 'supplierId',
            partnerNameField: 'supplierName',
            partnerRequest: async ({ keyWords }) => {
              const list = await loadSupplierFormReferenceList(KUAIZHIZAO_DOC_HOST.paymentApplication);
              const kw = String(keyWords ?? '')
                .trim()
                .toLowerCase();
              const filtered = kw
                ? list.filter(
                    (s) =>
                      String(s.name ?? '')
                        .toLowerCase()
                        .includes(kw) ||
                      String(s.code ?? '')
                        .toLowerCase()
                        .includes(kw),
                  )
                : list;
              return filtered.slice(0, 50).map((s) => ({ label: s.name, value: s.id }));
            },
          }),
          {
            title: t('app.kuaizhizao.paymentApplication.col.supplierAndCode'),
            key: 'finance_doc_partner_stacked',
            dataIndex: 'applicationCode',
            width: 240,
            minWidth: 240,
            uniTableKeepWidth: true,
            uniTablePrimaryFlex: false,
            resizable: false,
            fixed: 'left',
            hideInSearch: true,
            ellipsis: false,
            render: (_, r) => (
              <UniTableStackedPrimaryCell
                primary={String(r.supplierName ?? '')}
                secondary={String(r.applicationCode ?? '')}
                onSecondaryClick={() => void openDetail(r)}
              />
            ),
          },
          {
            title: t('app.kuaizhizao.paymentApplication.supplierName'),
            dataIndex: 'supplierName',
            hideInTable: true,
          },
          {
            title: t('app.kuaizhizao.paymentApplication.totalRequestAmount'),
            key: 'total_amount',
            dataIndex: 'totalRequestAmount',
            align: 'right',
            width: 140,
            minWidth: 140,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
            render: (_, r) => formatCurrencyAmount(r.totalRequestAmount),
          },
          {
            title: t('app.kuaizhizao.paymentApplication.remainingAmount'),
            key: 'remaining_amount',
            dataIndex: 'remainingAmount',
            align: 'right',
            width: 132,
            minWidth: 132,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
            render: (_, r) => formatCurrencyAmount(r.remainingAmount),
          },
          {
            title: t('app.kuaizhizao.paymentApplication.applicationDate'),
            key: 'application_date',
            dataIndex: 'applicationDate',
            valueType: 'date',
            width: 132,
            minWidth: 132,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
            render: (_, r) => (r.applicationDate ? formatDateBySiteSetting(r.applicationDate) : '—'),
          },
          {
            title: t('app.kuaizhizao.paymentApplication.notes'),
            dataIndex: 'notes',
            minWidth: 160,
            uniTableRemainderFlex: true,
            uniTablePrimaryFlex: true,
            resizable: false,
            hideInSearch: true,
            ellipsis: true,
            render: (_, r) => r.notes?.trim() || '—',
          },
          ...buildDocumentAuditColumns<PaymentApplication>(t),
          {
            title: t('app.kuaizhizao.paymentApplication.status'),
            key: 'lifecycle',
            dataIndex: 'status',
            fixed: 'right',
            hideInSearch: true,
            render: (_, r) => renderDocumentStatusTag(String(r.status ?? ''), String(r.status ?? '')),
          },
          {
            title: t('common.actions'),
            key: 'action',
            fixed: 'right',
            hideInSearch: true,
            render: (_, row) => {
              const nodes: React.ReactNode[] = [];
              if (perms.canRead) {
                nodes.push(
                  <Button key="detail" {...rowActionKind('read')} onClick={() => void openDetail(row)} />,
                );
              }
              if (perms.canUpdate && row.capabilities?.update?.allowed) {
                nodes.push(
                  <Button key="edit" {...rowActionKind('update')} onClick={() => void openEdit(row)} />,
                );
              }
              nodes.push(
                <span {...rowActionKind('skip')} key="wf">
                  <UniWorkflowActions
                    {...rowActionKind('skip')}
                    record={row}
                    entityType="payment_application"
                    entityName={t('app.kuaizhizao.paymentApplication.entityName')}
                    statusField="status"
                    reviewStatusField="reviewStatus"
                    {...paymentApplicationWorkflowStatuses}
                    onSuccess={() => {
                      actionRef.current?.reload();
                      if (detailOpen && detail?.id === row.id) {
                        void getPaymentApplication(row.id).then(setDetail).catch(() => {});
                      }
                    }}
                  />
                </span>,
              );
              return nodes;
            },
          },
        ],
        SALES_DOC_LIST_FIELD_RANK,
      ),
    [
      detail?.id,
      detailOpen,
      openDetail,
      openEdit,
      paymentApplicationWorkflowStatuses,
      perms.canRead,
      perms.canUpdate,
      t,
    ],
  );

  const openCreate = async () => {
    const suppliers = await loadSupplierFormReferenceList(KUAIZHIZAO_DOC_HOST.paymentApplication);
    setSupplierOptions(suppliers.map((s) => ({ id: s.id, name: s.name })));
    setEditId(null);
    setPayableOptions([]);
    setPayableSupplierId(null);
    setEditOpen(true);
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (!keys.length) return;
    const rows = keys
      .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
      .filter((row): row is PaymentApplication => row != null);
    const deletable = rows.filter((row) => row.capabilities?.delete?.allowed === true);
    if (deletable.length === 0) {
      messageApi.warning(t('app.kuaizhizao.paymentApplication.batchDeleteNoneDeletable'));
      return;
    }
    if (deletable.length < rows.length) {
      messageApi.warning(t('app.kuaizhizao.paymentApplication.batchDeletePartial'));
    }
    for (const row of deletable) {
      await deletePaymentApplication(row.id);
    }
    messageApi.success(t('app.kuaizhizao.paymentApplication.batchDeleteSuccess', { count: deletable.length }));
    setSelectedRowKeys([]);
    if (detail?.id != null && deletable.some((row) => row.id === detail.id)) {
      setDetail(null);
      setDetailOpen(false);
    }
    actionRef.current?.reload();
  };

  const handleSave = async (values: Record<string, unknown>) => {
    const supplier = supplierOptions.find((s) => s.id === values.supplierId);
    const items: PaymentApplicationLine[] = normalizeFormListItems<Record<string, unknown>>(
      values.items,
    ).map(
      (row: Record<string, unknown>, index: number) => {
        const payableId = row.payableId as number | undefined;
        const opt = payableOptions.find((p) => p.payableId === payableId);
        return {
          sourceType: 'payable',
          sourceId: payableId,
          sourceCode: opt?.payableCode,
          payableId,
          payableCode: opt?.payableCode,
          lineKind: 'goods',
          requestAmount: Number(row.requestAmount),
          lineNo: index + 1,
        };
      },
    );
    const payload = {
      supplierId: values.supplierId,
      supplierName: supplier?.name ?? values.supplierName,
      applicationDate: toApiDateString(values.applicationDate),
      expectedPaymentDate: toApiDateString(values.expectedPaymentDate),
      notes: values.notes,
      items,
    };
    if (editId) {
      await updatePaymentApplication(editId, payload);
      messageApi.success(t('common.updateSuccess'));
    } else {
      await createPaymentApplication(payload);
      messageApi.success(t('common.createSuccess'));
    }
    setEditOpen(false);
    actionRef.current?.reload();
  };

  return (
    <>
      <ListPageTemplate>
        <UniTable<PaymentApplication>
          actionRef={actionRef}
          permissionResource={RESOURCE}
          columnPersistenceId="apps.kuaizhizao.pages.purchase-management.payment-applications-width-v5"
          headerTitle={t('app.kuaizhizao.menu.purchase-management.payment-applications')}
          rowKey="id"
          columns={columns}
          showCreateButton={perms.canCreate}
          createButtonText={t('app.kuaizhizao.paymentApplication.create')}
          onCreate={() => void openCreate()}
          enableRowSelection={
            perms.canDelete ||
            Boolean(perms.canAction?.('submit')) ||
            Boolean(perms.canAction?.('audit'))
          }
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton={perms.canDelete}
          onDelete={handleBatchDelete}
          deleteConfirmTitle={(count) =>
            t('app.kuaizhizao.paymentApplication.confirmBatchDelete', { count })
          }
          toolBarActionsAfterDelete={[
            <UniAuditBatchMenuButton
              key="payment-application-batch-menu"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedApplicationsForBatch}
              auditEnabled={auditEnabled}
              permGates={perms}
              handlers={paymentApplicationAuditBatchHandlers}
              onSuccess={handlePaymentApplicationAuditBatchSuccess}
              toolBarButtonSize="middle"
            />,
          ]}
          onTableDataChange={(rows) => {
            tableRowsRef.current = rows;
          }}
          request={async (params) => {
            const res = await listPaymentApplications({
              skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
              limit: params.pageSize ?? 20,
              keyword: params.applicationCode as string,
            });
            return { data: res.data, success: true, total: res.total };
          }}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        title={detail?.applicationCode}
        extra={
          detail ? (
            <Space>
              <UniWorkflowActions
                record={detail}
                entityType="payment_application"
                entityName={t('app.kuaizhizao.paymentApplication.entityName')}
                statusField="status"
                reviewStatusField="reviewStatus"
                {...paymentApplicationWorkflowStatuses}
                theme="default"
                size="middle"
                onSuccess={() => {
                  void getPaymentApplication(detail.id).then(setDetail);
                  actionRef.current?.reload();
                }}
              />
              {detail.capabilities?.push_payment?.allowed && perms.canAction?.('push') ? (
                <Button
                  onClick={async () => {
                    const res = await pushPaymentApplicationToPayment(detail.id, {
                      paymentMethod: '银行转账',
                    });
                    messageApi.success(
                      t('app.kuaizhizao.paymentApplication.pushPaymentSuccess', {
                        code: res.payment_code,
                      }),
                    );
                    actionRef.current?.reload();
                  }}
                >
                  {t('app.kuaizhizao.paymentApplication.pushPayment')}
                </Button>
              ) : null}
            </Space>
          ) : null
        }
      >
        {detail ? (
          <>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label={t('app.kuaizhizao.paymentApplication.supplierName')}>
                {detail.supplierName}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.paymentApplication.status')}>
                {renderDocumentStatusTag(detail.status, detail.status)}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.paymentApplication.totalRequestAmount')}>
                {formatCurrencyAmount(detail.totalRequestAmount)}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.paymentApplication.remainingAmount')}>
                {formatCurrencyAmount(detail.remainingAmount)}
              </Descriptions.Item>
            </Descriptions>
            <Table
              size="small"
              pagination={false}
              rowKey="id"
              dataSource={detail.items}
              columns={[
                { title: t('app.kuaizhizao.paymentApplication.payableCode'), dataIndex: 'payableCode' },
                {
                  title: t('app.kuaizhizao.paymentApplication.requestAmount'),
                  dataIndex: 'requestAmount',
                  render: (v) => formatCurrencyAmount(v),
                },
                {
                  title: t('app.kuaizhizao.paymentApplication.paidAmount'),
                  dataIndex: 'paidAmount',
                  render: (v) => formatCurrencyAmount(v),
                },
              ]}
            />
          </>
        ) : null}
      </DetailDrawerTemplate>

      <FormModalTemplate
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={
          editId
            ? t('app.kuaizhizao.paymentApplication.editTitle')
            : t('app.kuaizhizao.paymentApplication.create')
        }
        isEdit={editId != null}
        formRef={formRef}
        afterOpenChange={(open) => {
          if (!open) {
            formRef.current?.resetFields();
            setPayableSupplierId(null);
            setPayableOptions([]);
            return;
          }
          if (editId == null) {
            formRef.current?.setFieldsValue({
              applicationDate: dayjs(),
              items: [{ lineKind: 'goods' }],
            });
          }
        }}
        onFinish={async (values) => {
          try {
            await handleSave(values as Record<string, unknown>);
          } catch (error) {
            messageApi.error(getApiErrorMessage(error, t('common.saveFailed')));
          }
        }}
        width={MODAL_CONFIG.LARGE_WIDTH}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSelect
              name="supplierId"
              label={t('app.kuaizhizao.paymentApplication.supplierName')}
              rules={[{ required: true }]}
              options={supplierOptions.map((s) => ({ value: s.id, label: s.name }))}
              fieldProps={{
                showSearch: true,
                optionFilterProp: 'label',
                onChange: (v) => {
                  void onSupplierChange(Number(v));
                  formRef.current?.setFieldsValue({
                    items: [{ lineKind: 'goods', requestAmount: undefined }],
                  });
                },
              }}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="applicationDate"
              label={t('app.kuaizhizao.paymentApplication.applicationDate')}
              rules={[{ required: true }]}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
        </Row>
        <UniTableDetail
          name="items"
          title={t('app.kuaizhizao.paymentApplication.lines')}
          required
          initialValue={{ lineKind: 'goods' }}
          columns={[
            {
              title: t('app.kuaizhizao.paymentApplication.payableCode'),
              dataIndex: 'payableId',
              width: 200,
              render: (_: unknown, field: FormListFieldData) => (
                <Form.Item name={[field.name, 'payableId']} style={{ margin: 0 }} rules={[{ required: true }]}>
                  <Select
                    size="small"
                    showSearch
                    optionFilterProp="label"
                    loading={payablesLoading}
                    disabled={!payableSupplierId}
                    placeholder={
                      payableSupplierId
                        ? t('app.kuaizhizao.paymentApplication.selectPayable')
                        : t('app.kuaizhizao.paymentApplication.selectSupplierFirst')
                    }
                    options={payableOptions.map((p) => ({
                      value: p.payableId,
                      label: `${p.payableCode} (${formatCurrencyAmount(p.maxRequestAmount)})`,
                    }))}
                  />
                </Form.Item>
              ),
            },
            {
              title: t('app.kuaizhizao.paymentApplication.requestAmount'),
              dataIndex: 'requestAmount',
              width: 140,
              render: (_: unknown, field: FormListFieldData) => (
                <Form.Item name={[field.name, 'requestAmount']} style={{ margin: 0 }} rules={[{ required: true }]}>
                  <InputNumber size="small" min={0.01} precision={2} style={{ width: '100%' }} />
                </Form.Item>
              ),
            },
          ]}
        />
        <Row gutter={16}>
          <Col span={24}>
            <ProFormTextArea
              name="notes"
              label={t('app.kuaizhizao.paymentApplication.notes')}
              fieldProps={{ rows: 2 }}
            />
          </Col>
        </Row>
      </FormModalTemplate>
    </>
  );
};

export default PaymentApplicationsPage;
