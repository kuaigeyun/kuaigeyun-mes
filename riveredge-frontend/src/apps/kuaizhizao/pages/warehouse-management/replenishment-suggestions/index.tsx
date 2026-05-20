/**
 * 补货建议管理页面
 *
 * 提供补货建议的查看、生成和处理功能
 *
 * @author RiverEdge Team
 * @date 2026-01-17
 */

import React, { useRef, useState } from 'react';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Card, Table, Input, Typography, Descriptions } from 'antd';
import dayjs from 'dayjs';
import { ProForm, ProFormRadio, ProFormTextArea } from '@ant-design/pro-components';
import { EyeOutlined, ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { detailDrawerDescriptionItems, DetailDrawerTemplate, DRAWER_CONFIG, ListPageTemplate } from '../../../../../components/layout-templates';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { warehouseApi } from '../../../services/production';
import { getReplenishmentSuggestionLifecycle } from '../../../utils/replenishmentSuggestionLifecycle';

// 补货建议接口定义
interface ReplenishmentSuggestion {
  id?: number;
  tenant_id?: number;
  uuid?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  current_quantity?: number;
  safety_stock?: number;
  min_stock?: number;
  max_stock?: number;
  suggested_quantity?: number;
  priority?: string;
  suggestion_type?: string;
  estimated_delivery_days?: number;
  suggested_order_date?: string;
  supplier_id?: number;
  supplier_name?: string;
  status?: string;
  processed_by?: number;
  processed_by_name?: string;
  processed_at?: string;
  processing_notes?: string;
  alert_id?: number;
  related_demand_id?: number;
  related_demand_code?: string;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
}

const ReplenishmentSuggestionsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [suggestionDetail, setSuggestionDetail] = useState<ReplenishmentSuggestion | null>(null);

  // 处理Modal状态
  const [processModalVisible, setProcessModalVisible] = useState(false);
  const [processSuggestion, setProcessSuggestion] = useState<ReplenishmentSuggestion | null>(null);
  const [processStatus, setProcessStatus] = useState<string>('processed');
  const [processNotes, setProcessNotes] = useState<string>('');

  // 表格列定义
  const columns: ProColumns<ReplenishmentSuggestion>[] = [
    {
      title: '物料编号',
      dataIndex: 'material_code',
      width: 120,
      ellipsis: true,
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
      ellipsis: true,
    },
    {
      title: '仓库',
      dataIndex: 'warehouse_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '当前库存',
      dataIndex: 'current_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '安全库存',
      dataIndex: 'safety_stock',
      width: 100,
      align: 'right',
    },
    {
      title: '建议补货数量',
      dataIndex: 'suggested_quantity',
      width: 120,
      align: 'right',
      render: (_, record) => (
        <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{record.suggested_quantity}</span>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 100,
      render: (priority) => {
        const priorityMap = {
          'high': { text: '高', color: 'error' },
          'medium': { text: '中', color: 'warning' },
          'low': { text: '低', color: 'default' },
        };
        const config = priorityMap[priority as keyof typeof priorityMap] || priorityMap['medium'];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '建议类型',
      dataIndex: 'suggestion_type',
      width: 120,
      render: (type) => {
        const typeMap = {
          'low_stock': '低库存',
          'demand_based': '需求驱动',
          'seasonal': '季节性',
        };
        return typeMap[type as keyof typeof typeMap] || type;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      hideInTable: true,
      valueType: 'select',
      valueEnum: {
        pending: { text: '待处理' },
        processed: { text: '已处理' },
        ignored: { text: '已忽略' },
      },
    },
    {
      title: '建议下单日期',
      dataIndex: 'suggested_order_date',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
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
      width: 132,
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getReplenishmentSuggestionLifecycle(record as Record<string, unknown>);
        return (
          <UniLifecycle
            percent={lifecycle.percent}
            stageName={lifecycle.stageName}
            status={lifecycle.status}
            subStages={lifecycle.subStages}
            showLabel
            size="small"
            showCircleTooltip={false}
          />
        );
      },
    },
    {
      title: '操作',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleDetail(record)}
          >
            详情
          </Button>
          {record.status === 'pending' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleProcess(record)}
              style={{ color: '#52c41a' }}
            >
              处理
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // 处理详情查看
  const handleDetail = async (record: ReplenishmentSuggestion) => {
    try {
      const detail = await warehouseApi.replenishmentSuggestion.get(record.id!.toString());
      setSuggestionDetail(detail);
      setDetailDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取补货建议详情失败');
    }
  };

  // 处理补货建议
  const handleProcess = (record: ReplenishmentSuggestion) => {
    setProcessSuggestion(record);
    setProcessStatus('processed');
    setProcessNotes('');
    setProcessModalVisible(true);
  };

  // 提交处理
  const handleProcessSubmit = async () => {
    if (!processSuggestion) return;

    try {
      await warehouseApi.replenishmentSuggestion.process(processSuggestion.id!.toString(), {
        status: processStatus,
        processing_notes: processNotes,
      });
      messageApi.success('补货建议处理成功');
      setProcessModalVisible(false);
      setProcessSuggestion(null);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '处理失败');
    }
  };

  // 生成补货建议
  const handleGenerateFromAlerts = async () => {
    Modal.confirm({
      title: '生成补货建议',
      content: '确定要从库存预警生成补货建议吗？',
      onOk: async () => {
        try {
          await warehouseApi.replenishmentSuggestion.generateFromAlerts();
          messageApi.success('补货建议生成成功');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '生成失败');
        }
      },
    });
  };

  // 详情列定义
  const detailColumns: ProDescriptionsItemProps<ReplenishmentSuggestion>[] = [
    {
      title: '物料编号',
      dataIndex: 'material_code',
    },
    {
      title: '物料名称',
      dataIndex: 'material_name',
    },
    {
      title: '仓库',
      dataIndex: 'warehouse_name',
    },
    {
      title: '当前库存',
      dataIndex: 'current_quantity',
    },
    {
      title: '安全库存',
      dataIndex: 'safety_stock',
    },
    {
      title: '最低库存',
      dataIndex: 'min_stock',
    },
    {
      title: '最高库存',
      dataIndex: 'max_stock',
    },
    {
      title: '建议补货数量',
      dataIndex: 'suggested_quantity',
      render: (_, record) => (
        <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{record.suggested_quantity}</span>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      render: (_, record) => {
        const priorityKey = String(record.priority ?? '');
        const priorityMap: Record<string, { text: string; color: string }> = {
          high: { text: '高', color: 'error' },
          medium: { text: '中', color: 'warning' },
          low: { text: '低', color: 'default' },
        };
        const config = priorityMap[priorityKey] || { text: priorityKey || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '建议类型',
      dataIndex: 'suggestion_type',
    },
    {
      title: '预计交货天数',
      dataIndex: 'estimated_delivery_days',
    },
    {
      title: '建议下单日期',
      dataIndex: 'suggested_order_date',
      valueType: 'dateTime',
    },
    {
      title: '供应商',
      dataIndex: 'supplier_name',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (_, record) => {
        const statusKey = String(record.status ?? '');
        const statusMap: Record<string, { text: string; color: string }> = {
          pending: { text: '待处理', color: 'default' },
          processed: { text: '已处理', color: 'success' },
          ignored: { text: '已忽略', color: 'error' },
        };
        const config = statusMap[statusKey] || { text: statusKey || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      span: 2,
      render: (text) => text || '-',
    },
  ];

  return (
    <>
      <ListPageTemplate
        statCards={[
          {
            title: '待处理建议',
            value: 0,
            prefix: <ExclamationCircleOutlined />,
            valueStyle: { color: '#faad14' },
          },
          {
            title: '高优先级',
            value: 0,
            suffix: '个',
            valueStyle: { color: '#f5222d' },
          },
          {
            title: '已处理',
            value: 0,
            suffix: '个',
            valueStyle: { color: '#52c41a' },
          },
        ]}
      >
        <UniTable
          headerTitle="补货建议"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.replenishment-suggestions"
          showAdvancedSearch={true}
          request={async (params) => {
            try {
              const response = await warehouseApi.replenishmentSuggestion.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                status: params.status,
                priority: params.priority,
                suggestion_type: params.suggestion_type,
                material_id: params.material_id,
                warehouse_id: params.warehouse_id,
              });
              return {
                data: Array.isArray(response) ? response : response.data || [],
                success: true,
                total: Array.isArray(response) ? response.length : response.total || 0,
              };
            } catch (error) {
              messageApi.error('获取补货建议列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          toolBarRender={() => [
            <Button
              key="generate"
              type="primary"
              icon={<ReloadOutlined />}
              onClick={handleGenerateFromAlerts}
            >
              从预警生成
            </Button>,
          ]}
          scroll={{ x: 1200 }}
        />
      </ListPageTemplate>

      {/* 详情Drawer */}
      <DetailDrawerTemplate
        title={`补货建议详情${suggestionDetail?.material_code ? ` - ${suggestionDetail.material_code}` : ''}`}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setSuggestionDetail(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        basic={
          suggestionDetail ? (
            <Descriptions column={2} items={detailDrawerDescriptionItems(detailColumns, suggestionDetail)} />
          ) : undefined
        }
      />

      {/* 处理Modal */}
      <Modal
        title="处理补货建议"
        open={processModalVisible}
        onOk={handleProcessSubmit}
        onCancel={() => {
          setProcessModalVisible(false);
          setProcessSuggestion(null);
          setProcessNotes('');
        }}
        okText="确认"
        cancelText="取消"
      >
        <ProForm
          submitter={false}
          initialValues={{
            status: processStatus,
            notes: processNotes,
          }}
          onValuesChange={(changedValues) => {
            if (changedValues.status !== undefined) {
              setProcessStatus(changedValues.status);
            }
            if (changedValues.notes !== undefined) {
              setProcessNotes(changedValues.notes);
            }
          }}
        >
          <ProFormRadio.Group
            name="status"
            label="处理状态"
            options={[
              { label: '已处理', value: 'processed' },
              { label: '忽略', value: 'ignored' },
            ]}
          />
          <ProFormTextArea
            name="notes"
            label="处理备注"
            placeholder="请输入处理备注（可选）"
            fieldProps={{
              rows: 4,
            }}
          />
        </ProForm>
      </Modal>
    </>
  );
};

export default ReplenishmentSuggestionsPage;
