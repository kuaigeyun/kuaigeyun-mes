/**
 * 缺料异常管理页面
 *
 * 提供缺料异常的管理功能，包括异常列表查看、异常处理等。
 *
 * Author: Luigi Lu
 * Date: 2026-01-15
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, message, Popconfirm } from 'antd';
import { EyeOutlined, CheckCircleOutlined, ShoppingOutlined, SwapOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { exceptionApi } from '../../../services/production';

interface MaterialShortageException {
  id?: number;
  uuid?: string;
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
  handled_by?: number;
  handled_by_name?: string;
  handled_at?: string;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
}

const MaterialShortageExceptionPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);

  // Modal 相关状态
  const [handleModalVisible, setHandleModalVisible] = useState(false);
  const [currentExceptionId, setCurrentExceptionId] = useState<number | null>(null);
  const [handleAction, setHandleAction] = useState<string>('purchase');

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentException, setCurrentException] = useState<MaterialShortageException | null>(null);

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: MaterialShortageException) => {
    try {
      setCurrentException(record);
      setDetailDrawerVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取异常详情失败');
    }
  };

  /**
   * 处理异常
   */
  const handleException = async (record: MaterialShortageException, action: string) => {
    setCurrentExceptionId(record.id!);
    setHandleAction(action);
    setHandleModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      action,
    });
  };

  /**
   * 处理提交异常处理
   */
  const handleExceptionSubmit = async (values: any) => {
    try {
      if (!currentExceptionId) {
        messageApi.error('异常记录ID不存在');
        return;
      }

      await exceptionApi.materialShortage.handle(
        currentExceptionId.toString(),
        values.action,
        values.alternative_material_id,
        values.remarks
      );
      messageApi.success('异常处理成功');
      setHandleModalVisible(false);
      setCurrentExceptionId(null);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '处理异常失败');
      throw error;
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<MaterialShortageException>[] = [
    {
      title: '工单编码',
      dataIndex: 'work_order_code',
      width: 150,
      fixed: 'left',
      ellipsis: true,
    },
    {
      title: '物料编码',
      dataIndex: 'material_code',
      width: 120,
      ellipsis: true,
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
        <Tag color="error">{record.shortage_quantity}</Tag>
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
        critical: { text: '严重', status: 'error' },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        pending: { text: '待处理', status: 'warning' },
        processing: { text: '处理中', status: 'processing' },
        resolved: { text: '已解决', status: 'success' },
        cancelled: { text: '已取消', status: 'default' },
      },
    },
    {
      title: '建议操作',
      dataIndex: 'suggested_action',
      width: 120,
      valueEnum: {
        purchase: { text: '采购', status: 'default' },
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
                icon={<SwapOutlined />}
                onClick={() => handleException(record, 'substitute')}
              >
                替代
              </Button>
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleException(record, 'resolve')}
              >
                解决
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
        headerTitle="缺料异常管理"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        request={async (params) => {
          try {
            const result = await exceptionApi.materialShortage.list({
              skip: (params.current! - 1) * params.pageSize!,
              limit: params.pageSize,
              work_order_id: params.work_order_id,
              status: params.status,
              alert_level: params.alert_level,
            });
            return {
              data: result || [],
              success: true,
              total: result?.length || 0,
            };
          } catch (error) {
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        scroll={{ x: 1400 }}
      />

      {/* 处理异常Modal */}
      <FormModalTemplate
        title="处理缺料异常"
        open={handleModalVisible}
        onCancel={() => {
          setHandleModalVisible(false);
          setCurrentExceptionId(null);
          formRef.current?.resetFields();
        }}
        onFinish={handleExceptionSubmit}
        formRef={formRef}
        {...MODAL_CONFIG}
      >
        <div style={{ marginBottom: 16 }}>
          <Tag color="info">处理操作：{handleAction === 'purchase' ? '采购' : handleAction === 'substitute' ? '替代' : '解决'}</Tag>
        </div>
        {handleAction === 'substitute' && (
          <div>
            <label>替代物料ID：</label>
            <input
              type="number"
              onChange={(e) => {
                formRef.current?.setFieldsValue({
                  alternative_material_id: e.target.value ? Number(e.target.value) : undefined,
                });
              }}
            />
          </div>
        )}
        <div>
          <label>备注：</label>
          <textarea
            rows={3}
            onChange={(e) => {
              formRef.current?.setFieldsValue({
                remarks: e.target.value,
              });
            }}
          />
        </div>
      </FormModalTemplate>

      {/* 详情Drawer */}
      <DetailDrawerTemplate
        title="缺料异常详情"
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentException(null);
        }}
        dataSource={currentException || {}}
        columns={[
          {
            title: '工单编码',
            dataIndex: 'work_order_code',
          },
          {
            title: '物料编码',
            dataIndex: 'material_code',
          },
          {
            title: '物料名称',
            dataIndex: 'material_name',
          },
          {
            title: '需求数量',
            dataIndex: 'required_quantity',
          },
          {
            title: '可用数量',
            dataIndex: 'available_quantity',
          },
          {
            title: '缺料数量',
            dataIndex: 'shortage_quantity',
          },
          {
            title: '预警级别',
            dataIndex: 'alert_level',
            valueEnum: {
              low: { text: '低', status: 'default' },
              medium: { text: '中', status: 'warning' },
              high: { text: '高', status: 'error' },
              critical: { text: '严重', status: 'error' },
            },
          },
          {
            title: '状态',
            dataIndex: 'status',
            valueEnum: {
              pending: { text: '待处理', status: 'warning' },
              processing: { text: '处理中', status: 'processing' },
              resolved: { text: '已解决', status: 'success' },
              cancelled: { text: '已取消', status: 'default' },
            },
          },
          {
            title: '建议操作',
            dataIndex: 'suggested_action',
            valueEnum: {
              purchase: { text: '采购', status: 'default' },
              substitute: { text: '替代', status: 'warning' },
              adjust: { text: '调整', status: 'default' },
            },
          },
          {
            title: '替代物料',
            dataIndex: 'alternative_material_name',
          },
          {
            title: '处理人',
            dataIndex: 'handled_by_name',
          },
          {
            title: '处理时间',
            dataIndex: 'handled_at',
            valueType: 'dateTime',
          },
          {
            title: '备注',
            dataIndex: 'remarks',
          },
        ]}
      />
    </ListPageTemplate>
  );
};

export default MaterialShortageExceptionPage;
