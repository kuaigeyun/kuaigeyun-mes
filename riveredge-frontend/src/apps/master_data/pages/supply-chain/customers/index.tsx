/**
 * 客户管理页面
 * 
 * 提供客户的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormTextArea, ProFormSwitch, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni-table';
import { customerApi } from '../../../services/supply-chain';
import type { Customer, CustomerCreate, CustomerUpdate } from '../../../types/supply-chain';

/**
 * 客户管理列表页面组件
 */
const CustomersPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentCustomerUuid, setCurrentCustomerUuid] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<Customer | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑客户）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建客户
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentCustomerUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      isActive: true,
    });
  };

  /**
   * 处理编辑客户
   */
  const handleEdit = async (record: Customer) => {
    try {
      setIsEdit(true);
      setCurrentCustomerUuid(record.uuid);
      setModalVisible(true);
      
      // 获取客户详情
      const detail = await customerApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        code: detail.code,
        name: detail.name,
        shortName: detail.shortName,
        contactPerson: detail.contactPerson,
        phone: detail.phone,
        email: detail.email,
        address: detail.address,
        category: detail.category,
        isActive: detail.isActive,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取客户详情失败');
    }
  };

  /**
   * 处理删除客户
   */
  const handleDelete = async (record: Customer) => {
    try {
      await customerApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: Customer) => {
    try {
      setCurrentCustomerUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await customerApi.get(record.uuid);
      setCustomerDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取客户详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setCurrentCustomerUuid(null);
    setCustomerDetail(null);
  };

  /**
   * 处理提交表单（创建/更新客户）
   */
  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentCustomerUuid) {
        // 更新客户
        await customerApi.update(currentCustomerUuid, values as CustomerUpdate);
        messageApi.success('更新成功');
      } else {
        // 创建客户
        await customerApi.create(values as CustomerCreate);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || (isEdit ? '更新失败' : '创建失败'));
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 处理关闭 Modal
   */
  const handleCloseModal = () => {
    setModalVisible(false);
    formRef.current?.resetFields();
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Customer>[] = [
    {
      title: '客户编码',
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
    },
    {
      title: '客户名称',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: '简称',
      dataIndex: 'shortName',
      width: 150,
      hideInSearch: true,
    },
    {
      title: '联系人',
      dataIndex: 'contactPerson',
      width: 120,
      hideInSearch: true,
    },
    {
      title: '电话',
      dataIndex: 'phone',
      width: 150,
      hideInSearch: true,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      width: 200,
      hideInSearch: true,
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 120,
      hideInSearch: true,
    },
    {
      title: '启用状态',
      dataIndex: 'isActive',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '启用', status: 'Success' },
        false: { text: '禁用', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.isActive ? 'success' : 'default'}>
          {record.isActive ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
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
            onClick={() => handleOpenDetail(record)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个客户吗？"
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="link"
              danger
              size="small"
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
    <>
      <UniTable<Customer>
        actionRef={actionRef}
        columns={columns}
        request={async (params, sort, _filter, searchFormValues) => {
          // 处理搜索参数
          const apiParams: any = {
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
          };
          
          // 启用状态筛选
          if (searchFormValues?.isActive !== undefined && searchFormValues.isActive !== '' && searchFormValues.isActive !== null) {
            apiParams.isActive = searchFormValues.isActive;
          }
          
          // 分类筛选
          if (searchFormValues?.category !== undefined && searchFormValues.category !== '' && searchFormValues.category !== null) {
            apiParams.category = searchFormValues.category;
          }
          
          try {
            const result = await customerApi.list(apiParams);
            return {
              data: result,
              success: true,
              total: result.length,
            };
          } catch (error: any) {
            console.error('获取客户列表失败:', error);
            messageApi.error(error?.message || '获取客户列表失败');
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        rowKey="uuid"
        showAdvancedSearch={true}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建客户
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 详情 Drawer */}
      <Drawer
        title="客户详情"
        size={720}
        open={drawerVisible}
        onClose={handleCloseDetail}
      >
        <ProDescriptions<Customer>
          dataSource={customerDetail}
          loading={detailLoading}
          column={2}
          columns={[
            {
              title: '客户编码',
              dataIndex: 'code',
            },
            {
              title: '客户名称',
              dataIndex: 'name',
            },
            {
              title: '简称',
              dataIndex: 'shortName',
            },
            {
              title: '联系人',
              dataIndex: 'contactPerson',
            },
            {
              title: '电话',
              dataIndex: 'phone',
            },
            {
              title: '邮箱',
              dataIndex: 'email',
            },
            {
              title: '地址',
              dataIndex: 'address',
              span: 2,
            },
            {
              title: '分类',
              dataIndex: 'category',
            },
            {
              title: '启用状态',
              dataIndex: 'isActive',
              render: (_, record) => (
                <Tag color={record.isActive ? 'success' : 'default'}>
                  {record.isActive ? '启用' : '禁用'}
                </Tag>
              ),
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
      </Drawer>

      {/* 创建/编辑客户 Modal */}
      <Modal
        title={isEdit ? '编辑客户' : '新建客户'}
        open={modalVisible}
        onCancel={handleCloseModal}
        footer={null}
        width={800}
        destroyOnHidden
      >
        <ProForm
          formRef={formRef}
          loading={formLoading}
          onFinish={handleSubmit}
          submitter={{
            searchConfig: {
              submitText: isEdit ? '更新' : '创建',
              resetText: '取消',
            },
            resetButtonProps: {
              onClick: handleCloseModal,
            },
          }}
          initialValues={{
            isActive: true,
          }}
          layout="vertical"
          grid={true}
          rowProps={{ gutter: 16 }}
        >
          <ProFormText
            name="code"
            label="客户编码"
            placeholder="请输入客户编码"
            colProps={{ span: 12 }}
            rules={[
              { required: true, message: '请输入客户编码' },
              { max: 50, message: '客户编码不能超过50个字符' },
            ]}
            fieldProps={{
              style: { textTransform: 'uppercase' },
            }}
          />
          <ProFormText
            name="name"
            label="客户名称"
            placeholder="请输入客户名称"
            colProps={{ span: 12 }}
            rules={[
              { required: true, message: '请输入客户名称' },
              { max: 200, message: '客户名称不能超过200个字符' },
            ]}
          />
          <ProFormText
            name="shortName"
            label="简称"
            placeholder="请输入简称"
            colProps={{ span: 12 }}
            rules={[
              { max: 100, message: '简称不能超过100个字符' },
            ]}
          />
          <ProFormText
            name="contactPerson"
            label="联系人"
            placeholder="请输入联系人"
            colProps={{ span: 12 }}
            rules={[
              { max: 100, message: '联系人不能超过100个字符' },
            ]}
          />
          <ProFormText
            name="phone"
            label="电话"
            placeholder="请输入电话"
            colProps={{ span: 12 }}
            rules={[
              { max: 20, message: '电话不能超过20个字符' },
            ]}
          />
          <ProFormText
            name="email"
            label="邮箱"
            placeholder="请输入邮箱"
            colProps={{ span: 12 }}
            rules={[
              { type: 'email', message: '请输入有效的邮箱地址' },
              { max: 100, message: '邮箱不能超过100个字符' },
            ]}
          />
          <ProFormText
            name="category"
            label="分类"
            placeholder="请输入分类"
            colProps={{ span: 12 }}
            rules={[
              { max: 50, message: '分类不能超过50个字符' },
            ]}
          />
          <ProFormTextArea
            name="address"
            label="地址"
            placeholder="请输入地址"
            colProps={{ span: 24 }}
            fieldProps={{
              rows: 3,
              maxLength: 500,
            }}
          />
          <ProFormSwitch
            name="isActive"
            label="是否启用"
            colProps={{ span: 12 }}
          />
        </ProForm>
      </Modal>
    </>
  );
};

export default CustomersPage;
