/**
 * 采购发票列表页
 */
import React, { useRef, useState, useEffect } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Typography, Space, Dropdown, Modal, Input, Table, Tag } from 'antd';
import { EyeOutlined, PlusOutlined, DownOutlined } from '@ant-design/icons';
import { apiRequest } from '../../../../../services/api';
import { purchaseInvoiceService } from '../../../services/finance/purchase-invoice';
import { PurchaseInvoice } from '../../../types/finance/purchase-invoice';
import { useNavigate } from 'react-router-dom';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import { getChineseInvoiceLifecycle } from '../../../utils/financeLifecycle';
import { renderRowActionsOverflow } from '../../../utils/renderRowActionsOverflow';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { ModalForm, ProFormDatePicker, ProFormDigit, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import { listPurchaseOrders } from '../../../../kuaizhizao/services/purchase';
import { warehouseApi } from '../../../../kuaizhizao/services/warehouse-execution';
import { buildKuaicaiwuPullCreateMenuItems, getKuaicaiwuDocumentAction } from '../../../constants/documentActionRegistry';
import { getStatusDisplay } from '../../../../kuaizhizao/constants/documentStatus';
import { INVOICE_TYPE_OPTIONS } from '../../../utils/purchaseInvoiceUi';

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
    const [pullVisible, setPullVisible] = useState(false);
    const [pullLoading, setPullLoading] = useState(false);
    const [pullSubmitting, setPullSubmitting] = useState(false);
    const [pullKeyword, setPullKeyword] = useState('');
    const [pullSourceType, setPullSourceType] = useState<'purchase_order' | 'purchase_receipt'>('purchase_order');
    const [pullCandidates, setPullCandidates] = useState<PullPurchaseInvoiceCandidate[]>([]);
    const [selectedPullSourceId, setSelectedPullSourceId] = useState<number | null>(null);
    const [pullFormVisible, setPullFormVisible] = useState(false);
    const [pullSelectedSource, setPullSelectedSource] = useState<PullPurchaseInvoiceCandidate | null>(null);
    const [supplierOptions, setSupplierOptions] = useState<{ label: string; value: number }[]>([]);
    const { message: messageApi } = App.useApp();
    const navigate = useNavigate();
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
                invoice_date: values.invoice_date?.format ? values.invoice_date.format('YYYY-MM-DD') : (values.invoice_date || dayjs().format('YYYY-MM-DD')),
                invoice_type: values.invoice_type || '增值税专用发票',
                tax_rate: taxRate,
                invoice_amount: invoiceAmount,
                tax_amount: taxAmount,
                total_amount: totalAmount,
                notes: values.notes,
                status: '未审核',
                review_status: '待审核',
            };

            await purchaseInvoiceService.create(data);
            messageApi.success('采购发票登记成功');
            setCreateModalVisible(false);
            actionRef.current?.reload();
            return true;
        } catch (error: any) {
            messageApi.error(error?.message || '登记失败');
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

    const loadPullCandidates = async (sourceType: 'purchase_order' | 'purchase_receipt', keyword = '') => {
        setPullLoading(true);
        try {
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
                setPullCandidates(rows.filter((r: PullPurchaseInvoiceCandidate) => (kw ? `${r.source_code} ${r.supplier_name || ''}`.toLowerCase().includes(kw) : true)));
            } else {
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
                setPullCandidates(rows.filter((r: PullPurchaseInvoiceCandidate) => (kw ? `${r.source_code} ${r.supplier_name || ''}`.toLowerCase().includes(kw) : true)));
            }
        } catch (e: any) {
            setPullCandidates([]);
            messageApi.error(e?.response?.data?.detail?.message || e?.response?.data?.detail || e?.message || '加载来源单失败');
        } finally {
            setPullLoading(false);
        }
    };

    const openPullModal = async (sourceType: 'purchase_order' | 'purchase_receipt') => {
        setPullSourceType(sourceType);
        setPullKeyword('');
        setSelectedPullSourceId(null);
        setPullVisible(true);
        await loadPullCandidates(sourceType, '');
    };

    const handlePullNext = () => {
        if (!selectedPullSourceId) {
            messageApi.warning(`请选择${pullSourceType === 'purchase_order' ? pullFromPurchaseOrderAction.sourceLabel : pullFromPurchaseReceiptAction.sourceLabel}`);
            return;
        }
        const selected = pullCandidates.find((x) => x.source_id === selectedPullSourceId);
        if (!selected) return;
        if (selected.converted) {
            messageApi.warning(`该${pullSourceType === 'purchase_order' ? pullFromPurchaseOrderAction.sourceLabel : pullFromPurchaseReceiptAction.sourceLabel}已创建${pullFromPurchaseOrderAction.targetLabel}，请勿重复创建`);
            return;
        }
        const invoiceAmount = Number(selected.amount || 0);
        if (invoiceAmount <= 0) {
            messageApi.warning(`源单据金额为 0，无法创建${pullFromPurchaseOrderAction.targetLabel}`);
            return;
        }
        setPullSelectedSource(selected);
        setPullVisible(false);
        setPullFormVisible(true);
    };

    const handlePullCreateSubmit = async (values: any) => {
        if (!pullSelectedSource) return false;
        const invoiceAmount = Number(values.invoice_amount) || 0;
        if (invoiceAmount <= 0) {
            messageApi.warning('不含税金额必须大于 0');
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
                invoice_date: values.invoice_date?.format
                    ? values.invoice_date.format('YYYY-MM-DD')
                    : (values.invoice_date || dayjs().format('YYYY-MM-DD')),
                invoice_type: values.invoice_type || '增值税专用发票',
                tax_rate: taxRate,
                invoice_amount: invoiceAmount,
                tax_amount: taxAmount,
                total_amount: totalAmount,
                notes: String(values.notes ?? '').trim() || `从${sourceLabel} ${pullSelectedSource.source_code} 创建`,
                status: '未审核',
                review_status: '待审核',
            });
            messageApi.success(`已创建${pullFromPurchaseOrderAction.targetLabel}`);
            setPullFormVisible(false);
            setPullSelectedSource(null);
            setSelectedPullSourceId(null);
            actionRef.current?.reload();
            return true;
        } catch (e: any) {
            messageApi.error(e?.response?.data?.detail || e?.message || '创建失败');
            return false;
        } finally {
            setPullSubmitting(false);
        }
    };

    const columns: ProColumns<PurchaseInvoice>[] = [
        {
            title: '发票编号',
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
            title: '采购订单',
            dataIndex: 'purchase_order_code',
            width: 150,
        },
        {
            title: '供应商',
            dataIndex: 'supplier_name',
            width: 200,
        },
        {
            title: '发票号码',
            dataIndex: 'invoice_number',
            width: 120,
        },
        {
            title: '价税合计',
            dataIndex: 'total_amount',
            valueType: 'money',
            align: 'right',
            width: 120,
        },
        {
            title: '开票日期',
            dataIndex: 'invoice_date',
            valueType: 'date',
            width: 120,
        },
        {
            title: '状态',
            dataIndex: 'status',
            hideInTable: true,
        },
        {
            title: '审核状态',
            dataIndex: 'review_status',
            hideInTable: true,
            valueEnum: {
                '待审核': { text: '待审核' },
                '已审核': { text: '已审核' },
                '已驳回': { text: '已驳回' },
                '通过': { text: '已审核' },
                '驳回': { text: '已驳回' },
            },
        },
        {
            title: '生命周期',
            dataIndex: 'lifecycle_stage',
            fixed: 'right',
            align: 'left',
            width: 130,
            hideInSearch: true,
            render: (_, record) => {
                const lc = getChineseInvoiceLifecycle(record as unknown as Record<string, unknown>);
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
            title: '操作',
            valueType: 'option',
            fixed: 'right',
            width: 200,
            render: (_, record) =>
                renderRowActionsOverflow(
                    [
                        <Button {...rowActionKind('read')}
                            key="det"
                            type="link"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => navigate(`/apps/kuaicaiwu/finance-management/purchase-invoices/${record.id}`)}
                        >
                            详情
                        </Button>,
                        record.review_status === '待审核' ? (
                            <UniWorkflowActions {...rowActionKind('skip')}
                                key="wf"
                                record={record}
                                entityName="采购发票"
                                statusField="status"
                                reviewStatusField="review_status"
                                draftStatuses={[]}
                                pendingStatuses={['待审核']}
                                approvedStatuses={['已审核', '通过']}
                                rejectedStatuses={['已驳回', '驳回']}
                                theme="link"
                                size="small"
                                actions={{
                                    approve: (id) => purchaseInvoiceService.approve(id),
                                    reject: (id, reason) => purchaseInvoiceService.approve(id, reason),
                                }}
                                onSuccess={() => actionRef.current?.reload()}
                            />
                        ) : null,
                    ].filter(Boolean) as React.ReactNode[],
                    `pi-${record.id}`,
                ),
        },
    ];

    return (
        <ListPageTemplate>
            <UniTable<PurchaseInvoice>
                headerTitle="采购发票"
                actionRef={actionRef}
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
                        messageApi.error(error?.message || '获取列表失败');
                        return { data: [], total: 0, success: false };
                    }
                }}
                rowKey="id"
                showCreateButton={false}
                createButtonText="登记采购发票"
                onCreate={() => setCreateModalVisible(true)}
                toolBarRender={() => [
                    <UniPullCreateToolbar
                        compactKey="create-purchase-invoice-with-pull"
                        createIcon={<PlusOutlined />}
                        createLabel="登记采购发票"
                        onCreate={() => setCreateModalVisible(true)}
                        menuItems={buildKuaicaiwuPullCreateMenuItems([
                            {
                                key: 'pull-from-po',
                                actionKey: 'purchase_invoice.pull_from_purchase_order',
                                onClick: () => {
                                    void openPullModal('purchase_order');
                                },
                            },
                            {
                                key: 'pull-from-pr',
                                actionKey: 'purchase_invoice.pull_from_purchase_receipt',
                                onClick: () => {
                                    void openPullModal('purchase_receipt');
                                },
                            },
                        ])}
                    />,
                ]}
            />

            <Modal
                title={pullSourceType === 'purchase_order' ? pullFromPurchaseOrderAction.label : pullFromPurchaseReceiptAction.label}
                open={pullVisible}
                width={1180}
                onCancel={() => {
                    if (pullSubmitting) return;
                    setPullVisible(false);
                    setSelectedPullSourceId(null);
                }}
                onOk={() => {
                    void handlePullNext();
                }}
                okText="下一步"
                confirmLoading={false}
                destroyOnHidden
            >
                <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                    <Input.Search
                        allowClear
                        placeholder="按单号/供应商搜索"
                        value={pullKeyword}
                        onChange={(e) => setPullKeyword(e.target.value)}
                        onSearch={(value) => {
                            setPullKeyword(value);
                            void loadPullCandidates(pullSourceType, value);
                        }}
                        enterButton="搜索"
                    />
                    <Table<PullPurchaseInvoiceCandidate>
                        rowKey={(r) => `${r.source_type}-${r.source_id}`}
                        loading={pullLoading}
                        dataSource={pullCandidates}
                        pagination={false}
                        scroll={{ x: 1100, y: 360 }}
                        rowSelection={{
                            type: 'radio',
                            selectedRowKeys: selectedPullSourceId ? [`${pullSourceType}-${selectedPullSourceId}`] : [],
                            onChange: (keys) => {
                                const key = String(keys?.[0] || '');
                                const id = Number(key.split('-').slice(-1)[0]);
                                if (Number.isFinite(id)) setSelectedPullSourceId(id);
                                else setSelectedPullSourceId(null);
                            },
                            getCheckboxProps: (record) => ({ disabled: !!record.converted }),
                        }}
                        onRow={(record) => ({
                            onClick: () => {
                                if (record.converted) return;
                                setSelectedPullSourceId(record.source_id);
                            },
                        })}
                        columns={[
                            { title: '源单号', dataIndex: 'source_code', width: 220, ellipsis: true },
                            { title: '供应商', dataIndex: 'supplier_name', width: 220, ellipsis: true },
                            {
                                title: '单据状态',
                                dataIndex: 'source_status',
                                width: 130,
                                align: 'center',
                                render: (v) => {
                                    const { text, color } = getStatusDisplay(v);
                                    return text === '-' ? '-' : <Tag color={color}>{text}</Tag>;
                                },
                            },
                            { title: '业务日期', dataIndex: 'source_date', width: 130, render: (v) => (v ? dayjs(v).format('YYYY-MM-DD') : '-') },
                            {
                                title: '金额',
                                dataIndex: 'amount',
                                width: 140,
                                align: 'right',
                                render: (v) => `¥${Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`,
                            },
                            {
                                title: '转单状态',
                                key: 'convert_status',
                                width: 140,
                                align: 'center',
                                render: (_, r) => (r.converted ? <Tag color="gold">已创建</Tag> : <Tag color="success">可创建</Tag>),
                            },
                        ]}
                    />
                </Space>
            </Modal>

            <ModalForm
                title="填写采购发票信息"
                open={pullFormVisible}
                onOpenChange={(open) => {
                    if (pullSubmitting) return;
                    setPullFormVisible(open);
                    if (!open) {
                        setPullSelectedSource(null);
                        setSelectedPullSourceId(null);
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
                            notes: `从${
                                pullSelectedSource.source_type === 'purchase_order'
                                    ? pullFromPurchaseOrderAction.sourceLabel
                                    : pullFromPurchaseReceiptAction.sourceLabel
                            } ${pullSelectedSource.source_code} 创建`,
                        }
                        : undefined
                }
            >
                <ProFormText name="source_code" label="来源单号" readonly />
                <ProFormText name="supplier_name" label="供应商" readonly />
                <ProFormText
                    name="invoice_number"
                    label="发票号码"
                    rules={[{ required: true, message: '请输入发票号码' }]}
                    placeholder="请输入票面号码"
                />
                <ProFormSelect
                    name="invoice_type"
                    label="发票类型"
                    options={INVOICE_TYPE_OPTIONS}
                    rules={[{ required: true, message: '请选择发票类型' }]}
                />
                <ProFormDatePicker
                    name="invoice_date"
                    label="开票日期"
                    rules={[{ required: true, message: '请选择开票日期' }]}
                    fieldProps={{ style: { width: '100%' } }}
                />
                <ProFormSelect
                    name="tax_rate"
                    label="税率"
                    options={TAX_RATE_OPTIONS}
                    rules={[{ required: true, message: '请选择税率' }]}
                />
                <ProFormDigit
                    name="invoice_amount"
                    label="不含税金额"
                    min={0}
                    rules={[{ required: true, message: '请输入不含税金额' }]}
                    fieldProps={{ precision: 2, style: { width: '100%' } }}
                />
                <ProFormTextArea name="notes" label="备注" fieldProps={{ rows: 3 }} />
            </ModalForm>

            <ModalForm
                title="手动登记采购发票"
                open={createModalVisible}
                onOpenChange={setCreateModalVisible}
                onFinish={handleRegister}
                width={520}
            >
                <div style={{ marginBottom: 16 }}>
                    <p style={{ color: '#8c8c8c', fontSize: '13px' }}>提示：如果是从采购订单转发票，请在采购订单页面点击“下推发票”。此操作用于直接登记收到的进项发票。</p>
                </div>
                <ProFormSelect
                    name="supplier_id"
                    label="供应商"
                    options={supplierOptions}
                    rules={[{ required: true, message: '请选择供应商' }]}
                    placeholder="请选择供应商"
                    showSearch
                />
                <ProFormText
                    name="invoice_number"
                    label="发票号码"
                    rules={[{ required: true, message: '请输入发票号码' }]}
                    placeholder="请输入票面号码"
                />
                <ProFormSelect
                    name="invoice_type"
                    label="发票类型"
                    options={[
                        { label: '增值税专用发票', value: '增值税专用发票' },
                        { label: '增值税普通发票', value: '增值税普通发票' },
                        { label: '其他', value: '其他' },
                    ]}
                    initialValue="增值税专用发票"
                    rules={[{ required: true }]}
                />
                <ProFormDatePicker name="invoice_date" label="开票日期" rules={[{ required: true }]} initialValue={dayjs()} fieldProps={{ style: { width: '100%' } }} />
                <ProFormDigit
                    name="tax_rate"
                    label="税率(%)"
                    initialValue={13}
                    min={0}
                    max={100}
                    rules={[{ required: true }]}
                    fieldProps={{ style: { width: '100%' } }}
                />
                <ProFormDigit
                    name="invoice_amount"
                    label="不含税金额"
                    min={0}
                    rules={[{ required: true, message: '请输入不含税金额' }]}
                    fieldProps={{ precision: 2, style: { width: '100%' } }}
                />
                <ProFormTextArea name="notes" label="备注" />
            </ModalForm>
        </ListPageTemplate>
    );
};

export default PurchaseInvoiceList;
