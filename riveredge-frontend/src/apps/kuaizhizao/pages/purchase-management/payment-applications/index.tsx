/**
 * 付款申请单
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns, ProFormInstance } from '@ant-design/pro-components';
import {
  ModalForm,
  ProFormDatePicker,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import {
  App,
  Button,
  Col,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
} from 'antd';
import { PlusOutlined, PrinterOutlined } from '@ant-design/icons';
import type { TFunction } from 'i18next';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import { useLinkedDocumentDetail } from '../../../../../components/linked-document-detail';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { usePaymentApplicationPullMenus } from './usePaymentApplicationPullMenus';
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
import { UniAuditBatchMenuButton, UniCapabilityBatchButton } from '../../../../../components/uni-batch';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { UniTableStackedPrimaryCell } from '../../../../../components/uni-table/stackedPrimaryColumn';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import {
  LedgerAccountFormFields,
} from '../../../components/LedgerAccountFormFields';
import {
  mapAttachmentsToUploadList,
  normalizeDocumentAttachments,
  openDocumentAttachment,
} from '../../../utils/documentAttachments';
import { renderDocumentStatusTag } from '../../../../../utils/documentLifecycleStatusTag';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { financeDocCodePartnerSearchColumns } from '../../../utils/financeListCore';
import {
  assertBankAccountForPaymentMethod,
  BANK_TRANSFER_PAYMENT_METHOD,
  formatPaymentMethod,
  getPaymentMethodOptions,
} from '../../../utils/financeSharedOptions';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useKuaizhizaoPrintModal } from '../../../hooks/useKuaizhizaoPrintModal';
import {
  formatCurrencyAmount,
  formatDateBySiteSetting,
  todaySiteDateString,
} from '../../../../../utils/format';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { coerceFormDate, toApiDateString } from '../../../../../utils/formDate';
import { normalizeFormListItems } from '../../../../../utils/formListItems';
import { fetchAllListItems } from '../../../../../utils/fetchAllListPages';
import { downloadRecordsAsXlsx } from '../../../../../utils/exportRecordsXlsx';
import {
  KUAIZHIZAO_DOC_HOST,
  loadSupplierFormReferenceList,
} from '../../../../../utils/documentFormReferenceLoad';
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import {
  canOpenLinkedDocumentDetail,
  normalizeLinkedDocumentType,
} from '../../../utils/linkedDocumentDetail';
import { bankAccountService, type BankAccount } from '../../../services/finance/bank-account';
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

const PAYMENT_APP_SOURCE_TYPE_KEYS = [
  'payable',
  'purchase_order',
  'purchase_receipt',
  'other_expense',
  'document_reconciliation',
] as const;

function paymentApplicationSourceTypeLabel(t: TFunction, sourceType: string | undefined): string {
  const st = String(sourceType || '').trim();
  if (!st) return '—';
  if ((PAYMENT_APP_SOURCE_TYPE_KEYS as readonly string[]).includes(st)) {
    return t(`app.kuaizhizao.paymentApplication.sourceType.${st}`);
  }
  return st;
}

function resolvePaymentApplicationLinkedDocType(sourceType: string): string {
  const st = normalizeLinkedDocumentType(sourceType);
  if (st === 'purchase_order' || st === 'purchase_receipt') return st;
  return st;
}

const PaymentApplicationsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const linkedDetail = useLinkedDocumentDetail();
  const [pullPayableOpen, setPullPayableOpen] = useState(false);
  const [pullPayableSupplierId, setPullPayableSupplierId] = useState<number | null>(null);
  const [pullPayableRows, setPullPayableRows] = useState<
    Array<{ payableId: number; payableCode: string; maxRequestAmount: number }>
  >([]);
  const [pullPayableSelected, setPullPayableSelected] = useState<number[]>([]);
  const [pullPayableLoading, setPullPayableLoading] = useState(false);
  const [pullPayableSubmitting, setPullPayableSubmitting] = useState(false);
  const actionRef = useRef<ActionType>();
  const tableRowsRef = useRef<PaymentApplication[]>([]);
  const { menuItems: pullCreateMenuItems, renderPullModals } = usePaymentApplicationPullMenus({
    onCreated: () => actionRef.current?.reload(),
    onOpenPayablePull: () => setPullPayableOpen(true),
  });
  const perms = useResourcePermissions(RESOURCE);
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal();
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
  const paymentMethodOptions = useMemo(() => getPaymentMethodOptions(t), [t]);
  const invoiceStatusOptions = useMemo(
    () => [
      {
        value: '有发票',
        label: t('app.kuaizhizao.paymentApplication.invoiceStatus.hasInvoice'),
      },
      {
        value: '无发票',
        label: t('app.kuaizhizao.paymentApplication.invoiceStatus.noInvoice'),
      },
      {
        value: '发票后补',
        label: t('app.kuaizhizao.paymentApplication.invoiceStatus.later'),
      },
    ],
    [t],
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
  const [pushPaymentOpen, setPushPaymentOpen] = useState(false);
  const [pushPaymentSubmitting, setPushPaymentSubmitting] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const formRef = useRef<ProFormInstance>();
  const pushPaymentFormRef = useRef<ProFormInstance>();
  const [supplierOptions, setSupplierOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [payableOptions, setPayableOptions] = useState<
    Array<{ payableId: number; payableCode: string; maxRequestAmount: number }>
  >([]);
  const [payableSupplierId, setPayableSupplierId] = useState<number | null>(null);
  const [payablesLoading, setPayablesLoading] = useState(false);

  useEffect(() => {
    void bankAccountService
      .list({ limit: 200, is_active: true })
      .then((res) => setBankAccounts(res.data || []))
      .catch(() => setBankAccounts([]));
  }, []);

  const openPushPaymentModal = useCallback(() => {
    if (!detail) return;
    setPushPaymentOpen(true);
  }, [detail]);

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
        paymentReason: full.paymentReason,
        paymentMethod: full.paymentMethod || BANK_TRANSFER_PAYMENT_METHOD,
        invoiceStatus: full.invoiceStatus,
        paymentTerms: full.paymentTerms,
        supplierAccountName: full.supplierAccountName,
        supplierBankName: full.supplierBankName,
        supplierBankAccount: full.supplierBankAccount,
        notes: full.notes,
        requirePaymentVoucher: Boolean(full.requirePaymentVoucher),
        attachments: mapAttachmentsToUploadList(
          full.attachments as Parameters<typeof mapAttachmentsToUploadList>[0],
        ),
        items: (full.items ?? []).map((line) => ({
          lineKind: line.lineKind ?? 'goods',
          sourceType: line.sourceType || 'payable',
          sourceId: line.sourceId,
          sourceCode: line.sourceCode,
          payableId: line.payableId ?? (line.sourceType === 'payable' ? line.sourceId : undefined),
          payableCode: line.payableCode,
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
    ).map((row: Record<string, unknown>, index: number) => {
      const payableId = row.payableId as number | undefined;
      const opt = payableOptions.find((p) => p.payableId === payableId);
      const sourceType = String(row.sourceType || 'payable').trim() || 'payable';
      const sourceId =
        row.sourceId != null && Number(row.sourceId) > 0
          ? Number(row.sourceId)
          : payableId;
      const sourceCode =
        (row.sourceCode as string | undefined)?.trim()
        || opt?.payableCode
        || (row.payableCode as string | undefined);
      return {
        sourceType,
        sourceId,
        sourceCode,
        payableId,
        payableCode: opt?.payableCode || (row.payableCode as string | undefined),
        lineKind: String(row.lineKind || 'goods'),
        requestAmount: Number(row.requestAmount),
        lineNo: index + 1,
      };
    });
    const payload = {
      supplierId: values.supplierId,
      supplierName: supplier?.name ?? values.supplierName,
      applicationDate: toApiDateString(values.applicationDate),
      expectedPaymentDate: toApiDateString(values.expectedPaymentDate),
      paymentReason: values.paymentReason,
      paymentMethod: values.paymentMethod,
      invoiceStatus: values.invoiceStatus,
      paymentTerms: values.paymentTerms,
      supplierAccountName: values.supplierAccountName,
      supplierBankName: values.supplierBankName,
      supplierBankAccount: values.supplierBankAccount,
      notes: values.notes,
      requirePaymentVoucher: Boolean(values.requirePaymentVoucher),
      attachments: normalizeDocumentAttachments(values.attachments),
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
          showCreateButton={false}
          headerActions={
            perms.canCreate ? (
              <UniPullCreateToolbar
                compactKey="create-payment-application-with-pull"
                createIcon={<PlusOutlined />}
                createLabel={t('app.kuaizhizao.paymentApplication.create')}
                onCreate={() => void openCreate()}
                menuItems={pullCreateMenuItems}
              />
            ) : undefined
          }
          enableRowSelection={
            perms.canDelete ||
            Boolean(perms.canAction?.('submit')) ||
            Boolean(perms.canAction?.('audit')) ||
            perms.canPrint
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
          rightToolBarActionsBeforeExport={[
            <UniCapabilityBatchButton
              key="payment-application-print"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedApplicationsForBatch}
              capabilityKey="print"
              permAllowed={perms.canPrint}
              batchAllowed={(records, perm) =>
                Boolean(perm) && records.some((record) => record.capabilities?.print?.allowed === true)
              }
              singleOnly
              onRun={async (id) => {
                openPrint({ documentType: 'payment_application', documentId: id });
              }}
              labels={{
                single: t('components.uniAction.print'),
                batch: t('components.uniAction.print'),
              }}
              icon={<PrinterOutlined />}
              size="medium"
            />,
          ]}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              let items =
                type === 'currentPage'
                  ? (pageData ?? [])
                  : await fetchAllListItems((p) => listPaymentApplications(p));
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter(
                  (d: PaymentApplication) => d.id != null && keys.includes(d.id),
                );
              }
              if (items.length === 0) {
                messageApi.warning(t('common.noDataToExport'));
                return;
              }
              await downloadRecordsAsXlsx(
                items as Array<Record<string, unknown>>,
                `payment-applications-${todaySiteDateString()}.xlsx`,
              );
              messageApi.success(t('common.exportSuccess', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('common.exportFailed'));
            }
          }}
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
                <Button type="primary" onClick={openPushPaymentModal}>
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
              <Descriptions.Item label={t('app.kuaizhizao.paymentApplication.applicationDate')}>
                {detail.applicationDate ? formatDateBySiteSetting(detail.applicationDate) : '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.paymentApplication.expectedPaymentDate')}>
                {detail.expectedPaymentDate
                  ? formatDateBySiteSetting(detail.expectedPaymentDate)
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.paymentApplication.totalRequestAmount')}>
                {formatCurrencyAmount(detail.totalRequestAmount)}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.paymentApplication.remainingAmount')}>
                {formatCurrencyAmount(detail.remainingAmount)}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.paymentApplication.paymentMethod')}>
                {formatPaymentMethod(detail.paymentMethod, t)}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.paymentApplication.invoiceStatus')}>
                {detail.invoiceStatus || '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.paymentApplication.paymentTerms')}>
                {detail.paymentTerms || '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.paymentApplication.supplierAccountName')}>
                {detail.supplierAccountName || '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.paymentApplication.supplierBankName')}>
                {detail.supplierBankName || '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.paymentApplication.supplierBankAccount')}>
                {detail.supplierBankAccount || '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.paymentApplication.paymentReason')} span={2}>
                {detail.paymentReason?.trim() || '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.paymentApplication.notes')} span={2}>
                {detail.notes?.trim() || '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.paymentApplication.requirePaymentVoucher')}>
                {detail.requirePaymentVoucher ? t('common.yes') : t('common.no')}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.paymentApplication.attachments')} span={2}>
                {Array.isArray(detail.attachments) && detail.attachments.length > 0 ? (
                  <Space wrap size={[8, 4]}>
                    {detail.attachments.map((file, idx) => {
                      const name = String(
                        (file as { name?: string; original_name?: string }).name
                          || (file as { original_name?: string }).original_name
                          || (file as { uid?: string }).uid
                          || idx + 1,
                      );
                      return (
                        <Button
                          key={String((file as { uid?: string }).uid || idx)}
                          type="link"
                          size="small"
                          style={{ padding: 0, height: 'auto' }}
                          onClick={() =>
                            void openDocumentAttachment(
                              file as Parameters<typeof openDocumentAttachment>[0],
                            )
                          }
                        >
                          {name}
                        </Button>
                      );
                    })}
                  </Space>
                ) : (
                  '—'
                )}
              </Descriptions.Item>
            </Descriptions>
            {detail.linkedPayments && detail.linkedPayments.length > 0 ? (
              <Descriptions column={1} size="small" style={{ marginTop: 16 }}>
                <Descriptions.Item label={t('app.kuaizhizao.paymentApplication.linkedPayments')}>
                  <Space wrap size={[8, 4]}>
                    {detail.linkedPayments.map((p) => {
                      const canOpen = canOpenLinkedDocumentDetail('payment');
                      return (
                        <Button
                          key={p.id}
                          type="link"
                          size="small"
                          style={{ padding: 0, height: 'auto' }}
                          onClick={() => {
                            if (!canOpen || !linkedDetail) {
                              messageApi.warning(t('app.kuaizhizao.paymentApplication.linkedPaymentOpenFailed'));
                              return;
                            }
                            const ok = linkedDetail.openLinkedDocumentDetail('payment', p.id);
                            if (!ok) {
                              messageApi.warning(t('app.kuaizhizao.paymentApplication.linkedPaymentOpenFailed'));
                            }
                          }}
                        >
                          {p.code || p.id}
                        </Button>
                      );
                    })}
                  </Space>
                </Descriptions.Item>
              </Descriptions>
            ) : null}
            <Table
              size="small"
              pagination={false}
              rowKey="id"
              style={{ marginTop: 16 }}
              dataSource={detail.items}
              columns={[
                {
                  title: t('app.kuaizhizao.paymentApplication.sourceType'),
                  key: 'sourceType',
                  width: 120,
                  render: (_, row) => paymentApplicationSourceTypeLabel(t, row.sourceType),
                },
                {
                  title: t('app.kuaizhizao.paymentApplication.sourceCode'),
                  key: 'source',
                  render: (_, row) => {
                    const st = String(row.sourceType ?? '').trim();
                    const sid = row.sourceId;
                    const code = row.sourceCode || row.payableCode;
                    if (!code && sid == null) return '—';
                    const docType = resolvePaymentApplicationLinkedDocType(st);
                    if (sid != null && canOpenLinkedDocumentDetail(docType)) {
                      return (
                        <Button
                          type="link"
                          size="small"
                          style={{ padding: 0, height: 'auto' }}
                          onClick={() =>
                            linkedDetail?.openLinkedDocumentDetail(docType, Number(sid))
                          }
                        >
                          {code || sid}
                        </Button>
                      );
                    }
                    return code || String(sid ?? '—');
                  },
                },
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
              paymentMethod: BANK_TRANSFER_PAYMENT_METHOD,
              requirePaymentVoucher: false,
              attachments: [],
              items: [{ lineKind: 'goods', sourceType: 'payable' }],
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
                    items: [{ lineKind: 'goods', sourceType: 'payable', requestAmount: undefined }],
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
          <Col span={12}>
            <ProFormDatePicker
              name="expectedPaymentDate"
              label={t('app.kuaizhizao.paymentApplication.expectedPaymentDate')}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="paymentMethod"
              label={t('app.kuaizhizao.paymentApplication.paymentMethod')}
              rules={[{ required: true }]}
              options={paymentMethodOptions}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="invoiceStatus"
              label={t('app.kuaizhizao.paymentApplication.invoiceStatus')}
              options={invoiceStatusOptions}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="paymentTerms"
              label={t('app.kuaizhizao.paymentApplication.paymentTerms')}
            />
          </Col>
          <Col span={24}>
            <ProFormTextArea
              name="paymentReason"
              label={t('app.kuaizhizao.paymentApplication.paymentReason')}
              rules={[{ required: true }]}
              fieldProps={{ rows: 2 }}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="supplierAccountName"
              label={t('app.kuaizhizao.paymentApplication.supplierAccountName')}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="supplierBankName"
              label={t('app.kuaizhizao.paymentApplication.supplierBankName')}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="supplierBankAccount"
              label={t('app.kuaizhizao.paymentApplication.supplierBankAccount')}
            />
          </Col>
        </Row>
        <UniTableDetail
          name="items"
          title={t('app.kuaizhizao.paymentApplication.lines')}
          required
          initialValue={{ lineKind: 'goods', sourceType: 'payable' }}
          columns={[
            {
              title: t('app.kuaizhizao.paymentApplication.sourceType'),
              dataIndex: 'sourceType',
              width: 120,
              render: (_: unknown, field: FormListFieldData) => (
                <>
                  <Form.Item name={[field.name, 'sourceType']} hidden>
                    <Input />
                  </Form.Item>
                  <Form.Item name={[field.name, 'sourceId']} hidden>
                    <Input />
                  </Form.Item>
                  <Form.Item name={[field.name, 'sourceCode']} hidden>
                    <Input />
                  </Form.Item>
                  <Form.Item name={[field.name, 'payableCode']} hidden>
                    <Input />
                  </Form.Item>
                  <Form.Item shouldUpdate style={{ margin: 0 }}>
                    {() => {
                      const st = formRef.current?.getFieldValue(['items', field.name, 'sourceType']);
                      return paymentApplicationSourceTypeLabel(t, st);
                    }}
                  </Form.Item>
                </>
              ),
            },
            {
              title: t('app.kuaizhizao.paymentApplication.sourceCode'),
              dataIndex: 'sourceCode',
              width: 160,
              render: (_: unknown, field: FormListFieldData) => (
                <Form.Item shouldUpdate style={{ margin: 0 }}>
                  {() => {
                    const code = formRef.current?.getFieldValue(['items', field.name, 'sourceCode']);
                    const payableCode = formRef.current?.getFieldValue([
                      'items',
                      field.name,
                      'payableCode',
                    ]);
                    return String(code || payableCode || '—');
                  }}
                </Form.Item>
              ),
            },
            {
              title: t('app.kuaizhizao.paymentApplication.payableCode'),
              dataIndex: 'payableId',
              width: 200,
              render: (_: unknown, field: FormListFieldData) => (
                <Form.Item
                  name={[field.name, 'payableId']}
                  style={{ margin: 0 }}
                  rules={[{ required: true }]}
                >
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
                    onChange={(payableId: number) => {
                      const opt = payableOptions.find((p) => p.payableId === payableId);
                      const cur = formRef.current?.getFieldValue(['items', field.name]) || {};
                      const keepSource = Boolean(cur.sourceType && cur.sourceType !== 'payable');
                      formRef.current?.setFieldValue(['items', field.name], {
                        ...cur,
                        payableId,
                        payableCode: opt?.payableCode,
                        sourceType: keepSource ? cur.sourceType : 'payable',
                        sourceId: keepSource ? cur.sourceId : payableId,
                        sourceCode: keepSource ? cur.sourceCode : opt?.payableCode,
                        requestAmount: cur.requestAmount ?? opt?.maxRequestAmount,
                      });
                    }}
                  />
                </Form.Item>
              ),
            },
            {
              title: t('app.kuaizhizao.paymentApplication.requestAmount'),
              dataIndex: 'requestAmount',
              width: 140,
              render: (_: unknown, field: FormListFieldData) => (
                <Form.Item
                  name={[field.name, 'requestAmount']}
                  style={{ margin: 0 }}
                  rules={[{ required: true }]}
                >
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
          <Col span={24}>
            <DocumentAttachmentsField
              category="payment_application_attachments"
              label={t('app.kuaizhizao.paymentApplication.attachments')}
            />
          </Col>
          <Col span={24}>
            <ProFormSwitch
              name="requirePaymentVoucher"
              label={t('app.kuaizhizao.paymentApplication.requirePaymentVoucher')}
              extra={t('app.kuaizhizao.paymentApplication.requirePaymentVoucherHint')}
            />
          </Col>
        </Row>
      </FormModalTemplate>

      <Modal
        open={pullPayableOpen}
        title={resolveKuaizhizaoDocumentAction(t, 'payment_application.pull_from_payable').label}
        width={720}
        confirmLoading={pullPayableSubmitting}
        onCancel={() => {
          setPullPayableOpen(false);
          setPullPayableSelected([]);
        }}
        onOk={async () => {
          if (!pullPayableSupplierId || pullPayableSelected.length === 0) {
            messageApi.warning(t('common.required'));
            return;
          }
          setPullPayableSubmitting(true);
          try {
            const supplier = supplierOptions.find((s) => s.id === pullPayableSupplierId);
            const items: PaymentApplicationLine[] = pullPayableSelected.map((payableId, index) => {
              const opt = pullPayableRows.find((p) => p.payableId === payableId);
              return {
                sourceType: 'payable',
                sourceId: payableId,
                sourceCode: opt?.payableCode,
                payableId,
                payableCode: opt?.payableCode,
                lineKind: 'goods',
                requestAmount: opt?.maxRequestAmount ?? 0,
                lineNo: index + 1,
              };
            });
            await createPaymentApplication({
              supplierId: pullPayableSupplierId,
              supplierName: supplier?.name,
              items,
            });
            messageApi.success(t('common.createSuccess'));
            setPullPayableOpen(false);
            setPullPayableSelected([]);
            actionRef.current?.reload();
          } catch (e) {
            messageApi.error(getApiErrorMessage(e, t('app.kuaizhizao.paymentApplication.createFailed')));
          } finally {
            setPullPayableSubmitting(false);
          }
        }}
      >
        <Select
          style={{ width: '100%', marginBottom: 12 }}
          placeholder={t('app.kuaizhizao.paymentApplication.supplierName')}
          options={supplierOptions.map((s) => ({ label: s.name, value: s.id }))}
          value={pullPayableSupplierId ?? undefined}
          showSearch
          optionFilterProp="label"
          onChange={async (supplierId: number) => {
            setPullPayableSupplierId(supplierId);
            setPullPayableSelected([]);
            setPullPayableLoading(true);
            try {
              const res = await listPayablesForPaymentApplication(supplierId, { limit: 200 });
              setPullPayableRows(
                (res.data ?? []).map((row) => ({
                  payableId: Number(row.payable_id),
                  payableCode: String(row.payable_code ?? ''),
                  maxRequestAmount: Number(row.max_request_amount ?? 0),
                })),
              );
            } finally {
              setPullPayableLoading(false);
            }
          }}
        />
        <Table
          size="small"
          loading={pullPayableLoading}
          rowKey="payableId"
          pagination={false}
          dataSource={pullPayableRows}
          rowSelection={{
            selectedRowKeys: pullPayableSelected,
            onChange: (keys) => setPullPayableSelected(keys.map((k) => Number(k))),
          }}
          columns={[
            { title: t('app.kuaizhizao.paymentApplication.payableCode'), dataIndex: 'payableCode' },
            {
              title: t('app.kuaizhizao.paymentApplication.requestAmount'),
              dataIndex: 'maxRequestAmount',
              render: (v) => formatCurrencyAmount(v),
            },
          ]}
        />
      </Modal>

      <ModalForm
        key={detail ? `push-payment-${detail.id}` : 'push-payment'}
        title={t('app.kuaizhizao.paymentApplication.pushPayment')}
        open={pushPaymentOpen}
        formRef={pushPaymentFormRef}
        initialValues={{
          payment_method: detail?.paymentMethod || BANK_TRANSFER_PAYMENT_METHOD,
          payment_date: dayjs(),
          notes: detail
            ? t('app.kuaizhizao.paymentApplication.pushPaymentDefaultNotes', {
                code: detail.applicationCode,
              })
            : undefined,
        }}
        modalProps={{
          destroyOnHidden: true,
          confirmLoading: pushPaymentSubmitting,
          mask: { closable: !pushPaymentSubmitting },
        }}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        grid
        onOpenChange={setPushPaymentOpen}
        onFinish={async (values) => {
          if (!detail) return false;
          try {
            assertBankAccountForPaymentMethod(
              values.payment_method as string,
              values.bank_account_id,
              t,
            );
          } catch (e) {
            messageApi.warning((e as Error).message);
            return false;
          }
          setPushPaymentSubmitting(true);
          try {
            const res = await pushPaymentApplicationToPayment(detail.id, {
              paymentMethod: values.payment_method,
              bankAccountId: values.bank_account_id,
              paymentDate: toApiDateString(values.payment_date),
              notes: values.notes,
            });
            messageApi.success(
              t('app.kuaizhizao.paymentApplication.pushPaymentSuccess', {
                code: String(res.payment_code ?? ''),
              }),
            );
            const full = await getPaymentApplication(detail.id);
            setDetail(full);
            actionRef.current?.reload();
            return true;
          } catch (e) {
            messageApi.error(
              getApiErrorMessage(e, t('app.kuaizhizao.paymentApplication.pushPaymentFailed')),
            );
            return false;
          } finally {
            setPushPaymentSubmitting(false);
          }
        }}
      >
        <ProFormSelect
          name="payment_method"
          label={t('app.kuaizhizao.paymentApplication.paymentMethod')}
          rules={[{ required: true }]}
          options={paymentMethodOptions}
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="payment_date"
          label={t('app.kuaizhizao.paymentApplication.paymentDate')}
          rules={[{ required: true }]}
          fieldProps={{ style: { width: '100%' } }}
          colProps={{ span: 12 }}
        />
        <LedgerAccountFormFields
          accounts={bankAccounts}
          accountLabel={t('app.kuaicaiwu.payment.outBankAccount')}
          noteLabel={t('app.kuaicaiwu.payment.outAccountNote')}
        />
        <ProFormTextArea
          name="notes"
          label={t('app.kuaizhizao.paymentApplication.notes')}
          fieldProps={{ rows: 2 }}
          colProps={{ span: 24 }}
        />
      </ModalForm>

      {renderPullModals()}
      {PrintModal}
    </>
  );
};

export default PaymentApplicationsPage;
