/**
 * 采购发票列表页
 */
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Typography, Space, Dropdown, Tag } from 'antd';
import { EyeOutlined, PlusOutlined, DownOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '../../../../../services/api';
import { purchaseInvoiceService } from '../../../services/finance/purchase-invoice';
import { PurchaseInvoice } from '../../../types/finance/purchase-invoice';
import { useNavigate } from 'react-router-dom';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import { UniPullQueryModal, useUniPullQuery } from '../../../../../components/uni-pull-query';
import { getChineseInvoiceLifecycle } from '../../../utils/financeLifecycle';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { ModalForm, ProFormDatePicker, ProFormDigit, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import { listPurchaseOrders } from '../../../../kuaizhizao/services/purchase';
import { warehouseApi } from '../../../../kuaizhizao/services/warehouse-execution';
import { buildKuaicaiwuPullCreateMenuItems, getKuaicaiwuDocumentAction } from '../../../constants/documentActionRegistry';
import DocumentAttachmentsField from '../../../../kuaizhizao/components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../../kuaizhizao/utils/documentAttachments';
import { getStatusDisplay } from '../../../../kuaizhizao/constants/documentStatus';
import { buildReviewStatusEnum, getChineseInvoiceTypeOptions } from '../../../utils/financeSharedOptions';
import { formatDateTime } from '../../../../../utils/format';

const P = 'app.kuaicaiwu.purchaseInvoice';

const TAX_RATE_OPTIONS = [
    { label: '13%', value: 13 },
    { label: '9%', value: 9 },
    { label: '6%', value: 6 },
    { label: '1%', value: 1 },
    { label: '0%', value: 0 },
];

type PullPurchaseInvoiceCandidate = {
    source_type: 'purchase_order' | 'purchase_receipt';
    source_id: number;
    source_code: string;
    supplier_id?: number;
    supplier_name?: string;
    purchase_order_id?: number;
    purchase_order_code?: string;
    source_date?: string;
    source_status?: string;
    amount?: number;
    converted?: boolean;
};

const PurchaseInvoiceList: React.FC = () => {
    const actionRef = useRef<ActionType>();
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [pullSubmitting, setPullSubmitting] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [pullFormVisible, setPullFormVisible] = useState(false);
    const [pullSelectedSource, setPullSelectedSource] = useState<PullPurchaseInvoiceCandidate | null>(null);
    const [supplierOptions, setSupplierOptions] = useState<{ label: string; value: number }[]>([]);
    const { message: messageApi } = App.useApp();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const invoiceTypeOptions = useMemo(
        () => getChineseInvoiceTypeOptions(t, { includeOther: true, includeReceipt: false }),
        [t],
    );
    const pullFromPurchaseOrderAction = getKuaicaiwuDocumentAction('purchase_invoice.pull_from_purchase_order');
    const pullFromPurchaseReceiptAction = getKuaicaiwuDocumentAction('purchase_invoice.pull_from_purchase_receipt');

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
 
    const handleRegister = async (values: any) => {
        try {
            const invoiceAmount = Number(values.invoice_amount) || 0;
            const taxRate = Number(values.tax_rate) || 13;
            const taxAmount = Number((invoiceAmount * taxRate / 100).toFixed(2));
            const totalAmount = Number((invoiceAmount + taxAmount).toFixed(2));
            
            const data: any = {
                supplier_id: values.supplier_id,
                supplier_name: supplierOptions.find(o => o.value === values.supplier_id)?.label || '',
                invoice_number: values.invoice_number,
                invoice_date: formatDateTime(values.invoice_date || dayjs(), 'YYYY-MM-DD'),
                invoice_type: values.invoice_type || '增值税专用发票',
                tax_rate: taxRate,
                invoice_amount: invoiceAmount,
                tax_amount: taxAmount,
                total_amount: totalAmount,
                notes: values.notes,
                status: '未审核',
                review_status: '待审核',
                attachments: normalizeDocumentAttachments(values.attachments),
            };

            await purchaseInvoiceService.create(data);
            messageApi.success(t(`${P}.createSuccess`));
            setCreateModalVisible(false);
            actionRef.current?.reload();
            return true;
        } catch (error: any) {
            messageApi.error(error?.message || t(`${P}.registerFailed`));
            return false;
        }
    };

    const fetchExistingPurchaseOrderIdsFromInvoices = async (): Promise<Set<number>> => {
        const ids = new Set<number>();
        const pageSize = 200;
        let skip = 0;
        let total = Infinity;
        while (skip < total) {
            const res = await purchaseInvoiceService.list({ skip, limit: pageSize });
            const items = res?.items || [];
            total = Number(res?.total ?? items.length);
            items.forEach((x: any) => {
                const poId = Number(x?.purchase_order_id || 0);
                if (poId > 0) ids.add(poId);
            });
            if (items.length < pageSize) break;
            skip += pageSize;
        }
        return ids;
    };

    const fetchExistingReceiptNotesFromInvoices = async (): Promise<string[]> => {
        const notes: string[] = [];
        const pageSize = 200;
        let skip = 0;
        let total = Infinity;
        while (skip < total) {
            const res = await purchaseInvoiceService.list({ skip, limit: pageSize });
            const items = res?.items || [];
            total = Number(res?.total ?? items.length);
            items.forEach((x: any) => {
                const note = String(x?.notes || '').trim();
                if (note) notes.push(note);
            });
            if (items.length < pageSize) break;
            skip += pageSize;
        }
        return notes;
    };

    const loadPullCandidatesBySource = async (
        sourceType: 'purchase_order' | 'purchase_receipt',
        keyword: string,
        page: number,
        pageSize: number,
    ): Promise<{ data: PullPurchaseInvoiceCandidate[]; total: number }> => {
        const kw = keyword.trim().toLowerCase();
        if (sourceType === 'purchase_order') {
            const invoicePoIdSet = await fetchExistingPurchaseOrderIdsFromInvoices();
            const poRes = await listPurchaseOrders({ skip: 0, limit: 200, keyword: kw || undefined });
            const rows = (poRes?.data || []).map((po: any) => {
                const code = String(po.order_code || po.code || po.id || '');
                return {
                    source_type: 'purchase_order' as const,
                    source_id: Number(po.id),
                    source_code: code,
                    supplier_id: po.supplier_id,
                    supplier_name: po.supplier_name,
                    purchase_order_id: Number(po.id),
                    purchase_order_code: code,
                    source_date: po.order_date,
                    source_status: po.status,
                    amount: Number(po.total_amount || 0),
                    converted: invoicePoIdSet.has(Number(po.id)),
                };
            });
            const filtered = rows.filter((r: PullPurchaseInvoiceCandidate) => (kw ? `${r.source_code} ${r.supplier_name || ''}`.toLowerCase().includes(kw) : true));
            const start = (page - 1) * pageSize;
            return { data: filtered.slice(start, start + pageSize), total: filtered.length };
        }

        const invoiceNotes = await fetchExistingReceiptNotesFromInvoices();
        const receiptRes: any = await warehouseApi.purchaseReceipt.list({ skip: 0, limit: 200, keyword: kw || undefined });
        const receiptList = Array.isArray(receiptRes) ? receiptRes : (receiptRes?.data || []);
        const rows = receiptList.map((pr: any) => {
            const receiptCode = String(pr.receipt_code || pr.code || pr.id || '');
            const poId = Number(pr.purchase_order_id || 0);
            const noteHit = invoiceNotes.some((n: string) => n.includes(receiptCode));
            return {
                source_type: 'purchase_receipt' as const,
                source_id: Number(pr.id),
                source_code: receiptCode,
                supplier_id: pr.supplier_id,
                supplier_name: pr.supplier_name,
                purchase_order_id: poId || undefined,
                purchase_order_code: pr.purchase_order_code,
                source_date: pr.receipt_time || pr.receipt_date || pr.created_at,
                source_status: pr.status,
                amount: Number(pr.total_amount || 0),
                converted: noteHit,
            };
        });
        const filtered = rows.filter((r: PullPurchaseInvoiceCandidate) => (kw ? `${r.source_code} ${r.supplier_name || ''}`.toLowerCase().includes(kw) : true));
        const start = (page - 1) * pageSize;
        return { data: filtered.slice(start, start + pageSize), total: filtered.length };
    };

    const openPullFormFromRows = (
        sourceType: 'purchase_order' | 'purchase_receipt',
        keys: React.Key[],
        rows: PullPurchaseInvoiceCandidate[],
        closeModal: () => void,
    ) => {
        const selected = rows.find((x) => String(x.source_id) === String(keys[0]));
        if (!selected) {
            messageApi.warning(t('app.kuaicaiwu.common.selectSource', {
                source: sourceType === 'purchase_order'
                    ? pullFromPurchaseOrderAction.sourceLabel
                    : pullFromPurchaseReceiptAction.sourceLabel,
            }));
            return;
        }
        if (selected.converted) {
            messageApi.warning(t(`${P}.sourceConverted`, {
                source: sourceType === 'purchase_order'
                    ? pullFromPurchaseOrderAction.sourceLabel
                    : pullFromPurchaseReceiptAction.sourceLabel,
                target: pullFromPurchaseOrderAction.targetLabel,
            }));
            return;
        }
        const invoiceAmount = Number(selected.amount || 0);
        if (invoiceAmount <= 0) {
            messageApi.warning(t(`${P}.zeroAmount`, { target: pullFromPurchaseOrderAction.targetLabel }));
            return;
        }
        setPullSelectedSource(selected);
        closeModal();
        setPullFormVisible(true);
    };

    const pullFromPurchaseOrderQuery = useUniPullQuery<PullPurchaseInvoiceCandidate>({
        rowKey: 'source_id',
        selectionType: 'radio',
        isRowDisabled: (record) => !!record.converted,
        loadData: async ({ keyword, page, pageSize }) => {
            try {
                return await loadPullCandidatesBySource('purchase_order', keyword, page, pageSize);
            } catch (e: any) {
                messageApi.error(e?.response?.data?.detail?.message || e?.response?.data?.detail || e?.message || t(`${P}.loadSourceFailed`));
                return { data: [], total: 0 };
            }
        },
        onConfirm: async (keys, rows) => {
            openPullFormFromRows('purchase_order', keys, rows, pullFromPurchaseOrderQuery.closeModal);
        },
    });

    const pullFromPurchaseReceiptQuery = useUniPullQuery<PullPurchaseInvoiceCandidate>({
        rowKey: 'source_id',
        selectionType: 'radio',
        isRowDisabled: (record) => !!record.converted,
        loadData: async ({ keyword, page, pageSize }) => {
            try {
                return await loadPullCandidatesBySource('purchase_receipt', keyword, page, pageSize);
            } catch (e: any) {
                messageApi.error(e?.response?.data?.detail?.message || e?.response?.data?.detail || e?.message || t(`${P}.loadSourceFailed`));
                return { data: [], total: 0 };
            }
        },
        onConfirm: async (keys, rows) => {
            openPullFormFromRows('purchase_receipt', keys, rows, pullFromPurchaseReceiptQuery.closeModal);
        },
    });

    const handlePullCreateSubmit = async (values: any) => {
        if (!pullSelectedSource) return false;
        const invoiceAmount = Number(values.invoice_amount) || 0;
        if (invoiceAmount <= 0) {
            messageApi.warning(t(`${P}.amountRequired`));
            return false;
        }
        const taxRate = Number(values.tax_rate) || 13;
        const taxAmount = Number((invoiceAmount * taxRate / 100).toFixed(2));
        const totalAmount = Number((invoiceAmount + taxAmount).toFixed(2));
        const sourceLabel = pullSelectedSource.source_type === 'purchase_order'
            ? pullFromPurchaseOrderAction.sourceLabel
            : pullFromPurchaseReceiptAction.sourceLabel;
        setPullSubmitting(true);
        try {
            await purchaseInvoiceService.create({
                purchase_order_id: pullSelectedSource.purchase_order_id,
                purchase_order_code: pullSelectedSource.purchase_order_code || undefined,
                supplier_id: Number(pullSelectedSource.supplier_id || 0),
                supplier_name: pullSelectedSource.supplier_name || '',
                invoice_number: String(values.invoice_number ?? '').trim(),
                invoice_date: formatDateTime(values.invoice_date || dayjs(), 'YYYY-MM-DD'),
                invoice_type: values.invoice_type || '增值税专用发票',
                tax_rate: taxRate,
                invoice_amount: invoiceAmount,
                tax_amount: taxAmount,
                total_amount: totalAmount,
                notes: String(values.notes ?? '').trim() || t('app.kuaicaiwu.common.createdFromSourceNote', {
                    source: sourceLabel,
                    code: pullSelectedSource.source_code,
                }),
                status: '未审核',
                review_status: '待审核',
                attachments: normalizeDocumentAttachments(values.attachments),
            });
            messageApi.success(t(`${P}.pullCreateSuccess`, { target: pullFromPurchaseOrderAction.targetLabel }));
            setPullFormVisible(false);
            setPullSelectedSource(null);
            setSelectedPullSourceId(null);
            actionRef.current?.reload();
            return true;
        } catch (e: any) {
            messageApi.error(e?.response?.data?.detail || e?.message || t('common.createFailed'));
            return false;
        } finally {
            setPullSubmitting(false);
        }
    };

    const handleBatchApprove = async (keys: React.Key[]) => {
        try {
            for (const id of keys) {
                await purchaseInvoiceService.approve(Number(id));
            }
            messageApi.success(t(`${P}.batchApproveSuccess`, { count: keys.length }));
            setSelectedRowKeys([]);
            actionRef.current?.reload();
        } catch (error: any) {
            messageApi.error(error?.message || t('app.kuaicaiwu.common.batchApproveFailed'));
        }
    };

    const columns: ProColumns<PurchaseInvoice>[] = useMemo(() => [
        {
            title: t(`${P}.col.code`),
            dataIndex: 'invoice_code',
            width: 168,
            fixed: 'left',
            render: (_, entity) => (
                <Typography.Text copyable={{ text: String(entity.invoice_code ?? '') }} ellipsis>
                    <a onClick={() => navigate(`/apps/kuaicaiwu/finance-management/purchase-invoices/${entity.id}`)}>{entity.invoice_code}</a>
                </Typography.Text>
            ),
        },
        {
            title: t(`${P}.col.purchaseOrder`),
            dataIndex: 'purchase_order_code',
            width: 150,
        },
        {
            title: t('app.kuaicaiwu.common.supplier'),
            dataIndex: 'supplier_name',
            width: 200,
        },
        {
            title: t(`${P}.col.invoiceNumber`),
            dataIndex: 'invoice_number',
            width: 120,
        },
        {
            title: t(`${P}.col.totalAmount`),
            dataIndex: 'total_amount',
            valueType: 'money',
            align: 'right',
            width: 120,
        },
        {
            title: t('app.kuaicaiwu.common.invoiceDate'),
            dataIndex: 'invoice_date',
            valueType: 'date',
            width: 120,
        },
        {
            title: t('common.status'),
            dataIndex: 'status',
            hideInTable: true,
        },
        {
            title: t('app.kuaicaiwu.common.reviewStatus'),
            dataIndex: 'review_status',
            hideInTable: true,
            valueEnum: buildReviewStatusEnum(t),
        },
        {
            title: t('app.kuaicaiwu.common.lifecycle'),
            dataIndex: 'lifecycle_stage',
            fixed: 'right',
            align: 'left',
            width: 130,
            hideInSearch: true,
            render: (_, record) => {
                const lc = getChineseInvoiceLifecycle(record as unknown as Record<string, unknown>, t);
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
            width: 200,
            render: (_, record) => [
                        <Button {...rowActionKind('read')}
                            key="det"
                            type="link"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => navigate(`/apps/kuaicaiwu/finance-management/purchase-invoices/${record.id}`)}
                        >
                            {t('common.detail')}
                        </Button>,
                        record.review_status === '待审核' ? (
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
                            />
                        ) : null,
                    ].filter(Boolean) as React.ReactNode[],
        },
    ], [t, navigate]);

    const pullTableColumns = useMemo(() => [
        { title: t(`${P}.pull.col.sourceCode`), dataIndex: 'source_code', width: 220, ellipsis: true },
        { title: t('app.kuaicaiwu.common.supplier'), dataIndex: 'supplier_name', width: 220, ellipsis: true },
        {
            title: t(`${P}.pull.col.docStatus`),
            dataIndex: 'source_status',
            width: 130,
            align: 'center' as const,
            render: (v: unknown) => {
                const { text, color } = getStatusDisplay(v);
                return text === '-' ? '-' : <Tag color={color}>{text}</Tag>;
            },
        },
        {
            title: t('app.kuaicaiwu.common.businessDate'),
            dataIndex: 'source_date',
            width: 130,
            render: (v: unknown) => (v ? formatDateTime(String(v), 'YYYY-MM-DD') : '-'),
        },
        {
            title: t(`${P}.col.amount`),
            dataIndex: 'amount',
            width: 140,
            align: 'right' as const,
            render: (v: unknown) => `¥${Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`,
        },
        {
            title: t(`${P}.pull.col.convertStatus`),
            key: 'convert_status',
            width: 140,
            align: 'center' as const,
            render: (_: unknown, r: PullPurchaseInvoiceCandidate) => (
                r.converted
                    ? <Tag color="gold">{t(`${P}.pull.converted`)}</Tag>
                    : <Tag color="success">{t(`${P}.pull.convertible`)}</Tag>
            ),
        },
    ], [t]);

    return (
        <ListPageTemplate>
            <UniTable<PurchaseInvoice>
                headerTitle={t(`${P}.pageTitle`)}
                actionRef={actionRef}
                enableRowSelection
                selectedRowKeys={selectedRowKeys}
                onRowSelectionChange={setSelectedRowKeys}
                columns={columns}
                columnPersistenceId="apps.kuaicaiwu.pages.finance-management.purchase-invoices"
                scroll={{ x: 1600 }}
                showAdvancedSearch
                request={async (params) => {
                    const { current, pageSize, ...rest } = params;
                    try {
                        const res = await purchaseInvoiceService.list({
                            skip: ((current || 1) - 1) * (pageSize || 20),
                            limit: pageSize || 20,
                            ...rest,
                        });
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
                rowKey="id"
                showCreateButton={false}
                createButtonText={t(`${P}.createButton`)}
                onCreate={() => setCreateModalVisible(true)}
                toolBarActionsAfterBatch={[
                    <UniBatchMenuButton
                        key="purchase-invoice-batch-actions"
                        selectedRowKeys={selectedRowKeys}
                        buttonText={t('components.uniBatch.batchActions')}
                        menuItems={[
                            {
                                key: 'batch-approve',
                                label: t('app.kuaicaiwu.common.batchApprove'),
                                requireConfirm: true,
                                confirmTitle: (count) => t(`${P}.batchApproveTitle`, { count }),
                                confirmDescription: t('app.kuaicaiwu.common.batchOnlyPendingApprove'),
                                onClick: handleBatchApprove,
                            },
                        ]}
                    />,
                ]}
                toolBarRender={() => [
                    <UniPullCreateToolbar
                        compactKey="create-purchase-invoice-with-pull"
                        createIcon={<PlusOutlined />}
                        createLabel={t(`${P}.createButton`)}
                        onCreate={() => setCreateModalVisible(true)}
                        menuItems={buildKuaicaiwuPullCreateMenuItems([
                            {
                                key: 'pull-from-po',
                                actionKey: 'purchase_invoice.pull_from_purchase_order',
                                onClick: pullFromPurchaseOrderQuery.openModal,
                            },
                            {
                                key: 'pull-from-pr',
                                actionKey: 'purchase_invoice.pull_from_purchase_receipt',
                                onClick: pullFromPurchaseReceiptQuery.openModal,
                            },
                        ])}
                    />,
                ]}
            />

            <UniPullQueryModal<PullPurchaseInvoiceCandidate>
                open={pullFromPurchaseOrderQuery.open}
                title={pullFromPurchaseOrderAction.label}
                onCancel={pullFromPurchaseOrderQuery.closeModal}
                onOk={pullFromPurchaseOrderQuery.handleConfirm}
                rowKey="source_id"
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
                okText={t('common.next')}
                width={1180}
            />

            <UniPullQueryModal<PullPurchaseInvoiceCandidate>
                open={pullFromPurchaseReceiptQuery.open}
                title={pullFromPurchaseReceiptAction.label}
                onCancel={pullFromPurchaseReceiptQuery.closeModal}
                onOk={pullFromPurchaseReceiptQuery.handleConfirm}
                rowKey="source_id"
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
                okText={t('common.next')}
                width={1180}
            />

            <ModalForm
                title={t(`${P}.pullFormTitle`)}
                open={pullFormVisible}
                onOpenChange={(open) => {
                    if (pullSubmitting) return;
                    setPullFormVisible(open);
                    if (!open) {
                        setPullSelectedSource(null);
                    }
                }}
                onFinish={handlePullCreateSubmit}
                width={560}
                modalProps={{ destroyOnHidden: true }}
                submitter={{ submitButtonProps: { loading: pullSubmitting } }}
                initialValues={
                    pullSelectedSource
                        ? {
                            source_code: pullSelectedSource.source_code,
                            supplier_name: pullSelectedSource.supplier_name,
                            invoice_date: pullSelectedSource.source_date ? dayjs(pullSelectedSource.source_date) : dayjs(),
                            invoice_type: '增值税专用发票',
                            tax_rate: 13,
                            invoice_amount: pullSelectedSource.amount,
                            notes: t('app.kuaicaiwu.common.createdFromSourceNote', {
                                source: pullSelectedSource.source_type === 'purchase_order'
                                    ? pullFromPurchaseOrderAction.sourceLabel
                                    : pullFromPurchaseReceiptAction.sourceLabel,
                                code: pullSelectedSource.source_code,
                            }),
                        }
                        : undefined
                }
            >
                <ProFormText name="source_code" label={t('app.kuaicaiwu.common.sourceDoc')} readonly />
                <ProFormText name="supplier_name" label={t('app.kuaicaiwu.common.supplier')} readonly />
                <ProFormText
                    name="invoice_number"
                    label={t(`${P}.col.invoiceNumber`)}
                    rules={[{ required: true, message: t(`${P}.form.invoiceNumberRequired`) }]}
                    placeholder={t(`${P}.form.invoiceNumberPlaceholder`)}
                />
                <ProFormSelect
                    name="invoice_type"
                    label={t(`${P}.col.invoiceType`)}
                    options={invoiceTypeOptions}
                    rules={[{ required: true, message: t(`${P}.form.invoiceTypeRequired`) }]}
                />
                <ProFormDatePicker
                    name="invoice_date"
                    label={t('app.kuaicaiwu.common.invoiceDate')}
                    rules={[{ required: true, message: t(`${P}.form.invoiceDateRequired`) }]}
                    fieldProps={{ style: { width: '100%' } }}
                />
                <ProFormSelect
                    name="tax_rate"
                    label={t(`${P}.col.taxRate`)}
                    options={TAX_RATE_OPTIONS}
                    rules={[{ required: true, message: t(`${P}.form.taxRateRequired`) }]}
                />
                <ProFormDigit
                    name="invoice_amount"
                    label={t(`${P}.col.exclTax`)}
                    min={0}
                    rules={[{ required: true, message: t(`${P}.form.exTaxAmountRequired`) }]}
                    fieldProps={{ precision: 2, style: { width: '100%' } }}
                />
                <ProFormTextArea name="notes" label={t('app.kuaicaiwu.common.notes')} fieldProps={{ rows: 3 }} />
                <DocumentAttachmentsField category="purchase_invoice_attachments" />
            </ModalForm>

            <ModalForm
                title={t(`${P}.createTitle`)}
                open={createModalVisible}
                onOpenChange={setCreateModalVisible}
                onFinish={handleRegister}
                width={520}
            >
                <div style={{ marginBottom: 16 }}>
                    <p style={{ color: '#8c8c8c', fontSize: '13px' }}>{t(`${P}.createHint`)}</p>
                </div>
                <ProFormSelect
                    name="supplier_id"
                    label={t('app.kuaicaiwu.common.supplier')}
                    options={supplierOptions}
                    rules={[{ required: true, message: t('app.kuaicaiwu.common.selectSupplier') }]}
                    placeholder={t('app.kuaicaiwu.common.selectSupplier')}
                    showSearch
                />
                <ProFormText
                    name="invoice_number"
                    label={t(`${P}.col.invoiceNumber`)}
                    rules={[{ required: true, message: t(`${P}.form.invoiceNumberRequired`) }]}
                    placeholder={t(`${P}.form.invoiceNumberPlaceholder`)}
                />
                <ProFormSelect
                    name="invoice_type"
                    label={t(`${P}.col.invoiceType`)}
                    options={invoiceTypeOptions}
                    initialValue="增值税专用发票"
                    rules={[{ required: true }]}
                />
                <ProFormDatePicker name="invoice_date" label={t('app.kuaicaiwu.common.invoiceDate')} rules={[{ required: true }]} initialValue={dayjs()} fieldProps={{ style: { width: '100%' } }} />
                <ProFormDigit
                    name="tax_rate"
                    label={t(`${P}.col.taxRate`)}
                    initialValue={13}
                    min={0}
                    max={100}
                    rules={[{ required: true }]}
                    fieldProps={{ style: { width: '100%' } }}
                />
                <ProFormDigit
                    name="invoice_amount"
                    label={t(`${P}.col.exclTax`)}
                    min={0}
                    rules={[{ required: true, message: t(`${P}.form.exTaxAmountRequired`) }]}
                    fieldProps={{ precision: 2, style: { width: '100%' } }}
                />
                <ProFormTextArea name="notes" label={t('app.kuaicaiwu.common.notes')} />
                <DocumentAttachmentsField category="purchase_invoice_attachments" />
            </ModalForm>
        </ListPageTemplate>
    );
};

export default PurchaseInvoiceList;
