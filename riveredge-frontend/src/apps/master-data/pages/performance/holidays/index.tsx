/**
 * 假期管理页面
 * 
 * 提供假期的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormDatePicker, ProFormInstance, ProDescriptionsItemType } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { holidayApi } from '../../../services/performance';
import type { Holiday, HolidayCreate, HolidayUpdate } from '../../../types/performance';
import dayjs from 'dayjs';

/**
 * 假期管理列表页面组件
 */
const HolidaysPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentHolidayUuid, setCurrentHolidayUuid] = useState<string | null>(null);
  const [holidayDetail, setHolidayDetail] = useState<Holiday | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑假期）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建假期
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentHolidayUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      isActive: true,
    });
  };

  /**
   * 处理编辑假期
   */
  const handleEdit = async (record: Holiday) => {
    try {
      setIsEdit(true);
      setCurrentHolidayUuid(record.uuid);
      setModalVisible(true);
      
      // 获取假期详情
      const detail = await holidayApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        name: detail.name,
        holidayDate: detail.holidayDate ? dayjs(detail.holidayDate) : undefined,
        holidayType: detail.holidayType,
        description: detail.description,
        isActive: detail.isActive,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取假期详情失败');
    }
  };

  /**
   * 处理删除假期
   */
  const handleDelete = async (record: Holiday) => {
    try {
      await holidayApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: Holiday) => {
    try {
      setCurrentHolidayUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await holidayApi.get(record.uuid);
      setHolidayDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取假期详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setCurrentHolidayUuid(null);
    setHolidayDetail(null);
  };

  /**
   * 处理提交表单（创建/更新假期）
   */
  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      
      // 转换日期格式
      const submitData: any = { ...values };
      if (submitData.holidayDate) {
        submitData.holidayDate = dayjs(submitData.holidayDate).format('YYYY-MM-DD');
      }
      
      if (isEdit && currentHolidayUuid) {
        // 更新假期
        await holidayApi.update(currentHolidayUuid, submitData as HolidayUpdate);
        messageApi.success('更新成功');
      } else {
        // 创建假期
        await holidayApi.create(submitData as HolidayCreate);
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
  const columns: ProColumns<Holiday>[] = [
    {
      title: '假期名称',
      dataIndex: 'name',
      width: 200,
      fixed: 'left',
    },
    {
      title: '假期日期',
      dataIndex: 'holidayDate',
      width: 150,
      valueType: 'date',
      sorter: true,
    },
    {
      title: '假期类型',
      dataIndex: 'holidayType',
      width: 150,
      hideInSearch: true,
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
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
            title="确定要删除这个假期吗？"
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

  // 详情列定义
  const detailColumns: ProDescriptionsItemType<Holiday>[] = [
    {
      title: '假期名称',
      dataIndex: 'name',
    },
    {
      title: '假期日期',
      dataIndex: 'holidayDate',
      valueType: 'date',
    },
    {
      title: '假期类型',
      dataIndex: 'holidayType',
    },
    {
      title: '描述',
      dataIndex: 'description',
      span: 2,
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
  ];

  return (
    <>
      <ListPageTemplate>
      <UniTable<Holiday>
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
          
          try {
            const result = await holidayApi.list(apiParams);
            return {
              data: result,
              success: true,
              total: result.length,
            };
          } catch (error: any) {
            console.error('获取假期列表失败:', error);
            messageApi.error(error?.message || '获取假期列表失败');
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
            新建假期
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />
      </ListPageTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate<Holiday>
        title="假期详情"
        open={drawerVisible}
        onClose={handleCloseDetail}
        dataSource={holidayDetail || undefined}
        columns={detailColumns}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
      />

      {/* 创建/编辑假期 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑假期' : '新建假期'}
        open={modalVisible}
        onClose={handleCloseModal}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={formLoading}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        initialValues={{
          isActive: true,
        }}
        layout="vertical"
        grid={true}
      >
          <ProFormText
            name="name"
            label="假期名称"
            placeholder="请输入假期名称"
            colProps={{ span: 12 }}
            rules={[
              { required: true, message: '请输入假期名称' },
              { max: 200, message: '假期名称不能超过200个字符' },
            ]}
          />
          <ProFormDatePicker
            name="holidayDate"
            label="假期日期"
            placeholder="请选择假期日期"
            colProps={{ span: 12 }}
            rules={[
              { required: true, message: '请选择假期日期' },
            ]}
            fieldProps={{
              style: { width: '100%' },
            }}
          />
          <ProFormText
            name="holidayType"
            label="假期类型"
            placeholder="请输入假期类型（如：法定节假日、公司假期等）"
            colProps={{ span: 12 }}
            rules={[
              { max: 50, message: '假期类型不能超过50个字符' },
            ]}
          />
          <ProFormTextArea
            name="description"
            label="描述"
            placeholder="请输入描述"
            colProps={{ span: 24 }}
            fieldProps={{
              rows: 4,
              maxLength: 500,
            }}
          />
          <ProFormSwitch
            name="isActive"
            label="是否启用"
            colProps={{ span: 12 }}
          />
      </FormModalTemplate>
    </>
  );
};

export default HolidaysPage;
