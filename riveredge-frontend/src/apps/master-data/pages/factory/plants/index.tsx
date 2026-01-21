/**
 * 厂区管理页面
 * 
 * 提供厂区的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormInstance } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { plantApi } from '../../../services/factory';
import type { Plant, PlantCreate, PlantUpdate } from '../../../types/factory';
import { generateCode } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';

/**
 * 厂区管理列表页面组件
 */
const PlantsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();

  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Modal 相关状态（创建/编辑厂区）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [currentPlantUuid, setCurrentPlantUuid] = useState<string | null>(null);

  /**
   * 处理新建厂区
   */
  const handleCreate = async () => {
    setIsEdit(false);
    setCurrentPlantUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    
    // 检查是否启用自动编码
    if (isAutoGenerateEnabled('master-data-factory-plant')) {
      try {
        const ruleCode = getPageRuleCode('master-data-factory-plant');
        const code = await generateCode(ruleCode);
        formRef.current?.setFieldsValue({ code });
      } catch (error) {
        console.error('自动生成编码失败:', error);
      }
    }
  };

  /**
   * 处理编辑厂区
   */
  const handleEdit = async (record: Plant) => {
    setIsEdit(true);
    setCurrentPlantUuid(record.uuid);
    setModalVisible(true);
    
    // 加载厂区详情
    try {
      const detail = await plantApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        code: detail.code,
        name: detail.name,
        description: detail.description,
        address: detail.address,
        isActive: detail.isActive,
      });
    } catch (error: any) {
      messageApi.error(error.message || '加载厂区详情失败');
    }
  };

  /**
   * 处理删除厂区
   */
  const handleDelete = async (record: Plant) => {
    try {
      await plantApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理提交表单（创建/更新厂区）
   */
  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentPlantUuid) {
        // 更新厂区
        await plantApi.update(currentPlantUuid, values as PlantUpdate);
        messageApi.success('更新成功');
      } else {
        // 创建厂区
        await plantApi.create(values as PlantCreate);
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
  const columns: ProColumns<Plant>[] = [
    {
      title: '厂区编码',
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
      ellipsis: true,
      copyable: true,
    },
    {
      title: '厂区名称',
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '地址',
      dataIndex: 'address',
      width: 300,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '描述',
      dataIndex: 'description',
      width: 250,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '状态',
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
      render: (_, record) => [
        <Button
          key="edit"
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={() => handleEdit(record)}
        >
          编辑
        </Button>,
        <Popconfirm
          key="delete"
          title="确定要删除这个厂区吗？"
          description="删除后无法恢复，请谨慎操作。"
          onConfirm={() => handleDelete(record)}
          okText="确定"
          cancelText="取消"
        >
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
          >
            删除
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<Plant>
          actionRef={actionRef}
          columns={columns}
          request={async (params, _sort, _filter, searchFormValues) => {
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
              const result = await plantApi.list(apiParams);
              
              return {
                data: result,
                success: true,
                total: result.length, // 注意：后端需要返回总数，这里暂时使用数组长度
              };
            } catch (error: any) {
              console.error('获取厂区列表失败:', error);
              messageApi.error(error?.message || '获取厂区列表失败');
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
              新建厂区
            </Button>,
          ]}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
        />
      </ListPageTemplate>

      {/* 创建/编辑厂区 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑厂区' : '新建厂区'}
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
      >
        <ProFormText
          name="code"
          label="厂区编码"
          placeholder="请输入厂区编码"
          rules={[
            { required: true, message: '请输入厂区编码' },
            { max: 50, message: '厂区编码不能超过50个字符' },
          ]}
          fieldProps={{
            disabled: isEdit, // 编辑时不允许修改编码
          }}
        />
        <ProFormText
          name="name"
          label="厂区名称"
          placeholder="请输入厂区名称"
          rules={[
            { required: true, message: '请输入厂区名称' },
            { max: 200, message: '厂区名称不能超过200个字符' },
          ]}
        />
        <ProFormText
          name="address"
          label="地址"
          placeholder="请输入厂区地址"
          rules={[
            { max: 500, message: '地址不能超过500个字符' },
          ]}
        />
        <ProFormTextArea
          name="description"
          label="描述"
          placeholder="请输入描述信息"
          fieldProps={{
            rows: 4,
            maxLength: 1000,
          }}
        />
        <ProFormSwitch
          name="isActive"
          label="是否启用"
          initialValue={true}
        />
      </FormModalTemplate>
    </>
  );
};

export default PlantsPage;
