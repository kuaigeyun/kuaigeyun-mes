/**
 * 消息配置管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的消息配置。
 * 支持消息配置的 CRUD 操作。
 */

import React, { useMemo, useRef, useState } from 'react';
import { rowActionKind } from '../../../../components/uni-action';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProFormText,
  ProFormTextArea,
  ProFormSwitch,
  ProFormInstance,
  ProFormDependency,
  ProFormDigit,
  type ProDescriptionsItemProps,
} from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/safe-pro-form-select';
import { App, Button, Input, Modal, Popconfirm } from 'antd';
import { alignProColumns, GLOBAL_DOC_LIST_FIELD_RANK } from '../../../../apps/kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { renderSystemActiveTag, renderSystemTypeMarker, renderSystemYesNoTag } from '../../utils/systemListPresentation';
import {
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../utils/errorHandler';
import { buildDetailDrawerEditExtra } from '../../../../apps/kuaizhizao/pages/equipment-management/shared/equipmentMasterDataDetail';
import { SystemMasterDetailDrawer } from '../../shared/systemMasterDetailDrawer';
import {
  getMessageConfigList,
  getMessageConfigByUuid,
  createMessageConfig,
  updateMessageConfig,
  deleteMessageConfig,
  MessageConfig,
  CreateMessageConfigData,
  UpdateMessageConfigData,
  testMessageConfig,
} from '../../../../services/messageConfig';
import { fetchAllListItems } from '../../../../utils/fetchAllListPages';
import { downloadRecordsAsXlsx } from '../../../../utils/exportRecordsXlsx';
import { pickListSearchKeyword } from '../../../../utils/tableQueryKey';
import { getAntdModal } from '../../../../utils/antdAppApis';
import { todaySiteDateString } from '../../../../utils/format';
/**
 * 消息配置管理列表页面组件
 */
const MessageConfigListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);
  const detailRetryUuidRef = useRef<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Modal 相关状态（创建/编辑消息配置）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentMessageConfigUuid, setCurrentMessageConfigUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<MessageConfig | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const BUILTIN_INTERNAL_CHANNEL_UUID = '__builtin_internal_channel__';
  const BUILTIN_INTERNAL_CHANNEL_CODE = 'IN_APP_DEFAULT';
  const isBuiltInChannel = (record: Partial<MessageConfig> | undefined | null) =>
    !!record && (record.uuid === BUILTIN_INTERNAL_CHANNEL_UUID || record.code === BUILTIN_INTERNAL_CHANNEL_CODE);
  const builtInInternalChannel: MessageConfig = {
    uuid: BUILTIN_INTERNAL_CHANNEL_UUID,
    name: '站内通知',
    code: BUILTIN_INTERNAL_CHANNEL_CODE,
    type: 'internal',
    description: '系统内置默认渠道（不可删除）',
    config: {},
    is_active: true,
    is_default: true,
    created_at: '',
    updated_at: '',
  } as MessageConfig;

  /**
   * 处理新建消息配置
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentMessageConfigUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      type: 'email',
      is_active: true,
      is_default: false,
    });
  };

  /**
   * 处理编辑消息配置
   */
  const handleEdit = async (record: MessageConfig) => {
    if (isBuiltInChannel(record)) {
      messageApi.info('站内通知为系统内置渠道，不支持编辑');
      return;
    }
    try {
      setIsEdit(true);
      setCurrentMessageConfigUuid(record.uuid);
      // 获取消息配置详情
      const detail = await getMessageConfigByUuid(record.uuid);
      formRef.current?.setFieldsValue({
        name: detail.name,
        code: detail.code,
        description: detail.description,
        type: detail.type,
        is_active: detail.is_active,
        is_default: detail.is_default,
        ...detail.config, // 将配置项展开到表单字段中
      });
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.messageConfig.getDetailFailed'));
    }
  };

  /**
   * 处理查看详情
   */
  const loadDetail = async (uuid: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await getMessageConfigByUuid(uuid);
      setDetailData(detail);
    } catch (error) {
      setDetailData(null);
      setDetailError(getApiErrorMessage(error, t('pages.system.messageConfig.getDetailFailed')));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleView = (record: MessageConfig) => {
    if (isBuiltInChannel(record)) {
      detailRetryUuidRef.current = null;
      setDrawerVisible(true);
      setDetailLoading(false);
      setDetailError(null);
      setDetailData(builtInInternalChannel);
      return;
    }
    detailRetryUuidRef.current = record.uuid;
    setDrawerVisible(true);
    setDetailData(null);
    setDetailError(null);
    void loadDetail(record.uuid);
  };

  /**
   * 处理删除消息配置
   */
  const handleDelete = async (record: MessageConfig) => {
    if (isBuiltInChannel(record)) {
      messageApi.warning('站内通知为系统内置渠道，不可删除');
      return;
    }
    try {
      await deleteMessageConfig(record.uuid);
      messageApi.success(t('pages.system.messageConfig.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.messageConfig.deleteFailed'));
    }
  };

  /**
   * 处理批量删除消息配置
   */
  const handleBatchDelete = () => {
    const deletableKeys = selectedRowKeys.filter((k) => String(k) !== BUILTIN_INTERNAL_CHANNEL_UUID);
    if (deletableKeys.length === 0) {
      messageApi.warning(t('pages.system.selectFirst'));
      return;
    }

    getAntdModal().confirm({
      title: t('pages.system.messageConfig.batchDeleteConfirmTitle'),
      content: t('pages.system.messageConfig.batchDeleteConfirmContent', { count: deletableKeys.length }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: async () => {
        try {
          let successCount = 0;
          let failCount = 0;
          const errors: string[] = [];

          for (const key of deletableKeys) {
            try {
              await deleteMessageConfig(key.toString());
              successCount++;
            } catch (error: any) {
              failCount++;
              errors.push(error.message || t('pages.system.messageConfig.deleteFailed'));
            }
          }

          if (successCount > 0) {
            messageApi.success(t('pages.system.messageConfig.batchDeleteSuccessCount', { count: successCount }));
          }
          if (failCount > 0) {
            messageApi.error(t('pages.system.messageConfig.batchDeleteFailCount', { count: failCount }) + (errors.length > 0 ? '：' + errors.join('; ') : ''));
          }

          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('pages.system.messageConfig.batchDeleteFailed'));
        }
      },
    });
  };

  /**
   * 处理提交表单（创建/更新消息配置）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);
      
      // 提取技术配置字段
      const config: Record<string, any> = {};
      const { name, code, type, description, is_active, is_default, ...technicalConfig } = values;
      Object.assign(config, technicalConfig);
      
      if (isEdit && currentMessageConfigUuid) {
        await updateMessageConfig(currentMessageConfigUuid, {
          name: values.name,
          description: values.description,
          config: config,
          is_active: values.is_active,
          is_default: values.is_default,
        } as UpdateMessageConfigData);
        messageApi.success(t('pages.system.messageConfig.updateSuccess'));
      } else {
        await createMessageConfig({
          name: values.name,
          code: values.code,
          type: values.type,
          description: values.description,
          config: config,
          is_active: values.is_active,
          is_default: values.is_default,
        } as CreateMessageConfigData);
        messageApi.success(t('pages.system.messageConfig.createSuccess'));
      }
      
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      if (error?.name === 'ValidationError') {
         // Form validation failed, handled by ProForm
      } else {
        messageApi.error(error.message || t('pages.system.messageConfig.operationFailed'));
      }
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 处理配置测试
   */
  const handleTest = async () => {
    try {
      const values = await formRef.current?.validateFields();
      if (!values) return;

      const { name: _n, code: _c, type, description: _d, is_active: _a, is_default: _def, ...config } = values;
      
      let testTarget = '';
      getAntdModal().confirm({
        title: t('pages.system.messageConfig.testTitle'),
        icon: null,
        content: (
          <div style={{ marginTop: 16 }}>
            <p>{t('pages.system.messageConfig.testInputLabel', { target: type === 'email' ? t('pages.system.messageConfig.testTargetEmail') : t('pages.system.messageConfig.testTargetPhone') })}</p>
            <Input 
              placeholder={type === 'email' ? t('pages.system.messageConfig.testTargetPlaceholderEmail') : t('pages.system.messageConfig.testTargetPlaceholderPhone')} 
              onChange={(e) => { testTarget = e.target.value; }}
            />
          </div>
        ),
        onOk: async () => {
          if (!testTarget) {
            messageApi.warning(t('pages.system.messageConfig.testInputRequired'));
            return Promise.reject();
          }
          
          const hide = messageApi.loading(t('pages.system.messageConfig.testSending'), 0);
          try {
            const result = await testMessageConfig({
              type,
              config,
              target: testTarget,
            });
            hide();
            if (result.success) {
              messageApi.success(result.message);
            } else {
              getAntdModal().error({
                title: t('pages.system.messageConfig.testFailed'),
                content: (
                  <div>
                    <p>{result.message}</p>
                    {result.error_detail && (
                      <pre style={{ 
                        marginTop: 8, 
                        padding: 8, 
                        background: '#fff2f0', 
                        border: '1px solid #ffccc7',
                        borderRadius: 4,
                        fontSize: 12,
                        maxHeight: 200,
                        overflow: 'auto'
                      }}>
                        {result.error_detail}
                      </pre>
                    )}
                  </div>
                ),
              });
            }
          } catch (error: any) {
            hide();
            messageApi.error(t('pages.system.messageConfig.testRequestFailed', { message: error.message }));
          }
        },
      });
    } catch (e) {
      messageApi.warning(t('pages.system.messageConfig.completeConfigFirst'));
    }
  };

  /**
   * 表格列定义
   */
  const columns = useMemo<ProColumns<MessageConfig>[]>(() => alignProColumns([
    {
      title: t('pages.system.messageConfig.name'),
      dataIndex: 'name',
      width: 200,
      fixed: 'left',
    },
    {
      title: t('pages.system.messageConfig.code'),
      dataIndex: 'code',
      width: 150,
      minWidth: 150,
      uniTableKeepWidth: true,
      resizable: false,
    },
    {
      title: t('pages.system.messageConfig.type'),
      dataIndex: 'type',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      valueType: 'select',
      valueEnum: {
        email: { text: t('pages.system.messageConfig.typeEmail'), status: 'Success' },
        sms: { text: t('pages.system.messageConfig.typeSms'), status: 'Processing' },
        internal: { text: t('pages.system.messageConfig.typeInternal'), status: 'Warning' },
        push: { text: t('pages.system.messageConfig.typePush'), status: 'Default' },
      },
      render: (_, record) => {
        const typeMap: Record<string, { color: string; text: string }> = {
          email: { color: 'processing', text: t('pages.system.messageConfig.typeEmail') },
          sms: { color: 'warning', text: t('pages.system.messageConfig.typeSms') },
          internal: { color: 'success', text: t('pages.system.messageConfig.typeInternal') },
          push: { color: 'default', text: t('pages.system.messageConfig.typePush') },
        };
        const typeInfo = typeMap[record.type] || { color: 'default', text: record.type };
        return renderSystemTypeMarker(typeInfo.text, typeInfo.color);
      },
    },
    {
      title: t('pages.system.messageConfig.remark'),
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('pages.system.messageConfig.activeStatus'),
      dataIndex: 'is_active',
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
      valueType: 'select',
      valueEnum: {
        true: { text: t('pages.system.applications.enabled'), status: 'Success' },
        false: { text: t('pages.system.applications.disabled'), status: 'Default' },
      },
      render: (_, record) =>
        renderSystemActiveTag(t, record.is_active, 'pages.system.applications.enabled', 'pages.system.applications.disabled'),
    },
    {
      title: t('pages.system.messageConfig.defaultConfig'),
      dataIndex: 'is_default',
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
      valueType: 'select',
      valueEnum: {
        true: { text: t('field.customField.yes'), status: 'Success' },
        false: { text: t('field.customField.no'), status: 'Default' },
      },
      render: (_, record) => renderSystemYesNoTag(t, record.is_default),
    },
    {
      title: t('pages.system.messageConfig.createdAt'),
      dataIndex: 'created_at',
      width: 180,
      minWidth: 180,
      uniTableKeepWidth: true,
      resizable: false,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('pages.system.messageConfig.actions'),
      key: 'action',
      valueType: 'option',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => [
            <Button {...rowActionKind('read')} key="view" onClick={() => handleView(record)}>
              {t('pages.system.messageConfig.view')}
            </Button>,
            <Button {...rowActionKind('update')}
              key="edit"
              type="link"
              size="small"
              icon={<EditOutlined />}
              disabled={isBuiltInChannel(record)}
              onClick={() => handleEdit(record)}
            >
              {t('pages.system.messageConfig.edit')}
            </Button>,
            <Popconfirm {...rowActionKind('delete')}
              key="delete"
              title={t('pages.system.messageConfig.deleteConfirm')}
              disabled={isBuiltInChannel(record)}
              onConfirm={() => handleDelete(record)}
            >
              <Button
                type="link"
                danger
                size="small"
                icon={<DeleteOutlined />}
                disabled={isBuiltInChannel(record)}
              >
                {t('pages.system.messageConfig.delete')}
              </Button>
            </Popconfirm>,
          ],
    },
  ], GLOBAL_DOC_LIST_FIELD_RANK), [t, handleView, handleEdit, handleDelete, isBuiltInChannel]);

  /**
   * 详情列定义
   */
  const detailColumns = [
    { title: t('pages.system.messageConfig.name'), dataIndex: 'name' },
    { title: t('pages.system.messageConfig.code'), dataIndex: 'code' },
    {
      title: t('pages.system.messageConfig.type'),
      dataIndex: 'type',
      render: (_, r) => {
        const typeMap: Record<string, string> = {
          email: t('pages.system.messageConfig.typeEmail'),
          sms: t('pages.system.messageConfig.typeSms'),
          internal: t('pages.system.messageConfig.typeInternal'),
          push: t('pages.system.messageConfig.typePush'),
        };
        return typeMap[r.type] || r.type;
      },
    },
    { title: t('pages.system.messageConfig.remark'), dataIndex: 'description' },
    {
      title: t('pages.system.messageConfig.configInfo'),
      dataIndex: 'config',
      render: (_, r) => (
        <pre style={{
          margin: 0,
          padding: '8px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
          overflow: 'auto',
          maxHeight: '300px',
          fontSize: 12,
        }}>
          {JSON.stringify(r.config, null, 2)}
        </pre>
      ),
    },
    {
      title: t('pages.system.messageConfig.activeStatus'),
      dataIndex: 'is_active',
      render: (_, r) =>
        renderSystemActiveTag(t, r.is_active, 'pages.system.applications.enabled', 'pages.system.applications.disabled'),
    },
    {
      title: t('pages.system.messageConfig.defaultConfig'),
      dataIndex: 'is_default',
      render: (_, r) => renderSystemYesNoTag(t, r.is_default),
    },
    { title: t('pages.system.messageConfig.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
    { title: t('pages.system.messageConfig.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<MessageConfig>
        columnPersistenceId="pages.system.messages.config.list-v1"
        actionRef={actionRef}
        columns={columns}
        request={async (params, _sort, _filter, searchFormValues) => {
          // 处理搜索参数
          const apiParams: any = {
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
          };
          
          // 消息类型筛选
          if (searchFormValues?.type) {
            apiParams.type = searchFormValues.type;
          }
          
          // 启用状态筛选
          if (searchFormValues?.is_active !== undefined && searchFormValues.is_active !== '' && searchFormValues.is_active !== null) {
            apiParams.is_active = searchFormValues.is_active;
          }
          const keyword = pickListSearchKeyword(searchFormValues);
          if (keyword) {
            apiParams.keyword = keyword;
          }
          
          try {
            const result = await getMessageConfigList(apiParams);
            const merged = Array.isArray(result) ? result : [];
            const hasInternal = merged.some((it: any) => isBuiltInChannel(it) || (it?.type === 'internal' && it?.is_default));
            const dataWithBuiltIn = hasInternal ? merged : [builtInInternalChannel, ...merged];
            return {
              data: dataWithBuiltIn,
              success: true,
              total: dataWithBuiltIn.length,  // 简化实现，实际应该从后端返回总数
            };
          } catch (error: any) {
            console.error('获取消息配置列表失败:', error);
            messageApi.error(error?.message || t('pages.system.messageConfig.loadListFailed'));
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        rowKey="uuid"
        showAdvancedSearch={true}
        showCreateButton
        createButtonText={t('pages.system.messageConfig.createButton')}
        onCreate={handleCreate}
        enableRowSelection
        onRowSelectionChange={setSelectedRowKeys}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteButtonText={t('pages.system.messageConfig.batchDeleteButton')}
        showImportButton={false}
        showExportButton={true}
        onExport={async (type, keys, pageData) => {
          try {
            let items = await fetchAllListItems((p) => getMessageConfigList(p));
            if (type === 'currentPage' && pageData?.length) {
              items = pageData;
            } else if (type === 'selected' && keys?.length) {
              items = items.filter((d: any) => keys.includes(d.uuid));
            }
            if (items.length === 0) {
              messageApi.warning(t('pages.system.messageConfig.noDataExport'));
              return;
            }
            await downloadRecordsAsXlsx(
              items as Array<Record<string, unknown>>,
              `message-configs-${todaySiteDateString()}.xlsx`,
            );
            messageApi.success(t('pages.system.messageConfig.exportSuccessCount', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('pages.system.messageConfig.exportFailed'));
          }
        }}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
        />
      </ListPageTemplate>

      {/* 创建/编辑消息配置 Modal */}
      <FormModalTemplate
        title={isEdit ? t('pages.system.messageConfig.editTitle') : t('pages.system.messageConfig.createTitle')}
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={formLoading}
        width={MODAL_CONFIG.SMALL_WIDTH}
        grid
      >
        <ProFormText
          name="code"
          label={t('pages.system.messageConfig.code')}
          rules={[
            { required: true, message: t('pages.system.messageConfig.codeRequired') },
            { pattern: /^[A-Z0-9_]+$/, message: t('pages.system.messageConfig.codePattern') },
          ]}
          placeholder={t('pages.system.messageConfig.codePlaceholder')}
          disabled={isEdit}
          colProps={{ span: 24 }}
        />
        <ProFormText
          name="name"
          label={t('pages.system.messageConfig.name')}
          rules={[{ required: true, message: t('pages.system.messageConfig.nameRequired') }]}
          placeholder={t('pages.system.messageConfig.namePlaceholder')}
          colProps={{ span: 24 }}
        />
        <SafeProFormSelect
          name="type"
          label={t('pages.system.messageConfig.type')}
          rules={[{ required: true, message: t('pages.system.messageConfig.typeRequired') }]}
          options={[
            { label: t('pages.system.messageConfig.typeEmailOption'), value: 'email' },
            { label: t('pages.system.messageConfig.typeSmsOption'), value: 'sms' },
            { label: t('pages.system.messageConfig.typeInternalOption'), value: 'internal' },
            { label: t('pages.system.messageConfig.typePushOption'), value: 'push' },
          ]}
          disabled={isEdit}
          colProps={{ span: 24 }}
        />

        <ProFormDependency name={['type']}>
          {({ type }) => {
            if (type === 'email') {
              return (
                <>
                  <ProFormText
                    name="smtp_host"
                    label={t('pages.system.messageConfig.smtpHost')}
                    rules={[{ required: true }]}
                    placeholder={t('pages.system.messageConfig.smtpHostPlaceholder')}
                    colProps={{ span: 16 }}
                  />
                  <ProFormDigit
                    name="smtp_port"
                    label={t('pages.system.messageConfig.smtpPort')}
                    rules={[{ required: true }]}
                    placeholder={t('pages.system.messageConfig.smtpPortPlaceholder')}
                    colProps={{ span: 8 }}
                    fieldProps={{ style: { width: '100%' } }}
                  />
                  <ProFormText
                    name="smtp_username"
                    label={t('pages.system.messageConfig.smtpUsername')}
                    rules={[{ required: true, type: 'email' }]}
                    placeholder="your-account@example.com"
                    colProps={{ span: 12 }}
                  />
                  <ProFormText.Password
                    name="smtp_password"
                    label={t('pages.system.messageConfig.smtpPassword')}
                    rules={[{ required: true }]}
                    placeholder={t('pages.system.messageConfig.smtpPasswordPlaceholder')}
                    colProps={{ span: 12 }}
                  />
                  <ProFormText
                    name="from_name"
                    label={t('pages.system.messageConfig.fromName')}
                    placeholder={t('pages.system.messageConfig.fromNamePlaceholder')}
                    colProps={{ span: 12 }}
                  />
                  <ProFormSwitch
                    name="smtp_use_tls"
                    label={t('pages.system.messageConfig.smtpUseTls')}
                    initialValue={true}
                    colProps={{ span: 12 }}
                  />
                </>
              );
            }
            if (type === 'sms') {
              return (
                <>
                  <SafeProFormSelect
                    name="provider"
                    label={t('pages.system.messageConfig.provider')}
                    initialValue="aliyun"
                    options={[
                      { label: t('pages.system.messageConfig.providerAliyun'), value: 'aliyun' },
                      { label: t('pages.system.messageConfig.providerTencent'), value: 'tencent' },
                    ]}
                    colProps={{ span: 12 }}
                  />
                  <ProFormText
                    name="region"
                    label={t('pages.system.messageConfig.region')}
                    placeholder={t('pages.system.messageConfig.regionPlaceholder')}
                    colProps={{ span: 12 }}
                  />
                  <ProFormText
                    name="access_key_id"
                    label={t('pages.system.messageConfig.accessKeyId')}
                    rules={[{ required: true }]}
                    placeholder={t('pages.system.messageConfig.accessKeyIdPlaceholder')}
                    colProps={{ span: 12 }}
                    fieldProps={{ prefix: <SafetyCertificateOutlined style={{ color: '#bfbfbf' }} /> }}
                  />
                  <ProFormText.Password
                    name="access_key_secret"
                    label={t('pages.system.messageConfig.accessKeySecret')}
                    rules={[{ required: true }]}
                    placeholder={t('pages.system.messageConfig.accessKeySecretPlaceholder')}
                    colProps={{ span: 12 }}
                  />
                  <ProFormText
                    name="sign_name"
                    label={t('pages.system.messageConfig.signName')}
                    placeholder={t('pages.system.messageConfig.signNamePlaceholder')}
                    colProps={{ span: 24 }}
                    fieldProps={{ prefix: <CheckCircleOutlined style={{ color: '#bfbfbf' }} /> }}
                  />
                </>
              );
            }
            return null;
          }}
        </ProFormDependency>

        <ProFormTextArea
          name="description"
          label={t('pages.system.messageConfig.remark')}
          placeholder={t('pages.system.messageConfig.remarkPlaceholder')}
          fieldProps={{ rows: 2 }}
          colProps={{ span: 24 }}
        />
        <ProFormSwitch
          name="is_active"
          label={t('pages.system.messageConfig.activeStatus')}
          colProps={{ span: 12 }}
        />
        <ProFormSwitch
          name="is_default"
          label={t('pages.system.messageConfig.defaultConfig')}
          colProps={{ span: 12 }}
        />
      </FormModalTemplate>

      {/* 查看详情 Drawer */}
      <SystemMasterDetailDrawer
        title={t('pages.system.messageConfig.detailTitle')}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setDetailData(null);
          setDetailError(null);
        }}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          const id = detailRetryUuidRef.current;
          if (id) void loadDetail(id);
        }}
        extra={buildDetailDrawerEditExtra(t, Boolean(detailData) && !isBuiltInChannel(detailData), () => {
          if (!detailData) return;
          void handleEdit(detailData);
        })}
        detail={detailData}
        detailColumns={detailColumns as ProDescriptionsItemProps<MessageConfig>[]}
      />
    </>
  );
};

export default MessageConfigListPage;

