/**
 * 变体属性定义管理页面
 *
 * 提供变体属性定义的 CRUD 操作、版本管理等功能。
 *
 * Author: Luigi Lu
 * Date: 2026-01-08
 */

import React, { useRef, useState } from 'react';
import { App, Tag, Space, Button, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, HistoryOutlined } from '@ant-design/icons';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSelect, ProFormSwitch, ProFormDigit, ProFormInstance, ProForm } from '@ant-design/pro-components';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import type { VariantAttributeDefinition } from '../../../types/variant-attribute';
import { variantAttributeApi } from '../../../services/variant-attribute';

const VariantAttributesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [historyDrawerVisible, setHistoryDrawerVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentUuid, setCurrentUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [historyUuid, setHistoryUuid] = useState<string | null>(null);

  /**
   * 获取属性类型选项
   */
  const attributeTypeOptions = [
    { label: '枚举', value: 'enum' },
    { label: '文本', value: 'text' },
    { label: '数值', value: 'number' },
    { label: '日期', value: 'date' },
    { label: '布尔', value: 'boolean' },
  ];

  /**
   * 表格列定义
   */
  const columns: ProColumns<VariantAttributeDefinition>[] = [
    {
      title: '属性名称',
      dataIndex: 'attribute_name',
      width: 150,
      fixed: 'left',
    },
    {
      title: '显示名称',
      dataIndex: 'display_name',
      width: 150,
    },
    {
      title: '属性类型',
      dataIndex: 'attribute_type',
      width: 100,
      valueType: 'select',
      valueEnum: {
        enum: { text: '枚举', status: 'Default' },
        text: { text: '文本', status: 'Default' },
        number: { text: '数值', status: 'Default' },
        date: { text: '日期', status: 'Default' },
        boolean: { text: '布尔', status: 'Default' },
      },
      render: (_, record) => {
        const typeMap: Record<string, { text: string; color: string }> = {
          enum: { text: '枚举', color: 'blue' },
          text: { text: '文本', color: 'green' },
          number: { text: '数值', color: 'orange' },
          date: { text: '日期', color: 'purple' },
          boolean: { text: '布尔', color: 'red' },
        };
        const type = typeMap[record.attribute_type] || { text: record.attribute_type, color: 'default' };
        return <Tag color={type.color}>{type.text}</Tag>;
      },
    },
    {
      title: '是否必填',
      dataIndex: 'is_required',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '是', status: 'Error' },
        false: { text: '否', status: 'Success' },
      },
      render: (_, record) => (
        <Tag color={record.is_required ? 'red' : 'green'}>
          {record.is_required ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '显示顺序',
      dataIndex: 'display_order',
      width: 100,
      sorter: true,
    },
    {
      title: '枚举值',
      dataIndex: 'enum_values',
      width: 200,
      hideInTable: false,
      render: (_, record) => {
        if (record.attribute_type === 'enum' && record.enum_values && record.enum_values.length > 0) {
          return (
            <Space wrap>
              {record.enum_values.map((value, index) => (
                <Tag key={index}>{value}</Tag>
              ))}
            </Space>
          );
        }
        return '-';
      },
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '启用', status: 'Success' },
        false: { text: '禁用', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      width: 80,
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_: any, record: VariantAttributeDefinition) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => handleViewHistory(record.uuid)}
          >
            历史
          </Button>
          <Popconfirm
            title="确定要删除这个属性定义吗？"
            onConfirm={() => handleDelete(record.uuid)}
            okText="确定"
            cancelText="取消"
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

  /**
   * 处理新建
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
  };

  /**
   * 处理编辑
   */
  const handleEdit = async (record: VariantAttributeDefinition) => {
    try {
      setIsEdit(true);
      setCurrentUuid(record.uuid);
      setModalVisible(true);
      
      // 获取详情数据
      const detail = await variantAttributeApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        ...detail,
        enum_values: detail.enum_values ? (Array.isArray(detail.enum_values) ? detail.enum_values.join(',') : detail.enum_values) : '',
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取属性定义详情失败');
    }
  };

  /**
   * 处理删除
   */
  const handleDelete = async (uuid: string) => {
    try {
      await variantAttributeApi.delete(uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理查看历史
   */
  const handleViewHistory = (uuid: string) => {
    setHistoryUuid(uuid);
    setHistoryDrawerVisible(true);
  };

  /**
   * 处理表单提交
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);
      
      // 处理枚举值（如果是数组，转换为数组；如果是字符串，按逗号分割）
      let enumValues = values.enum_values;
      if (values.attribute_type === 'enum') {
        if (typeof enumValues === 'string') {
          enumValues = enumValues.split(',').map((v: string) => v.trim()).filter((v: string) => v);
        }
        if (!Array.isArray(enumValues) || enumValues.length === 0) {
          messageApi.error('枚举类型必须提供至少一个枚举值');
          throw new Error('枚举类型必须提供至少一个枚举值');
        }
      } else {
        enumValues = undefined;
      }

      const submitData = {
        ...values,
        enum_values: enumValues,
      };

      if (isEdit && currentUuid) {
        await variantAttributeApi.update(currentUuid, submitData);
        messageApi.success('更新成功');
      } else {
        await variantAttributeApi.create(submitData);
        messageApi.success('创建成功');
      }

      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || (isEdit ? '更新失败' : '创建失败'));
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <>
      <ListPageTemplate>
        <UniTable<VariantAttributeDefinition>
          headerTitle="变体属性定义"
          actionRef={actionRef}
          columns={columns}
          request={async (_params, _sort, _filter, searchFormValues) => {
            try {
              const data = await variantAttributeApi.list({
                is_active: searchFormValues?.is_active,
                attribute_type: searchFormValues?.attribute_type,
              });
              return {
                data,
                success: true,
                total: data.length,
              };
            } catch (error: any) {
              messageApi.error(error.message || '加载失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          rowKey="uuid"
          toolBarRender={() => [
            <Button
              key="create"
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              新建属性定义
            </Button>,
          ]}
          search={{
            labelWidth: 'auto',
          }}
          scroll={{ x: 1200 }}
        />
      </ListPageTemplate>

      {/* 创建/编辑 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑属性定义' : '新建属性定义'}
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        loading={formLoading}
        onFinish={handleSubmit}
      >
        <ProFormText
          name="attribute_name"
          label="属性名称"
          placeholder="请输入属性名称（如：颜色、尺寸）"
          rules={[
            { required: true, message: '请输入属性名称' },
            { pattern: /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/, message: '属性名称只能包含字母、数字、下划线和中文' },
          ]}
          disabled={isEdit}
        />
        <ProFormSelect
          name="attribute_type"
          label="属性类型"
          placeholder="请选择属性类型"
          options={attributeTypeOptions}
          rules={[{ required: true, message: '请选择属性类型' }]}
          fieldProps={{
            onChange: (value) => {
              // 当类型改变时，清空枚举值（如果不是枚举类型）
              if (value !== 'enum') {
                formRef.current?.setFieldsValue({ enum_values: undefined });
              }
            },
          }}
        />
        <ProFormText
          name="display_name"
          label="显示名称"
          placeholder="请输入显示名称（如：产品颜色）"
          rules={[{ required: true, message: '请输入显示名称' }]}
        />
        <ProFormTextArea
          name="description"
          label="描述"
          placeholder="请输入属性描述"
        />
        <ProFormSwitch
          name="is_required"
          label="是否必填"
          initialValue={false}
        />
        <ProFormDigit
          name="display_order"
          label="显示顺序"
          initialValue={0}
          min={0}
        />
        <ProForm.Item
          noStyle
          shouldUpdate={(prevValues: any, currentValues: any) => prevValues.attribute_type !== currentValues.attribute_type}
        >
          {({ getFieldValue }: any) => {
            const attributeType = getFieldValue('attribute_type');
            if (attributeType === 'enum') {
              return (
                <ProFormText
                  name="enum_values"
                  label="枚举值"
                  placeholder="请输入枚举值，多个值用逗号分隔（如：红色,蓝色,绿色）"
                  rules={[{ required: true, message: '请输入枚举值' }]}
                  extra="多个值用逗号分隔"
                />
              );
            }
            return null;
          }}
        </ProForm.Item>
        <ProFormSwitch
          name="is_active"
          label="是否启用"
          initialValue={true}
        />
      </FormModalTemplate>


      {/* 版本历史 Drawer - 待实现 */}
      {historyDrawerVisible && historyUuid && (
        <DetailDrawerTemplate
          title="版本历史"
          open={historyDrawerVisible}
          onClose={() => setHistoryDrawerVisible(false)}
          loading={false}
          columns={[]}
          dataSource={undefined}
          width={DRAWER_CONFIG.STANDARD_WIDTH}
        />
      )}
    </>
  );
};

export default VariantAttributesPage;
