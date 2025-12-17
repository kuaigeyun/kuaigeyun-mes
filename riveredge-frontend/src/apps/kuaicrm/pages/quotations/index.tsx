/**
 * 报价单管理页面
 * 
 * 提供报价单的 CRUD 功能，包括列表展示、创建、编辑、删除、转化为订单等操作。
 */

import React, { useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormDigit, ProFormDatePicker, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, CheckCircleOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni-table';
import { quotationApi } from '../../services/process';
import type { Quotation, QuotationCreate, QuotationUpdate } from '../../types/process';

/**
 * 报价单管理列表页面组件
 */
const QuotationsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentQuotationUuid, setCurrentQuotationUuid] = useState<string | null>(null);
  const [quotationDetail, setQuotationDetail] = useState<Quotation | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑报价单）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  
  // 根据路由路径自动打开创建 Modal
  useEffect(() => {
    if (location.pathname.endsWith('/create')) {
      handleCreate();
      // 清理 URL，避免刷新时重复打开
      navigate(location.pathname.replace('/create', ''), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  /**
   * 处理新建报价单
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentQuotationUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      status: '草稿',
      quotationDate: new Date().toISOString(),
    });
  };

  /**
   * 处理编辑报价单
   */
  const handleEdit = async (record: Quotation) => {
    try {
      setIsEdit(true);
      setCurrentQuotationUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await quotationApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        quotationNo: detail.quotationNo,
        quotationDate: detail.quotationDate,
        customerId: detail.customerId,
        opportunityId: detail.opportunityId,
        leadId: detail.leadId,
        status: detail.status,
        totalAmount: detail.totalAmount,
        validUntil: detail.validUntil,
        description: detail.description,
        terms: detail.terms,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取报价单详情失败');
    }
  };

  /**
   * 处理删除报价单
   */
  const handleDelete = async (record: Quotation) => {
    try {
      await quotationApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: Quotation) => {
    try {
      setCurrentQuotationUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await quotationApi.get(record.uuid);
      setQuotationDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取报价单详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理转化为订单
   */
  const handleConvertToOrder = async (record: Quotation) => {
    Modal.confirm({
      title: '转化为销售订单',
      content: '确定要将此报价单转化为销售订单吗？',
      onOk: async () => {
        try {
          const result = await quotationApi.convertToOrder(record.uuid);
          messageApi.success('报价单已转化为销售订单');
          actionRef.current?.reload();
          // 可以跳转到订单详情页面
          // navigate(`/apps/kuaicrm/sales-orders/${result.order.uuid}`);
        } catch (error: any) {
          messageApi.error(error.message || '转化失败');
        }
      },
    });
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: QuotationCreate | QuotationUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentQuotationUuid) {
        await quotationApi.update(currentQuotationUuid, values as QuotationUpdate);
        messageApi.success('更新成功');
      } else {
        await quotationApi.create(values as QuotationCreate);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || (isEdit ? '更新失败' : '创建失败'));
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Quotation>[] = [
    {
      title: '报价单编号',
      dataIndex: 'quotationNo',
      width: 150,
      fixed: 'left',
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.quotationNo}</a>
      ),
    },
    {
      title: '报价日期',
      dataIndex: 'quotationDate',
      width: 120,
      valueType: 'date',
    },
    {
      title: '客户ID',
      dataIndex: 'customerId',
      width: 100,
    },
    {
      title: '报价金额',
      dataIndex: 'totalAmount',
      width: 120,
      sorter: true,
      render: (amount) => `¥${amount?.toLocaleString() || 0}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '草稿': { text: <Tag color="default">草稿</Tag> },
        '已发送': { text: <Tag color="blue">已发送</Tag> },
        '已接受': { text: <Tag color="green">已接受</Tag> },
        '已拒绝': { text: <Tag color="red">已拒绝</Tag> },
        '已过期': { text: <Tag color="orange">已过期</Tag> },
      },
    },
    {
      title: '有效期至',
      dataIndex: 'validUntil',
      width: 120,
      valueType: 'date',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          {record.status === '已接受' && (
            <Button
              type="link"
              size="small"
              icon={<ShoppingCartOutlined />}
              onClick={() => handleConvertToOrder(record)}
            >
              转订单
            </Button>
          )}
          <Popconfirm
            title="确定要删除此报价单吗？"
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>
      <UniTable<Quotation>
        headerTitle="报价单管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const result = await quotationApi.list({
            skip: (params.current! - 1) * params.pageSize!,
            limit: params.pageSize!,
            status: params.status as string | undefined,
            customerId: params.customerId as number | undefined,
          });
          return {
            data: result,
            success: true,
            total: result.length, // 实际应该从后端返回总数
          };
        }}
        rowKey="uuid"
        search={{
          labelWidth: 'auto',
        }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
        }}
        toolBarRender={() => [
          <Button
            type="primary"
            key="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建报价单
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑报价单 Modal */}
      <Modal
        title={isEdit ? '编辑报价单' : '新建报价单'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
      >
        <ProForm
          formRef={formRef}
          onFinish={handleSubmit}
          submitter={{
            searchConfig: {
              submitText: isEdit ? '更新' : '创建',
            },
            submitButtonProps: {
              loading: formLoading,
            },
          }}
        >
          <ProFormText
            name="quotationNo"
            label="报价单编号"
            rules={[{ required: true, message: '请输入报价单编号' }]}
            fieldProps={{
              placeholder: '请输入报价单编号',
            }}
            disabled={isEdit}
          />
          <ProFormDatePicker
            name="quotationDate"
            label="报价日期"
            rules={[{ required: true, message: '请选择报价日期' }]}
            fieldProps={{
              style: { width: '100%' },
            }}
          />
          <ProFormDigit
            name="customerId"
            label="客户ID"
            rules={[{ required: true, message: '请输入客户ID' }]}
            fieldProps={{
              placeholder: '请输入客户ID',
            }}
          />
          <ProFormDigit
            name="opportunityId"
            label="关联商机ID"
            fieldProps={{
              placeholder: '请输入关联商机ID（可选）',
            }}
          />
          <ProFormDigit
            name="leadId"
            label="关联线索ID"
            fieldProps={{
              placeholder: '请输入关联线索ID（可选）',
            }}
          />
          <ProFormSelect
            name="status"
            label="报价单状态"
            options={[
              { label: '草稿', value: '草稿' },
              { label: '已发送', value: '已发送' },
              { label: '已接受', value: '已接受' },
              { label: '已拒绝', value: '已拒绝' },
              { label: '已过期', value: '已过期' },
            ]}
            rules={[{ required: true, message: '请选择报价单状态' }]}
          />
          <ProFormDigit
            name="totalAmount"
            label="报价金额"
            rules={[{ required: true, message: '请输入报价金额' }]}
            fieldProps={{
              placeholder: '请输入报价金额',
              min: 0,
              precision: 2,
            }}
          />
          <ProFormDatePicker
            name="validUntil"
            label="有效期至"
            fieldProps={{
              style: { width: '100%' },
            }}
          />
          <ProFormTextArea
            name="description"
            label="描述"
            fieldProps={{
              rows: 3,
              placeholder: '请输入描述',
            }}
          />
          <ProFormTextArea
            name="terms"
            label="条款说明"
            fieldProps={{
              rows: 3,
              placeholder: '请输入条款说明',
            }}
          />
        </ProForm>
      </Modal>

      {/* 报价单详情 Drawer */}
      <Drawer
        title="报价单详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : quotationDetail ? (
          <ProDescriptions
            column={1}
            dataSource={quotationDetail}
            columns={[
              {
                title: '报价单编号',
                dataIndex: 'quotationNo',
              },
              {
                title: '报价日期',
                dataIndex: 'quotationDate',
                valueType: 'date',
              },
              {
                title: '客户ID',
                dataIndex: 'customerId',
              },
              {
                title: '关联商机ID',
                dataIndex: 'opportunityId',
              },
              {
                title: '关联线索ID',
                dataIndex: 'leadId',
              },
              {
                title: '报价单状态',
                dataIndex: 'status',
                render: (status) => {
                  const statusMap: Record<string, { color: string; text: string }> = {
                    '草稿': { color: 'default', text: '草稿' },
                    '已发送': { color: 'blue', text: '已发送' },
                    '已接受': { color: 'green', text: '已接受' },
                    '已拒绝': { color: 'red', text: '已拒绝' },
                    '已过期': { color: 'orange', text: '已过期' },
                  };
                  const statusInfo = statusMap[status] || { color: 'default', text: status };
                  return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
                },
              },
              {
                title: '报价金额',
                dataIndex: 'totalAmount',
                render: (amount) => `¥${amount?.toLocaleString() || 0}`,
              },
              {
                title: '有效期至',
                dataIndex: 'validUntil',
                valueType: 'date',
              },
              {
                title: '描述',
                dataIndex: 'description',
              },
              {
                title: '条款说明',
                dataIndex: 'terms',
              },
              {
                title: '创建时间',
                dataIndex: 'createdAt',
                valueType: 'dateTime',
              },
              {
                title: '更新时间',
                dataIndex: 'updatedAt',
                valueType: 'dateTime',
              },
            ]}
          />
        ) : (
          <div>暂无数据</div>
        )}
      </Drawer>
    </div>
  );
};

export default QuotationsPage;

