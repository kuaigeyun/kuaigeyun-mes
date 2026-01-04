/**
 * 缺料异常处理页面
 *
 * 提供缺料异常处理功能，包括预警列表、替代物料推荐、紧急采购等。
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Tag, Button, Space, Modal, message } from 'antd';
import { EyeOutlined, CheckCircleOutlined, ShoppingOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { apiRequest } from '../../../../../services/api';

/**
 * 缺料异常接口定义
 */
interface MaterialShortageException {
  id?: number;
  work_order_id?: number;
  work_order_code?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  shortage_quantity?: number;
  available_quantity?: number;
  required_quantity?: number;
  alert_level?: string;
  status?: string;
  alternative_material_id?: number;
  alternative_material_code?: string;
  alternative_material_name?: string;
  suggested_action?: string;
  handled_by_name?: string;
  handled_at?: string;
  created_at?: string;
}

/**
 * 缺料异常处理页面组件
 */
const MaterialShortageExceptionsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<MaterialShortageException | null>(null);

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: MaterialShortageException) => {
    setCurrentRecord(record);
    setDetailDrawerVisible(true);
  };

  /**
   * 处理缺料异常
   */
  const handleException = async (record: MaterialShortageException, action: string) => {
    try {
      await apiRequest(`/apps/kuaizhizao/exceptions/material-shortage/${record.id}/handle`, {
        method: 'POST',
        params: { action },
      });
      messageApi.success('处理成功');
      actionRef.current?.reload();
    } catch (error) {
      messageApi.error('处理失败');
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<MaterialShortageException>[] = [
    {
      title: '工单编码',
      dataIndex: 'work_order_code',
      width: 140,
      fixed: 'left',
    },
    {
      title: '物料编码',
      dataIndex: 'material_code',
      width: 120,
    },
    {
      title: '物料名称',
      dataIndex: 'material_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '需求数量',
      dataIndex: 'required_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '可用数量',
      dataIndex: 'available_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '缺料数量',
      dataIndex: 'shortage_quantity',
      width: 100,
      align: 'right',
      render: (_, record) => (
        <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
          {record.shortage_quantity}
        </span>
      ),
    },
    {
      title: '预警级别',
      dataIndex: 'alert_level',
      width: 100,
      valueEnum: {
        low: { text: '低', status: 'default' },
        medium: { text: '中', status: 'warning' },
        high: { text: '高', status: 'error' },
        critical: { text: '紧急', status: 'error' },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        pending: { text: '待处理', status: 'default' },
        processing: { text: '处理中', status: 'processing' },
        resolved: { text: '已解决', status: 'success' },
        cancelled: { text: '已取消', status: 'error' },
      },
    },
    {
      title: '建议操作',
      dataIndex: 'suggested_action',
      width: 100,
      valueEnum: {
        purchase: { text: '采购', status: 'processing' },
        substitute: { text: '替代', status: 'warning' },
        adjust: { text: '调整', status: 'default' },
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '操作',
      width: 200,
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
            <>
              <Button
                type="link"
                size="small"
                icon={<ShoppingOutlined />}
                onClick={() => handleException(record, 'purchase')}
              >
                采购
              </Button>
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleException(record, 'resolve')}
              >
                已解决
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle="缺料异常处理"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async (params) => {
          try {
            const result = await apiRequest('/apps/kuaizhizao/exceptions/material-shortage', {
              method: 'GET',
              params: {
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                status: params.status,
                alert_level: params.alert_level,
              },
            });
            return {
              data: result || [],
              success: true,
              total: result?.length || 0,
            };
          } catch (error) {
            messageApi.error('获取异常列表失败');
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        showAdvancedSearch={true}
      />

      {/* 详情 Drawer */}
      <DetailDrawerTemplate
        title={`缺料异常详情 - ${currentRecord?.work_order_code || ''}`}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        columns={[]}
        customContent={
          currentRecord ? (
            <div style={{ padding: '16px 0' }}>
              <p><strong>工单编码：</strong>{currentRecord.work_order_code}</p>
              <p><strong>物料编码：</strong>{currentRecord.material_code}</p>
              <p><strong>物料名称：</strong>{currentRecord.material_name}</p>
              <p><strong>需求数量：</strong>{currentRecord.required_quantity}</p>
              <p><strong>可用数量：</strong>{currentRecord.available_quantity}</p>
              <p><strong>缺料数量：</strong>
                <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                  {currentRecord.shortage_quantity}
                </span>
              </p>
              <p><strong>预警级别：</strong>
                <Tag color={
                  currentRecord.alert_level === 'critical' ? 'red' :
                  currentRecord.alert_level === 'high' ? 'orange' :
                  currentRecord.alert_level === 'medium' ? 'gold' : 'default'
                }>
                  {currentRecord.alert_level === 'critical' ? '紧急' :
                   currentRecord.alert_level === 'high' ? '高' :
                   currentRecord.alert_level === 'medium' ? '中' : '低'}
                </Tag>
              </p>
              <p><strong>状态：</strong>
                <Tag color={
                  currentRecord.status === 'resolved' ? 'success' :
                  currentRecord.status === 'processing' ? 'processing' :
                  currentRecord.status === 'cancelled' ? 'error' : 'default'
                }>
                  {currentRecord.status === 'resolved' ? '已解决' :
                   currentRecord.status === 'processing' ? '处理中' :
                   currentRecord.status === 'cancelled' ? '已取消' : '待处理'}
                </Tag>
              </p>
              <p><strong>建议操作：</strong>{currentRecord.suggested_action || '-'}</p>
              {currentRecord.alternative_material_name && (
                <p><strong>替代物料：</strong>{currentRecord.alternative_material_name}</p>
              )}
              {currentRecord.handled_by_name && (
                <>
                  <p><strong>处理人：</strong>{currentRecord.handled_by_name}</p>
                  <p><strong>处理时间：</strong>{currentRecord.handled_at}</p>
                </>
              )}
            </div>
          ) : null
        }
      />
    </ListPageTemplate>
  );
};

export default MaterialShortageExceptionsPage;

