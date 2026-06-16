import { rowActionKind } from '../../../../components/uni-action';
/**
 * 消息模板管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的消息模板。
 * 支持消息模板的 CRUD 操作。
 */

import React, { useRef, useState } from 'react';
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
import { App, Button, Descriptions, Modal, Popconfirm, Tag } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { flushDrawerOpen, DRAWER_CONFIG, FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../components/layout-templates';
import { UniDetail, detailDrawerDescriptionItems } from '../../../../components/uni-detail';
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

/**
 * 消息模板管理列表页面组件
 */
const MessageTemplateListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);
  const messageTemplateDetailReqRef = useRef(0);
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
  const handleView = async (record: MessageTemplate) => {
    const req = ++messageTemplateDetailReqRef.current;
    flushDrawerOpen(() => {
      setDrawerVisible(true);
      setDetailData(null);
      setDetailLoading(true);
    });
    try {
      const detail = await getMessageTemplateByUuid(record.uuid);
      if (messageTemplateDetailReqRef.current !== req) return;
      setDetailData(detail);
    } catch (error: any) {
      if (messageTemplateDetailReqRef.current === req) {
        messageApi.error(error.message || t('pages.system.messageTemplate.getDetailFailed'));
      }
    } finally {
      if (messageTemplateDetailReqRef.current === req) {
        setDetailLoading(false);
      }
    }
  };

  /**
   * 处理删除消息模板
   */
  const handleDelete = async (record: MessageTemplate) => {
    try {
      await deleteMessageTemplate(record.uuid);
      messageApi.success(t('pages.system.messageConfig.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.messageConfig.deleteFailed'));
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
        messageApi.success(t('pages.system.messageConfig.updateSuccess'));
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
        messageApi.success(t('pages.system.messageConfig.createSuccess'));
      }
      
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.messageConfig.operationFailed'));
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<MessageTemplate>[] = [
    {
      title: t('pages.system.messageTemplate.templateName'),
      dataIndex: 'name',
      width: 200,
      fixed: 'left',
      render: (_, record) => resolvePresetMessageTemplateName(record, t),
    },
    {
      title: t('pages.system.messageTemplate.templateCode'),
      dataIndex: 'code',
      width: 150,
    },
    {
      title: t('pages.system.messageConfig.type'),
      dataIndex: 'type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        email: { text: t('pages.system.messageConfig.typeEmail'), status: 'Success' },
        sms: { text: t('pages.system.messageConfig.typeSms'), status: 'Processing' },
        internal: { text: t('pages.system.messageConfig.typeInternal'), status: 'Warning' },
        push: { text: t('pages.system.messageConfig.typePush'), status: 'Default' },
      },
      render: (_, record) => {
        const typeMap: Record<string, { color: string; text: string }> = {
          email: { color: 'blue', text: t('pages.system.messageConfig.typeEmail') },
          sms: { color: 'orange', text: t('pages.system.messageConfig.typeSms') },
          internal: { color: 'green', text: t('pages.system.messageConfig.typeInternal') },
          push: { color: 'default', text: t('pages.system.messageConfig.typePush') },
        };
        const typeInfo = typeMap[record.type] || { color: 'default', text: record.type };
        return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
      },
    },
    {
      title: t('pages.system.messageTemplate.subject'),
      dataIndex: 'subject',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('pages.system.messageConfig.description'),
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
      render: (_, record) => resolvePresetMessageTemplateDescription(record, t),
    },
    {
      title: t('pages.system.messageConfig.activeStatus'),
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('pages.system.applications.enabled'), status: 'Success' },
        false: { text: t('pages.system.applications.disabled'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? t('pages.system.applications.enabled') : t('pages.system.applications.disabled')}
        </Tag>
      ),
    },
    {
      title: t('pages.system.messageConfig.createdAt'),
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('pages.system.messageConfig.actions'),
      valueType: 'option',
      fixed: 'right',
      render: (_, record) => [
            <Button {...rowActionKind('read')} key="view" onClick={() => handleView(record)}>
              {t('pages.system.messageConfig.view')}
            </Button>,
            <Button {...rowActionKind('update')} key="edit" onClick={() => handleEdit(record)}>
              {t('pages.system.messageConfig.edit')}
            </Button>,
            <Popconfirm {...rowActionKind('delete')}
              key="delete"
              title={t('pages.system.messageTemplate.deleteConfirm')}
              onConfirm={() => handleDelete(record)}
            >
              <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                {t('pages.system.messageConfig.delete')}
              </Button>
            </Popconfirm>,
          ],
    },
  ];

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
      title: t('pages.system.messageTemplate.remark'),
      dataIndex: 'description',
      render: (_, r) => resolvePresetMessageTemplateDescription(r, t),
    },
    {
      title: t('pages.system.messageConfig.activeStatus'),
      dataIndex: 'is_active',
      render: (_, r) => (
        <Tag color={r.is_active ? 'success' : 'default'}>
          {r.is_active ? t('pages.system.applications.enabled') : t('pages.system.applications.disabled')}
        </Tag>
      ),
    },
    { title: t('pages.system.messageConfig.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
    { title: t('pages.system.messageConfig.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<MessageTemplate>
        columnPersistenceId="pages.system.messages.template"
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
        deleteButtonText={t('pages.system.messageTemplate.batchDeleteButton')}
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
            const allData = await getMessageTemplateList({ skip: 0, limit: 10000 });
            let items = Array.isArray(allData) ? allData : [];
            if (type === 'currentPage' && pageData?.length) {
              items = pageData;
            } else if (type === 'selected' && keys?.length) {
              items = items.filter((d: any) => keys.includes(d.uuid));
            }
            if (items.length === 0) {
              messageApi.warning(t('pages.system.messageTemplate.noDataExport'));
              return;
            }
            const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `message-templates-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            messageApi.success(t('pages.system.messageTemplate.exportSuccessCount', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('pages.system.messageTemplate.exportFailed'));
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
              label={t('pages.system.messageTemplate.remark')}
              placeholder={t('pages.system.messageTemplate.descriptionPlaceholder')}
              fieldProps={{
                rows: 2,
              }}
              colProps={{ span: 24 }}
            />
            <ProFormSwitch
              name="is_active"
              label={t('pages.system.messageTemplate.enabled')}
              colProps={{ span: 12 }}
            />
      </FormModalTemplate>

      {/* 查看详情 Drawer */}
      <UniDetail
        title={t('pages.system.messageTemplate.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        basic={detailData ? (
            <Descriptions column={1} items={detailDrawerDescriptionItems(detailColumns, detailData)} />
          ) : null}
      />
    </>
  );
};

export default MessageTemplateListPage;

