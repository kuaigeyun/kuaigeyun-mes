/**
 * 不合格品记录管理页面
 * 
 * 提供不合格品记录的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormTextArea, ProFormSelect, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni-table';
import { nonconformingProductApi } from '../../services/process';
import type { NonconformingProduct, NonconformingProductCreate, NonconformingProductUpdate } from '../../types/process';

/**
 * 不合格品记录管理列表页面组件
 */
const NonconformingProductsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentRecordUuid, setCurrentRecordUuid] = useState<string | null>(null);
  const [recordDetail, setRecordDetail] = useState<NonconformingProduct | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑记录）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建记录
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentRecordUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      status: '待处理',
    });
  };

  /**
   * 处理编辑记录
   */
  const handleEdit = async (record: NonconformingProduct) => {
    try {
      setIsEdit(true);
      setCurrentRecordUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await nonconformingProductApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        recordNo: detail.recordNo,
        materialName: detail.materialName,
        quantity: detail.quantity,
        defectDescription: detail.defectDescription,
        defectCause: detail.defectCause,
        impactAssessment: detail.impactAssessment,
        impactScope: detail.impactScope,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取记录详情失败');
    }
  };

  /**
   * 处理删除记录
   */
  const handleDelete = async (record: NonconformingProduct) => {
    try {
      await nonconformingProductApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: NonconformingProduct) => {
    try {
      setCurrentRecordUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await nonconformingProductApi.get(record.uuid);
      setRecordDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取记录详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: NonconformingProductCreate | NonconformingProductUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentRecordUuid) {
        await nonconformingProductApi.update(currentRecordUuid, values as NonconformingProductUpdate);
        messageApi.success('更新成功');
      } else {
        await nonconformingProductApi.create(values as NonconformingProductCreate);
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
  const columns: ProColumns<NonconformingProduct>[] = [
    {
      title: '记录编号',
      dataIndex: 'recordNo',
      width: 150,
      fixed: 'left',
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.recordNo}</a>
      ),
    },
    {
      title: '物料名称',
      dataIndex: 'materialName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '不合格数量',
      dataIndex: 'quantity',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '缺陷类型',
      dataIndex: 'defectTypeName',
      width: 150,
    },
    {
      title: '影响评估',
      dataIndex: 'impactAssessment',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '高': { text: <Tag color="red">高</Tag> },
        '中': { text: <Tag color="orange">中</Tag> },
        '低': { text: <Tag color="default">低</Tag> },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '待处理': { text: <Tag color="default">待处理</Tag> },
        '处理中': { text: <Tag color="processing">处理中</Tag> },
        '已处理': { text: <Tag color="success">已处理</Tag> },
        '已关闭': { text: <Tag color="default">已关闭</Tag> },
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 150,
      valueType: 'dateTime',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
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
          <Popconfirm
            title="确定要删除这条记录吗？"
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
      <UniTable<NonconformingProduct>
        headerTitle="不合格品记录管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await nonconformingProductApi.list({
            skip,
            limit: pageSize,
            ...rest,
          });
          return {
            data,
            success: true,
            total: data.length,
          };
        }}
        rowKey="uuid"
        search={{
          labelWidth: 'auto',
        }}
        toolBarRender={() => [
          <Button
            type="primary"
            key="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建记录
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑不合格品记录' : '新建不合格品记录'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
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
            name="recordNo"
            label="记录编号"
            rules={[{ required: true, message: '请输入记录编号' }]}
            placeholder="请输入记录编号"
          />
          <ProFormText
            name="materialName"
            label="物料名称"
            rules={[{ required: true, message: '请输入物料名称' }]}
            placeholder="请输入物料名称"
          />
          <ProFormText
            name="quantity"
            label="不合格数量"
            rules={[{ required: true, message: '请输入不合格数量' }]}
            placeholder="请输入不合格数量"
          />
          <ProFormTextArea
            name="defectDescription"
            label="缺陷描述"
            rules={[{ required: true, message: '请输入缺陷描述' }]}
            placeholder="请输入缺陷描述"
          />
          <ProFormTextArea
            name="defectCause"
            label="缺陷原因"
            placeholder="请输入缺陷原因"
          />
          <ProFormSelect
            name="impactAssessment"
            label="影响评估"
            options={[
              { label: '高', value: '高' },
              { label: '中', value: '中' },
              { label: '低', value: '低' },
            ]}
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="不合格品记录详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : recordDetail ? (
          <ProDescriptions<NonconformingProduct>
            column={1}
            dataSource={recordDetail}
            columns={[
              { title: '记录编号', dataIndex: 'recordNo' },
              { title: '物料名称', dataIndex: 'materialName' },
              { title: '不合格数量', dataIndex: 'quantity', valueType: 'digit' },
              { title: '缺陷类型', dataIndex: 'defectTypeName' },
              { title: '缺陷描述', dataIndex: 'defectDescription' },
              { title: '缺陷原因', dataIndex: 'defectCause' },
              { title: '影响评估', dataIndex: 'impactAssessment' },
              { title: '影响范围', dataIndex: 'impactScope' },
              { title: '状态', dataIndex: 'status' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default NonconformingProductsPage;
