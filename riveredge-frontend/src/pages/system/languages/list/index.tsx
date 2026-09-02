/**
 * 语言管理列表页面
 *
 * 用于系统管理员查看和管理组织内的语言。
 * 支持语言的 CRUD 操作和翻译管理。
 * 国际化
 */

import React, { useMemo, useRef, useState } from 'react';
import { rowActionKind, rowActionLabelKeep } from '../../../../components/uni-action';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormText, ProFormSwitch, ProFormDigit, ProDescriptionsItemProps } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Space, Drawer, Modal, Table, Input, theme } from 'antd';
import { alignProColumns, GLOBAL_DOC_LIST_FIELD_RANK } from '../../../../apps/kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { renderSystemActiveTag, renderSystemYesNoTag } from '../../utils/systemListPresentation';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../utils/uniTableLayoutColumns';
import { PlusOutlined, SettingOutlined, TranslationOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import {
  ListPageTemplate,
  FormModalTemplate,
  MODAL_CONFIG,
  DRAWER_CONFIG,
  SYSTEM_VIEWPORT_OFFSETS,
  getViewportHeightExpr,
  getDrawerFloatingWrapperStyle,
} from '../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../utils/errorHandler';
import { buildDetailDrawerEditExtra } from '../../../../apps/kuaizhizao/pages/equipment-management/shared/equipmentMasterDataDetail';
import { SystemMasterDetailDrawer } from '../../shared/systemMasterDetailDrawer';
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
import { cacheTenantDefaultLanguage } from '../../../../utils/localeBootstrap';
import { pickListSearchKeyword } from '../../../../utils/tableQueryKey';
import zhCN from '../../../../locales/zh-CN';
import enUS from '../../../../locales/en-US';
import zhHant from '../../../../locales/zh-Hant';
import jaJP from '../../../../locales/ja-JP';
import viVN from '../../../../locales/vi-VN';
import loLA from '../../../../locales/lo-LA';
import { CODE_FONT_FAMILY } from '../../../../constants/fonts';
import { downloadRecordsAsXlsx } from '../../../../utils/exportRecordsXlsx';
import { getAntdModal } from '../../../../utils/antdAppApis';
import { todaySiteDateString } from '../../../../utils/format';
import { buildListPageHelpViewConfig } from '../../../../components/page-help-wiki';
/**
 * 语言管理列表页面组件
 */
const LanguageListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const actionRef = useRef<ActionType>(null);
  const detailRetryUuidRef = useRef<string | null>(null);

  const languageDetailDescColumns = useMemo<ProDescriptionsItemProps<Language>[]>(
    () => [
      {
        title: t('field.language.code'),
        dataIndex: 'code',
        render: (_: unknown, entity: Language) => (
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
        render: (_: unknown, entity: Language) => entity?.native_name || '-',
      },
      {
        title: t('field.language.translationCount'),
        dataIndex: 'translations',
        render: (_: unknown, entity: Language) => Object.keys(entity?.translations || {}).length,
      },
      {
        title: t('field.language.isDefault'),
        dataIndex: 'is_default',
        render: (_: unknown, entity: Language) => renderSystemYesNoTag(t, entity?.is_default),
      },
      {
        title: t('field.language.sortOrder'),
        dataIndex: 'sort_order',
      },
      {
        title: t('common.status'),
        dataIndex: 'is_active',
        render: (_: unknown, entity: Language) =>
          renderSystemActiveTag(t, entity?.is_active, 'common.enabled', 'common.disabled'),
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
    ],
    [t]
  );

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
  const [detailError, setDetailError] = useState<string | null>(null);
  
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
  const loadDetail = async (uuid: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await getLanguageByUuid(uuid);
      setDetailData(detail);
    } catch (error) {
      setDetailData(null);
      setDetailError(getApiErrorMessage(error, t('common.loadFailed')));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleView = (record: Language) => {
    detailRetryUuidRef.current = record.uuid;
    setDrawerVisible(true);
    setDetailData(null);
    setDetailError(null);
    void loadDetail(record.uuid);
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
      'zh-Hant': zhHant as Record<string, string>,
      'ja-JP': jaJP as Record<string, string>,
      'vi-VN': viVN as Record<string, string>,
      'lo-LA': loLA as Record<string, string>,
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
      messageApi.success(t('common.updateSuccess'));
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
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
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

    getAntdModal().confirm({
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
              errors.push(error.message || t('common.deleteFailed'));
            }
          }

          if (successCount > 0) {
            messageApi.success(t('common.deleteSuccess'));
          }
          if (failCount > 0) {
            messageApi.error(
              `${t('common.deleteFailed')} ${failCount} ${errors.length > 0 ? '：' + errors.join('; ') : ''}`
            );
          }

          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('common.deleteFailed'));
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
        messageApi.success(t('common.updateSuccess'));
      } else {
        await createLanguage(values as CreateLanguageData);
        messageApi.success(t('common.createSuccess'));
      }

      if (values.is_default) {
        const code = values.code ?? formInitialValues?.code;
        if (code) cacheTenantDefaultLanguage(code);
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
  const columns = useMemo<ProColumns<Language>[]>(() => alignProColumns([
    {
      title: t('field.language.code'),
      dataIndex: 'code',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      render: (_, record) => (
        <span style={{ fontFamily: CODE_FONT_FAMILY, fontWeight: 'bold' }}>{record.code}</span>
      ),
    },
    {
      title: t('field.language.name'),
      dataIndex: 'name',
      width: 140,
      minWidth: 140,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
    },
    {
      // 本地名称长短不一：唯一 RemainderFlex
      title: t('field.language.nativeName'),
      dataIndex: 'native_name',
      minWidth: 140,
      uniTableRemainderFlex: true,
      uniTablePrimaryFlex: true,
      resizable: false,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('field.language.translationCount'),
      dataIndex: 'translations',
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      render: (_, record) => Object.keys(record.translations || {}).length,
    },
    {
      title: t('field.language.isDefault'),
      dataIndex: 'is_default',
      width: 128,
      minWidth: 128,
      uniTableKeepWidth: true,
      resizable: false,
      align: 'center',
      valueType: 'select',
      valueEnum: {
        true: { text: t('common.yes'), status: 'Success' },
        false: { text: t('common.no'), status: 'Default' },
      },
      render: (_, record) => renderSystemYesNoTag(t, record.is_default),
    },
    {
      title: t('field.department.sortOrder'),
      dataIndex: 'sort_order',
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('common.status'),
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
            <Button {...rowActionKind('read')} key="view" type="link" size="small" onClick={() => handleView(record)} />,
            <Button
              {...rowActionKind('skip')}
              {...rowActionLabelKeep()}
              key="translations"
              type="link"
              size="small"
              onClick={() => handleManageTranslations(record)}
            >
              {t('field.language.translations')}
            </Button>,
            <Button {...rowActionKind('update')} key="edit" type="link" size="small" onClick={() => handleEdit(record)} />,
            <Popconfirm
              key="delete"
              title={t('field.language.deleteConfirm')}
              onConfirm={() => handleDelete(record)}
              disabled={record.is_default}
            >
              <Button {...rowActionKind('delete')} disabled={record.is_default} />
            </Popconfirm>,
          ],
    },
  ], GLOBAL_DOC_LIST_FIELD_RANK), [t, handleView, handleManageTranslations, handleEdit, handleDelete]);

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
      render: (_: string, record: { key: string; value: string }) => (
        <Input.TextArea
          value={record.value}
          onChange={(e) => {
            const v = e.target.value;
            setTranslations((prev) => ({ ...prev, [record.key]: v }));
          }}
          autoSize={{ minRows: 1, maxRows: 8 }}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: t('common.actions'),
      width: 100,
      render: (_: any, record: { key: string }) => (
        <Button
          type="default"
          danger
          size="small"
          onClick={() => handleDeleteTranslation(record.key)}
        >
          {t('common.delete')}
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

  const floatPad = DRAWER_CONFIG.FLOAT_MARGIN * 2;
  const translationDrawerStyles = useMemo(() => {
    const floating = getDrawerFloatingWrapperStyle('right', token);
    return {
      wrapper: {
        ...floating,
        width: '70%',
      },
      body: {
        display: 'flex',
        flexDirection: 'column' as const,
        height: getViewportHeightExpr(
          SYSTEM_VIEWPORT_OFFSETS.LANG_TRANSLATION_DRAWER_BODY_BASE_PX + floatPad,
        ),
        overflow: 'hidden',
        paddingBottom: 24,
      },
    };
  }, [token.borderRadiusLG, token.boxShadowSecondary, floatPad]);

  return (
    <>
      <ListPageTemplate>
        <UniTable<Language>
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('system.languages')}
          columnPersistenceId="pages.system.languages.list-v3"
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
            const keyword = pickListSearchKeyword(searchFormValues);
            if (keyword) {
              apiParams.keyword = keyword;
            }
            
            try {
              const response = await getLanguageList(apiParams);
              return {
                data: response.items,
                success: true,
                total: response.total,
              };
            } catch (error: any) {
              console.error('Failed to fetch languages:', error);
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
          deleteButtonText={t('common.batchDelete')}
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
              await downloadRecordsAsXlsx(
                items as Array<Record<string, unknown>>,
                `languages-${todaySiteDateString()}.xlsx`,
              );
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
            <Button {...rowActionKind('update')}
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
            { label: t('field.language.codeZhTW'), value: 'zh-Hant' },
            { label: t('field.language.codeEnUS'), value: 'en-US' },
            { label: t('field.language.codeJaJP'), value: 'ja-JP' },
            { label: t('field.language.codeViVN'), value: 'vi-VN' },
            { label: t('field.language.codeLoLA'), value: 'lo-LA' },
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
        <ProFormDigit
          name="sort_order"
          label={t('field.language.sortOrder')}
          fieldProps={{ min: 0 }}
        />
        <ProFormSwitch
          name="is_default"
          label={t('field.language.isDefault')}
          colProps={{ span: 12 }}
        />
        <ProFormSwitch
          name="is_active"
          label={t('common.enabled')}
          colProps={{ span: 12 }}
        />
      </FormModalTemplate>

      {/* 查看详情 Drawer */}
      <SystemMasterDetailDrawer
        title={t('field.language.detailTitle')}
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
        detailColumns={languageDetailDescColumns}
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
        loading={translationLoading}
        rootClassName="drawer-slide-motion"
        styles={translationDrawerStyles}
        extra={
          <Space size="medium">
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
            size="small"
            columns={translationColumns}
            dataSource={translationTableData}
            rowKey="key"
            pagination={false}
            tableLayout="fixed"
            style={{ width: '100%' }}
            scroll={{
              y: getViewportHeightExpr(
                SYSTEM_VIEWPORT_OFFSETS.LANG_TRANSLATION_TABLE_BASE_PX + floatPad,
              ),
            }}
          />
        </div>
      </Drawer>
    </>
  );
};

export default LanguageListPage;
