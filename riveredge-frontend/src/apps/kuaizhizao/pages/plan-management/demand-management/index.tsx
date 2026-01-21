/**
 * 统一需求管理页面
 *
 * 提供销售预测和销售订单的统一管理功能，支持MTS/MTO两种模式。
 *
 * 根据《☆ 用户使用全场景推演.md》的设计理念，将销售预测和销售订单统一为需求管理。
 *
 * @author Luigi Lu
 * @date 2025-01-14
 */

import React, { useRef, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ActionType, ProColumns, ProForm, ProFormSelect, ProFormText, ProFormDatePicker, ProFormDigit, ProFormTextArea, ProDescriptions } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Drawer, Table, Input } from 'antd';
import { EyeOutlined, EditOutlined, CheckCircleOutlined, CloseCircleOutlined, SendOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { 
  listDemands, 
  getDemand, 
  createDemand, 
  updateDemand, 
  submitDemand, 
  approveDemand, 
  rejectDemand,
  batchCreateDemands,
  pushDemandToComputation,
  Demand,
  DemandItem 
} from '../../../services/demand';
import { getDocumentRelations } from '../../../services/document-relation';
import DocumentRelationDisplay from '../../../../../components/document-relation-display';
import type { DocumentRelationData } from '../../../../../components/document-relation-display';

const DemandManagementPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const [searchParams] = useSearchParams();
  
  // Modal 相关状态（新建/编辑）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentDemand, setCurrentDemand] = useState<Demand | null>(null);
  const [documentRelations, setDocumentRelations] = useState<DocumentRelationData | null>(null);
  
  // 需求类型选择（销售预测/销售订单），支持从 URL 参数读取
  const urlDemandType = searchParams.get('demand_type') as 'sales_forecast' | 'sales_order' | null;
  const [demandType, setDemandType] = useState<'sales_forecast' | 'sales_order'>(
    urlDemandType || 'sales_forecast'
  );

  // 当 URL 参数变化时，更新需求类型
  useEffect(() => {
    if (urlDemandType && (urlDemandType === 'sales_forecast' || urlDemandType === 'sales_order')) {
      setDemandType(urlDemandType);
    }
  }, [urlDemandType]);

  /**
   * 处理新建需求
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentId(null);
    setModalVisible(true);
    formRef.current?.resetFields();
  };

  /**
   * 处理编辑需求
   */
  const handleEdit = async (keys: React.Key[]) => {
    if (keys.length === 1) {
      const id = Number(keys[0]);
      setIsEdit(true);
      setCurrentId(id);
      setModalVisible(true);
      try {
        const data = await getDemand(id);
        formRef.current?.setFieldsValue(data);
        setDemandType(data.demand_type || 'sales_forecast');
      } catch (error: any) {
        messageApi.error('获取需求详情失败');
      }
    }
  };

  /**
   * 处理详情查看
   */
  const handleDetail = async (keys: React.Key[]) => {
    if (keys.length === 1) {
      const id = Number(keys[0]);
      try {
        const data = await getDemand(id, true, true);  // includeItems=true, includeDuration=true
        setCurrentDemand(data);
        
        // 获取单据关联关系
        try {
          const relations = await getDocumentRelations('demand', id);
          setDocumentRelations(relations);
        } catch (error) {
          console.error('获取单据关联关系失败:', error);
          setDocumentRelations(null);
        }
        
        setDrawerVisible(true);
      } catch (error: any) {
        messageApi.error('获取需求详情失败');
      }
    }
  };

  /**
   * 处理删除需求
   */
  const handleDelete = async (_keys: React.Key[]) => {
    // TODO: 实现删除功能
    messageApi.info('删除功能待实现');
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: any) => {
    try {
      values.demand_type = demandType;
      values.business_mode = demandType === 'sales_forecast' ? 'MTS' : 'MTO';
      
      if (isEdit && currentId) {
        await updateDemand(currentId, values);
        messageApi.success('需求更新成功');
      } else {
        await createDemand(values);
        messageApi.success('需求创建成功');
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    }
  };

  /**
   * 处理提交需求
   */
  const handleSubmitDemand = async (id: number) => {
    Modal.confirm({
      title: '提交需求',
      content: '确定要提交此需求吗？提交后将进入审核流程。',
      onOk: async () => {
        try {
          await submitDemand(id);
          messageApi.success('需求提交成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '提交失败');
        }
      },
    });
  };

  /**
   * 处理审核通过
   */
  const handleApprove = async (id: number) => {
    Modal.confirm({
      title: '审核通过',
      content: '确定要审核通过此需求吗？',
      onOk: async () => {
        try {
          await approveDemand(id);
          messageApi.success('需求审核通过');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '审核失败');
        }
      },
    });
  };

  /**
   * 处理批量导入
   */
  const handleImport = async (data: any[][]) => {
    if (!data || data.length === 0) {
      messageApi.warning('导入数据为空');
      return;
    }

    try {
      // 第一行是表头，从第二行开始是数据
      const headers = data[0];
      const rows = data.slice(1);

      // 字段映射（表头名称 -> 字段名）
      const fieldMap: Record<string, string> = {
        '需求类型': 'demand_type',
        '需求名称': 'demand_name',
        '业务模式': 'business_mode',
        '开始日期': 'start_date',
        '结束日期': 'end_date',
        '预测周期': 'forecast_period',
        '客户ID': 'customer_id',
        '客户名称': 'customer_name',
        '客户联系人': 'customer_contact',
        '客户电话': 'customer_phone',
        '订单日期': 'order_date',
        '交货日期': 'delivery_date',
        '销售员ID': 'salesman_id',
        '销售员姓名': 'salesman_name',
        '收货地址': 'shipping_address',
        '发货方式': 'shipping_method',
        '付款条件': 'payment_terms',
        '备注': 'notes',
      };

      // 转换数据
      const demands: Partial<Demand>[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.every(cell => !cell || cell.toString().trim() === '')) {
          continue; // 跳过空行
        }

        const demand: any = {
          status: '草稿',
          review_status: '待审核',
        };

        // 映射字段
        for (let j = 0; j < headers.length && j < row.length; j++) {
          const header = headers[j]?.toString().trim();
          const value = row[j]?.toString().trim();
          
          if (!header || !value) continue;

          const fieldName = fieldMap[header];
          if (fieldName) {
            // 处理日期字段
            if (fieldName.includes('date') || fieldName.includes('period')) {
              demand[fieldName] = value;
            }
            // 处理数字字段
            else if (fieldName.includes('_id')) {
              demand[fieldName] = value ? parseInt(value, 10) : null;
            }
            // 处理枚举字段
            else if (fieldName === 'demand_type') {
              demand[fieldName] = value === '销售预测' ? 'sales_forecast' : 
                                 value === '销售订单' ? 'sales_order' : value;
            }
            else if (fieldName === 'business_mode') {
              demand[fieldName] = value.toUpperCase();
            }
            // 其他字段直接赋值
            else {
              demand[fieldName] = value;
            }
          }
        }

        // 根据需求类型设置业务模式
        if (demand.demand_type === 'sales_forecast' && !demand.business_mode) {
          demand.business_mode = 'MTS';
        } else if (demand.demand_type === 'sales_order' && !demand.business_mode) {
          demand.business_mode = 'MTO';
        }

        demands.push(demand);
      }

      if (demands.length === 0) {
        messageApi.warning('没有有效的数据行');
        return;
      }

      // 调用批量创建API
      const result = await batchCreateDemands(demands);
      
      if (result.failure_count === 0) {
        messageApi.success(`批量导入成功！成功导入 ${result.success_count} 条需求`);
        actionRef.current?.reload();
      } else {
        messageApi.warning(
          `批量导入完成，成功 ${result.success_count} 条，失败 ${result.failure_count} 条`
        );
        // 显示错误详情
        if (result.errors && result.errors.length > 0) {
          const errorMessages = result.errors
            .slice(0, 10) // 只显示前10个错误
            .map(err => `第 ${err.row} 行: ${err.error}`)
            .join('\n');
          messageApi.error(`部分数据导入失败：\n${errorMessages}`, 10);
        }
        if (result.success_count > 0) {
          actionRef.current?.reload();
        }
      }
    } catch (error: any) {
      messageApi.error(`批量导入失败: ${error.message || '未知错误'}`);
    }
  };

  /**
   * 处理下推需求到物料需求运算
   */
  const handlePushToComputation = async (id: number) => {
    Modal.confirm({
      title: '下推到物料需求运算',
      content: '确定要将此需求下推到物料需求运算吗？下推后将创建需求计算任务。',
      onOk: async () => {
        try {
          const result = await pushDemandToComputation(id);
          messageApi.success(result.message || '需求下推成功');
          if (result.computation_code) {
            messageApi.info(`计算编码：${result.computation_code}`);
          }
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '下推失败');
        }
      },
    });
  };

  /**
   * 处理驳回需求
   */
  const handleReject = async (id: number) => {
    Modal.confirm({
      title: '驳回需求',
      content: (
        <Input.TextArea
          placeholder="请输入驳回原因"
          rows={4}
          id="rejection-reason-input"
        />
      ),
      onOk: async () => {
        const reasonInput = document.getElementById('rejection-reason-input') as HTMLTextAreaElement;
        const reason = reasonInput?.value?.trim();
        if (!reason) {
          messageApi.warning('请输入驳回原因');
          return;
        }
        try {
          await rejectDemand(id, reason);
          messageApi.success('需求已驳回');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '驳回失败');
        }
      },
    });
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Demand>[] = [
    {
      title: '需求编码',
      dataIndex: 'demand_code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '需求类型',
      dataIndex: 'demand_type',
      width: 120,
      valueEnum: {
        'sales_forecast': { text: '销售预测', status: 'Processing' },
        'sales_order': { text: '销售订单', status: 'Success' },
      },
    },
    {
      title: '需求名称',
      dataIndex: 'demand_name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '业务模式',
      dataIndex: 'business_mode',
      width: 100,
      valueEnum: {
        'MTS': { text: 'MTS', status: 'Processing' },
        'MTO': { text: 'MTO', status: 'Success' },
      },
    },
    {
      title: '开始日期',
      dataIndex: 'start_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '结束日期',
      dataIndex: 'end_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '交货日期',
      dataIndex: 'delivery_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '客户名称',
      dataIndex: 'customer_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '总数量',
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      width: 120,
      align: 'right',
      render: (text) => text ? `¥${Number(text).toLocaleString()}` : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        '草稿': { text: '草稿', status: 'Default' },
        '待审核': { text: '待审核', status: 'Processing' },
        '已审核': { text: '已审核', status: 'Success' },
        '已驳回': { text: '已驳回', status: 'Error' },
      },
    },
    {
      title: '审核状态',
      dataIndex: 'review_status',
      width: 100,
      valueEnum: {
        '待审核': { text: '待审核', status: 'Default' },
        '通过': { text: '通过', status: 'Success' },
        '驳回': { text: '驳回', status: 'Error' },
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
            onClick={() => handleDetail([record.id!])}
          >
            详情
          </Button>
          {record.status === '草稿' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit([record.id!])}
              >
                编辑
              </Button>
              <Button
                type="link"
                size="small"
                icon={<SendOutlined />}
                onClick={() => handleSubmitDemand(record.id!)}
                style={{ color: '#1890ff' }}
              >
                提交
              </Button>
            </>
          )}
          {record.status === '待审核' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleApprove(record.id!)}
                style={{ color: '#52c41a' }}
              >
                审核
              </Button>
              <Button
                type="link"
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => handleReject(record.id!)}
              >
                驳回
              </Button>
            </>
          )}
          {record.status === '已审核' && 
           record.review_status === '通过' && 
           !record.pushed_to_computation && (
            <Button
              type="link"
              size="small"
              icon={<ArrowDownOutlined />}
              onClick={() => handlePushToComputation(record.id!)}
              style={{ color: '#1890ff' }}
            >
              下推
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<Demand>
          actionRef={actionRef}
          columns={columns}
          request={async (params, sort, _filter, searchFormValues) => {
            const apiParams: any = {
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
            };
            
            // 处理搜索参数，优先使用搜索表单的值，如果没有则使用 URL 参数的值
            if (searchFormValues?.demand_type) {
              apiParams.demand_type = searchFormValues.demand_type;
            } else if (urlDemandType) {
              apiParams.demand_type = urlDemandType;
            }
            if (searchFormValues?.status) {
              apiParams.status = searchFormValues.status;
            }
            if (searchFormValues?.business_mode) {
              apiParams.business_mode = searchFormValues.business_mode;
            }
            if (searchFormValues?.review_status) {
              apiParams.review_status = searchFormValues.review_status;
            }
            
            // 处理排序
            if (sort) {
              const sortKeys = Object.keys(sort);
              if (sortKeys.length > 0) {
                const key = sortKeys[0];
                apiParams.order_by = sort[key] === 'ascend' ? key : `-${key}`;
              }
            }
            
            try {
              const response = await listDemands(apiParams);
              return {
                data: response.data || [],
                success: response.success !== false,
                total: response.total || 0,
              };
            } catch (error: any) {
              messageApi.error(error?.message || '获取列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          rowKey="id"
          showAdvancedSearch={true}
          showCreateButton={true}
          onCreate={handleCreate}
          showEditButton={true}
          onEdit={handleEdit}
          showDeleteButton={true}
          onDelete={handleDelete}
          showImportButton={true}
          onImport={handleImport}
          importHeaders={[
            '需求类型',
            '需求名称',
            '业务模式',
            '开始日期',
            '结束日期',
            '预测周期',
            '客户ID',
            '客户名称',
            '客户联系人',
            '客户电话',
            '订单日期',
            '交货日期',
            '销售员ID',
            '销售员姓名',
            '收货地址',
            '发货方式',
            '付款条件',
            '备注',
          ]}
          importExampleRow={[
            '销售预测',
            '2026年1月销售预测',
            'MTS',
            '2026-01-01',
            '2026-01-31',
            '2026-01',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '批量导入示例',
          ]}
        />
      </ListPageTemplate>
      
      {/* 新建/编辑 Modal */}
      <Modal
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        title={isEdit ? '编辑需求' : '新建需求'}
        width={900}
        footer={null}
        destroyOnClose
      >
        <ProForm
          formRef={formRef}
          onFinish={handleSubmit}
          layout="vertical"
          submitter={{
            render: () => (
              <div style={{ textAlign: 'right', marginTop: 16 }}>
                <Space>
                  <Button onClick={() => setModalVisible(false)}>取消</Button>
                  <Button type="primary" onClick={() => formRef.current?.submit()}>
                    {isEdit ? '更新' : '创建'}
                  </Button>
                </Space>
              </div>
            ),
          }}
        >
          <ProFormSelect
            name="demand_type"
            label="需求类型"
            options={[
              { label: '销售预测', value: 'sales_forecast' },
              { label: '销售订单', value: 'sales_order' },
            ]}
            rules={[{ required: true, message: '请选择需求类型' }]}
            fieldProps={{
              onChange: (value: 'sales_forecast' | 'sales_order') => setDemandType(value),
            }}
            disabled={isEdit}
          />
          <ProFormText
            name="demand_name"
            label="需求名称"
            placeholder="请输入需求名称"
            rules={[{ required: true, message: '请输入需求名称' }]}
          />
          <ProFormDatePicker
            name="start_date"
            label="开始日期"
            rules={[{ required: true, message: '请选择开始日期' }]}
            width="100%"
          />
          <ProFormDatePicker
            name="end_date"
            label="结束日期"
            width="100%"
          />
          {/* 销售预测专用字段 */}
          {demandType === 'sales_forecast' && (
            <>
              <ProFormText
                name="forecast_period"
                label="预测周期"
                placeholder="例如：2026-01"
                rules={[{ required: true, message: '请输入预测周期' }]}
              />
            </>
          )}
          {/* 销售订单专用字段 */}
          {demandType === 'sales_order' && (
            <>
              <ProFormDigit
                name="customer_id"
                label="客户ID"
                rules={[{ required: true, message: '请输入客户ID' }]}
              />
              <ProFormText
                name="customer_name"
                label="客户名称"
                rules={[{ required: true, message: '请输入客户名称' }]}
              />
              <ProFormText
                name="customer_contact"
                label="客户联系人"
              />
              <ProFormText
                name="customer_phone"
                label="客户电话"
              />
              <ProFormDatePicker
                name="order_date"
                label="订单日期"
                rules={[{ required: true, message: '请选择订单日期' }]}
                width="100%"
              />
              <ProFormDatePicker
                name="delivery_date"
                label="交货日期"
                rules={[{ required: true, message: '请选择交货日期' }]}
                width="100%"
              />
              <ProFormDigit
                name="salesman_id"
                label="销售员ID"
              />
              <ProFormText
                name="salesman_name"
                label="销售员姓名"
              />
              <ProFormTextArea
                name="shipping_address"
                label="收货地址"
                fieldProps={{ rows: 2 }}
              />
              <ProFormText
                name="shipping_method"
                label="发货方式"
              />
              <ProFormText
                name="payment_terms"
                label="付款条件"
              />
            </>
          )}
          <ProFormTextArea
            name="notes"
            label="备注"
            fieldProps={{ rows: 3 }}
          />
        </ProForm>
      </Modal>
      
      {/* 详情 Drawer */}
      <Drawer
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        title={`需求详情 - ${currentDemand?.demand_code || ''}`}
        width={900}
        extra={
          currentDemand && (
            <Space>
              {currentDemand.status === '草稿' && (
                <>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={() => handleSubmitDemand(currentDemand.id!)}
                  >
                    提交
                  </Button>
                  <Button
                    icon={<EditOutlined />}
                    onClick={() => {
                      setDrawerVisible(false);
                      handleEdit([currentDemand.id!]);
                    }}
                  >
                    编辑
                  </Button>
                </>
              )}
              {currentDemand.status === '待审核' && (
                <>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={() => handleApprove(currentDemand.id!)}
                    style={{ color: '#52c41a', borderColor: '#52c41a' }}
                  >
                    审核通过
                  </Button>
                  <Button
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={() => handleReject(currentDemand.id!)}
                  >
                    驳回
                  </Button>
                </>
              )}
              {currentDemand.status === '已审核' && 
               currentDemand.review_status === '通过' && 
               !currentDemand.pushed_to_computation && (
                <Button
                  type="primary"
                  icon={<ArrowDownOutlined />}
                  onClick={() => handlePushToComputation(currentDemand.id!)}
                >
                  下推到物料需求运算
                </Button>
              )}
            </Space>
          )
        }
      >
        {currentDemand && (
          <div style={{ padding: '16px 0' }}>
            <ProDescriptions
              column={2}
              title="基本信息"
              dataSource={currentDemand}
            >
              <ProDescriptions.Item label="需求编码" dataIndex="demand_code" />
              <ProDescriptions.Item label="需求类型" dataIndex="demand_type">
                <Tag color={currentDemand.demand_type === 'sales_forecast' ? 'processing' : 'success'}>
                  {currentDemand.demand_type === 'sales_forecast' ? '销售预测' : '销售订单'}
                </Tag>
              </ProDescriptions.Item>
              <ProDescriptions.Item label="需求名称" dataIndex="demand_name" />
              <ProDescriptions.Item label="业务模式" dataIndex="business_mode">
                <Tag color={currentDemand.business_mode === 'MTS' ? 'processing' : 'success'}>
                  {currentDemand.business_mode}
                </Tag>
              </ProDescriptions.Item>
              <ProDescriptions.Item label="开始日期" dataIndex="start_date" valueType="date" />
              <ProDescriptions.Item label="结束日期" dataIndex="end_date" valueType="date" />
              {currentDemand.demand_type === 'sales_forecast' && (
                <ProDescriptions.Item label="预测周期" dataIndex="forecast_period" />
              )}
              {currentDemand.demand_type === 'sales_order' && (
                <>
                  <ProDescriptions.Item label="订单日期" dataIndex="order_date" valueType="date" />
                  <ProDescriptions.Item label="交货日期" dataIndex="delivery_date" valueType="date" />
                </>
              )}
              <ProDescriptions.Item label="客户名称" dataIndex="customer_name" />
              {currentDemand.demand_type === 'sales_order' && (
                <>
                  <ProDescriptions.Item label="客户联系人" dataIndex="customer_contact" />
                  <ProDescriptions.Item label="客户电话" dataIndex="customer_phone" />
                  <ProDescriptions.Item label="销售员" dataIndex="salesman_name" />
                  <ProDescriptions.Item label="收货地址" dataIndex="shipping_address" span={2} />
                  <ProDescriptions.Item label="发货方式" dataIndex="shipping_method" />
                  <ProDescriptions.Item label="付款条件" dataIndex="payment_terms" />
                </>
              )}
              <ProDescriptions.Item label="总数量" dataIndex="total_quantity" />
              <ProDescriptions.Item label="总金额" dataIndex="total_amount">
                {currentDemand.total_amount ? `¥${Number(currentDemand.total_amount).toLocaleString()}` : '-'}
              </ProDescriptions.Item>
              <ProDescriptions.Item label="状态" dataIndex="status">
                <Tag
                  color={
                    currentDemand.status === '已审核' ? 'success' :
                    currentDemand.status === '待审核' ? 'processing' :
                    currentDemand.status === '已驳回' ? 'error' : 'default'
                  }
                >
                  {currentDemand.status}
                </Tag>
              </ProDescriptions.Item>
              <ProDescriptions.Item label="审核状态" dataIndex="review_status">
                <Tag
                  color={
                    currentDemand.review_status === '通过' ? 'success' :
                    currentDemand.review_status === '驳回' ? 'error' : 'default'
                  }
                >
                  {currentDemand.review_status}
                </Tag>
              </ProDescriptions.Item>
              {currentDemand.reviewer_name && (
                <>
                  <ProDescriptions.Item label="审核人" dataIndex="reviewer_name" />
                  <ProDescriptions.Item label="审核时间" dataIndex="review_time" valueType="dateTime" />
                </>
              )}
              {currentDemand.review_remarks && (
                <ProDescriptions.Item label="审核备注" dataIndex="review_remarks" span={2} />
              )}
              {currentDemand.notes && (
                <ProDescriptions.Item label="备注" dataIndex="notes" span={2} />
              )}
              {currentDemand.submit_time && (
                <ProDescriptions.Item label="提交时间" dataIndex="submit_time" valueType="dateTime" />
              )}
            </ProDescriptions>

            {/* 耗时统计 */}
            {(currentDemand as any).duration_info && (
              <div style={{ marginTop: 24 }}>
                <h4>耗时统计</h4>
                <ProDescriptions
                  column={2}
                  dataSource={(currentDemand as any).duration_info}
                >
                  <ProDescriptions.Item label="创建时间" dataIndex="created_at" valueType="dateTime" />
                  {currentDemand.submit_time && (
                    <>
                      <ProDescriptions.Item label="提交时间" dataIndex="submit_time" valueType="dateTime" />
                      {(currentDemand as any).duration_info?.duration_to_submit !== null && (
                        <ProDescriptions.Item 
                          label="创建到提交耗时" 
                          dataIndex="duration_to_submit"
                        >
                          {(currentDemand as any).duration_info?.duration_to_submit 
                            ? `${(currentDemand as any).duration_info.duration_to_submit} 小时` 
                            : '-'}
                        </ProDescriptions.Item>
                      )}
                    </>
                  )}
                  {currentDemand.review_time && (
                    <>
                      <ProDescriptions.Item label="审核时间" dataIndex="review_time" valueType="dateTime" />
                      {(currentDemand as any).duration_info?.duration_to_review !== null && (
                        <ProDescriptions.Item 
                          label="创建到审核耗时" 
                          dataIndex="duration_to_review"
                        >
                          {(currentDemand as any).duration_info?.duration_to_review 
                            ? `${(currentDemand as any).duration_info.duration_to_review} 小时` 
                            : '-'}
                        </ProDescriptions.Item>
                      )}
                      {(currentDemand as any).duration_info?.duration_submit_to_review !== null && (
                        <ProDescriptions.Item 
                          label="提交到审核耗时" 
                          dataIndex="duration_submit_to_review"
                        >
                          {(currentDemand as any).duration_info?.duration_submit_to_review 
                            ? `${(currentDemand as any).duration_info.duration_submit_to_review} 小时` 
                            : '-'}
                        </ProDescriptions.Item>
                      )}
                    </>
                  )}
                </ProDescriptions>
              </div>
            )}

            {/* 需求明细表格 */}
            {currentDemand.items && currentDemand.items.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h4>需求明细</h4>
                <Table<DemandItem>
                  size="small"
                  columns={[
                    { title: '物料编码', dataIndex: 'material_code', width: 120 },
                    { title: '物料名称', dataIndex: 'material_name', width: 150 },
                    { title: '物料规格', dataIndex: 'material_spec', width: 120 },
                    { title: '单位', dataIndex: 'material_unit', width: 80 },
                    { title: '需求数量', dataIndex: 'required_quantity', width: 100, align: 'right' as const },
                    ...(currentDemand.demand_type === 'sales_forecast' ? [
                      { title: '预测日期', dataIndex: 'forecast_date', width: 120 },
                      { title: '预测月份', dataIndex: 'forecast_month', width: 100 },
                    ] : [
                      { title: '交货日期', dataIndex: 'delivery_date', width: 120 },
                      { title: '已交货数量', dataIndex: 'delivered_quantity', width: 100, align: 'right' as const },
                      { title: '剩余数量', dataIndex: 'remaining_quantity', width: 100, align: 'right' as const },
                    ]),
                    { title: '单价', dataIndex: 'unit_price', width: 100, align: 'right' as const, render: (text) => text ? `¥${Number(text).toLocaleString()}` : '-' },
                    { title: '金额', dataIndex: 'item_amount', width: 120, align: 'right' as const, render: (text) => text ? `¥${Number(text).toLocaleString()}` : '-' },
                  ]}
                  dataSource={currentDemand.items}
                  pagination={false}
                  bordered
                  rowKey="id"
                />
              </div>
            )}

            {/* 单据关联 */}
            <DocumentRelationDisplay
              relations={documentRelations}
              onDocumentClick={(documentType, documentId) => {
                // TODO: 根据单据类型跳转到对应的详情页面
                messageApi.info(`跳转到${documentType}#${documentId}的详情页面`);
              }}
              style={{ marginTop: 24 }}
            />
          </div>
        )}
      </Drawer>
    </>
  );
};

export default DemandManagementPage;
