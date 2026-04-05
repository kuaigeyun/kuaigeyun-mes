/**
 * 应付单列表页
 */
import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Modal, Typography } from 'antd';
import { ModalForm, ProFormDatePicker, ProFormMoney, ProFormSelect, ProFormTextArea } from '@ant-design/pro-components';
import { EyeOutlined, DollarOutlined } from '@ant-design/icons';
import { apiRequest } from '../../../../../services/api';
import { payableService } from '../../../services/finance/payable';
import { Payable, PayableCreateData } from '../../../types/finance/payable';
import { batchImport } from '../../../../../utils/batchOperations';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { getPayableLifecycle } from '../../../utils/financeLifecycle';
import { renderRowActionsOverflow } from '../../../utils/renderRowActionsOverflow';
import dayjs from 'dayjs';

const PayableList: React.FC = () => {
    const actionRef = useRef<ActionType>();
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [supplierOptions, setSupplierOptions] = useState<{ label: string; value: number }[]>([]);
    const { message: messageApi } = App.useApp();
    const { t } = useTranslation();
    const navigate = useNavigate();

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
        const today = dayjs().format('YYYY-MM-DD');
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
            review_status: '待审核',
            notes: values.notes,
        };
        await payableService.createPayable(data);
        messageApi.success('创建成功');
        setCreateModalVisible(false);
        actionRef.current?.reload();
    };

    const columns: ProColumns<Payable>[] = [
        {
            title: t('app.kuaicaiwu.common.code', { defaultValue: '编号' }),
            dataIndex: 'payable_code',
            width: 168,
            fixed: 'left',
            render: (_, entity) => (
                <Typography.Text copyable={{ text: String(entity.payable_code ?? '') }} ellipsis>
                    <a onClick={() => navigate(`/apps/kuaicaiwu/finance-management/payables/${entity.id}`)}>{entity.payable_code}</a>
                </Typography.Text>
            ),
        },
        {
            title: '供应商名称',
            dataIndex: 'supplier_name',
            width: 200,
        },
        {
            title: '应付总额',
            dataIndex: 'total_amount',
            valueType: 'money',
            align: 'right',
            width: 120,
        },
        {
            title: '已付金额',
            dataIndex: 'paid_amount',
            valueType: 'money',
            align: 'right',
            width: 120,
        },
        {
            title: '剩余应付',
            dataIndex: 'remaining_amount',
            valueType: 'money',
            align: 'right',
            width: 120,
            render: (_, record) => (
                <span style={{ color: record.remaining_amount > 0 ? 'red' : 'inherit', fontWeight: 'bold' }}>
                    {record.remaining_amount != null
                        ? `¥${Number(record.remaining_amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
                        : '-'}
                </span>
            ),
        },
        {
            title: '到期日期',
            dataIndex: 'due_date',
            valueType: 'date',
            width: 120,
        },
        {
            title: '状态',
            dataIndex: 'status',
            hideInTable: true,
            valueEnum: {
                '未付款': { text: '未付款' },
                '部分付款': { text: '部分付款' },
                '已结清': { text: '已结清' },
            },
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
            title: '更新时间',
            dataIndex: 'updated_at',
            width: 168,
            hideInSearch: true,
            render: (_, r) => (r.updated_at ? dayjs(r.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'),
        },
        {
            title: '生命周期',
            dataIndex: 'lifecycle',
            fixed: 'right',
            align: 'left',
            width: 130,
            hideInSearch: true,
            render: (_, record) => {
                const lc = getPayableLifecycle(record as unknown as Record<string, unknown>);
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
            width: 220,
            render: (_, record) =>
                renderRowActionsOverflow(
                    [
                        <Button
                            key="det"
                            type="link"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => navigate(`/apps/kuaicaiwu/finance-management/payables/${record.id}`)}
                        >
                            详情
                        </Button>,
                        <UniWorkflowActions
                            key="wf"
                            record={record}
                            entityName="应付单"
                            statusField="status"
                            reviewStatusField="review_status"
                            draftStatuses={[]}
                            pendingStatuses={['待审核']}
                            approvedStatuses={['已审核', '通过']}
                            rejectedStatuses={['已驳回', '驳回']}
                            theme="link"
                            size="small"
                            actions={{
                                approve: (id) => payableService.approvePayable(id),
                                reject: (id, reason) => payableService.approvePayable(id, reason),
                            }}
                            onSuccess={() => actionRef.current?.reload()}
                        />,
                        record.remaining_amount > 0 ? (
                            <Button
                                key="pay"
                                type="link"
                                size="small"
                                icon={<DollarOutlined />}
                                onClick={() => navigate(`/apps/kuaicaiwu/finance-management/payables/${record.id}`)}
                            >
                                付款
                            </Button>
                        ) : null,
                    ].filter(Boolean) as React.ReactNode[],
                    `pay-${record.id}`,
                ),
        },
    ];

    return (
        <ListPageTemplate>
            <UniTable<Payable>
                headerTitle="应付账款"
                actionRef={actionRef}
                rowKey="id"
                columnPersistenceId="kuaicaiwu-finance-payables"
                scroll={{ x: 1680 }}
                showAdvancedSearch
                search={{ labelWidth: 120 }}
                showCreateButton
                createButtonText="新建应付单"
                onCreate={() => setCreateModalVisible(true)}
                enableRowSelection
                showDeleteButton
                deleteButtonText="批量删除"
                onDelete={async (keys) => {
                    Modal.confirm({
                        title: '确认批量删除',
                        content: `确定要删除选中的 ${keys.length} 条应付单吗？仅待审核且无付款记录的应付单可删除。`,
                        onOk: async () => {
                            try {
                                for (const id of keys) {
                                    await payableService.deletePayable(Number(id));
                                }
                                messageApi.success(`成功删除 ${keys.length} 条记录`);
                                actionRef.current?.reload();
                            } catch (error: any) {
                                messageApi.error(error?.message || '删除失败');
                            }
                        },
                    });
                }}
                request={async (params) => {
                    const { current, pageSize, ...rest } = params;
                    const res = await payableService.listPayables({
                        skip: ((current || 1) - 1) * (pageSize || 20),
                        limit: pageSize || 20,
                        ...rest,
                    });
                    return {
                        data: res.items,
                        total: res.total,
                        success: true,
                    };
                }}
                columns={columns}
                showImportButton
                onImport={async (data) => {
                    if (!data || data.length < 2) {
                        messageApi.warning('导入数据为空或格式不正确');
                        return;
                    }
                    const headers = (data[0] || []).map((h: any) => String(h || '').trim());
                    const getIdx = (...keys: string[]) => {
                        for (const k of keys) {
                            const i = headers.findIndex((h: string) => h.includes(k) || h.replace(/\*/g, '').trim().toLowerCase().includes(k.toLowerCase()));
                            if (i >= 0) return i;
                        }
                        return -1;
                    };
                    const sIdx = getIdx('供应商', 'supplier', 'supplier_name');
                    const amtIdx = getIdx('应付', '金额', 'amount', 'total_amount');
                    const dueIdx = getIdx('到期', 'due');
                    const dateIdx = getIdx('业务', 'business');
                    if (sIdx < 0 || amtIdx < 0) {
                        messageApi.error('导入表头需包含供应商名称和应付金额');
                        return;
                    }
                    const items: PayableCreateData[] = [];
                    for (let i = 1; i < data.length; i++) {
                        const row = data[i];
                        if (!row || row.length === 0) continue;
                        const suppLabel = String(row[sIdx] ?? '').trim();
                        const suppOpt = supplierOptions.find(o => (o.label || '').trim() === suppLabel) ?? supplierOptions.find(o => (o.label || '').includes(suppLabel));
                        const suppId = suppOpt?.value;
                        const amount = Number(row[amtIdx]) || 0;
                        if (!suppId || amount <= 0) continue;
                        const today = dayjs().format('YYYY-MM-DD');
                        const dueDate = dueIdx >= 0 && row[dueIdx] ? dayjs(row[dueIdx]).format('YYYY-MM-DD') : today;
                        const bizDate = dateIdx >= 0 && row[dateIdx] ? dayjs(row[dateIdx]).format('YYYY-MM-DD') : today;
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
                            status: '未付款',
                            review_status: '待审核',
                        });
                    }
                    if (items.length === 0) {
                        messageApi.warning('没有可导入的有效数据');
                        return;
                    }
                    const result = await batchImport({
                        items,
                        importFn: async (item) => payableService.createPayable(item),
                        title: '导入应付单',
                        concurrency: 5,
                    });
                    if (result.successCount > 0) {
                        messageApi.success(`成功导入 ${result.successCount} 条应付单`);
                        actionRef.current?.reload();
                    }
                    if (result.failureCount > 0) {
                        messageApi.warning(`部分失败 ${result.failureCount} 条`);
                    }
                }}
                importHeaders={['*供应商名称', '*应付金额', '到期日期', '业务日期']}
                showExportButton
                onExport={async (type, keys, pageData) => {
                    try {
                        const res = await payableService.listPayables({ skip: 0, limit: 10000 });
                        let items = res.items || [];
                        if (type === 'currentPage' && pageData?.length) {
                            items = pageData;
                        } else if (type === 'selected' && keys?.length) {
                            items = items.filter((d: Payable) => d.id != null && keys.includes(d.id));
                        }
                        if (items.length === 0) {
                            messageApi.warning('暂无数据可导出');
                            return;
                        }
                        const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `payables-${new Date().toISOString().slice(0, 10)}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                        messageApi.success(`已导出 ${items.length} 条记录`);
                    } catch (error: any) {
                        messageApi.error(error?.message || '导出失败');
                    }
                }}
            />

            <ModalForm
                title="新建应付单"
                open={createModalVisible}
                onOpenChange={setCreateModalVisible}
                onFinish={handleCreate}
                width={480}
            >
                <ProFormSelect
                    name="supplier_id"
                    label="供应商"
                    options={supplierOptions}
                    rules={[{ required: true, message: '请选择供应商' }]}
                    placeholder="请选择供应商"
                />
                <ProFormMoney name="total_amount" label="应付金额" min={0.01} rules={[{ required: true }]} />
                <ProFormDatePicker name="due_date" label="到期日期" rules={[{ required: true }]} />
                <ProFormDatePicker name="business_date" label="业务日期" />
                <ProFormTextArea name="notes" label="备注" />
            </ModalForm>
        </ListPageTemplate>
    );
};

export default PayableList;
