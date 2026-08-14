/**
 * 应付单列表页
 */
import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Typography, Modal, Spin, Alert, Table, Empty, Form } from 'antd';
import { ModalForm, ProForm, ProFormDatePicker, ProFormMoney, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import type { ProFormInstance } from '@ant-design/pro-components';
import { EyeOutlined, DollarOutlined, PlusOutlined, FileTextOutlined } from '@ant-design/icons';
import { apiRequest } from '../../../../../services/api';
import {
    payableService,
    type PayablePullCandidate,
    type PayablePullPreview,
} from '../../../services/finance/payable';
import { Payable, PayableCreateData } from '../../../types/finance/payable';
import { importInChunksViaPerItemCreate } from '../../../../../utils/chunkedBulkImport';
import { buildFutureDateShortcutFieldProps } from '../../../../../utils/futureDatePickerShortcuts';
import { useTranslation } from 'react-i18next';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../../../utils/spreadsheetImportTemplate';
import { useNavigate } from 'react-router-dom';
import { UniTable } from '../../../../../components/uni-table';
import { UniAuditBatchMenuButton, createUniAuditBatchHandlers } from '../../../../../components/uni-batch';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { financeColFull, financeColHalf, financeFormGridProps } from '../../../utils/financeFormLayout';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import {
  UniPullQueryModal,
  filterByPullScope,
  paginatePullRows,
  UNI_PULL_QUERY_MAX_FETCH_LIMIT,
  useUniPullQuery,
} from '../../../../../components/uni-pull-query';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { getPayableLifecycle } from '../../../utils/financeLifecycle';
import { buildPayableStatusEnum, buildReviewStatusEnum } from '../../../utils/financeSharedOptions';
import { buildKuaicaiwuPullCreateMenuItems, getKuaicaiwuDocumentAction } from '../../../constants/documentActionRegistry';
import { payableCapabilityReasonMessage } from '../../../utils/payableCapabilityMessages';
import dayjs from 'dayjs';
import DocumentAttachmentsField from '../../../../kuaizhizao/components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../../kuaizhizao/utils/documentAttachments';
import { formatDateTime, todaySiteDateString } from '../../../../../utils/format';
import {
  FINANCE_DOC_PINNED_STATUS_FIELD,
  financeDocCodePartnerSearchColumns,
  financeDocCreatedUpdatedColumns,
  resolvePayableListParams,
} from '../../../utils/financeListCore';
import type { PayableListParams } from '../../../types/finance/payable';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import {
  DocumentPushProgressBar,
  DOCUMENT_PROGRESS_COLUMN_DEFAULTS,
} from '../../../../kuaizhizao/pages/sales-management/shared/DocumentPushProgressBar';
import { payablePaymentPushPercent, payableInvoicePushPercent } from '../../../../kuaizhizao/pages/sales-management/shared/pushProgress';
import { renderPayableInvoiceStatusTag } from '../../../utils/financeInvoiceStatusUi';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { fetchAllListItems } from '../../../../../utils/fetchAllListPages';
import { downloadRecordsAsXlsx } from '../../../../../utils/exportRecordsXlsx';
import MergeFinanceDocsModal, {
  type MergeFinanceMode,
  type MergeFinanceSourceRow,
} from '../../../components/MergeFinanceDocsModal';

const P = 'app.kuaicaiwu.payable';
const PAYABLE_RESOURCE = 'kuaicaiwu:payable';
const PAYMENT_RESOURCE = 'kuaicaiwu:payment';
const PURCHASE_INVOICE_RESOURCE = 'kuaicaiwu:purchase-invoice';

type PullPreviewKind = 'purchase_order' | 'purchase_receipt';

const formatPullMoney = (value: number) =>
  `¥${Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PayableList: React.FC = () => {
    const actionRef = useRef<ActionType>();
    const lastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});
    const createFormRef = useRef<ProFormInstance>(null);
    const [pullForm] = Form.useForm();
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [pullPreviewOpen, setPullPreviewOpen] = useState(false);
    const [pullPreviewLoading, setPullPreviewLoading] = useState(false);
    const [pullSubmitting, setPullSubmitting] = useState(false);
    const [pullPreviewData, setPullPreviewData] = useState<PayablePullPreview | null>(null);
    const [pullPreviewSourceId, setPullPreviewSourceId] = useState<number | null>(null);
    const [pullPreviewKind, setPullPreviewKind] = useState<PullPreviewKind | null>(null);
    const pullFromPurchaseOrderCloseRef = useRef<(() => void) | null>(null);
    const pullFromPurchaseReceiptCloseRef = useRef<(() => void) | null>(null);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [tableRows, setTableRows] = useState<Payable[]>([]);
    const [supplierOptions, setSupplierOptions] = useState<{ label: string; value: number }[]>([]);
    const { message: messageApi } = App.useApp();
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const pullFromPurchaseOrderAction = getKuaicaiwuDocumentAction('payable.pull_from_purchase_order');
    const pullFromPurchaseReceiptAction = getKuaicaiwuDocumentAction('payable.pull_from_purchase_receipt');

    const payableAuditEnabled = useAuditRequired('payable', false);
    const payablePerms = useResourcePermissions(PAYABLE_RESOURCE);
    const paymentPerms = useResourcePermissions(PAYMENT_RESOURCE);
    const purchaseInvoicePerms = useResourcePermissions(PURCHASE_INVOICE_RESOURCE);
    const payableAuditBatchHandlers = useMemo(
        () => createUniAuditBatchHandlers('payable'),
        [],
    );
    const selectedRecordsForBatch = useMemo(
        () => tableRows.filter((row) => row.id != null && selectedRowKeys.includes(row.id)),
        [tableRows, selectedRowKeys],
    );
    const [mergeModalOpen, setMergeModalOpen] = useState(false);
    const [mergeMode, setMergeMode] = useState<MergeFinanceMode>('merge_payment');
    const [mergeSources, setMergeSources] = useState<MergeFinanceSourceRow[]>([]);
    const handlePayableAuditBatchSuccess = () => {
        setSelectedRowKeys([]);
        actionRef.current?.reload();
    };

    const openMergeModal = (mode: MergeFinanceMode) => {
        const selected = selectedRecordsForBatch;
        if (selected.length === 0) {
            messageApi.warning(t('app.kuaicaiwu.mergeFinance.needSelection'));
            return;
        }
        const partnerIds = new Set(selected.map((r) => Number(r.supplier_id)));
        if (partnerIds.size !== 1) {
            messageApi.error(t('app.kuaicaiwu.mergeFinance.sameSupplierRequired'));
            return;
        }
        const sources: MergeFinanceSourceRow[] = [];
        for (const row of selected) {
            const isInvoice = mode === 'merge_purchase_invoice';
            const available = isInvoice
                ? Number(row.remaining_invoice_amount ?? row.total_amount ?? 0)
                : Number(row.remaining_amount ?? 0);
            const pushAllowed = isInvoice
                ? row.capabilities?.push_purchase_invoice?.allowed !== false
                : row.capabilities?.push_payment?.allowed !== false;
            if (!(available > 0) || !pushAllowed) {
                messageApi.error(
                    t('app.kuaicaiwu.mergeFinance.sourceNotEligible', {
                        code: row.payable_code || row.id,
                    }),
                );
                return;
            }
            sources.push({
                id: Number(row.id),
                code: String(row.payable_code || row.id),
                partnerId: Number(row.supplier_id),
                partnerName: String(row.supplier_name || ''),
                availableAmount: available,
            });
        }
        setMergeMode(mode);
        setMergeSources(sources);
        setMergeModalOpen(true);
    };

    const mergePaymentDisabled =
        !paymentPerms.canCreate ||
        selectedRecordsForBatch.length === 0 ||
        new Set(selectedRecordsForBatch.map((r) => Number(r.supplier_id))).size !== 1;
    const mergeInvoiceDisabled =
        !purchaseInvoicePerms.canCreate ||
        selectedRecordsForBatch.length === 0 ||
        new Set(selectedRecordsForBatch.map((r) => Number(r.supplier_id))).size !== 1;

    const payableImportTemplate = useMemo(
        () =>
            buildFactoryImportTemplate(
                t,
                [
                    {
                        field: 'supplier',
                        required: true,
                        labelKey: `${P}.import.supplierName`,
                        aliases: ['供应商名称', '供应商'],
                    },
                    {
                        field: 'amount',
                        required: true,
                        labelKey: `${P}.import.amount`,
                        aliases: ['应付金额', '金额'],
                    },
                    { field: 'dueDate', labelKey: `${P}.import.dueDate`, aliases: ['到期日期'] },
                    { field: 'businessDate', labelKey: `${P}.import.businessDate`, aliases: ['业务日期'] },
                    { field: 'notes', labelKey: 'app.kuaicaiwu.common.notes', aliases: ['备注'] },
                ],
                [
                    t(`${P}.importExample.supplierName`),
                    t(`${P}.importExample.amount`),
                    t(`${P}.importExample.dueDate`),
                    t(`${P}.importExample.businessDate`),
                    '',
                ],
            ),
        [t, i18n.language],
    );

    useEffect(() => {
        const load = async () => {
            try {
                const res = await apiRequest<unknown>('/apps/master-data/supply-chain/suppliers', { params: { limit: 1000, is_active: true } });
                const list = Array.isArray(res) ? res : (res as any)?.data ?? (res as any)?.items ?? [];
                setSupplierOptions((Array.isArray(list) ? list : []).map((s: any) => ({
                    label: s.name || s.supplier_name || s.code || String(s.id),
                    value: s.id,
                })));
            } catch {
                setSupplierOptions([]);
            }
        };
        load();
    }, []);

    const handleCreate = async (values: any) => {
        const today = formatDateTime(dayjs(), 'YYYY-MM-DD');
        const data: PayableCreateData = {
            source_type: '手工',
            source_id: 0,
            source_code: '手工',
            supplier_id: values.supplier_id,
            supplier_name: supplierOptions.find(o => o.value === values.supplier_id)?.label || '',
            total_amount: values.total_amount,
            paid_amount: 0,
            remaining_amount: values.total_amount,
            due_date: values.due_date || today,
            business_date: values.business_date || today,
            status: '未付款',
            review_status: '草稿',
            notes: values.notes,
            attachments: normalizeDocumentAttachments(values.attachments),
        };
        const created = await payableService.createPayable(data);
        messageApi.success(t('common.createSuccess'));
        setCreateModalVisible(false);
        actionRef.current?.reload();
        if (created?.id) {
            navigate(`/apps/kuaicaiwu/finance-management/payables/${created.id}`);
        }
        return true;
    };

    const resetPullPreview = () => {
        setPullPreviewOpen(false);
        setPullPreviewSourceId(null);
        setPullPreviewData(null);
        setPullPreviewKind(null);
        pullForm.resetFields();
    };

    const openPullPreview = async (kind: PullPreviewKind, sourceId: number) => {
        setPullPreviewKind(kind);
        setPullPreviewOpen(true);
        setPullPreviewLoading(true);
        setPullPreviewData(null);
        setPullPreviewSourceId(sourceId);
        try {
            const data =
                kind === 'purchase_order'
                    ? await payableService.previewPullFromPurchaseOrder(sourceId)
                    : await payableService.previewPullFromPurchaseReceipt(sourceId);
            setPullPreviewData(data);
        } catch (e: any) {
            messageApi.error(
                e?.response?.data?.detail?.message || e?.response?.data?.detail || e?.message || t(`${P}.loadSourceFailed`),
            );
            resetPullPreview();
        } finally {
            setPullPreviewLoading(false);
        }
    };

    const isPullPayableSelectable = useCallback(
        (record: PayablePullCandidate) => record.capabilities?.pull_payable?.allowed !== false,
        [],
    );

    const pullQueryScopeOptions = useMemo(
        () => [
            { label: t('components.uniPullQuery.scopePullable'), value: 'pullable' },
            { label: t('components.uniPullQuery.scopeAll'), value: 'all' },
        ],
        [t],
    );

    const pullFromPurchaseOrderQuery = useUniPullQuery<PayablePullCandidate>({
        rowKey: 'id',
        selectionType: 'radio',
        scopeOptions: pullQueryScopeOptions,
        defaultScope: 'pullable',
        isRowDisabled: (record) => !isPullPayableSelectable(record),
        loadData: async ({ keyword, page, pageSize, scope }) => {
            try {
                const res = await payableService.listPurchaseOrderPullCandidates({
                    skip: 0,
                    limit: UNI_PULL_QUERY_MAX_FETCH_LIMIT,
                    keyword: keyword.trim() || undefined,
                });
                const rows = res.data || [];
                const filtered = filterByPullScope(rows, scope, isPullPayableSelectable);
                return paginatePullRows(filtered, page, pageSize);
            } catch (e: any) {
                messageApi.error(
                    e?.response?.data?.detail?.message || e?.response?.data?.detail || e?.message || t(`${P}.loadSourceFailed`),
                );
                return { data: [], total: 0 };
            }
        },
        onConfirm: async (keys, rows) => {
            const selected = rows.find((x) => String(x.id) === String(keys[0]));
            if (!selected?.id) {
                messageApi.warning(t(`${P}.selectSource`, { label: pullFromPurchaseOrderAction.sourceLabel }));
                return;
            }
            pullFromPurchaseOrderCloseRef.current?.();
            await openPullPreview('purchase_order', selected.id);
        },
    });
    pullFromPurchaseOrderCloseRef.current = pullFromPurchaseOrderQuery.closeModal;

    const pullFromPurchaseReceiptQuery = useUniPullQuery<PayablePullCandidate>({
        rowKey: 'id',
        selectionType: 'radio',
        scopeOptions: pullQueryScopeOptions,
        defaultScope: 'pullable',
        isRowDisabled: (record) => !isPullPayableSelectable(record),
        loadData: async ({ keyword, page, pageSize, scope }) => {
            try {
                const res = await payableService.listPurchaseReceiptPullCandidates({
                    skip: 0,
                    limit: UNI_PULL_QUERY_MAX_FETCH_LIMIT,
                    keyword: keyword.trim() || undefined,
                });
                const rows = res.data || [];
                const filtered = filterByPullScope(rows, scope, isPullPayableSelectable);
                return paginatePullRows(filtered, page, pageSize);
            } catch (e: any) {
                messageApi.error(
                    e?.response?.data?.detail?.message || e?.response?.data?.detail || e?.message || t(`${P}.loadSourceFailed`),
                );
                return { data: [], total: 0 };
            }
        },
        onConfirm: async (keys, rows) => {
            const selected = rows.find((x) => String(x.id) === String(keys[0]));
            if (!selected?.id) {
                messageApi.warning(t(`${P}.selectSource`, { label: pullFromPurchaseReceiptAction.sourceLabel }));
                return;
            }
            pullFromPurchaseReceiptCloseRef.current?.();
            await openPullPreview('purchase_receipt', selected.id);
        },
    });
    pullFromPurchaseReceiptCloseRef.current = pullFromPurchaseReceiptQuery.closeModal;

    const handlePullCreateSubmit = async (values: any) => {
        if (!pullPreviewData || !pullPreviewSourceId || !pullPreviewKind) {
            messageApi.warning(t(`${P}.pullPreviewIncomplete`));
            return false;
        }
        if (pullPreviewData.has_blocking_issues) {
            messageApi.warning(
                payableCapabilityReasonMessage(pullPreviewData.blocking_reason, t)
                    || t(`${P}.pullPreviewBlocked`),
            );
            return false;
        }
        const maxPush = Number(pullPreviewData.items?.[0]?.max_push_quantity ?? 0);
        const totalAmount = Number(values.total_amount) || 0;
        if (totalAmount <= 0) {
            messageApi.warning(t(`${P}.amountRequired`));
            return false;
        }
        if (totalAmount > maxPush) {
            messageApi.warning(t(`${P}.pullExceedMax`, { max: maxPush.toFixed(2) }));
            return false;
        }
        const sourceLabel =
            pullPreviewKind === 'purchase_order'
                ? pullFromPurchaseOrderAction.sourceLabel
                : pullFromPurchaseReceiptAction.sourceLabel;
        setPullSubmitting(true);
        try {
            await payableService.createPayable({
                source_type: pullPreviewKind,
                source_id: pullPreviewSourceId,
                source_code: pullPreviewData.source_code || '',
                pull_source_type: pullPreviewKind,
                pull_source_id: pullPreviewSourceId,
                supplier_id: Number(pullPreviewData.supplier_id || 0),
                supplier_name: pullPreviewData.supplier_name || '',
                total_amount: totalAmount,
                paid_amount: 0,
                remaining_amount: totalAmount,
                due_date: formatDateTime(values.due_date || dayjs().add(30, 'day'), 'YYYY-MM-DD'),
                business_date: formatDateTime(values.business_date || dayjs(), 'YYYY-MM-DD'),
                status: '未付款',
                review_status: '草稿',
                notes:
                    String(values.notes ?? '').trim() ||
                    t('app.kuaicaiwu.common.createdFromSourceNote', {
                        source: sourceLabel,
                        code: pullPreviewData.source_code,
                    }),
                attachments: normalizeDocumentAttachments(values.attachments),
            });
            messageApi.success(t(`${P}.pullCreateSuccess`, { target: pullFromPurchaseOrderAction.targetLabel }));
            resetPullPreview();
            actionRef.current?.reload();
            return true;
        } catch (e: any) {
            messageApi.error(
                e?.response?.data?.detail?.message || e?.response?.data?.detail || e?.message || t('common.createFailed'),
            );
            return false;
        } finally {
            setPullSubmitting(false);
        }
    };

    const pullPreviewMaxPush = Number(pullPreviewData?.items?.[0]?.max_push_quantity ?? 0);
    const pullPreviewTargetLabel = pullFromPurchaseOrderAction.targetLabel;

    const pullFormInitialValues = useMemo(() => {
        if (!pullPreviewData || !pullPreviewKind) return undefined;
        const maxPush = Number(pullPreviewData.items?.[0]?.max_push_quantity ?? 0);
        const sourceLabel =
            pullPreviewKind === 'purchase_order'
                ? pullFromPurchaseOrderAction.sourceLabel
                : pullFromPurchaseReceiptAction.sourceLabel;
        return {
            source_code: pullPreviewData.source_code,
            supplier_name: pullPreviewData.supplier_name,
            total_amount: maxPush > 0 ? maxPush : undefined,
            due_date: dayjs().add(30, 'day'),
            business_date: dayjs(),
            notes: t('app.kuaicaiwu.common.createdFromSourceNote', {
                source: sourceLabel,
                code: pullPreviewData.source_code,
            }),
        };
    }, [
        pullPreviewData,
        pullPreviewKind,
        pullFromPurchaseOrderAction.sourceLabel,
        pullFromPurchaseReceiptAction.sourceLabel,
        t,
    ]);

    useEffect(() => {
        if (!pullPreviewOpen || pullPreviewLoading || !pullFormInitialValues) return;
        pullForm.setFieldsValue(pullFormInitialValues);
    }, [pullPreviewOpen, pullPreviewLoading, pullFormInitialValues, pullForm]);

    const handlePullPreviewOk = async () => {
        if (pullPreviewLoading || !pullPreviewData) {
            messageApi.warning(t(`${P}.pullPreviewIncomplete`));
            return;
        }
        if (pullPreviewData.has_blocking_issues) {
            messageApi.warning(
                payableCapabilityReasonMessage(pullPreviewData.blocking_reason, t)
                    || t(`${P}.pullPreviewBlocked`),
            );
            return;
        }
        if (pullPreviewMaxPush <= 0) {
            messageApi.warning(t(`${P}.pullNoPayableAmount`));
            return;
        }
        try {
            const values = await pullForm.validateFields();
            await handlePullCreateSubmit(values);
        } catch {
            messageApi.warning(t(`${P}.pullFormValidationFailed`));
        }
    };

    const pullTableColumns: ProColumns<PayablePullCandidate>[] = useMemo(
        () => [
            { title: t(`${P}.pullCol.sourceCode`), dataIndex: 'code', width: 220, ellipsis: true },
            { title: t('app.kuaicaiwu.common.supplier'), dataIndex: 'supplier_name', width: 160, ellipsis: true },
            { title: t(`${P}.pullCol.sourceStatus`), dataIndex: 'source_status', width: 100, ellipsis: true },
            { title: t(`${P}.pullCol.sourceDate`), dataIndex: 'source_date', width: 120, ellipsis: true },
            { title: t(`${P}.pullCol.docAmount`), dataIndex: 'amount', valueType: 'money', width: 120, align: 'right' },
        ],
        [t],
    );

    const handleBatchDelete = async (keys: React.Key[]) => {
        try {
            for (const id of keys) {
                await payableService.deletePayable(Number(id));
            }
            messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
            setSelectedRowKeys([]);
            actionRef.current?.reload();
        } catch (error: any) {
            messageApi.error(error?.message || t('common.deleteFailed'));
        }
    };

    const columns: ProColumns<Payable>[] = useMemo(() => [
        ...financeDocCodePartnerSearchColumns({
            docCodeLabel: t('app.kuaicaiwu.common.code'),
            docCodeField: 'payable_code',
            partnerLabel: t('app.kuaicaiwu.common.supplier', '供应商'),
            partnerIdField: 'supplier_id',
            partnerNameField: 'supplier_name',
            partnerOptions: supplierOptions,
        }),
        {
            title: t('app.kuaicaiwu.common.code'),
            key: 'finance_doc_partner_stacked',
            dataIndex: 'payable_code',
            ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
            fixed: 'left',
            hideInSearch: true,
            sorter: true,
            render: (_, entity) => (
                <UniTableStackedPrimaryCell
                    primary={String(entity.supplier_name ?? '')}
                    secondary={String(entity.payable_code ?? '')}
                    onSecondaryClick={() =>
                        navigate(`/apps/kuaicaiwu/finance-management/payables/${entity.id}`)
                    }
                />
            ),
        },
        {
            title: t(`${P}.col.supplierName`),
            dataIndex: 'supplier_name',
            hideInTable: true,
        },
        {
            title: t(`${P}.col.invoiceStatus`),
            key: 'invoice_status',
            dataIndex: 'invoice_status',
            width: 100,
            minWidth: 100,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
            render: (_, record) => renderPayableInvoiceStatusTag(record.invoice_status, t),
        },
        {
            title: t(`${P}.col.invoicedAmount`),
            dataIndex: 'invoiced_amount',
            valueType: 'money',
            align: 'right',
            width: 120,
            minWidth: 120,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
        },
        {
            title: t(`${P}.col.remainingInvoiceAmount`),
            dataIndex: 'remaining_invoice_amount',
            valueType: 'money',
            align: 'right',
            width: 120,
            minWidth: 120,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
            render: (_, record) => (
                <span
                    style={{
                        color: Number(record.remaining_invoice_amount ?? 0) > 0 ? '#1677ff' : 'inherit',
                        fontWeight: Number(record.remaining_invoice_amount ?? 0) > 0 ? 'bold' : 'normal',
                    }}
                >
                    {record.remaining_invoice_amount != null
                        ? `¥${Number(record.remaining_invoice_amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
                        : '-'}
                </span>
            ),
        },
        {
            title: t(`${P}.col.totalAmount`),
            dataIndex: 'total_amount',
            valueType: 'money',
            align: 'right',
            width: 120,
            minWidth: 120,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
            sorter: true,
        },
        {
            title: t(`${P}.col.paidAmount`),
            dataIndex: 'paid_amount',
            valueType: 'money',
            align: 'right',
            width: 120,
            minWidth: 120,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
            sorter: true,
        },
        {
            title: t(`${P}.col.remainingAmount`),
            dataIndex: 'remaining_amount',
            valueType: 'money',
            align: 'right',
            width: 120,
            minWidth: 120,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
            sorter: true,
            render: (_, record) => (
                <span style={{ color: record.remaining_amount > 0 ? 'red' : 'inherit', fontWeight: 'bold' }}>
                    {record.remaining_amount != null
                        ? `¥${Number(record.remaining_amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
                        : '-'}
                </span>
            ),
        },
        {
            title: t('app.kuaicaiwu.common.businessDate', '业务日期'),
            dataIndex: 'business_date',
            valueType: 'date',
            width: 120,
            minWidth: 120,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
            sorter: true,
        },
        {
            title: t('app.kuaicaiwu.common.businessDate', '业务日期'),
            dataIndex: 'business_date_range',
            valueType: 'dateRange',
            hideInTable: true,
            order: 20,
        },
        {
            title: t('app.kuaicaiwu.common.dueDate'),
            dataIndex: 'due_date',
            valueType: 'date',
            width: 120,
            minWidth: 120,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
            sorter: true,
        },
        {
            title: t('app.kuaicaiwu.common.dueDate'),
            dataIndex: 'due_date_range',
            valueType: 'dateRange',
            hideInTable: true,
            order: 21,
        },
        {
            title: t('common.status'),
            dataIndex: 'status',
            hideInTable: true,
            order: 22,
            valueEnum: buildPayableStatusEnum(t),
        },
        {
            title: t('app.kuaicaiwu.common.reviewStatus'),
            dataIndex: 'review_status',
            hideInTable: true,
            order: 23,
            valueEnum: buildReviewStatusEnum(t),
        },
        {
            title: t('app.kuaizhizao.salesManagement.pushProgress.title'),
            dataIndex: 'payment_push_progress',
            ...DOCUMENT_PROGRESS_COLUMN_DEFAULTS,
            render: (_, record) => {
                const percent = payablePaymentPushPercent(record.paid_amount, record.total_amount);
                return (
                    <DocumentPushProgressBar
                        percent={percent}
                        tooltip={t('app.kuaizhizao.salesManagement.pushProgress.percentOnly', {
                            percent: Math.round(percent),
                        })}
                    />
                );
            },
        },
        {
            title: t(`${P}.col.invoicePushProgress`),
            dataIndex: 'invoice_push_progress',
            ...DOCUMENT_PROGRESS_COLUMN_DEFAULTS,
            render: (_, record) => {
                const percent = payableInvoicePushPercent(record.invoiced_amount, record.total_amount);
                return (
                    <DocumentPushProgressBar
                        percent={percent}
                        tooltip={t(`${P}.col.invoicePushProgressTooltip`, {
                            percent: Math.round(percent),
                        })}
                    />
                );
            },
        },
        ...financeDocCreatedUpdatedColumns<Payable>(t),
        {
            title: t('app.kuaicaiwu.common.lifecycle'),
            key: 'lifecycle',
            dataIndex: 'lifecycle_stage',
            fixed: 'right',
            hideInSearch: true,
            render: (_, record) => {
                const lc = getPayableLifecycle(record as unknown as Record<string, unknown>, t);
                return (
                    <UniLifecycle
                        percent={lc.percent}
                        stageName={lc.stageName}
                        status={lc.status}
                        subStages={lc.subStages}
                        showLabel
                        size="small"
                        showCircleTooltip={false}
                    />
                );
            },
        },
        {
            title: t('common.actions'),
            key: 'action',
            valueType: 'option',
            fixed: 'right',
            hideInSearch: true,
            uniActionRenderOptions: { directMax: 5 },
            render: (_, record) => [
                        <Button {...rowActionKind('read')}
                            key="det"
                            type="link"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => navigate(`/apps/kuaicaiwu/finance-management/payables/${record.id}`)}
                        >
                            {t('common.detail')}
                        </Button>,
                        <UniWorkflowActions {...rowActionKind('skip')}
                            key="wf"
                            record={record}
                            apiPrefix="/apps/kuaicaiwu/payables"
                            entityType="payable"
                            entityName={t(`${P}.entityName`)}
                            statusField="status"
                            reviewStatusField="review_status"
                            draftStatuses={['草稿', 'draft']}
                            pendingStatuses={['待审核']}
                            approvedStatuses={['已审核']}
                            rejectedStatuses={['已驳回', '驳回']}
                            theme="link"
                            size="small"
                            onSuccess={() => actionRef.current?.reload()}
                        />,
                        record.remaining_amount > 0 &&
                        record.capabilities?.push_payment?.allowed !== false &&
                        payablePerms.canUpdate ? (
                            <Button {...rowActionKind('execute')}
                                key="pay"
                                type="link"
                                size="small"
                                icon={<DollarOutlined />}
                                onClick={() => navigate('/apps/kuaicaiwu/finance-management/payments', {
                                    state: { pullPayableId: record.id },
                                })}
                            >
                                {t('app.kuaicaiwu.common.pay')}
                            </Button>
                        ) : null,
                        record.capabilities?.push_purchase_invoice?.allowed !== false &&
                        Number(record.remaining_invoice_amount ?? record.total_amount ?? 0) > 0 &&
                        purchaseInvoicePerms.canCreate ? (
                            <Button {...rowActionKind('create')}
                                key="invoice"
                                type="link"
                                size="small"
                                icon={<FileTextOutlined />}
                                onClick={() => navigate('/apps/kuaicaiwu/finance-management/purchase-invoices', {
                                    state: { pullPayableId: record.id },
                                })}
                            >
                                {t('app.kuaicaiwu.payable.createInvoice')}
                            </Button>
                        ) : null,
                    ].filter(Boolean) as React.ReactNode[],
        },
    ], [t, navigate, supplierOptions, payablePerms, purchaseInvoicePerms]);

    return (
        <ListPageTemplate>
            <UniTable<Payable>
                headerTitle={t(`${P}.pageTitle`)}
                actionRef={actionRef}
                columns={alignProColumns(columns, SALES_DOC_LIST_FIELD_RANK)}
                columnPersistenceId="apps.kuaicaiwu.pages.finance-management.payables.list-v1"
                request={async (params, sort, _filter, searchFormValues) => {
                    const { current, pageSize } = params;
                    const listParams = resolvePayableListParams(searchFormValues, sort);
                    lastListParamsRef.current = listParams;
                    const apiParams: PayableListParams = {
                        skip: ((current || 1) - 1) * (pageSize || 20),
                        limit: pageSize || 20,
                        ...listParams,
                    };

                    try {
                        const res = await payableService.listPayables(apiParams);
                        return {
                            data: res.items || [],
                            total: res.total || 0,
                            success: true,
                        };
                    } catch (error: any) {
                        messageApi.error(error?.message || t('app.kuaicaiwu.common.loadListFailed'));
                        return { data: [], total: 0, success: false };
                    }
                }}
                skipFuzzyPinyinClientFilter
                pinnedTabsField={FINANCE_DOC_PINNED_STATUS_FIELD}
                rowKey="id"
                showCreateButton={false}
                createButtonText={t(`${P}.createTitle`)}
                onCreate={() => setCreateModalVisible(true)}
                toolBarRender={() => [
                    <UniPullCreateToolbar
                        key="create-payable-with-pull"
                        createIcon={<PlusOutlined />}
                        createLabel={t(`${P}.createTitle`)}
                        onCreate={() => setCreateModalVisible(true)}
                        menuItems={buildKuaicaiwuPullCreateMenuItems([
                            {
                                key: 'pull-from-purchase-order',
                                actionKey: 'payable.pull_from_purchase_order',
                                onClick: () => {
                                    pullFromPurchaseOrderQuery.openModal();
                                },
                            },
                            {
                                key: 'pull-from-purchase-receipt',
                                actionKey: 'payable.pull_from_purchase_receipt',
                                onClick: () => {
                                    pullFromPurchaseReceiptQuery.openModal();
                                },
                            },
                        ])}
                    />,
                ]}
                enableRowSelection
                selectedRowKeys={selectedRowKeys}
                onRowSelectionChange={setSelectedRowKeys}
                onTableDataChange={setTableRows}
                showDeleteButton
                deleteButtonText={t('common.batchDelete')}
                onDelete={handleBatchDelete}
                deleteConfirmTitle={t('app.kuaicaiwu.common.confirmBatchDelete')}
                deleteConfirmDescription={(count) => t(`${P}.deleteConfirm`, { count })}
                toolBarActionsAfterDelete={[
                    <UniAuditBatchMenuButton
                        key="payable-batch-audit"
                        selectedRowKeys={selectedRowKeys}
                        selectedRecords={selectedRecordsForBatch}
                        auditEnabled={payableAuditEnabled}
                        permGates={payablePerms}
                        handlers={payableAuditBatchHandlers}
                        onSuccess={handlePayableAuditBatchSuccess}
                        toolBarButtonSize="middle"
                    />,
                    <Button
                        key="merge-payment"
                        size="medium"
                        disabled={mergePaymentDisabled}
                        onClick={() => openMergeModal('merge_payment')}
                    >
                        {t('app.kuaicaiwu.mergeFinance.mergePayment')}
                    </Button>,
                    <Button
                        key="merge-purchase-invoice"
                        size="medium"
                        disabled={mergeInvoiceDisabled}
                        onClick={() => openMergeModal('merge_purchase_invoice')}
                    >
                        {t('app.kuaicaiwu.mergeFinance.mergePurchaseInvoice')}
                    </Button>,
                ]}
                showAdvancedSearch={true}
                showImportButton
                onImport={async (data) => {
                    if (!data || data.length < 2) {
                        messageApi.warning(t('app.kuaicaiwu.common.importEmpty'));
                        return;
                    }
                    const headers = (data[0] || []).map((h: any) => String(h || '').trim());
                    const headerIndexMap = resolveFactoryImportHeaderIndexMap(
                        headers,
                        payableImportTemplate.importHeaderMap,
                    );
                    if (headerIndexMap.supplier === undefined || headerIndexMap.amount === undefined) {
                        messageApi.error(t(`${P}.importHeaderError`));
                        return;
                    }
                    const items: PayableCreateData[] = [];
                    const importRows = data.slice(2).filter((row: any[]) =>
                        row?.some((c: any) => c != null && String(c).trim() !== ''),
                    );
                    for (const row of importRows) {
                        const suppLabel = String(row[headerIndexMap.supplier] ?? '').trim();
                        const suppOpt = supplierOptions.find(o => (o.label || '').trim() === suppLabel) ?? supplierOptions.find(o => (o.label || '').includes(suppLabel));
                        const suppId = suppOpt?.value;
                        const amount = Number(row[headerIndexMap.amount]) || 0;
                        if (!suppId || amount <= 0) continue;
                        const today = formatDateTime(dayjs(), 'YYYY-MM-DD');
                        const dueDate =
                            headerIndexMap.dueDate !== undefined && row[headerIndexMap.dueDate]
                                ? formatDateTime(row[headerIndexMap.dueDate], 'YYYY-MM-DD')
                                : today;
                        const bizDate =
                            headerIndexMap.businessDate !== undefined && row[headerIndexMap.businessDate]
                                ? formatDateTime(row[headerIndexMap.businessDate], 'YYYY-MM-DD')
                                : today;
                        items.push({
                            source_type: '手工',
                            source_id: 0,
                            source_code: '手工',
                            supplier_id: suppId,
                            supplier_name: suppOpt?.label || suppLabel,
                            total_amount: amount,
                            paid_amount: 0,
                            remaining_amount: amount,
                            due_date: dueDate,
                            business_date: bizDate,
                            notes:
                              headerIndexMap.notes !== undefined && row[headerIndexMap.notes]
                                ? String(row[headerIndexMap.notes]).trim() || undefined
                                : undefined,
                            status: '未付款',
                            review_status: '草稿',
                        });
                    }
                    if (items.length === 0) {
                        messageApi.warning(t('app.kuaicaiwu.common.importNoValidRows'));
                        return;
                    }
                    const result = await importInChunksViaPerItemCreate({
                        items,
                        createOne: async (item, _index) => payableService.createPayable(item),
                        title: t(`${P}.importTitle`),
                        chunkSize: 100,
                        concurrency: 4,
                    });
                    if (result.successCount > 0) {
                        messageApi.success(t(`${P}.importSuccess`, { count: result.successCount }));
                        actionRef.current?.reload();
                    }
                    if (result.failureCount > 0) {
                        messageApi.warning(t('app.kuaicaiwu.common.importPartialFail', { count: result.failureCount }));
                    }
                }}
                importHeaders={payableImportTemplate.importHeaders}
                importExampleRow={payableImportTemplate.importExampleRow}
                importColumnOptions={payableImportTemplate.importColumnOptions}
                importFieldMap={payableImportTemplate.importHeaderMap}
                showExportButton
                onExport={async (type, keys, pageData) => {
                    try {
                        let items: Payable[] =
                            type === 'currentPage' && pageData?.length
                                ? pageData
                                : await fetchAllListItems((p) =>
                                      payableService.listPayables({
                                          ...p,
                                          ...lastListParamsRef.current,
                                      }),
                                  );
                        if (type === 'selected' && keys?.length) {
                            items = items.filter((d: Payable) => d.id != null && keys.includes(d.id));
                        }
                        if (items.length === 0) {
                            messageApi.warning(t('common.exportNoData'));
                            return;
                        }
                        await downloadRecordsAsXlsx(
                          items as Array<Record<string, unknown>>,
                          `payables-${todaySiteDateString()}.xlsx`,
                        );
                        messageApi.success(t('common.exportCountSuccess', { count: items.length }));
                    } catch (error: any) {
                        messageApi.error(error?.message || t('common.exportFailed'));
                    }
                }}
            />

            <UniPullQueryModal<PayablePullCandidate>
                open={pullFromPurchaseOrderQuery.open}
                title={pullFromPurchaseOrderAction.label}
                onCancel={pullFromPurchaseOrderQuery.closeModal}
                onOk={() => {
                    void pullFromPurchaseOrderQuery.handleConfirm();
                }}
                rowKey="id"
                columns={pullTableColumns}
                dataSource={pullFromPurchaseOrderQuery.dataSource}
                loading={pullFromPurchaseOrderQuery.loading}
                confirmLoading={pullFromPurchaseOrderQuery.confirmLoading}
                selectionType={pullFromPurchaseOrderQuery.selectionType}
                selectedRowKeys={pullFromPurchaseOrderQuery.selectedRowKeys}
                onSelectedRowKeysChange={pullFromPurchaseOrderQuery.handleSelectedRowKeysChange}
                isRowDisabled={pullFromPurchaseOrderQuery.isRowDisabled}
                searchDraft={pullFromPurchaseOrderQuery.searchDraft}
                onSearchDraftChange={pullFromPurchaseOrderQuery.setSearchDraft}
                onSearchApply={pullFromPurchaseOrderQuery.handleSearchApply}
                onSearchClear={pullFromPurchaseOrderQuery.handleSearchClear}
                appliedKeyword={pullFromPurchaseOrderQuery.appliedKeyword}
                searchPlaceholder={t(`${P}.pull.searchPlaceholder`)}
                page={pullFromPurchaseOrderQuery.page}
                pageSize={pullFromPurchaseOrderQuery.pageSize}
                total={pullFromPurchaseOrderQuery.total}
                onPageChange={pullFromPurchaseOrderQuery.handlePageChange}
                scopeOptions={pullFromPurchaseOrderQuery.scopeOptions}
                scope={pullFromPurchaseOrderQuery.scope}
                onScopeChange={pullFromPurchaseOrderQuery.handleScopeChange}
                okText={t('components.uniLifecycle.nextStep')}
            />

            <UniPullQueryModal<PayablePullCandidate>
                open={pullFromPurchaseReceiptQuery.open}
                title={pullFromPurchaseReceiptAction.label}
                onCancel={pullFromPurchaseReceiptQuery.closeModal}
                onOk={() => {
                    void pullFromPurchaseReceiptQuery.handleConfirm();
                }}
                rowKey="id"
                columns={pullTableColumns}
                dataSource={pullFromPurchaseReceiptQuery.dataSource}
                loading={pullFromPurchaseReceiptQuery.loading}
                confirmLoading={pullFromPurchaseReceiptQuery.confirmLoading}
                selectionType={pullFromPurchaseReceiptQuery.selectionType}
                selectedRowKeys={pullFromPurchaseReceiptQuery.selectedRowKeys}
                onSelectedRowKeysChange={pullFromPurchaseReceiptQuery.handleSelectedRowKeysChange}
                isRowDisabled={pullFromPurchaseReceiptQuery.isRowDisabled}
                searchDraft={pullFromPurchaseReceiptQuery.searchDraft}
                onSearchDraftChange={pullFromPurchaseReceiptQuery.setSearchDraft}
                onSearchApply={pullFromPurchaseReceiptQuery.handleSearchApply}
                onSearchClear={pullFromPurchaseReceiptQuery.handleSearchClear}
                appliedKeyword={pullFromPurchaseReceiptQuery.appliedKeyword}
                searchPlaceholder={t(`${P}.pull.searchPlaceholder`)}
                page={pullFromPurchaseReceiptQuery.page}
                pageSize={pullFromPurchaseReceiptQuery.pageSize}
                total={pullFromPurchaseReceiptQuery.total}
                onPageChange={pullFromPurchaseReceiptQuery.handlePageChange}
                scopeOptions={pullFromPurchaseReceiptQuery.scopeOptions}
                scope={pullFromPurchaseReceiptQuery.scope}
                onScopeChange={pullFromPurchaseReceiptQuery.handleScopeChange}
                okText={t('components.uniLifecycle.nextStep')}
            />

            <Modal
                title={
                    pullPreviewKind === 'purchase_receipt'
                        ? pullFromPurchaseReceiptAction.label
                        : pullFromPurchaseOrderAction.label
                }
                open={pullPreviewOpen}
                destroyOnClose
                width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
                onCancel={resetPullPreview}
                okText={pullPreviewTargetLabel}
                cancelText={t('common.cancel')}
                confirmLoading={pullSubmitting}
                onOk={() => {
                    void handlePullPreviewOk();
                }}
                okButtonProps={{
                    disabled:
                        pullPreviewLoading ||
                        !pullPreviewData ||
                        !!pullPreviewData?.has_blocking_issues ||
                        pullPreviewMaxPush <= 0,
                }}
            >
                {pullPreviewLoading ? (
                    <div style={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                        <Spin />
                        <div style={{ color: 'var(--ant-color-primary)' }}>{t('app.kuaizhizao.salesOrder.loadingPreview')}</div>
                    </div>
                ) : pullPreviewData ? (
                    <div>
                        <p style={{ marginBottom: 12, fontWeight: 500 }}>{pullPreviewData.summary}</p>
                        {pullPreviewData.has_blocking_issues && pullPreviewData.blocking_reason ? (
                            <Alert
                                type="warning"
                                showIcon
                                style={{ marginBottom: 12 }}
                                message={payableCapabilityReasonMessage(pullPreviewData.blocking_reason, t)}
                            />
                        ) : null}
                        {pullPreviewData.items?.length > 0 ? (
                            <Table
                                size="small"
                                dataSource={pullPreviewData.items}
                                rowKey={(row) => String(row.item_id)}
                                pagination={false}
                                scroll={{ x: 720 }}
                                columns={[
                                    { title: t(`${P}.pull.col.sourceCode`), dataIndex: 'source_code', width: 140, ellipsis: true },
                                    { title: t('app.kuaicaiwu.common.supplier'), dataIndex: 'supplier_name', width: 160, ellipsis: true },
                                    {
                                        title: t(`${P}.pull.col.docAmount`),
                                        dataIndex: 'quantity',
                                        width: 120,
                                        align: 'right',
                                        render: (v: number) => formatPullMoney(v),
                                    },
                                    {
                                        title: t(`${P}.pull.col.payableAmount`),
                                        dataIndex: 'pushed_quantity',
                                        width: 120,
                                        align: 'right',
                                        render: (v: number) => formatPullMoney(v),
                                    },
                                    {
                                        title: t(`${P}.pull.col.payableableAmount`),
                                        dataIndex: 'max_push_quantity',
                                        width: 120,
                                        align: 'right',
                                        render: (v: number) => formatPullMoney(v),
                                    },
                                ]}
                            />
                        ) : (
                            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.purchaseReturn.pull.previewNoLines')} />
                        )}
                        {pullPreviewData.tip ? (
                            <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 16 }}>
                                {pullPreviewData.tip}
                            </Typography.Paragraph>
                        ) : null}
                        {!pullPreviewData.has_blocking_issues && pullPreviewMaxPush > 0 ? (
                            <ProForm
                                key={`pull-payable-${pullPreviewKind}-${pullPreviewSourceId}`}
                                form={pullForm}
                                initialValues={pullFormInitialValues}
                                submitter={false}
                                onFinish={handlePullCreateSubmit}
                                layout="vertical"
                                {...financeFormGridProps}
                            >
                                <ProFormText name="source_code" label={t(`${P}.pullCol.sourceCode`)} readonly colProps={financeColHalf} />
                                <ProFormText name="supplier_name" label={t('app.kuaicaiwu.common.supplier')} readonly colProps={financeColHalf} />
                                <ProFormMoney
                                    name="total_amount"
                                    label={t(`${P}.col.amount`)}
                                    min={0.01}
                                    max={pullPreviewMaxPush}
                                    rules={[{ required: true, message: t(`${P}.amountRequired`) }]}
                                    colProps={financeColFull}
                                />
                                <ProFormDatePicker
                                    name="business_date"
                                    label={t('app.kuaicaiwu.common.businessDate')}
                                    fieldProps={{ style: { width: '100%' } }}
                                    colProps={financeColHalf}
                                />
                                <ProFormDatePicker
                                    name="due_date"
                                    label={t('app.kuaicaiwu.common.dueDate')}
                                    rules={[{ required: true }]}
                                    colProps={financeColHalf}
                                    fieldProps={buildFutureDateShortcutFieldProps({
                                        getForm: () => pullForm,
                                        fieldName: 'due_date',
                                        baseFieldName: 'business_date',
                                        t,
                                    })}
                                />
                                <ProFormTextArea name="notes" label={t('app.kuaicaiwu.common.notes')} colProps={financeColFull} />
                                <DocumentAttachmentsField category="payable_attachments" />
                            </ProForm>
                        ) : null}
                    </div>
                ) : null}
            </Modal>

            <ModalForm
                title={t(`${P}.createTitle`)}
                open={createModalVisible}
                onOpenChange={setCreateModalVisible}
                onFinish={handleCreate}
                formRef={createFormRef}
                width={MODAL_CONFIG.STANDARD_WIDTH}
                {...financeFormGridProps}
            >
                <ProFormSelect
                    name="supplier_id"
                    label={t('app.kuaicaiwu.common.supplier')}
                    options={supplierOptions}
                    rules={[{ required: true, message: t('app.kuaicaiwu.common.selectSupplier') }]}
                    placeholder={t('app.kuaicaiwu.common.selectSupplier')}
                    colProps={financeColHalf}
                />
                <ProFormMoney
                    name="total_amount"
                    label={t(`${P}.col.amount`)}
                    min={0.01}
                    rules={[{ required: true }]}
                    colProps={financeColHalf}
                />
                <ProFormDatePicker
                    name="business_date"
                    label={t('app.kuaicaiwu.common.businessDate')}
                    fieldProps={{ style: { width: '100%' } }}
                    colProps={financeColHalf}
                />
                <ProFormDatePicker
                    name="due_date"
                    label={t('app.kuaicaiwu.common.dueDate')}
                    rules={[{ required: true }]}
                    colProps={financeColHalf}
                    fieldProps={buildFutureDateShortcutFieldProps({
                        getForm: () => createFormRef.current,
                        fieldName: 'due_date',
                        baseFieldName: 'business_date',
                        t,
                    })}
                />
                <ProFormTextArea name="notes" label={t('app.kuaicaiwu.common.notes')} colProps={financeColFull} />
                <DocumentAttachmentsField category="payable_attachments" />
            </ModalForm>

            <MergeFinanceDocsModal
                open={mergeModalOpen}
                mode={mergeMode}
                sources={mergeSources}
                onOpenChange={setMergeModalOpen}
                onSuccess={() => {
                    setSelectedRowKeys([]);
                    actionRef.current?.reload();
                }}
            />
        </ListPageTemplate>
    );
};

export default PayableList;
