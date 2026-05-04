/**
 * 属性定义管理页面
 *
 * 提供属性定义的 CRUD、预设加载等。
 */

import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Tag, Space, Button, Popconfirm, Modal, Table } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSelect, ProFormSwitch, ProFormDigit, ProFormInstance, ProForm } from '@ant-design/pro-components';
import { UniTable } from '../../../../../components/uni-table';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import type { VariantAttributeDefinition } from '../../../types/variant-attribute';
import { variantAttributeApi, type PresetAttributeItem } from '../../../services/variant-attribute';

const VariantAttributesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentUuid, setCurrentUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [loadPresetLoading, setLoadPresetLoading] = useState(false);
  const [presetModalVisible, setPresetModalVisible] = useState(false);
  const [presetList, setPresetList] = useState<PresetAttributeItem[]>([]);
  const [selectedPresetNames, setSelectedPresetNames] = useState<string[]>([]);
  const [presetConfirmLoading, setPresetConfirmLoading] = useState(false);

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
      sorter: true,
    },
    {
      title: '显示名称',
      dataIndex: 'display_name',
      width: 150,
      sorter: true,
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
      title: '允许多选',
      dataIndex: 'allow_multiple',
      width: 90,
      hideInSearch: true,
      render: (_, record) =>
        record.attribute_type === 'enum' ? (
          <Tag color={record.allow_multiple ? 'blue' : 'default'}>
            {record.allow_multiple ? '是' : '否'}
          </Tag>
        ) : '-',
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
      title: '备注',
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 160,
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
          <Popconfirm
            title={t('common.confirmDelete')}
            onConfirm={() => handleDelete(record.uuid)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
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

  useNewShortcut(handleCreate);

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
        allow_multiple: detail.allow_multiple ?? false,
      });
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.variantAttributes.getDetailFailed'));
    }
  };

  /**
   * 处理删除
   */
  const handleDelete = async (uuid: string) => {
    try {
      await variantAttributeApi.delete(uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 处理批量删除
   */
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('common.selectToDelete'));
      return;
    }

    Modal.confirm({
      title: t('common.confirmBatchDelete'),
      content: t('common.confirmBatchDeleteContent', { count: selectedRowKeys.length }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: async () => {
        try {
          let successCount = 0;
          let failCount = 0;
          const errors: string[] = [];

          for (const key of selectedRowKeys) {
            try {
              await variantAttributeApi.delete(key.toString());
              successCount++;
            } catch (error: any) {
              failCount++;
              errors.push(error.message || t('common.deleteFailed'));
            }
          }

          if (successCount > 0) {
            messageApi.success(t('common.batchDeleteSuccess', { count: successCount }));
          }
          if (failCount > 0) {
            messageApi.error(t('common.batchDeletePartial', { count: failCount, errors: errors.length > 0 ? '：' + errors.join('; ') : '' }));
          }

          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('common.batchDeleteFailed'));
        }
      },
    });
  };

  /**
   * 处理表单提交
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);
      
      // 处理枚举值（如果是数组，转换为数组；如果是字符串，按中英文逗号分割）
      let enumValues = values.enum_values;
      if (values.attribute_type === 'enum') {
        if (typeof enumValues === 'string') {
          enumValues = enumValues.split(/[,，]/).map((v: string) => v.trim()).filter((v: string) => v);
        }
        if (!Array.isArray(enumValues) || enumValues.length === 0) {
          messageApi.error(t('app.master-data.variantAttributes.enumValuesRequired'));
          throw new Error(t('app.master-data.variantAttributes.enumValuesRequired'));
        }
      } else {
        enumValues = undefined;
      }

      const submitData = {
        ...values,
        enum_values: enumValues,
        allow_multiple: values.attribute_type === 'enum' ? (values.allow_multiple ?? false) : false,
      };

      if (isEdit && currentUuid) {
        await variantAttributeApi.update(currentUuid, submitData);
        messageApi.success(t('common.updateSuccess'));
      } else {
        await variantAttributeApi.create(submitData);
        messageApi.success(t('common.createSuccess'));
      }

      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || (isEdit ? t('common.updateFailed') : t('common.createFailed')));
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <>
      <ListPageTemplate>
        <UniTable<VariantAttributeDefinition>
          headerTitle="属性定义"
          actionRef={actionRef}
          columns={columns}
          showAdvancedSearch={true}
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const { sortBy: rawSort, sortOrder } = extractProTableSort(sort);
              const sortFieldMap: Record<string, string> = {
                display_order: 'display_order',
                attribute_name: 'attribute_name',
                display_name: 'display_name',
                createdAt: 'created_at',
                updatedAt: 'updated_at',
              };
              const sort_by = rawSort ? sortFieldMap[rawSort] : undefined;
              const data = await variantAttributeApi.list({
                is_active: searchFormValues?.is_active,
                attribute_type: searchFormValues?.attribute_type,
                keyword: searchFormValues?.keyword?.trim() || undefined,
                sort_by,
                sort_order: sortOrder,
              });
              const current = params.current || 1;
              const pageSize = params.pageSize || 20;
              const total = data.length;
              const start = (current - 1) * pageSize;
              return {
                data: data.slice(start, start + pageSize),
                success: true,
                total,
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
          enableRowSelection={true}
          onRowSelectionChange={setSelectedRowKeys}
          headerActions={
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreate}
              >
                {'新建属性定义' + NEW_SHORTCUT_HINT}
              </Button>
              <Button
                key="loadPreset"
                loading={loadPresetLoading}
                onClick={async () => {
                  try {
                    setLoadPresetLoading(true);
                    const list = await variantAttributeApi.getPresetPreview();
                    setPresetList(list);
                    setSelectedPresetNames(list.map((x) => x.attribute_name));
                    setPresetModalVisible(true);
                  } catch (e: any) {
                    messageApi.error(e?.message || t('common.operationFailed'));
                  } finally {
                    setLoadPresetLoading(false);
                  }
                }}
              >
                {t('app.master-data.variantAttributes.loadPreset')}
              </Button>
              <Button
                danger
                disabled={selectedRowKeys.length === 0}
                icon={<DeleteOutlined />}
                onClick={handleBatchDelete}
              >
                批量删除
              </Button>
            </Space>
          }
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
        grid
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
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="attribute_type"
          label="属性类型"
          placeholder="请选择属性类型"
          options={attributeTypeOptions}
          rules={[{ required: true, message: '请选择属性类型' }]}
          fieldProps={{
            onChange: (value) => {
              if (value !== 'enum') {
                formRef.current?.setFieldsValue({ enum_values: undefined });
              }
            },
          }}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="display_name"
          label="显示名称"
          placeholder="请输入显示名称（如：产品颜色）"
          rules={[{ required: true, message: '请输入显示名称' }]}
          colProps={{ span: 12 }}
        />
        <ProFormDigit
          name="display_order"
          label="显示顺序"
          initialValue={0}
          min={0}
          colProps={{ span: 12 }}
        />
        <ProForm.Item
          noStyle
          shouldUpdate={(prevValues: any, currentValues: any) => prevValues.attribute_type !== currentValues.attribute_type}
        >
          {({ getFieldValue }: any) => {
            const attributeType = getFieldValue('attribute_type');
            if (attributeType === 'enum') {
              return (
                <>
                  <ProFormText
                    name="enum_values"
                    label="枚举值"
                    placeholder="请输入枚举值，多个值用逗号分隔（如：红色,蓝色,绿色）"
                    rules={[{ required: true, message: '请输入枚举值' }]}
                    extra="多个值用逗号分隔，中英文逗号均可"
                    colProps={{ span: 24 }}
                  />
                  <ProFormSwitch
                    name="allow_multiple"
                    label="允许多选"
                    initialValue={false}
                    extra="物料启用属性管理时，该属性是否支持选择多个枚举值"
                    colProps={{ span: 12 }}
                  />
                </>
              );
            }
            return null;
          }}
        </ProForm.Item>
        <ProFormTextArea
          name="description"
          label="备注"
          placeholder="请输入备注"
          colProps={{ span: 24 }}
        />
        <ProFormSwitch
          name="is_required"
          label="是否必填"
          initialValue={false}
          colProps={{ span: 12 }}
        />
        <ProFormSwitch
          name="is_active"
          label="是否启用"
          initialValue={true}
          colProps={{ span: 12 }}
        />
      </FormModalTemplate>

      {/* 加载预设预览 Modal：可去掉不要的预设项后再确认 */}
      <Modal
        title={t('app.master-data.variantAttributes.loadPresetModalTitle')}
        open={presetModalVisible}
        onCancel={() => setPresetModalVisible(false)}
        width={640}
        footer={[
          <Button key="cancel" onClick={() => setPresetModalVisible(false)}>
            {t('common.cancel')}
          </Button>,
          <Button
            key="confirm"
            type="primary"
            loading={presetConfirmLoading}
            disabled={selectedPresetNames.length === 0}
            onClick={async () => {
              try {
                setPresetConfirmLoading(true);
                const res = await variantAttributeApi.loadPreset(selectedPresetNames);
                messageApi.success(res.message);
                setPresetModalVisible(false);
                actionRef.current?.reload();
              } catch (e: any) {
                messageApi.error(e?.message || t('common.operationFailed'));
              } finally {
                setPresetConfirmLoading(false);
              }
            }}
          >
            {t('common.confirm')}
          </Button>,
        ]}
      >
        <p style={{ marginBottom: 12, color: 'var(--ant-color-text-secondary)' }}>
          {t('app.master-data.variantAttributes.loadPresetModalDesc')}
        </p>
        <Table<PresetAttributeItem>
          size="small"
          rowKey="attribute_name"
          dataSource={presetList}
          pagination={false}
          scroll={{ y: 320 }}
          rowSelection={{
            selectedRowKeys: selectedPresetNames,
            onChange: (keys) => setSelectedPresetNames(keys as string[]),
          }}
          columns={[
            { title: t('app.master-data.variantAttributes.presetColName'), dataIndex: 'attribute_name', width: 100 },
            { title: t('app.master-data.variantAttributes.presetColDisplayName'), dataIndex: 'display_name', width: 100 },
            {
              title: t('app.master-data.variantAttributes.presetColType'),
              dataIndex: 'attribute_type',
              width: 80,
              render: (type: string) => (
                <Tag color="blue">{attributeTypeOptions.find((o) => o.value === type)?.label ?? type}</Tag>
              ),
            },
            {
              title: t('app.master-data.variantAttributes.presetColEnumValues'),
              dataIndex: 'enum_values',
              ellipsis: true,
              render: (vals: string[] | undefined) =>
                Array.isArray(vals) ? vals.join('、') : '—',
            },
          ]}
        />
      </Modal>
    </>
  );
};

export default VariantAttributesPage;
