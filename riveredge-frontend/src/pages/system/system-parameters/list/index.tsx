/**
 * 系统参数管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的系统参数。
 * 支持系统参数的 CRUD 操作和批量更新。
 */

import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormSelect, ProFormDigit, ProFormInstance } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/safe-pro-form-select';
import { App, Modal, Popconfirm, Button, Tag, Space, Card, Typography } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../components/layout-templates';
import { theme } from 'antd';
import {
  getSystemParameterList,
  getSystemParameterByUuid,
  createSystemParameter,
  updateSystemParameter,
  deleteSystemParameter,
  SystemParameter,
  CreateSystemParameterData,
  UpdateSystemParameterData,
} from '../../../../services/systemParameter';

/**
 * 系统参数管理列表页面组件
 */
const SystemParameterListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token: themeToken } = theme.useToken();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Modal 相关状态（创建/编辑参数）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentParameterUuid, setCurrentParameterUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  const [parameterType, setParameterType] = useState<'string' | 'number' | 'boolean' | 'json'>('string');
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<SystemParameter | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * 处理新建参数
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentParameterUuid(null);
    setParameterType('string');
    setFormInitialValues({
      type: 'string',
      is_system: false,
      is_active: true,
    });
    setModalVisible(true);
  };

  /**
   * 处理编辑参数
   */
  const handleEdit = async (record: SystemParameter) => {
    try {
      setIsEdit(true);
      setCurrentParameterUuid(record.uuid);
      setParameterType(record.type);
      
      // 获取参数详情
      const detail = await getSystemParameterByUuid(record.uuid);
      // 格式化值用于显示
      let displayValue = detail.value;
      if (detail.type === 'json') {
        displayValue = JSON.stringify(detail.value, null, 2);
      }
      setFormInitialValues({
        key: detail.key,
        value: displayValue,
        type: detail.type,
        description: detail.description,
        is_active: detail.is_active,
      });
      setModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || t('field.systemParameter.fetchDetailFailed'));
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: SystemParameter) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getSystemParameterByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || t('field.systemParameter.fetchDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理删除参数
   */
  const handleDelete = async (record: SystemParameter) => {
    try {
      await deleteSystemParameter(record.uuid);
      messageApi.success(t('pages.system.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.deleteFailed'));
    }
  };

  /**
   * 处理批量删除参数
   */
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('pages.system.selectFirst'));
      return;
    }

    Modal.confirm({
      title: t('field.systemParameter.batchDeleteTitle'),
      content: t('field.systemParameter.batchDeleteConfirm', { count: selectedRowKeys.length }),
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
              await deleteSystemParameter(key.toString());
              successCount++;
            } catch (error: any) {
              failCount++;
              errors.push(error.message || t('pages.system.deleteFailed'));
            }
          }

          if (successCount > 0) {
            messageApi.success(t('pages.system.deleteSuccess'));
          }
          if (failCount > 0) {
            messageApi.error(t('pages.system.deleteFailed') + (errors.length > 0 ? '：' + errors.join('; ') : ''));
          }

          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('pages.system.deleteFailed'));
        }
      },
    });
  };

  /**
   * 处理提交表单（创建/更新参数）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);
      
      // 处理 JSON 类型参数值
      let processedValue = values.value;
      if (values.type === 'json') {
        try {
          if (typeof values.value === 'string') {
            processedValue = JSON.parse(values.value);
          }
        } catch (e) {
          messageApi.error(t('field.systemParameter.jsonInvalid'));
          throw new Error(t('field.systemParameter.jsonInvalid'));
        }
      } else if (values.type === 'number') {
        processedValue = Number(values.value);
      } else if (values.type === 'boolean') {
        processedValue = values.value === true || values.value === 'true' || values.value === 1;
      }
      
      if (isEdit && currentParameterUuid) {
        await updateSystemParameter(currentParameterUuid, {
          value: processedValue,
          description: values.description,
          is_active: values.is_active,
        } as UpdateSystemParameterData);
        messageApi.success(t('pages.system.updateSuccess'));
      } else {
        await createSystemParameter({
          key: values.key,
          value: processedValue,
          type: values.type,
          description: values.description,
          is_system: values.is_system || false,
          is_active: values.is_active,
        } as CreateSystemParameterData);
        messageApi.success(t('pages.system.createSuccess'));
      }
      
      setModalVisible(false);
      setFormInitialValues(undefined);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.deleteFailed'));
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 格式化参数值显示
   */
  const formatValue = (value: any, type: string): string => {
    if (type === 'json') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  /**
   * 渲染参数卡片
   */
  const renderParameterCard = (item: SystemParameter, index: number) => {
    const displayValue = formatValue(item.value, item.type);
    const typeMap: Record<string, { color: string; textKey: string }> = {
      string: { color: 'default', textKey: 'field.systemParameter.typeString' },
      number: { color: 'blue', textKey: 'field.systemParameter.typeNumber' },
      boolean: { color: 'green', textKey: 'field.systemParameter.typeBoolean' },
      json: { color: 'orange', textKey: 'field.systemParameter.typeJson' },
    };
    const typeInfo = typeMap[item.type] || { color: 'default', textKey: item.type };

    return (
      <Card
        key={item.uuid}
        hoverable
        style={{
          height: '100%',
          borderRadius: themeToken.borderRadiusLG,
        }}
        actions={[
          <Button
            key="view"
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleView(item)}
          >
            {t('field.systemParameter.view')}
          </Button>,
          <Button
            key="edit"
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(item)}
          >
            {t('field.systemParameter.edit')}
          </Button>,
          <Popconfirm
            key="delete"
            title={t('field.systemParameter.deleteConfirm')}
            onConfirm={() => handleDelete(item)}
            disabled={item.is_system}
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              disabled={item.is_system}
            >
              {t('field.systemParameter.delete')}
            </Button>
          </Popconfirm>,
        ]}
      >
        <Card.Meta
          title={
            <Space>
              <Typography.Text strong>{item.key}</Typography.Text>
              <Tag color={typeInfo.color}>{t(typeInfo.textKey)}</Tag>
              {item.is_system && <Tag color="default">{t('field.systemParameter.isSystem')}</Tag>}
              <Tag color={item.is_active ? 'success' : 'default'}>
                {item.is_active ? t('field.systemParameter.enabled') : t('field.systemParameter.disabled')}
              </Tag>
            </Space>
          }
          description={
            <div>
              {item.description && (
                <Typography.Paragraph
                  ellipsis={{ rows: 2 }}
                  style={{ marginBottom: 8, color: themeToken.colorTextSecondary }}
                >
                  {item.description}
                </Typography.Paragraph>
              )}
              <Typography.Text
                type="secondary"
                style={{
                  fontSize: '12px',
                  wordBreak: 'break-all',
                  display: 'block',
                  maxHeight: '60px',
                  overflow: 'hidden',
                }}
              >
                {displayValue.length > 100 ? `${displayValue.substring(0, 100)}...` : displayValue}
              </Typography.Text>
            </div>
          }
        />
      </Card>
    );
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<SystemParameter>[] = [
    {
      title: t('field.systemParameter.key'),
      dataIndex: 'key',
      width: 200,
      fixed: 'left',
    },
    {
      title: t('field.systemParameter.value'),
      dataIndex: 'value',
      width: 250,
      ellipsis: true,
      render: (_, record) => {
        const displayValue = formatValue(record.value, record.type);
        return (
          <span title={displayValue}>
            {displayValue.length > 50 ? `${displayValue.substring(0, 50)}...` : displayValue}
          </span>
        );
      },
    },
    {
      title: t('field.systemParameter.type'),
      dataIndex: 'type',
      width: 100,
      valueType: 'select',
      valueEnum: {
        string: { text: t('field.systemParameter.typeString'), status: 'Default' },
        number: { text: t('field.systemParameter.typeNumber'), status: 'Processing' },
        boolean: { text: t('field.systemParameter.typeBoolean'), status: 'Success' },
        json: { text: t('field.systemParameter.typeJson'), status: 'Warning' },
      },
      render: (_, record) => {
        const typeMap: Record<string, { color: string; textKey: string }> = {
          string: { color: 'default', textKey: 'field.systemParameter.typeString' },
          number: { color: 'blue', textKey: 'field.systemParameter.typeNumber' },
          boolean: { color: 'green', textKey: 'field.systemParameter.typeBoolean' },
          json: { color: 'orange', textKey: 'field.systemParameter.typeJson' },
        };
        const typeInfo = typeMap[record.type] || { color: 'default', textKey: record.type };
        return <Tag color={typeInfo.color}>{t(typeInfo.textKey)}</Tag>;
      },
    },
    {
      title: t('field.systemParameter.description'),
      dataIndex: 'description',
      width: 200,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('field.systemParameter.isSystem'),
      dataIndex: 'is_system',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('field.systemParameter.yes'), status: 'Default' },
        false: { text: t('field.systemParameter.no'), status: 'Processing' },
      },
      render: (_, record) => (
        <Tag color={record.is_system ? 'default' : 'blue'}>
          {record.is_system ? t('field.systemParameter.yes') : t('field.systemParameter.no')}
        </Tag>
      ),
    },
    {
      title: t('field.systemParameter.status'),
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('field.systemParameter.enabled'), status: 'Success' },
        false: { text: t('field.systemParameter.disabled'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? t('field.systemParameter.enabled') : t('field.systemParameter.disabled')}
        </Tag>
      ),
    },
    {
      title: t('field.systemParameter.createdAt'),
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            {t('field.systemParameter.view')}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('field.systemParameter.edit')}
          </Button>
          <Popconfirm
            title={t('field.systemParameter.deleteConfirm')}
            onConfirm={() => handleDelete(record)}
            disabled={record.is_system}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
              disabled={record.is_system}
            >
              {t('field.systemParameter.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  /**
   * 根据类型渲染值输入框
   */
  const renderValueInput = () => {
    switch (parameterType) {
      case 'number':
        return (
          <ProFormDigit
            name="value"
            label={t('field.systemParameter.value')}
            rules={[{ required: true, message: t('field.systemParameter.valueRequired') }]}
            placeholder={t('field.systemParameter.valueNumberPlaceholder')}
          />
        );
      case 'boolean':
        return (
          <ProFormSwitch
            name="value"
            label={t('field.systemParameter.value')}
            rules={[{ required: true, message: t('field.systemParameter.valueRequired') }]}
          />
        );
      case 'json':
        return (
          <ProFormTextArea
            name="value"
            label={t('field.systemParameter.valueJson')}
            rules={[
              { required: true, message: t('field.systemParameter.valueRequired') },
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  try {
                    JSON.parse(value);
                    return Promise.resolve();
                  } catch (e) {
                    return Promise.reject(new Error(t('field.systemParameter.jsonInvalid')));
                  }
                },
              },
            ]}
            placeholder={t('field.systemParameter.valueJsonPlaceholder')}
            fieldProps={{
              rows: 6,
            }}
          />
        );
      default:
        return (
          <ProFormText
            name="value"
            label={t('field.systemParameter.value')}
            rules={[{ required: true, message: t('field.systemParameter.valueRequired') }]}
            placeholder={t('field.systemParameter.valueStringPlaceholder')}
          />
        );
    }
  };

  return (
    <>
      <ListPageTemplate>
        <UniTable<SystemParameter>
          actionRef={actionRef}
          columns={columns}
          request={async (params, sort, _filter, searchFormValues) => {
            // 处理搜索参数
            const apiParams: any = {
              page: params.current || 1,
              page_size: params.pageSize || 20,
            };
            
            // 状态筛选
            if (searchFormValues?.is_active !== undefined && searchFormValues.is_active !== '' && searchFormValues.is_active !== null) {
              apiParams.is_active = searchFormValues.is_active;
            }
            
            // 类型筛选
            if (searchFormValues?.type) {
              apiParams.type = searchFormValues.type;
            }
            
            // 搜索条件处理：key 使用模糊搜索
            if (searchFormValues?.key) {
              apiParams.key = searchFormValues.key as string;
            }
            
            try {
              const response = await getSystemParameterList(apiParams);
              return {
                data: response.items,
                success: true,
                total: response.total,
              };
            } catch (error: any) {
              console.error('获取系统参数列表失败:', error);
              messageApi.error(error?.message || t('field.systemParameter.listFetchFailed'));
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
          showCreateButton
          createButtonText={t('field.systemParameter.createButton')}
          onCreate={handleCreate}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText={t('field.systemParameter.batchDeleteButton')}
          showImportButton
          showExportButton
          onExport={async (type, keys, pageData) => {
            const res = await getSystemParameterList({ page: 1, page_size: 10000 });
            let items = type === 'currentPage' && pageData?.length ? pageData : res.items;
            if (type === 'selected' && keys?.length) {
              items = res.items.filter((d) => keys.includes(d.uuid));
            }
            if (items.length === 0) {
              messageApi.warning(t('field.systemParameter.exportNoData'));
              return;
            }
            const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `system-parameters-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            messageApi.success(t('field.systemParameter.exportSuccess'));
          }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          viewTypes={['table', 'help']}
          defaultViewType="table"
          cardViewConfig={{
            renderCard: renderParameterCard,
            columns: { xs: 1, sm: 2, md: 3, lg: 4, xl: 4 },
          }}
        />
      </ListPageTemplate>

      {/* 创建/编辑参数 Modal */}
      <FormModalTemplate
        title={isEdit ? t('field.systemParameter.editTitle') : t('field.systemParameter.createTitle')}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setFormInitialValues(undefined);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        initialValues={formInitialValues}
        loading={formLoading}
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
          <ProFormText
            name="key"
            label={t('field.systemParameter.key')}
            rules={[{ required: true, message: t('field.systemParameter.keyRequired') }]}
            placeholder={t('field.systemParameter.keyPlaceholder')}
            disabled={isEdit}
          />
          <SafeProFormSelect
            name="type"
            label={t('field.systemParameter.type')}
            rules={[{ required: true, message: t('field.systemParameter.typeRequired') }]}
            options={[
              { label: t('field.systemParameter.typeString'), value: 'string' },
              { label: t('field.systemParameter.typeNumber'), value: 'number' },
              { label: t('field.systemParameter.typeBoolean'), value: 'boolean' },
              { label: t('field.systemParameter.typeJson'), value: 'json' },
            ]}
            fieldProps={{
              onChange: (value) => {
                setParameterType(value);
                setFormInitialValues((prev) => prev ? { ...prev, value: undefined } : undefined);
              },
            }}
            disabled={isEdit}
          />
          {renderValueInput()}
          <ProFormTextArea
            name="description"
            label={t('field.systemParameter.description')}
            placeholder={t('field.systemParameter.descriptionPlaceholder')}
          />
          {!isEdit && (
            <ProFormSwitch
              name="is_system"
              label={t('field.systemParameter.isSystemLabel')}
            />
          )}
          <ProFormSwitch
            name="is_active"
            label={t('field.systemParameter.isActiveLabel')}
          />
      </FormModalTemplate>

      {/* 查看详情 Drawer */}
      <DetailDrawerTemplate
        title={t('field.systemParameter.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        dataSource={detailData}
        columns={[
              {
                title: t('field.systemParameter.key'),
                dataIndex: 'key',
              },
              {
                title: t('field.systemParameter.value'),
                dataIndex: 'value',
                render: (value, record) => {
                  const displayValue = formatValue(value, record.type);
                  if (record.type === 'json') {
                    return (
                      <pre style={{
                        margin: 0,
                        padding: '8px',
                        backgroundColor: '#f5f5f5',
                        borderRadius: '4px',
                        overflow: 'auto',
                        maxHeight: '300px',
                      }}>
                        {displayValue}
                      </pre>
                    );
                  }
                  return <span>{displayValue}</span>;
                },
              },
              {
                title: t('field.systemParameter.type'),
                dataIndex: 'type',
              },
              {
                title: t('field.systemParameter.description'),
                dataIndex: 'description',
              },
              {
                title: t('field.systemParameter.isSystem'),
                dataIndex: 'is_system',
                render: (value) => (value ? t('field.systemParameter.yes') : t('field.systemParameter.no')),
              },
              {
                title: t('field.systemParameter.status'),
                dataIndex: 'is_active',
                render: (value) => (value ? t('field.systemParameter.enabled') : t('field.systemParameter.disabled')),
              },
              {
                title: t('field.systemParameter.createdAt'),
                dataIndex: 'created_at',
                valueType: 'dateTime',
              },
              {
                title: t('field.systemParameter.updatedAt'),
                dataIndex: 'updated_at',
                valueType: 'dateTime',
              },
        ]}
      />
    </>
  );
};

export default SystemParameterListPage;

