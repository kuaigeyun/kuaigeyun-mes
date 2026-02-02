import React, { useState } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { Tag, message, Space, Button } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { WarningOutlined, ExportOutlined } from '@ant-design/icons';
import { apiRequest } from '../../../../../services/api';
import dayjs from 'dayjs';

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
    const [includeExpired, setIncludeExpired] = useState(false);

    const columns: ProColumns<BatchInventoryItem>[] = [
        {
            title: '物料编码',
            dataIndex: 'material_code',
            width: 120,
            fixed: 'left',
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

    const fetchBatchInventory = async (params: any) => {
        try {
            const response = await apiRequest<{ total: number; items: BatchInventoryItem[] }>(
                '/apps/kuaizhizao/reports/inventory/batch-query',
                {
                    method: 'GET',
                    params: {
                        material_id: params.material_id,
                        warehouse_id: params.warehouse_id,
                        batch_number: params.batch_no,
                        include_expired: includeExpired,
                    },
                }
            );

            return {
                data: response.items || [],
                total: response.total || 0,
                success: true,
            };
        } catch (error) {
            message.error('查询失败');
            return {
                data: [],
                total: 0,
                success: false,
            };
        }
    };

    const handleExport = () => {
        message.info('导出功能开发中...');
    };

    return (
        <ListPageTemplate>
            <UniTable<BatchInventoryItem>
                columns={columns}
                request={fetchBatchInventory}
                rowKey="id"
                search={{
                    labelWidth: 'auto',
                }}
                pagination={{
                    defaultPageSize: 20,
                    showSizeChanger: true,
                }}
                scroll={{ x: 1200 }}
                toolBarRender={() => [
                    <Button
                        key="includeExpired"
                        type={includeExpired ? 'primary' : 'default'}
                        onClick={() => setIncludeExpired(!includeExpired)}
                    >
                        {includeExpired ? '隐藏过期批次' : '显示过期批次'}
                    </Button>,
                    <Button
                        key="export"
                        icon={<ExportOutlined />}
                        onClick={handleExport}
                    >
                        导出
                    </Button>,
                ]}
                params={{ includeExpired }}
                headerTitle="批次库存查询"
            />
        </ListPageTemplate>
    );
};

export default BatchInventoryQuery;
