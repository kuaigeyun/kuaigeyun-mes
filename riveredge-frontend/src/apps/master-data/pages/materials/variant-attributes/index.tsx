/**
 * 属性定义管理页面
 *
 * 提供属性定义的 CRUD、预设加载等。
 */

import React, { useRef, useState, useMemo } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { useTranslation } from 'react-i18next';
import { App, Tag, Space, Button, Popconfirm, Modal, Table } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSelect, ProFormSwitch, ProFormDigit, ProFormInstance, ProForm } from '@ant-design/pro-components';
import { UniTable } from '../../../../../components/uni-table';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { useTrialRunMode } from '../../../../../hooks/useTrialRunMode';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import type { VariantAttributeDefinition } from '../../../types/variant-attribute';
import { variantAttributeApi, type PresetAttributeItem } from '../../../services/variant-attribute';

const VariantAttributesPage: React.FC = () => {
  const { t } = useTranslation();
  const trialRunMode = useTrialRunMode();
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

  const attributeTypeOptions = useMemo(
    () => [
      { label: t('app.master-data.variantAttributes.typeEnum'), value: 'enum' },
      { label: t('app.master-data.variantAttributes.typeText'), value: 'text' },
      { label: t('app.master-data.variantAttributes.typeNumber'), value: 'number' },
      { label: t('app.master-data.variantAttributes.typeDate'), value: 'date' },
      { label: t('app.master-data.variantAttributes.typeBoolean'), value: 'boolean' },
    ],
    [t],
  );

  const attributeTypeLabels = useMemo(
    () => ({
      enum: { text: t('app.master-data.variantAttributes.typeEnum'), color: 'blue' },
      text: { text: t('app.master-data.variantAttributes.typeText'), color: 'green' },
      number: { text: t('app.master-data.variantAttributes.typeNumber'), color: 'orange' },
      date: { text: t('app.master-data.variantAttributes.typeDate'), color: 'purple' },
      boolean: { text: t('app.master-data.variantAttributes.typeBoolean'), color: 'red' },
    }),
    [t],
  );

  /**
   * 表格列定义
   */
  const columns: ProColumns<VariantAttributeDefinition>[] = useMemo(() => [
    {
      title: t('app.master-data.variantAttributes.attributeName'),
      dataIndex: 'attribute_name',
      width: 150,
      fixed: 'left',
      sorter: true,
    },
    {
      title: t('app.master-data.variantAttributes.displayName'),
      dataIndex: 'display_name',
      width: 150,
      sorter: true,
    },
    {
      title: t('app.master-data.variantAttributes.attributeType'),
      dataIndex: 'attribute_type',
      width: 100,
      valueType: 'select',
      valueEnum: {
        enum: { text: t('app.master-data.variantAttributes.typeEnum'), status: 'Default' },
        text: { text: t('app.master-data.variantAttributes.typeText'), status: 'Default' },
        number: { text: t('app.master-data.variantAttributes.typeNumber'), status: 'Default' },
        date: { text: t('app.master-data.variantAttributes.typeDate'), status: 'Default' },
        boolean: { text: t('app.master-data.variantAttributes.typeBoolean'), status: 'Default' },
      },
      render: (_, record) => {
        const type = attributeTypeLabels[record.attribute_type] || {
          text: record.attribute_type,
          color: 'default',
        };
        return <Tag color={type.color}>{type.text}</Tag>;
      },
    },
    {
      title: t('app.master-data.variantAttributes.allowMultiple'),
      dataIndex: 'allow_multiple',
      width: 90,
      hideInSearch: true,
      render: (_, record) =>
        record.attribute_type === 'enum' ? (
          <Tag color={record.allow_multiple ? 'blue' : 'default'}>
            {record.allow_multiple ? t('app.master-data.bom.yes') : t('app.master-data.bom.no')}
          </Tag>
        ) : '-',
    },
    {
      title: t('app.master-data.variantAttributes.isRequired'),
      dataIndex: 'is_required',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('app.master-data.bom.yes'), status: 'Error' },
        false: { text: t('app.master-data.bom.no'), status: 'Success' },
      },
      render: (_, record) => (
        <Tag color={record.is_required ? 'red' : 'green'}>
          {record.is_required ? t('app.master-data.bom.yes') : t('app.master-data.bom.no')}
        </Tag>
      ),
    },
    {
      title: t('app.master-data.variantAttributes.displayOrder'),
      dataIndex: 'display_order',
      width: 100,
      sorter: true,
    },
    {
      title: t('app.master-data.variantAttributes.enumValues'),
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
      title: t('app.master-data.variantAttributes.status'),
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('app.master-data.plants.enabled'), status: 'Success' },
        false: { text: t('app.master-data.plants.disabled'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? t('app.master-data.plants.enabled') : t('app.master-data.plants.disabled')}
        </Tag>
      ),
    },
    {
      title: t('app.master-data.variantAttributes.version'),
      dataIndex: 'version',
      width: 80,
    },
    {
      title: t('app.master-data.variantAttributes.description'),
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 160,
      fixed: 'right',
      render: (_: any, record: VariantAttributeDefinition) => (
        <Space>
          <Button key="edit" {...rowActionKind('update')}
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('field.customField.edit')}
          </Button>
          <Popconfirm key="delete" {...rowActionKind('delete')} title={t('common.confirmDelete')}
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
              {t('field.customField.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ], [t, attributeTypeLabels]);

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
  const handleBatchDelete = async (keys?: React.Key[]) => {
    const targetKeys = keys ?? selectedRowKeys;
    if (targetKeys.length === 0) {
      messageApi.warning(t('common.selectToDelete'));
      return;
    }

    try {
      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      for (const key of targetKeys) {
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
        messageApi.error(
          t('common.batchDeletePartial', {
            count: failCount,
            errors: errors.length > 0 ? '：' + errors.join('; ') : '',
          }),
        );
      }

      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.batchDeleteFailed'));
    }
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
          columnPersistenceId="apps.master-data.pages.materials.variant-attributes"
          headerTitle={t('app.master-data.menu.materials.variant-attributes')}
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
              messageApi.error(error.message || t('app.master-data.variantAttributes.listFailed'));
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          rowKey="uuid"
          showCreateButton
          createButtonText={t('app.master-data.variantAttributes.createTitle') + NEW_SHORTCUT_HINT}
          onCreate={handleCreate}
          toolBarActionsAfterCreate={[
            trialRunMode ? (
              <Button {...rowActionKind('import')}
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
            ) : null,
          ].filter(Boolean)}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteConfirmTitle={t('common.confirmBatchDelete')}
          deleteConfirmDescription={(count) => t('common.confirmBatchDeleteContent', { count })}
          enableRowSelection={true}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          search={{
            labelWidth: 'auto',
          }}
          scroll={{ x: 1200 }}
        />
      </ListPageTemplate>

      {/* 创建/编辑 Modal */}
      <FormModalTemplate
        title={isEdit ? t('app.master-data.variantAttributes.editTitle') : t('app.master-data.variantAttributes.createTitle')}
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
          label={t('app.master-data.variantAttributes.attributeName')}
          placeholder={t('app.master-data.variantAttributes.attributeNamePlaceholder')}
          rules={[
            { required: true, message: t('app.master-data.variantAttributes.attributeNameRequired') },
            { pattern: /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/, message: t('app.master-data.variantAttributes.attributeNamePattern') },
          ]}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="attribute_type"
          label={t('app.master-data.variantAttributes.attributeType')}
          placeholder={t('app.master-data.variantAttributes.attributeTypePlaceholder')}
          options={attributeTypeOptions}
          rules={[{ required: true, message: t('app.master-data.variantAttributes.attributeTypeRequired') }]}
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
          label={t('app.master-data.variantAttributes.displayName')}
          placeholder={t('app.master-data.variantAttributes.displayNamePlaceholder')}
          rules={[{ required: true, message: t('app.master-data.variantAttributes.displayNameRequired') }]}
          colProps={{ span: 12 }}
        />
        <ProFormDigit
          name="display_order"
          label={t('app.master-data.variantAttributes.displayOrder')}
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
                    label={t('app.master-data.variantAttributes.enumValues')}
                    placeholder={t('app.master-data.variantAttributes.enumValuesPlaceholder')}
                    rules={[{ required: true, message: t('app.master-data.variantAttributes.enumValuesInputRequired') }]}
                    extra={t('app.master-data.variantAttributes.enumValuesExtra')}
                    colProps={{ span: 24 }}
                  />
                  <ProFormSwitch
                    name="allow_multiple"
                    label={t('app.master-data.variantAttributes.allowMultiple')}
                    initialValue={false}
                    extra={t('app.master-data.variantAttributes.allowMultipleExtra')}
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
          label={t('app.master-data.variantAttributes.description')}
          placeholder={t('app.master-data.variantAttributes.descriptionPlaceholder')}
          colProps={{ span: 24 }}
        />
        <ProFormSwitch
          name="is_required"
          label={t('app.master-data.variantAttributes.isRequired')}
          initialValue={false}
          colProps={{ span: 12 }}
        />
        <ProFormSwitch
          name="is_active"
          label={t('app.master-data.variantAttributes.isActiveLabel')}
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
          <Button {...rowActionKind('revoke')} key="cancel" onClick={() => setPresetModalVisible(false)}>
            {t('common.cancel')}
          </Button>,
          <Button {...rowActionKind('audit')}
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
