import { rowActionKind } from '../../../../components/uni-action';
/**
 * 消息模板管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的消息模板。
 * 支持消息模板的 CRUD 操作。
 */

import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProFormText,
  ProFormTextArea,
  ProFormSwitch,
  ProFormInstance,
  ProFormList,
  ProFormGroup,
  type ProDescriptionsItemProps,
} from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/safe-pro-form-select';
import { App, Button, Modal, Popconfirm } from 'antd';
import { alignProColumns, GLOBAL_DOC_LIST_FIELD_RANK } from '../../../../apps/kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../utils/uniTableLayoutColumns';
import { renderSystemActiveTag, renderSystemTypeMarker } from '../../utils/systemListPresentation';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../utils/errorHandler';
import { buildDetailDrawerEditExtra } from '../../../../apps/kuaizhizao/pages/equipment-management/shared/equipmentMasterDataDetail';
import { SystemMasterDetailDrawer } from '../../shared/systemMasterDetailDrawer';
import {
  getMessageTemplateList,
  getMessageTemplateByUuid,
  createMessageTemplate,
  updateMessageTemplate,
  deleteMessageTemplate,
  loadPresetMessageTemplates,
  MessageTemplate,
  CreateMessageTemplateData,
  UpdateMessageTemplateData,
} from '../../../../services/messageTemplate';
import {
  resolvePresetMessageTemplateDescription,
  resolvePresetMessageTemplateName,
} from '../../../../utils/presetEntityI18n';
import { fetchAllListItems } from '../../../../utils/fetchAllListPages';
import { downloadRecordsAsXlsx } from '../../../../utils/exportRecordsXlsx';
import { pickListSearchKeyword } from '../../../../utils/tableQueryKey';
import { todaySiteDateString } from '../../../../utils/format';
import { buildListPageHelpViewConfig } from '../../../../components/page-help-wiki';

/**
 * 消息模板管理列表页面组件
 */
const MessageTemplateListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);
  const detailRetryUuidRef = useRef<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Modal 相关状态（创建/编辑消息模板）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentMessageTemplateUuid, setCurrentMessageTemplateUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<MessageTemplate | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [loadPresetLoading, setLoadPresetLoading] = useState(false);

  /**
   * 处理新建消息模板
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentMessageTemplateUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      type: 'email',
      is_active: true,
    });
  };

  /**
   * 处理编辑消息模板
   */
  const handleEdit = async (record: MessageTemplate) => {
    try {
      setIsEdit(true);
      setCurrentMessageTemplateUuid(record.uuid);
      setModalVisible(true);
      
      // 获取消息模板详情
      const detail = await getMessageTemplateByUuid(record.uuid);
      
      // 转换变量为列表格式
      const variableList = detail.variables 
        ? Object.entries(detail.variables).map(([key, label]) => ({ key, label }))
        : [];

      formRef.current?.setFieldsValue({
        name: detail.name,
        code: detail.code,
        description: detail.description,
        type: detail.type,
        subject: detail.subject,
        content: detail.content,
        variableList,
        is_active: detail.is_active,
      });
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.messageTemplate.getDetailFailed'));
    }
  };

  /**
   * 处理查看详情
   */
  const loadDetail = async (uuid: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await getMessageTemplateByUuid(uuid);
      setDetailData(detail);
    } catch (error) {
      setDetailData(null);
      setDetailError(getApiErrorMessage(error, t('pages.system.messageTemplate.getDetailFailed')));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleView = (record: MessageTemplate) => {
    detailRetryUuidRef.current = record.uuid;
    setDrawerVisible(true);
    setDetailData(null);
    setDetailError(null);
    void loadDetail(record.uuid);
  };

  /**
   * 处理删除消息模板
   */
  const handleDelete = async (record: MessageTemplate) => {
    try {
      await deleteMessageTemplate(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 处理批量删除消息模板
   */
  const handleBatchDelete = async (keys: React.Key[]) => {
    try {
      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      for (const key of keys) {
        try {
          await deleteMessageTemplate(key.toString());
          successCount++;
        } catch (error: any) {
          failCount++;
          errors.push(error.message || t('common.deleteFailed'));
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
  };

  /**
   * 处理提交表单（创建/更新消息模板）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);
      
      // 将变量列表转换回 JSON 对象
      let variables: Record<string, any> | undefined = undefined;
      if (values.variableList && Array.isArray(values.variableList)) {
        variables = {};
        values.variableList.forEach((item: any) => {
          if (item.key) {
            variables![item.key] = item.label || '';
          }
        });
      }
      
      if (isEdit && currentMessageTemplateUuid) {
        await updateMessageTemplate(currentMessageTemplateUuid, {
          name: values.name,
          description: values.description,
          subject: values.subject,
          content: values.content,
          variables: variables,
          is_active: values.is_active,
        } as UpdateMessageTemplateData);
        messageApi.success(t('common.updateSuccess'));
      } else {
        await createMessageTemplate({
          name: values.name,
          code: values.code,
          type: values.type,
          description: values.description,
          subject: values.subject,
          content: values.content,
          variables: variables,
          is_active: values.is_active,
        } as CreateMessageTemplateData);
        messageApi.success(t('common.createSuccess'));
      }
      
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.operationFailed'));
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const columns = useMemo<ProColumns<MessageTemplate>[]>(() => alignProColumns([
    {
      title: t('pages.system.messageTemplate.templateCode'),
      dataIndex: 'code',
      width: 160,
      minWidth: 160,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
    },
    {
      title: t('pages.system.messageTemplate.templateName'),
      dataIndex: 'name',
      width: 180,
      minWidth: 180,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      render: (_, record) => resolvePresetMessageTemplateName(record, t),
    },
    {
      title: t('pages.system.messageConfig.type'),
      dataIndex: 'type',
      width: 110,
      minWidth: 110,
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
      // 主题长短不一：唯一 RemainderFlex
      title: t('pages.system.messageTemplate.subject'),
      dataIndex: 'subject',
      minWidth: 160,
      uniTableRemainderFlex: true,
      uniTablePrimaryFlex: true,
      resizable: false,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('common.remark'),
      dataIndex: 'description',
      width: 160,
      minWidth: 160,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      hideInSearch: true,
      render: (_, record) => resolvePresetMessageTemplateDescription(record, t),
    },
    {
      title: t('pages.system.messageConfig.activeStatus'),
      dataIndex: 'is_active',
      ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
      valueType: 'select',
      valueEnum: {
        true: { text: t('common.enabled'), status: 'Success' },
        false: { text: t('common.disabled'), status: 'Default' },
      },
      render: (_, record) =>
        renderSystemActiveTag(t, record.is_active, 'common.enabled', 'common.disabled'),
    },
    {
      title: t('common.createdAt'),
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
      title: t('common.actions'),
      key: 'action',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => [
            <Button {...rowActionKind('read')} key="view" onClick={() => handleView(record)} />,
            <Button {...rowActionKind('update')} key="edit" onClick={() => handleEdit(record)} />,
            <Popconfirm
              key="delete"
              title={t('pages.system.messageTemplate.deleteConfirm')}
              onConfirm={() => handleDelete(record)}
            >
              <Button {...rowActionKind('delete')} />
            </Popconfirm>,
          ],
    },
  ], GLOBAL_DOC_LIST_FIELD_RANK), [t, handleView, handleEdit, handleDelete]);


  /**
   * 详情列定义
   */
  const detailColumns: ProDescriptionsItemProps<MessageTemplate>[] = [
    {
      title: t('pages.system.messageTemplate.templateName'),
      dataIndex: 'name',
      render: (_, r) => resolvePresetMessageTemplateName(r, t),
    },
    { title: t('pages.system.messageTemplate.templateCode'), dataIndex: 'code' },
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
    { title: t('pages.system.messageTemplate.subject'), dataIndex: 'subject' },
    {
      title: t('pages.system.messageTemplate.templateContent'),
      dataIndex: 'content',
      render: (_, r) => (
        <pre style={{
          margin: 0,
          padding: '8px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
          overflow: 'auto',
          maxHeight: '200px',
          fontSize: 12,
          whiteSpace: 'pre-wrap',
        }}>
          {r.content}
        </pre>
      ),
    },
    {
      title: t('pages.system.messageTemplate.templateVars'),
      dataIndex: 'variables',
      render: (_, r) => r.variables ? (
        <pre style={{
          margin: 0,
          padding: '8px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
          overflow: 'auto',
          maxHeight: '200px',
          fontSize: 12,
        }}>
          {JSON.stringify(r.variables, null, 2)}
        </pre>
      ) : '-',
    },
    {
      title: t('common.remark'),
      dataIndex: 'description',
      render: (_, r) => resolvePresetMessageTemplateDescription(r, t),
    },
    {
      title: t('pages.system.messageConfig.activeStatus'),
      dataIndex: 'is_active',
      render: (_, r) =>
        renderSystemActiveTag(t, r.is_active, 'common.enabled', 'common.disabled'),
    },
    { title: t('common.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
    { title: t('common.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<MessageTemplate>
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('system.messageTemplates')}
        columnPersistenceId="pages.system.messages.template.list-v2"
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
            const result = await getMessageTemplateList(apiParams);
            return {
              data: result,
              success: true,
              total: result.length,  // 简化实现，实际应该从后端返回总数
            };
          } catch (error: any) {
            console.error('获取消息模板列表失败:', error);
            messageApi.error(error?.message || t('pages.system.messageTemplate.loadListFailed'));
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
        createButtonText={t('pages.system.messageTemplate.createButton')}
        onCreate={handleCreate}
        enableRowSelection
        onRowSelectionChange={setSelectedRowKeys}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteButtonText={t('common.batchDelete')}
        deleteConfirmTitle={t('pages.system.messageConfig.batchDeleteTitle')}
        deleteConfirmDescription={(c) => t('pages.system.messageConfig.batchDeleteDescription', { count: c })}
        toolBarRender={() => [
          <Button {...rowActionKind('import')}
            key="loadPreset"
            loading={loadPresetLoading}
            onClick={async () => {
              try {
                setLoadPresetLoading(true);
                const res = await loadPresetMessageTemplates();
                messageApi.success(res.message);
    actionRef.current?.reload();
              } catch (e: any) {
                messageApi.error(e?.message || t('common.operationFailed'));
              } finally {
                setLoadPresetLoading(false);
              }
            }}
          >
            {t('field.messageTemplate.loadPreset')}
          </Button>
        ]}
        showImportButton={false}
        showExportButton={true}
        onExport={async (type, keys, pageData) => {
          try {
            let items = await fetchAllListItems((p) => getMessageTemplateList(p));
            if (type === 'currentPage' && pageData?.length) {
              items = pageData;
            } else if (type === 'selected' && keys?.length) {
              items = items.filter((d: any) => keys.includes(d.uuid));
            }
            if (items.length === 0) {
              messageApi.warning(t('common.exportNoData'));
              return;
            }
            await downloadRecordsAsXlsx(
              items as Array<Record<string, unknown>>,
              `message-templates-${todaySiteDateString()}.xlsx`,
            );
            messageApi.success(t('pages.system.messageTemplate.exportSuccessCount', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('common.exportFailed'));
          }
        }}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
        />
      </ListPageTemplate>

      {/* 创建/编辑消息模板 Modal */}
      <FormModalTemplate
        title={isEdit ? t('pages.system.messageTemplate.editTitle') : t('pages.system.messageTemplate.createTitle')}
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={formLoading}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        grid
      >
            <ProFormText
              name="code"
              label={t('pages.system.messageTemplate.templateCode')}
              rules={[
                { required: true, message: t('pages.system.messageTemplate.codeRequired') },
                { pattern: /^[A-Z0-9_]+$/, message: t('pages.system.messageTemplate.codePattern') },
              ]}
              placeholder={t('pages.system.messageTemplate.codePlaceholder')}
              disabled={isEdit}
              colProps={{ span: 8 }}
            />
            <ProFormText
              name="name"
              label={t('pages.system.messageTemplate.templateName')}
              rules={[{ required: true, message: t('pages.system.messageTemplate.nameRequired') }]}
              placeholder={t('pages.system.messageTemplate.namePlaceholder')}
              colProps={{ span: 8 }}
            />
            <SafeProFormSelect
              name="type"
              label={t('pages.system.messageConfig.type')}
              rules={[{ required: true, message: t('pages.system.messageTemplate.typeRequired') }]}
              options={[
                { label: t('pages.system.messageConfig.typeEmail'), value: 'email' },
                { label: t('pages.system.messageConfig.typeSms'), value: 'sms' },
                { label: t('pages.system.messageConfig.typeInternal'), value: 'internal' },
                { label: t('pages.system.messageConfig.typePush'), value: 'push' },
              ]}
              disabled={isEdit}
              colProps={{ span: 8 }}
            />
            <ProFormText
              name="subject"
              label={t('pages.system.messageTemplate.messageSubject')}
              placeholder={t('pages.system.messageTemplate.subjectPlaceholder')}
              colProps={{ span: 24 }}
            />
            <ProFormTextArea
              name="content"
              label={t('pages.system.messageTemplate.templateBody')}
              rules={[{ required: true, message: t('pages.system.messageTemplate.contentRequired') }]}
              placeholder={t('pages.system.messageTemplate.contentPlaceholder')}
              fieldProps={{
                rows: 6,
              }}
              colProps={{ span: 24 }}
            />
            <ProFormGroup colProps={{ span: 24 }} style={{ paddingLeft: 4, paddingRight: 4 }}>
              <ProFormList
                name="variableList"
                label={t('pages.system.messageTemplate.variableDeclaration')}
                creatorButtonProps={{
                  creatorButtonText: t('pages.system.messageTemplate.addVariable'),
                }}
                actionRender={(_, __, defaultAction) => [
                  defaultAction[0],
                  <span {...rowActionKind('delete')} key="delete" style={{ color: '#ff4d4f' }}>
                    {defaultAction[1]}
                  </span>,
                ]}
                itemRender={({ listDom, action }) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>{listDom}</div>
                    {action}
                  </div>
                )}
              >
                <ProFormGroup key="group" grid>
                  <ProFormText 
                    name="key" 
                    placeholder={t('pages.system.messageTemplate.varKeyPlaceholder')} 
                    rules={[{ required: true, message: t('pages.system.messageTemplate.required') }]}
                    colProps={{ span: 12 }}
                  />
                  <ProFormText 
                    name="label" 
                    placeholder={t('pages.system.messageTemplate.varLabelPlaceholder')} 
                    colProps={{ span: 12 }}
                  />
                </ProFormGroup>
              </ProFormList>
            </ProFormGroup>

            <ProFormTextArea
              name="description"
              label={t('common.remark')}
              placeholder={t('pages.system.messageTemplate.descriptionPlaceholder')}
              fieldProps={{
                rows: 2,
              }}
              colProps={{ span: 24 }}
            />
            <ProFormSwitch
              name="is_active"
              label={t('common.enabled')}
              colProps={{ span: 12 }}
            />
      </FormModalTemplate>

      {/* 查看详情 Drawer */}
      <SystemMasterDetailDrawer
        title={t('pages.system.messageTemplate.detailTitle')}
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
        extra={buildDetailDrawerEditExtra(t, Boolean(detailData), () => {
          if (!detailData) return;
          void handleEdit(detailData);
        })}
        detail={detailData}
        detailColumns={detailColumns}
      />
    </>
  );
};

export default MessageTemplateListPage;

