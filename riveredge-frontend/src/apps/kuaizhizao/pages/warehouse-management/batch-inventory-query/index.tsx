import React, { useMemo, useRef, useState } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { Card, Col, message, Row, Segmented, Select, Space, Statistic, Tag, Typography } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSearchParams } from 'react-router-dom';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { apiRequest } from '../../../../../services/api';

interface BatchInventoryItem {
    id: number;
    material_id: number;
    material_code: string;
    material_name: string;
    batch_no: string;
    production_date: string | null;
    expiry_date: string | null;
    quantity: number;
    supplier_batch_no: string | null;
    status: string;
    warehouse_id: number | null;
    warehouse_name: string | null;
}

const BatchInventoryQuery: React.FC = () => {
    const [searchParams] = useSearchParams();
    const [includeExpired, setIncludeExpired] = useState(false);
    const [includeZeroStock, setIncludeZeroStock] = useState(true);
    const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'zero' | 'expired'>('all');
    const [agingBucket, setAgingBucket] = useState<'all' | 'expired' | '0-30' | '31-90' | '90+'>('all');
    const [groupBy, setGroupBy] = useState<'warehouse' | 'material' | 'status' | 'aging_bucket'>('aging_bucket');
    const lastQueryRef = useRef<Record<string, any>>({});
    const actionRef = useRef<any>(null);
    const [summary, setSummary] = useState({
        total_records: 0,
        total_quantity: 0,
        in_stock_count: 0,
        zero_stock_count: 0,
        expired_count: 0,
        near_expiry_count: 0,
    });
    const [groups, setGroups] = useState<Array<{ group_key: string; record_count: number; total_quantity: number }>>([]);

    const escapeCsv = (v: unknown) => {
        const s = String(v ?? '');
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
    };

    const groupedTags = useMemo(() => groups.slice(0, 8), [groups]);

    const columns: ProColumns<BatchInventoryItem>[] = [
        {
            title: '物料编号',
            dataIndex: 'material_code',
            width: 120,
            fixed: 'left',
            render: (_, r) => (
                <Typography.Text copyable={{ text: String(r.material_code ?? '') }} ellipsis>
                    {r.material_code ?? '-'}
                </Typography.Text>
            ),
        },
        {
            title: '物料名称',
            dataIndex: 'material_name',
            width: 150,
            fixed: 'left',
        },
        {
            title: '批号',
            dataIndex: 'batch_no',
            width: 120,
            copyable: true,
        },
        {
            title: '生产日期',
            dataIndex: 'production_date',
            width: 120,
            valueType: 'date',
            render: (_, record) => record.production_date || '-',
        },
        {
            title: '有效期',
            dataIndex: 'expiry_date',
            width: 120,
            valueType: 'date',
            render: (_, record) => {
                if (!record.expiry_date) return '-';
                const isExpired = dayjs(record.expiry_date).isBefore(dayjs());
                const isNearExpiry = dayjs(record.expiry_date).diff(dayjs(), 'day') <= 30;

                return (
                    <Space>
                        {record.expiry_date}
                        {isExpired && <Tag color="red">已过期</Tag>}
                        {!isExpired && isNearExpiry && <WarningOutlined style={{ color: '#faad14' }} />}
                    </Space>
                );
            },
        },
        {
            title: '库存数量',
            dataIndex: 'quantity',
            width: 100,
            valueType: 'digit',
            render: (_, record) => {
                const color = record.quantity <= 0 ? 'red' : 'green';
                return <span style={{ color }}>{record.quantity}</span>;
            },
        },
        {
            title: '供应商批号',
            dataIndex: 'supplier_batch_no',
            width: 120,
            render: (_, record) => record.supplier_batch_no || '-',
        },
        {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            render: (_, record) => {
                let color = 'default';
                if (record.status === '已过期') color = 'red';
                else if (record.status === '无库存') color = 'orange';
                else if (record.status === '在库') color = 'green';

                return <Tag color={color}>{record.status}</Tag>;
            },
        },
        {
            title: '仓库',
            dataIndex: 'warehouse_name',
            width: 120,
            render: (_, record) => record.warehouse_name || '-',
        },
    ];

    const fetchBatchInventory = async (params: any, _sort: any, _filter: any, searchFormValues?: Record<string, any>) => {
        const search = searchFormValues || {};
        const apiParams = {
            material_id: search.material_id || params.material_id,
            warehouse_id: search.warehouse_id,
            batch_number: search.batch_no,
            include_expired: includeExpired,
            include_zero_stock: includeZeroStock,
            aging_bucket: agingBucket === 'all' ? undefined : agingBucket,
            status_filter: statusFilter === 'all' ? undefined : statusFilter,
            keyword: (search as any).keyword ?? params.keyword,
        };
        lastQueryRef.current = apiParams;
        try {
            const [listRes, summaryRes] = await Promise.all([
                apiRequest<{ items: BatchInventoryItem[]; total: number }>(
                    '/apps/kuaizhizao/reports/inventory/batch-lines',
                    {
                        method: 'GET',
                        params: {
                            ...apiParams,
                            current: params.current || 1,
                            page_size: params.pageSize || 20,
                        },
                    }
                ),
                apiRequest<{ summary: typeof summary; groups: Array<{ group_key: string; record_count: number; total_quantity: number }> }>(
                    '/apps/kuaizhizao/reports/inventory/batch-lines/summary',
                    {
                        method: 'GET',
                        params: { ...apiParams, group_by: groupBy },
                    }
                ),
            ]);
            setSummary(summaryRes.summary);
            setGroups(summaryRes.groups || []);
            return {
                data: listRes.items || [],
                total: listRes.total || 0,
                success: true,
            };
        } catch (error: any) {
            message.error(error?.message || '查询失败');
            return {
                data: [],
                total: 0,
                success: false,
            };
        }
    };

    const handleExport = async (
        type: 'selected' | 'currentPage' | 'all',
        selectedRowKeys?: React.Key[],
        currentPageData?: BatchInventoryItem[]
    ) => {
        try {
            let items: BatchInventoryItem[] = [];
            if (type === 'selected') {
                const keySet = new Set((selectedRowKeys || []).map(String));
                items = (currentPageData || []).filter((row) => keySet.has(String(row.id)));
            } else if (type === 'currentPage') {
                items = currentPageData || [];
            } else {
                const response = await apiRequest<{ items?: BatchInventoryItem[] }>(
                    '/apps/kuaizhizao/reports/inventory/batch-lines',
                    {
                        method: 'GET',
                        params: { ...lastQueryRef.current, current: 1, page_size: 100000 },
                    }
                );
                items = response.items ?? (Array.isArray(response) ? response : []);
            }
            if (items.length === 0) {
                message.warning('暂无数据可导出');
                return;
            }
            const headers = ['物料编号', '物料名称', '批号', '生产日期', '有效期', '库存数量', '供应商批号', '状态', '仓库'];
            const lines = items.map((r) =>
                [r.material_code, r.material_name, r.batch_no, r.production_date, r.expiry_date, r.quantity, r.supplier_batch_no, r.status, r.warehouse_name || '-']
                    .map(escapeCsv)
                    .join(',')
            );
            const csv = [headers.join(','), ...lines].join('\n');
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `batch-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            message.success(`已导出 ${items.length} 条记录`);
        } catch (error: any) {
            message.error(error?.message || '导出失败');
        }
    };

    return (
        <ListPageTemplate>
            <Card size="small" style={{ marginBottom: 12 }} title="分析区">
                <Row gutter={12}>
                    <Col span={4}><Statistic title="记录数" value={summary.total_records} /></Col>
                    <Col span={4}><Statistic title="库存总量" value={summary.total_quantity} precision={2} /></Col>
                    <Col span={4}><Statistic title="在库" value={summary.in_stock_count} /></Col>
                    <Col span={4}><Statistic title="无库存" value={summary.zero_stock_count} /></Col>
                    <Col span={4}><Statistic title="近效期(30天)" value={summary.near_expiry_count} /></Col>
                    <Col span={4}><Statistic title="过期" value={summary.expired_count} /></Col>
                </Row>
                <Space style={{ marginTop: 8, flexWrap: 'wrap' }}>
                    {groupedTags.map((g) => (
                        <Tag key={g.group_key}>
                            {g.group_key}: {g.record_count}项 / {Number(g.total_quantity || 0).toFixed(2)}
                        </Tag>
                    ))}
                </Space>
            </Card>

            <Card size="small" style={{ marginBottom: 12 }} title="筛选区">
                <Space wrap>
                    <Segmented
                        value={includeExpired ? 'show' : 'hide'}
                        options={[
                            { label: '显示过期批次', value: 'show' },
                            { label: '隐藏过期批次', value: 'hide' },
                        ]}
                        onChange={(v) => {
                            setIncludeExpired(v === 'show');
                            actionRef.current?.reload();
                        }}
                    />
                    <Segmented
                        value={includeZeroStock ? 'show' : 'hide'}
                        options={[
                            { label: '显示0库存', value: 'show' },
                            { label: '隐藏0库存', value: 'hide' },
                        ]}
                        onChange={(v) => {
                            setIncludeZeroStock(v === 'show');
                            actionRef.current?.reload();
                        }}
                    />
                    <Select
                        value={statusFilter}
                        style={{ width: 160 }}
                        options={[
                            { label: '全部状态', value: 'all' },
                            { label: '仅在库', value: 'in_stock' },
                            { label: '仅无库存', value: 'zero' },
                            { label: '仅已过期', value: 'expired' },
                        ]}
                        onChange={(v) => {
                            setStatusFilter(v);
                            actionRef.current?.reload();
                        }}
                    />
                    <Select
                        value={agingBucket}
                        style={{ width: 160 }}
                        options={[
                            { label: '全部库龄', value: 'all' },
                            { label: '已过期', value: 'expired' },
                            { label: '0-30天', value: '0-30' },
                            { label: '31-90天', value: '31-90' },
                            { label: '90天+', value: '90+' },
                        ]}
                        onChange={(v) => {
                            setAgingBucket(v);
                            actionRef.current?.reload();
                        }}
                    />
                    <Select
                        value={groupBy}
                        style={{ width: 160 }}
                        options={[
                            { label: '按库龄分组', value: 'aging_bucket' },
                            { label: '按仓库分组', value: 'warehouse' },
                            { label: '按物料分组', value: 'material' },
                            { label: '按状态分组', value: 'status' },
                        ]}
                        onChange={(v) => {
                            setGroupBy(v);
                            actionRef.current?.reload();
                        }}
                    />
                </Space>
            </Card>

            <Card size="small" title="结果区">
                <UniTable<BatchInventoryItem>
                    actionRef={actionRef}
                    columns={columns}
                    columnPersistenceId="kuaizhizao-wm-batch-inventory-query"
                    request={fetchBatchInventory}
                    showExportButton
                    onExport={handleExport}
                    rowKey="id"
                    search={{ labelWidth: 'auto' }}
                    pagination={{ defaultPageSize: 20, showSizeChanger: true }}
                    scroll={{ x: 1200 }}
                    params={{ material_id: searchParams.get('material_id') || undefined }}
                    headerTitle="批次库存查询"
                />
            </Card>
        </ListPageTemplate>
    );
};

export default BatchInventoryQuery;
