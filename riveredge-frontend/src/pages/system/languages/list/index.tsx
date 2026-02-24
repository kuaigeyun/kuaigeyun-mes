/**
 * 语言管理列表页面
 *
 * 用于系统管理员查看和管理组织内的语言。
 * 支持语言的 CRUD 操作和翻译管理。
 * 国际化
 */

import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormText, ProFormSwitch, ProFormDigit } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Space, Drawer, Modal, Table, Input } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, TranslationOutlined, SettingOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../components/layout-templates';
import {
  getLanguageList,
  getLanguageByUuid,
  createLanguage,
  updateLanguage,
  deleteLanguage,
  updateTranslations,
  initializeSystemLanguages,
  Language,
  CreateLanguageData,
  UpdateLanguageData,
  TranslationUpdateRequest,
} from '../../../../services/language';
import zhCN from '../../../../locales/zh-CN';
import enUS from '../../../../locales/en-US';
import { CODE_FONT_FAMILY } from '../../../../constants/fonts';

/**
 * 语言管理列表页面组件
 */
const LanguageListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Modal 相关状态（创建/编辑语言）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentLanguageUuid, setCurrentLanguageUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<Language | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // 翻译管理 Drawer 状态
  const [translationDrawerVisible, setTranslationDrawerVisible] = useState(false);
  const [currentLanguageForTranslation, setCurrentLanguageForTranslation] = useState<Language | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translationLoading, setTranslationLoading] = useState(false);
  const [translationSaving, setTranslationSaving] = useState(false);
  const [newTranslationKey, setNewTranslationKey] = useState('');
  const [newTranslationValue, setNewTranslationValue] = useState('');
  const [initializing, setInitializing] = useState(false);

  /**
   * 处理加载系统语言
   */
  const handleInitializeSystemLanguages = async () => {
    try {
      setInitializing(true);
      const result = await initializeSystemLanguages();
      messageApi.success(
        t('field.language.loadSystemLanguagesSuccess', {
          created: result.languages_created_count,
          skipped: result.languages_skipped_count,
        })
      );
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('common.loadFailed'));
    } finally {
      setInitializing(false);
    }
  };

  /**
   * 处理新建语言
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentLanguageUuid(null);
    setFormInitialValues({
      is_default: false,
      is_active: true,
      sort_order: 0,
    });
    setModalVisible(true);
  };

  /**
   * 处理编辑语言
   */
  const handleEdit = async (record: Language) => {
    try {
      setIsEdit(true);
      setCurrentLanguageUuid(record.uuid);
      
      // 获取语言详情
      const detail = await getLanguageByUuid(record.uuid);
      setFormInitialValues({
        code: detail.code,
        name: detail.name,
        native_name: detail.native_name,
        is_default: detail.is_default,
        is_active: detail.is_active,
        sort_order: detail.sort_order,
      });
      setModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || t('common.loadFailed'));
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: Language) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getLanguageByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || t('common.loadFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理管理翻译
   */
  const handleManageTranslations = async (record: Language) => {
    try {
      setTranslationLoading(true);
      setTranslationDrawerVisible(true);
      setCurrentLanguageForTranslation(record);
      const detail = await getLanguageByUuid(record.uuid);
      setTranslations(detail.translations || {});
    } catch (error: any) {
      messageApi.error(error.message || t('common.loadFailed'));
    } finally {
      setTranslationLoading(false);
    }
  };

  /**
   * 处理添加翻译
   */
  const handleAddTranslation = () => {
    if (!newTranslationKey.trim()) {
      messageApi.warning(t('field.language.translationKeyPlaceholder'));
      return;
    }
    if (translations[newTranslationKey]) {
      messageApi.warning(t('field.language.keyExists'));
      return;
    }
    setTranslations({
      ...translations,
      [newTranslationKey]: newTranslationValue,
    });
    setNewTranslationKey('');
    setNewTranslationValue('');
  };

  /**
   * 处理删除翻译
   */
  const handleDeleteTranslation = (key: string) => {
    const newTranslations = { ...translations };
    delete newTranslations[key];
    setTranslations(newTranslations);
  };

  /**
   * 从本地语言包同步翻译到当前语言
   * 将 src/locales 中的翻译内容同步到数据库
   */
  const handleSyncFromLocale = async () => {
    if (!currentLanguageForTranslation) return;
    const localeMap: Record<string, Record<string, string>> = {
      'zh-CN': zhCN as Record<string, string>,
      'en-US': enUS as Record<string, string>,
    };
    const localeContent = localeMap[currentLanguageForTranslation.code];
    if (!localeContent) {
      messageApi.warning(t('field.language.noLocaleForCode', { code: currentLanguageForTranslation.code }));
      return;
    }
    try {
      setTranslationSaving(true);
      await updateTranslations(currentLanguageForTranslation.uuid, {
        translations: localeContent,
      } as TranslationUpdateRequest);
      setTranslations(localeContent);
      messageApi.success(t('field.language.syncFromLocaleSuccess', { count: Object.keys(localeContent).length }));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('common.operationFailed'));
    } finally {
      setTranslationSaving(false);
    }
  };

  /**
   * 处理保存翻译
   */
  const handleSaveTranslations = async () => {
    if (!currentLanguageForTranslation) return;
    
    try {
      setTranslationSaving(true);
      await updateTranslations(currentLanguageForTranslation.uuid, {
        translations,
      } as TranslationUpdateRequest);
      messageApi.success(t('pages.system.updateSuccess'));
      setTranslationDrawerVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.saveFailed'));
    } finally {
      setTranslationSaving(false);
    }
  };

  /**
   * 处理删除语言
   */
  const handleDelete = async (record: Language) => {
    try {
      await deleteLanguage(record.uuid);
      messageApi.success(t('pages.system.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.deleteFailed'));
    }
  };

  /**
   * 处理批量删除语言
   */
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('pages.system.selectFirst'));
      return;
    }

    Modal.confirm({
      title: t('common.confirm'),
      content: t('field.language.batchDeleteConfirm', { count: selectedRowKeys.length }),
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
              await deleteLanguage(key.toString());
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
            messageApi.error(
              `${t('pages.system.deleteFailed')} ${failCount} ${errors.length > 0 ? '：' + errors.join('; ') : ''}`
            );
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
   * 处理提交表单（创建/更新语言）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentLanguageUuid) {
        await updateLanguage(currentLanguageUuid, values as UpdateLanguageData);
        messageApi.success(t('pages.system.updateSuccess'));
      } else {
        await createLanguage(values as CreateLanguageData);
        messageApi.success(t('pages.system.createSuccess'));
      }
      
      setModalVisible(false);
      setFormInitialValues(undefined);
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
  const columns: ProColumns<Language>[] = [
    {
      title: t('field.language.code'),
      dataIndex: 'code',
      width: 120,
      fixed: 'left',
      render: (_, record) => (
        <span style={{ fontFamily: CODE_FONT_FAMILY, fontWeight: 'bold' }}>{record.code}</span>
      ),
    },
    {
      title: t('field.language.name'),
      dataIndex: 'name',
      width: 150,
    },
    {
      title: t('field.language.nativeName'),
      dataIndex: 'native_name',
      width: 150,
      hideInSearch: true,
    },
    {
      title: t('field.language.translationCount'),
      dataIndex: 'translations',
      width: 120,
      hideInSearch: true,
      render: (_, record) => Object.keys(record.translations || {}).length,
    },
    {
      title: t('field.language.isDefault'),
      dataIndex: 'is_default',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('field.role.yes'), status: 'Success' },
        false: { text: t('field.role.no'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_default ? 'success' : 'default'}>
          {record.is_default ? t('field.role.yes') : t('field.role.no')}
        </Tag>
      ),
    },
    {
      title: t('field.department.sortOrder'),
      dataIndex: 'sort_order',
      width: 80,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('field.role.status'),
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('field.role.enabled'), status: 'Success' },
        false: { text: t('field.role.disabled'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? t('field.role.enabled') : t('field.role.disabled')}
        </Tag>
      ),
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 250,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            {t('field.language.view')}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<TranslationOutlined />}
            onClick={() => handleManageTranslations(record)}
          >
            {t('field.language.translations')}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('field.language.edit')}
          </Button>
          <Popconfirm
            title={t('field.language.deleteConfirm')}
            onConfirm={() => handleDelete(record)}
            disabled={record.is_default}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
              disabled={record.is_default}
            >
              {t('field.language.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  /**
   * 翻译表格列定义
   */
  const translationColumns = [
    {
      title: t('field.language.translationKey'),
      dataIndex: 'key',
      width: '40%',
      render: (text: string) => (
        <span style={{ fontFamily: CODE_FONT_FAMILY }}>{text}</span>
      ),
    },
    {
      title: t('field.language.translationValue'),
      dataIndex: 'value',
      width: '50%',
    },
    {
      title: t('common.actions'),
      width: '10%',
      render: (_: any, record: { key: string }) => (
        <Button
          type="link"
          danger
          size="small"
          onClick={() => handleDeleteTranslation(record.key)}
        >
          {t('field.language.delete')}
        </Button>
      ),
    },
  ];

  /**
   * 翻译表格数据
   */
  const translationTableData = Object.entries(translations).map(([key, value]) => ({
    key,
    value,
  }));

  return (
    <>
      <ListPageTemplate>
        <UniTable<Language>
          actionRef={actionRef}
          columns={columns}
          request={async (params, _sort, _filter, searchFormValues) => {
            // 处理搜索参数
            const apiParams: any = {
              page: params.current || 1,
              page_size: params.pageSize || 20,
            };
            
            // 状态筛选
            if (searchFormValues?.is_active !== undefined && searchFormValues.is_active !== '' && searchFormValues.is_active !== null) {
              apiParams.is_active = searchFormValues.is_active;
            }
            
            // 搜索条件处理：code 和 name 使用模糊搜索
            if (searchFormValues?.code) {
              apiParams.code = searchFormValues.code as string;
            }
            if (searchFormValues?.name) {
              apiParams.name = searchFormValues.name as string;
            }
            
            try {
              const response = await getLanguageList(apiParams);
              return {
                data: response.items,
                success: true,
                total: response.total,
              };
            } catch (error: any) {
              console.error('获取语言列表失败:', error);
              messageApi.error(error?.message || t('common.loadFailed'));
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
          createButtonText={t('field.language.createTitle')}
          onCreate={handleCreate}
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText={t('pages.system.batchDelete')}
          showImportButton={false}
          showExportButton={true}
          onExport={async (type, keys, pageData) => {
            try {
              const res = await getLanguageList({ page: 1, page_size: 10000 });
              let items = res.items || [];
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d) => keys.includes(d.uuid));
              }
              if (items.length === 0) {
                messageApi.warning(t('common.exportNoData'));
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `languages-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(t('common.exportSuccess', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('common.operationFailed'));
            }
          }}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
          }}
          toolBarRender={() => [
            <Button
              key="initialize"
              icon={<SettingOutlined />}
              onClick={handleInitializeSystemLanguages}
              loading={initializing}
            >
              {t('field.language.loadSystemLanguages')}
            </Button>,
          ]}
        />
      </ListPageTemplate>

      {/* 创建/编辑语言 Modal */}
      <FormModalTemplate
        title={isEdit ? t('field.language.editTitle') : t('field.language.createTitle')}
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
        <SafeProFormSelect
          name="code"
          label={t('field.language.code')}
          rules={[{ required: true, message: t('field.language.codeRequired') }]}
          disabled={isEdit}
          extra={t('field.language.codeExtra')}
          options={[
            { label: t('field.language.codeZhCN'), value: 'zh-CN' },
            { label: t('field.language.codeEnUS'), value: 'en-US' },
          ]}
        />
        <ProFormText
          name="name"
          label={t('field.language.name')}
          rules={[{ required: true, message: t('field.language.nameRequired') }]}
          placeholder={t('field.language.namePlaceholder')}
        />
        <ProFormText
          name="native_name"
          label={t('field.language.nativeName')}
          placeholder={t('field.language.namePlaceholder')}
        />
        <ProFormSwitch
          name="is_default"
          label={t('field.language.isDefault')}
        />
        <ProFormDigit
          name="sort_order"
          label={t('field.language.sortOrder')}
          fieldProps={{ min: 0 }}
        />
        <ProFormSwitch
          name="is_active"
          label={t('field.language.isActive')}
        />
      </FormModalTemplate>

      {/* 查看详情 Drawer */}
      <DetailDrawerTemplate
        title={t('field.language.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        dataSource={detailData || undefined}
        columns={[
          {
            title: t('field.language.code'),
            dataIndex: 'code',
            render: (_: any, entity: Language) => (
              <span style={{ fontFamily: CODE_FONT_FAMILY, fontWeight: 'bold' }}>{entity?.code}</span>
            ),
          },
          {
            title: t('field.language.name'),
            dataIndex: 'name',
          },
          {
            title: t('field.language.nativeName'),
            dataIndex: 'native_name',
            render: (_: any, entity: Language) => entity?.native_name || '-',
          },
          {
            title: t('field.language.translationCount'),
            dataIndex: 'translations',
            render: (_: any, entity: Language) => Object.keys(entity?.translations || {}).length,
          },
          {
            title: t('field.language.isDefault'),
            dataIndex: 'is_default',
            render: (_: any, entity: Language) => (entity?.is_default ? t('field.role.yes') : t('field.role.no')),
          },
          {
            title: t('field.language.sortOrder'),
            dataIndex: 'sort_order',
          },
          {
            title: t('field.role.status'),
            dataIndex: 'is_active',
            render: (_: any, entity: Language) => (entity?.is_active ? t('field.role.enabled') : t('field.role.disabled')),
          },
          {
            title: t('common.createdAt'),
            dataIndex: 'created_at',
            valueType: 'dateTime',
          },
          {
            title: t('common.updatedAt'),
            dataIndex: 'updated_at',
            valueType: 'dateTime',
          },
        ]}
      />

      {/* 翻译管理 Drawer */}
      <Drawer
        title={`${t('field.language.translations')} - ${currentLanguageForTranslation?.name || ''}`}
        open={translationDrawerVisible}
        onClose={() => {
          setTranslationDrawerVisible(false);
          setCurrentLanguageForTranslation(null);
          setTranslations({});
        }}
        size={800}
        loading={translationLoading}
        styles={{
          body: {
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 110px)',
            overflow: 'hidden',
            paddingBottom: 24,
          },
        }}
        extra={
          <Space size="middle">
            <Button
              icon={<TranslationOutlined />}
              onClick={handleSyncFromLocale}
              loading={translationSaving}
            >
              {t('field.language.syncFromLocale')}
            </Button>
            <Button
              type="primary"
              onClick={handleSaveTranslations}
              loading={translationSaving}
            >
              {t('common.save')}
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 16, flexShrink: 0 }}>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              placeholder={t('field.language.translationKeyPlaceholder')}
              value={newTranslationKey}
              onChange={(e) => setNewTranslationKey(e.target.value)}
              onPressEnter={handleAddTranslation}
            />
            <Input
              placeholder={t('field.language.translationValuePlaceholder')}
              value={newTranslationValue}
              onChange={(e) => setNewTranslationValue(e.target.value)}
              onPressEnter={handleAddTranslation}
            />
            <Button type="primary" onClick={handleAddTranslation}>
              {t('field.language.addTranslation')}
            </Button>
          </Space.Compact>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <Table
            columns={translationColumns}
            dataSource={translationTableData}
            rowKey="key"
            pagination={false}
            scroll={{ y: 'calc(100vh - 220px)' }}
          />
        </div>
      </Drawer>
    </>
  );
};

export default LanguageListPage;

