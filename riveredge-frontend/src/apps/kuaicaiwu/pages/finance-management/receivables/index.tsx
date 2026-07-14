/**
 * 应收单列表页
 */
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Typography, Modal, Spin, Alert, Table, Empty } from 'antd';
import { ModalForm, ProFormDatePicker, ProFormMoney, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import type { ProFormInstance } from '@ant-design/pro-components';
import { EyeOutlined, DollarOutlined, PlusOutlined } from '@ant-design/icons';
import { apiRequest } from '../../../../../services/api';
import {
  receivableService,
  type ReceivablePullCandidate,
  type ReceivablePullPreview,
} from '../../../services/finance/receivable';
import { Receivable, ReceivableCreateData, ReceivableListParams } from '../../../types/finance/receivable';
import { batchImport } from '../../../../../utils/batchOperations';
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
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import { UniPullQueryModal, useUniPullQuery } from '../../../../../components/uni-pull-query';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { getReceivableLifecycle } from '../../../utils/financeLifecycle';
import { buildReceivableStatusEnum, buildReviewStatusEnum } from '../../../utils/financeSharedOptions';
import { buildKuaicaiwuPullCreateMenuItems, getKuaicaiwuDocumentAction } from '../../../constants/documentActionRegistry';
import { receivableCapabilityReasonMessage } from '../../../utils/receivableCapabilityMessages';
import dayjs from 'dayjs';
import DocumentAttachmentsField from '../../../../kuaizhizao/components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../../kuaizhizao/utils/documentAttachments';
import { formatDateTime } from '../../../../../utils/format';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import {
  DocumentPushProgressBar,
  DOCUMENT_PROGRESS_COLUMN_WIDTH,
} from '../../../../kuaizhizao/pages/sales-management/shared/DocumentPushProgressBar';
import { receivableReceiptPushPercent } from '../../../../kuaizhizao/pages/sales-management/shared/pushProgress';
import {
  FINANCE_DOC_PINNED_STATUS_FIELD,
  financeDocCodePartnerSearchColumns,
  financeDocCreatedUpdatedColumns,
  resolveReceivableListParams,
} from '../../../utils/financeListCore';

const P = 'app.kuaicaiwu.receivable';
const RECEIVABLE_RESOURCE = 'kuaicaiwu:receivable';

type PullPreviewKind = 'sales_order' | 'sales_delivery';

const formatPullMoney = (value: number) =>
  `¥${Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ReceivableList: React.FC = () => {
    const actionRef = useRef<ActionType>();
    const lastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});
    const createFormRef = useRef<ProFormInstance>(null);
    const pullFormRef = useRef<ProFormInstance>(null);
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [pullPreviewOpen, setPullPreviewOpen] = useState(false);
    const [pullPreviewLoading, setPullPreviewLoading] = useState(false);
    const [pullSubmitting, setPullSubmitting] = useState(false);
    const [pullPreviewData, setPullPreviewData] = useState<ReceivablePullPreview | null>(null);
    const [pullPreviewSourceId, setPullPreviewSourceId] = useState<number | null>(null);
    const [pullPreviewKind, setPullPreviewKind] = useState<PullPreviewKind | null>(null);
    const pullFromSalesOrderCloseRef = useRef<(() => void) | null>(null);
    const pullFromSalesDeliveryCloseRef = useRef<(() => void) | null>(null);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [tableRows, setTableRows] = useState<Receivable[]>([]);
    const [customerOptions, setCustomerOptions] = useState<{ label: string; value: number }[]>([]);
    const { message: messageApi } = App.useApp();
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const pullFromSalesOrderAction = getKuaicaiwuDocumentAction('receivable.pull_from_sales_order');
    const pullFromSalesDeliveryAction = getKuaicaiwuDocumentAction('receivable.pull_from_sales_delivery');

    const receivableAuditEnabled = useAuditRequired('receivable', false);
    const receivablePerms = useResourcePermissions(RECEIVABLE_RESOURCE);
    const receivableAuditBatchHandlers = useMemo(
        () => createUniAuditBatchHandlers('receivable'),
        [],
    );
    const selectedRecordsForBatch = useMemo(
        () => tableRows.filter((row) => row.id != null && selectedRowKeys.includes(row.id)),
        [tableRows, selectedRowKeys],
    );
    const handleReceivableAuditBatchSuccess = () => {
        setSelectedRowKeys([]);
        actionRef.current?.reload();
    };

    const receivableImportTemplate = useMemo(
        () =>
            buildFactoryImportTemplate(
                t,
                [
                    {
                        field: 'customer',
                        required: true,
                        labelKey: `${P}.import.customerName`,
                        aliases: ['客户名称', '客户'],
                    },
                    {
                        field: 'amount',
                        required: true,
                        labelKey: `${P}.import.amount`,
                        aliases: ['应收金额', '金额'],
                    },
                    { field: 'dueDate', labelKey: `${P}.import.dueDate`, aliases: ['到期日期'] },
                    { field: 'businessDate', labelKey: `${P}.import.businessDate`, aliases: ['业务日期'] },
                ],
                [
                    t(`${P}.importExample.customerName`),
                    t(`${P}.importExample.amount`),
                    t(`${P}.importExample.dueDate`),
                    t(`${P}.importExample.businessDate`),
                ],
            ),
        [t, i18n.language],
    );

    useEffect(() => {
        const load = async () => {
            try {
                const res = await apiRequest<unknown>('/apps/master-data/supply-chain/customers', { params: { limit: 1000, is_active: true } });
                const list = Array.isArray(res) ? res : (res as any)?.data ?? (res as any)?.items ?? [];
                setCustomerOptions((Array.isArray(list) ? list : []).map((c: any) => ({
                    label: c.name || c.customer_name || c.code || String(c.id),
                    value: c.id,
                })));
            } catch {
                setCustomerOptions([]);
            }
        };
        load();
    }, []);

    const handleCreate = async (values: any) => {
        const today = formatDateTime(dayjs(), 'YYYY-MM-DD');
        const data: ReceivableCreateData = {
            source_type: '手工',
            source_id: 0,
            source_code: '手工',
            customer_id: values.customer_id,
            customer_name: customerOptions.find(o => o.value === values.customer_id)?.label || '',
            total_amount: values.total_amount,
            received_amount: 0,
            remaining_amount: values.total_amount,
            due_date: values.due_date || today,
            business_date: values.business_date || today,
            status: '未收款',
            review_status: '待审核',
            notes: values.notes,
            attachments: normalizeDocumentAttachments(values.attachments),
        };
        await receivableService.createReceivable(data);
        messageApi.success(t('common.createSuccess'));
        setCreateModalVisible(false);
        actionRef.current?.reload();
    };

    const resetPullPreview = () => {
        setPullPreviewOpen(false);
        setPullPreviewSourceId(null);
        setPullPreviewData(null);
        setPullPreviewKind(null);
        pullFormRef.current?.resetFields();
    };

    const openPullPreview = async (kind: PullPreviewKind, sourceId: number) => {
        setPullPreviewKind(kind);
        setPullPreviewOpen(true);
        setPullPreviewLoading(true);
        setPullPreviewData(null);
        setPullPreviewSourceId(sourceId);
        try {
            const data =
                kind === 'sales_order'
                    ? await receivableService.previewPullFromSalesOrder(sourceId)
                    : await receivableService.previewPullFromSalesDelivery(sourceId);
            setPullPreviewData(data);
            const maxPush = Number(data.items?.[0]?.max_push_quantity ?? 0);
            const today = formatDateTime(dayjs(), 'YYYY-MM-DD');
            const sourceLabel =
                kind === 'sales_order' ? pullFromSalesOrderAction.sourceLabel : pullFromSalesDeliveryAction.sourceLabel;
            pullFormRef.current?.setFieldsValue({
                source_code: data.source_code,
                customer_name: data.customer_name,
                total_amount: maxPush > 0 ? maxPush : undefined,
                due_date: dayjs().add(30, 'day'),
                business_date: dayjs(),
                notes: t('app.kuaicaiwu.common.createdFromSourceNote', {
                    source: sourceLabel,
                    code: data.source_code,
                }),
            });
        } catch (e: any) {
            messageApi.error(
                e?.response?.data?.detail?.message || e?.response?.data?.detail || e?.message || t(`${P}.loadSourceFailed`),
            );
            resetPullPreview();
        } finally {
            setPullPreviewLoading(false);
        }
    };

    const pullFromSalesOrderQuery = useUniPullQuery<ReceivablePullCandidate>({
        rowKey: 'id',
        selectionType: 'radio',
        isRowDisabled: (record) => record.capabilities?.pull_receivable?.allowed === false,
        loadData: async ({ keyword, page, pageSize }) => {
            try {
                const res = await receivableService.listSalesOrderPullCandidates({
                    skip: (page - 1) * pageSize,
                    limit: pageSize,
                    keyword: keyword.trim() || undefined,
                });
                return { data: res.data || [], total: res.total ?? 0 };
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
                messageApi.warning(t(`${P}.selectSource`, { label: pullFromSalesOrderAction.sourceLabel }));
                return;
            }
            pullFromSalesOrderCloseRef.current?.();
            await openPullPreview('sales_order', selected.id);
        },
    });
    pullFromSalesOrderCloseRef.current = pullFromSalesOrderQuery.closeModal;

    const pullFromSalesDeliveryQuery = useUniPullQuery<ReceivablePullCandidate>({
        rowKey: 'id',
        selectionType: 'radio',
        isRowDisabled: (record) => record.capabilities?.pull_receivable?.allowed === false,
        loadData: async ({ keyword, page, pageSize }) => {
            try {
                const res = await receivableService.listSalesDeliveryPullCandidates({
                    skip: (page - 1) * pageSize,
                    limit: pageSize,
                    keyword: keyword.trim() || undefined,
                });
                return { data: res.data || [], total: res.total ?? 0 };
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
                messageApi.warning(t(`${P}.selectSource`, { label: pullFromSalesDeliveryAction.sourceLabel }));
                return;
            }
            pullFromSalesDeliveryCloseRef.current?.();
            await openPullPreview('sales_delivery', selected.id);
        },
    });
    pullFromSalesDeliveryCloseRef.current = pullFromSalesDeliveryQuery.closeModal;

    const handlePullCreateSubmit = async (values: any) => {
        if (!pullPreviewData || !pullPreviewSourceId || !pullPreviewKind) return false;
        if (pullPreviewData.has_blocking_issues) return false;
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
        const today = formatDateTime(dayjs(), 'YYYY-MM-DD');
        const sourceLabel =
            pullPreviewKind === 'sales_order'
                ? pullFromSalesOrderAction.sourceLabel
                : pullFromSalesDeliveryAction.sourceLabel;
        setPullSubmitting(true);
        try {
            await receivableService.createReceivable({
                source_type: pullPreviewKind,
                source_id: pullPreviewSourceId,
                source_code: pullPreviewData.source_code || '',
                pull_source_type: pullPreviewKind,
                pull_source_id: pullPreviewSourceId,
                customer_id: Number(pullPreviewData.customer_id || 0),
                customer_name: pullPreviewData.customer_name || '',
                total_amount: totalAmount,
                received_amount: 0,
                remaining_amount: totalAmount,
                due_date: formatDateTime(values.due_date || dayjs().add(30, 'day'), 'YYYY-MM-DD'),
                business_date: formatDateTime(values.business_date || dayjs(), 'YYYY-MM-DD'),
                status: '未收款',
                review_status: '待审核',
                notes:
                    String(values.notes ?? '').trim() ||
                    t('app.kuaicaiwu.common.createdFromSourceNote', {
                        source: sourceLabel,
                        code: pullPreviewData.source_code,
                    }),
                attachments: normalizeDocumentAttachments(values.attachments),
            });
            messageApi.success(t(`${P}.pullCreateSuccess`, { target: pullFromSalesOrderAction.targetLabel }));
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
    const pullPreviewTargetLabel = pullFromSalesOrderAction.targetLabel;

    const pullTableColumns: ProColumns<ReceivablePullCandidate>[] = useMemo(
        () => [
            { title: t(`${P}.pullCol.sourceCode`), dataIndex: 'code', width: 220, ellipsis: true },
            { title: t('app.kuaicaiwu.common.customer'), dataIndex: 'customer_name', width: 160, ellipsis: true },
            { title: t(`${P}.pullCol.sourceStatus`), dataIndex: 'source_status', width: 100, ellipsis: true },
            { title: t(`${P}.pullCol.sourceDate`), dataIndex: 'source_date', width: 120, ellipsis: true },
            { title: t(`${P}.pullCol.docAmount`), dataIndex: 'amount', valueType: 'money', width: 120, align: 'right' },
        ],
        [t],
    );

    const handleBatchDelete = async (keys: React.Key[]) => {
        try {
            for (const id of keys) {
                await receivableService.deleteReceivable(Number(id));
            }
            messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
            setSelectedRowKeys([]);
            actionRef.current?.reload();
        } catch (error: any) {
            messageApi.error(error?.message || t('common.deleteFailed'));
        }
    };

    const columns: ProColumns<Receivable>[] = useMemo(() => [
        ...financeDocCodePartnerSearchColumns({
            docCodeLabel: t('app.kuaicaiwu.common.code'),
            docCodeField: 'receivable_code',
            partnerLabel: t('app.kuaicaiwu.common.customer'),
            partnerIdField: 'customer_id',
            partnerNameField: 'customer_name',
            partnerOptions: customerOptions,
        }),
        {
            title: t('app.kuaicaiwu.common.code'),
            dataIndex: 'receivable_code',
            width: 168,
            fixed: 'left',
            hideInSearch: true,
            sorter: true,
            render: (_, entity) => (
                <Typography.Text copyable={{ text: String(entity.receivable_code ?? '') }} ellipsis>
                    <a onClick={() => navigate(`/apps/kuaicaiwu/finance-management/receivables/${entity.id}`)}>{entity.receivable_code}</a>
                </Typography.Text>
            ),
        },
        {
            title: t(`${P}.col.customerName`),
            dataIndex: 'customer_name',
            width: 200,
            hideInSearch: true,
            sorter: true,
        },
        {
            title: t(`${P}.col.totalAmount`),
            dataIndex: 'total_amount',
            valueType: 'money',
            align: 'right',
            width: 120,
            hideInSearch: true,
            sorter: true,
        },
        {
            title: t(`${P}.col.receivedAmount`),
            dataIndex: 'received_amount',
            valueType: 'money',
            align: 'right',
            width: 120,
            hideInSearch: true,
            sorter: true,
        },
        {
            title: t(`${P}.col.remainingAmount`),
            dataIndex: 'remaining_amount',
            valueType: 'money',
            align: 'right',
            width: 120,
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
            valueEnum: buildReceivableStatusEnum(t),
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
            dataIndex: 'receipt_push_progress',
            width: DOCUMENT_PROGRESS_COLUMN_WIDTH,
            uniTableKeepWidth: true,
            hideInSearch: true,
            render: (_, record) => {
                const percent = receivableReceiptPushPercent(record.received_amount, record.total_amount);
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
        ...financeDocCreatedUpdatedColumns<Receivable>(t),
        {
            title: t('app.kuaicaiwu.common.lifecycle'),
            dataIndex: 'lifecycle_stage',
            fixed: 'right',
            align: 'left',
            width: 130,
            hideInSearch: true,
            render: (_, record) => {
                const lc = getReceivableLifecycle(record as unknown as Record<string, unknown>, t);
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
            valueType: 'option',
            fixed: 'right',
            width: 220,
            render: (_, record) => [
                        <Button {...rowActionKind('read')}
                            key="det"
                            type="link"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => navigate(`/apps/kuaicaiwu/finance-management/receivables/${record.id}`)}
                        >
                            {t('common.detail')}
                        </Button>,
                        <UniWorkflowActions {...rowActionKind('skip')}
                            key="wf"
                            record={record}
                            entityName={t(`${P}.entityName`)}
                            statusField="status"
                            reviewStatusField="review_status"
                            draftStatuses={[]}
                            pendingStatuses={['待审核']}
                            approvedStatuses={['已审核', '通过']}
                            rejectedStatuses={['已驳回', '驳回']}
                            theme="link"
                            size="small"
                            onSuccess={() => actionRef.current?.reload()}
                        />,
                        record.remaining_amount > 0 &&
                        record.capabilities?.push_receipt?.allowed !== false ? (
                            <Button {...rowActionKind('execute')}
                                key="pay"
                                type="link"
                                size="small"
                                icon={<DollarOutlined />}
                                onClick={() => navigate(`/apps/kuaicaiwu/finance-management/receivables/${record.id}`)}
                            >
                                {t('app.kuaicaiwu.common.collect')}
                            </Button>
                        ) : null,
                    ].filter(Boolean) as React.ReactNode[],
        },
    ], [t, navigate, customerOptions]);

    return (
        <ListPageTemplate>
            <UniTable<Receivable>
                headerTitle={t(`${P}.pageTitle`)}
                actionRef={actionRef}
                columns={alignProColumns(columns, SALES_DOC_LIST_FIELD_RANK)}
                columnPersistenceId="apps.kuaicaiwu.pages.finance-management.receivables"
                scroll={{ x: 1680 }}
                request={async (params, sort, _filter, searchFormValues) => {
                    const { current, pageSize } = params;
                    const listParams = resolveReceivableListParams(searchFormValues, sort);
                    lastListParamsRef.current = listParams;
                    const apiParams: ReceivableListParams = {
                        skip: ((current || 1) - 1) * (pageSize || 20),
                        limit: pageSize || 20,
                        ...listParams,
                    };

                    try {
                        const res = await receivableService.listReceivables(apiParams);
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
                        key="create-receivable-with-pull"
                        createIcon={<PlusOutlined />}
                        createLabel={t(`${P}.createTitle`)}
                        onCreate={() => setCreateModalVisible(true)}
                        menuItems={buildKuaicaiwuPullCreateMenuItems([
                            {
                                key: 'pull-from-sales-order',
                                actionKey: 'receivable.pull_from_sales_order',
                                onClick: () => {
                                    pullFromSalesOrderQuery.openModal();
                                },
                            },
                            {
                                key: 'pull-from-sales-delivery',
                                actionKey: 'receivable.pull_from_sales_delivery',
                                onClick: () => {
                                    pullFromSalesDeliveryQuery.openModal();
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
                        key="receivable-batch-audit"
                        selectedRowKeys={selectedRowKeys}
                        selectedRecords={selectedRecordsForBatch}
                        auditEnabled={receivableAuditEnabled}
                        permGates={receivablePerms}
                        handlers={receivableAuditBatchHandlers}
                        onSuccess={handleReceivableAuditBatchSuccess}
                        toolBarButtonSize="middle"
                    />,
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
                        receivableImportTemplate.importHeaderMap,
                    );
                    if (headerIndexMap.customer === undefined || headerIndexMap.amount === undefined) {
                        messageApi.error(t(`${P}.importHeaderError`));
                        return;
                    }
                    const items: ReceivableCreateData[] = [];
                    const importRows = data.slice(2).filter((row: any[]) =>
                        row?.some((c: any) => c != null && String(c).trim() !== ''),
                    );
                    for (const row of importRows) {
                        const custLabel = String(row[headerIndexMap.customer] ?? '').trim();
                        const custOpt = customerOptions.find(o => (o.label || '').trim() === custLabel) ?? customerOptions.find(o => (o.label || '').includes(custLabel));
                        const custId = custOpt?.value;
                        const amount = Number(row[headerIndexMap.amount]) || 0;
                        if (!custId || amount <= 0) continue;
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
                            customer_id: custId,
                            customer_name: custOpt?.label || custLabel,
                            total_amount: amount,
                            received_amount: 0,
                            remaining_amount: amount,
                            due_date: dueDate,
                            business_date: bizDate,
                            status: '未收款',
                            review_status: '待审核',
                        });
                    }
                    if (items.length === 0) {
                        messageApi.warning(t('app.kuaicaiwu.common.importNoValidRows'));
                        return;
                    }
                    const result = await batchImport({
                        items,
                        importFn: async (item) => receivableService.createReceivable(item),
                        title: t(`${P}.importTitle`),
                        concurrency: 5,
                    });
                    if (result.successCount > 0) {
                        messageApi.success(t(`${P}.importSuccess`, { count: result.successCount }));
                        actionRef.current?.reload();
                    }
                    if (result.failureCount > 0) {
                        messageApi.warning(t('app.kuaicaiwu.common.importPartialFail', { count: result.failureCount }));
                    }
                }}
                importHeaders={receivableImportTemplate.importHeaders}
                importExampleRow={receivableImportTemplate.importExampleRow}
                importFieldMap={receivableImportTemplate.importHeaderMap}
                showExportButton
                onExport={async (type, keys, pageData) => {
                    try {
                        let items: Receivable[] = [];
                        if (type === 'currentPage' && pageData?.length) {
                            items = pageData;
                        } else if (type === 'selected' && keys?.length) {
                            const res = await receivableService.listReceivables({
                                skip: 0,
                                limit: 10000,
                                ...lastListParamsRef.current,
                            });
                            items = (res.items || []).filter((d: Receivable) => d.id != null && keys.includes(d.id));
                        } else {
                            const res = await receivableService.listReceivables({
                                skip: 0,
                                limit: 10000,
                                ...lastListParamsRef.current,
                            });
                            items = res.items || [];
                        }
                        if (items.length === 0) {
                            messageApi.warning(t('common.exportNoData'));
                            return;
                        }
                        const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `receivables-${new Date().toISOString().slice(0, 10)}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                        messageApi.success(t('common.exportCountSuccess', { count: items.length }));
                    } catch (error: any) {
                        messageApi.error(error?.message || t('common.exportFailed'));
                    }
                }}
            />

            <UniPullQueryModal<ReceivablePullCandidate>
                open={pullFromSalesOrderQuery.open}
                title={pullFromSalesOrderAction.label}
                onCancel={pullFromSalesOrderQuery.closeModal}
                onOk={() => {
                    void pullFromSalesOrderQuery.handleConfirm();
                }}
                rowKey="id"
                columns={pullTableColumns}
                dataSource={pullFromSalesOrderQuery.dataSource}
                loading={pullFromSalesOrderQuery.loading}
                confirmLoading={pullFromSalesOrderQuery.confirmLoading}
                selectionType={pullFromSalesOrderQuery.selectionType}
                selectedRowKeys={pullFromSalesOrderQuery.selectedRowKeys}
                onSelectedRowKeysChange={pullFromSalesOrderQuery.handleSelectedRowKeysChange}
                isRowDisabled={pullFromSalesOrderQuery.isRowDisabled}
                searchDraft={pullFromSalesOrderQuery.searchDraft}
                onSearchDraftChange={pullFromSalesOrderQuery.setSearchDraft}
                onSearchApply={pullFromSalesOrderQuery.handleSearchApply}
                onSearchClear={pullFromSalesOrderQuery.handleSearchClear}
                appliedKeyword={pullFromSalesOrderQuery.appliedKeyword}
                searchPlaceholder={t(`${P}.pull.searchPlaceholder`)}
                page={pullFromSalesOrderQuery.page}
                pageSize={pullFromSalesOrderQuery.pageSize}
                total={pullFromSalesOrderQuery.total}
                onPageChange={pullFromSalesOrderQuery.handlePageChange}
                okText={t('components.uniLifecycle.nextStep')}
            />

            <UniPullQueryModal<ReceivablePullCandidate>
                open={pullFromSalesDeliveryQuery.open}
                title={pullFromSalesDeliveryAction.label}
                onCancel={pullFromSalesDeliveryQuery.closeModal}
                onOk={() => {
                    void pullFromSalesDeliveryQuery.handleConfirm();
                }}
                rowKey="id"
                columns={pullTableColumns}
                dataSource={pullFromSalesDeliveryQuery.dataSource}
                loading={pullFromSalesDeliveryQuery.loading}
                confirmLoading={pullFromSalesDeliveryQuery.confirmLoading}
                selectionType={pullFromSalesDeliveryQuery.selectionType}
                selectedRowKeys={pullFromSalesDeliveryQuery.selectedRowKeys}
                onSelectedRowKeysChange={pullFromSalesDeliveryQuery.handleSelectedRowKeysChange}
                isRowDisabled={pullFromSalesDeliveryQuery.isRowDisabled}
                searchDraft={pullFromSalesDeliveryQuery.searchDraft}
                onSearchDraftChange={pullFromSalesDeliveryQuery.setSearchDraft}
                onSearchApply={pullFromSalesDeliveryQuery.handleSearchApply}
                onSearchClear={pullFromSalesDeliveryQuery.handleSearchClear}
                appliedKeyword={pullFromSalesDeliveryQuery.appliedKeyword}
                searchPlaceholder={t(`${P}.pull.searchPlaceholder`)}
                page={pullFromSalesDeliveryQuery.page}
                pageSize={pullFromSalesDeliveryQuery.pageSize}
                total={pullFromSalesDeliveryQuery.total}
                onPageChange={pullFromSalesDeliveryQuery.handlePageChange}
                okText={t('components.uniLifecycle.nextStep')}
            />

            <Modal
                title={
                    pullPreviewKind === 'sales_delivery'
                        ? pullFromSalesDeliveryAction.label
                        : pullFromSalesOrderAction.label
                }
                open={pullPreviewOpen}
                destroyOnClose
                width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
                onCancel={resetPullPreview}
                okText={pullPreviewTargetLabel}
                cancelText={t('common.cancel')}
                confirmLoading={pullSubmitting}
                onOk={() => pullFormRef.current?.submit?.()}
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
                                message={receivableCapabilityReasonMessage(pullPreviewData.blocking_reason, t)}
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
                                    { title: t('app.kuaicaiwu.common.customer'), dataIndex: 'customer_name', width: 160, ellipsis: true },
                                    {
                                        title: t(`${P}.pull.col.docAmount`),
                                        dataIndex: 'quantity',
                                        width: 120,
                                        align: 'right',
                                        render: (v: number) => formatPullMoney(v),
                                    },
                                    {
                                        title: t(`${P}.pull.col.receivableAmount`),
                                        dataIndex: 'pushed_quantity',
                                        width: 120,
                                        align: 'right',
                                        render: (v: number) => formatPullMoney(v),
                                    },
                                    {
                                        title: t(`${P}.pull.col.receivableableAmount`),
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
                            <ModalForm
                                formRef={pullFormRef}
                                submitter={false}
                                onFinish={handlePullCreateSubmit}
                                layout="vertical"
                            >
                                <ProFormText name="source_code" label={t(`${P}.pullCol.sourceCode`)} readonly />
                                <ProFormText name="customer_name" label={t('app.kuaicaiwu.common.customer')} readonly />
                                <ProFormMoney
                                    name="total_amount"
                                    label={t(`${P}.col.amount`)}
                                    min={0.01}
                                    max={pullPreviewMaxPush}
                                    rules={[{ required: true, message: t(`${P}.amountRequired`) }]}
                                />
                                <ProFormDatePicker
                                    name="due_date"
                                    label={t('app.kuaicaiwu.common.dueDate')}
                                    rules={[{ required: true }]}
                                    fieldProps={buildFutureDateShortcutFieldProps({
                                        getForm: () => pullFormRef.current,
                                        fieldName: 'due_date',
                                        baseFieldName: 'business_date',
                                        t,
                                    })}
                                />
                                <ProFormDatePicker name="business_date" label={t('app.kuaicaiwu.common.businessDate')} />
                                <ProFormTextArea name="notes" label={t('app.kuaicaiwu.common.notes')} />
                                <DocumentAttachmentsField category="receivable_attachments" />
                            </ModalForm>
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
                width={480}
            >
                <ProFormSelect
                    name="customer_id"
                    label={t('app.kuaicaiwu.common.customer')}
                    options={customerOptions}
                    rules={[{ required: true, message: t('app.kuaicaiwu.common.selectCustomer') }]}
                    placeholder={t('app.kuaicaiwu.common.selectCustomer')}
                />
                <ProFormMoney name="total_amount" label={t(`${P}.col.amount`)} min={0.01} rules={[{ required: true }]} />
                <ProFormDatePicker
                    name="due_date"
                    label={t('app.kuaicaiwu.common.dueDate')}
                    rules={[{ required: true }]}
                    fieldProps={buildFutureDateShortcutFieldProps({
                        getForm: () => createFormRef.current,
                        fieldName: 'due_date',
                        baseFieldName: 'business_date',
                        t,
                    })}
                />
                <ProFormDatePicker name="business_date" label={t('app.kuaicaiwu.common.businessDate')} />
                <ProFormTextArea name="notes" label={t('app.kuaicaiwu.common.notes')} />
                <DocumentAttachmentsField category="receivable_attachments" />
            </ModalForm>
        </ListPageTemplate>
    );
};

export default ReceivableList;
