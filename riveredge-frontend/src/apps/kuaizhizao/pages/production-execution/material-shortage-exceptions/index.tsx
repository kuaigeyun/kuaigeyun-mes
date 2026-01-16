/**
 * 缺料异常处理页面
 *
 * 提供缺料异常处理功能，包括预警列表、替代物料推荐、紧急采购等。
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormTextArea } from '@ant-design/pro-components';
import { App, Tag, Button, Space, Modal, message, Form } from 'antd';
import { EyeOutlined, CheckCircleOutlined, ShoppingOutlined, SwapOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { apiRequest } from '../../../../../services/api';
import { materialApi } from '../../../../master-data/services/material';

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
  const [handleModalVisible, setHandleModalVisible] = useState(false);
  const [currentAction, setCurrentAction] = useState<string>('');
  const [materialList, setMaterialList] = useState<any[]>([]);
  const handleFormRef = useRef<any>(null);

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: MaterialShortageException) => {
    setCurrentRecord(record);
    setDetailDrawerVisible(true);
  };

  // 加载物料列表
  useEffect(() => {
    const loadMaterials = async () => {
      try {
        const materials = await materialApi.list({ isActive: true });
        setMaterialList(materials);
      } catch (error) {
        console.error('获取物料列表失败:', error);
      }
    };
    loadMaterials();
  }, []);

  /**
   * 打开处理异常Modal
   */
  const openHandleModal = (record: MaterialShortageException, action: string) => {
    setCurrentRecord(record);
    setCurrentAction(action);
    setHandleModalVisible(true);
    setTimeout(() => {
      handleFormRef.current?.resetFields();
    }, 100);
  };

  /**
   * 处理缺料异常
   */
  const handleException = async (values: any) => {
    try {
      if (!currentRecord?.id) {
        throw new Error('异常记录不存在');
      }

      const params: any = {
        action: currentAction,
      };

      if (currentAction === 'substitute' && values.alternativeMaterialId) {
        params.alternative_material_id = values.alternativeMaterialId;
      }

      if (values.remarks) {
        params.remarks = values.remarks;
      }

      await apiRequest(`/apps/kuaizhizao/exceptions/material-shortage/${currentRecord.id}/handle`, {
        method: 'POST',
        params,
      });
      messageApi.success('处理成功');
      setHandleModalVisible(false);
      setCurrentRecord(null);
      setCurrentAction('');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '处理失败');
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
                onClick={() => openHandleModal(record, 'purchase')}
              >
                采购
              </Button>
              <Button
                type="link"
                size="small"
                icon={<SwapOutlined />}
                onClick={() => openHandleModal(record, 'substitute')}
              >
                替代
              </Button>
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => openHandleModal(record, 'resolve')}
              >
                已解决
              </Button>
              <Button
                type="link"
                size="small"
                icon={<CloseCircleOutlined />}
                onClick={() => openHandleModal(record, 'cancel')}
                danger
              >
                取消
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
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentRecord(null);
        }}
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

      {/* 处理异常 Modal */}
      <FormModalTemplate
        title={
          currentAction === 'purchase' ? '处理缺料异常 - 采购' :
          currentAction === 'substitute' ? '处理缺料异常 - 替代物料' :
          currentAction === 'resolve' ? '处理缺料异常 - 已解决' :
          currentAction === 'cancel' ? '处理缺料异常 - 取消' :
          '处理缺料异常'
        }
        open={handleModalVisible}
        onClose={() => {
          setHandleModalVisible(false);
          setCurrentRecord(null);
          setCurrentAction('');
          handleFormRef.current?.resetFields();
        }}
        onFinish={handleException}
        width={MODAL_CONFIG.MEDIUM_WIDTH}
        formRef={handleFormRef}
      >
        {currentRecord && (
          <>
            <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
              <p><strong>工单编码：</strong>{currentRecord.work_order_code}</p>
              <p><strong>物料名称：</strong>{currentRecord.material_name}</p>
              <p><strong>缺料数量：</strong>
                <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                  {currentRecord.shortage_quantity}
                </span>
              </p>
            </div>
            {currentAction === 'substitute' && (
              <ProFormSelect
                name="alternativeMaterialId"
                label="替代物料"
                placeholder="请选择替代物料"
                options={materialList
                  .filter(m => m.id !== currentRecord.material_id)
                  .map(material => ({
                    label: `${material.code || material.mainCode} - ${material.name}`,
                    value: material.id,
                  }))}
                rules={[{ required: true, message: '请选择替代物料' }]}
                fieldProps={{
                  showSearch: true,
                  filterOption: (input: string, option: any) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
                }}
              />
            )}
            <ProFormTextArea
              name="remarks"
              label="备注"
              placeholder="请输入处理备注（可选）"
              fieldProps={{
                rows: 4,
              }}
            />
          </>
        )}
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default MaterialShortageExceptionsPage;

