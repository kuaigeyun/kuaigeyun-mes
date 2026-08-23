/**
 * 数据字典管理列表页面
 *
 * 用于系统管理员查看和管理组织内的数据字典。
 * 支持数据字典的 CRUD 操作和字典项管理。
 * Schema 驱动 + 国际化
 */

import React, { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { rowActionKind } from '../../../../components/uni-action';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProForm,
  ProFormText,
  ProFormTextArea,
  ProFormSwitch,
  ProFormDigit,
  ProFormInstance,
  ProDescriptionsItemProps,
} from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Drawer, Modal, Table, Tooltip, theme, Space } from 'antd';
import { alignProColumns, GLOBAL_DOC_LIST_FIELD_RANK } from '../../../../apps/kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { renderSystemActiveTag, renderSystemTypeMarker, renderSystemYesNoTag } from '../../utils/systemListPresentation';
import { SettingOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import {
  ListPageTemplate,
  getDrawerFloatingWrapperStyle,
} from '../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../utils/errorHandler';
import { buildDetailDrawerEditExtra } from '../../../../apps/kuaizhizao/pages/equipment-management/shared/equipmentMasterDataDetail';
import { SystemMasterDetailDrawer } from '../../shared/systemMasterDetailDrawer';
import { DataDictionaryFormModal } from '../components/DataDictionaryFormModal';
import {
  getDataDictionaryList,
  getDataDictionaryByUuid,
  deleteDataDictionary,
  getDictionaryItemList,
  createDictionaryItem,
  updateDictionaryItem,
  deleteDictionaryItem,
  initializeSystemDictionaries,
  DataDictionary,
  DictionaryItem,
  DataDictionaryListParams,
  CreateDictionaryItemData,
  UpdateDictionaryItemData,
} from '../../../../services/dataDictionary';
import {
  resolveSystemDictionaryDescription,
  resolveSystemDictionaryItemDescription,
  resolveSystemDictionaryItemLabel,
  resolveSystemDictionaryName,
} from '../../../../utils/systemDictionaryI18n';
import { downloadRecordsAsXlsx } from '../../../../utils/exportRecordsXlsx';
import { getAntdModal } from '../../../../utils/antdAppApis';
import { todaySiteDateString } from '../../../../utils/format';
import { buildListPageHelpViewConfig } from '../../../../components/page-help-wiki';
const DataDictionaryListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const [searchParams] = useSearchParams();
  const actionRef = useRef<ActionType>(null);
  const itemFormRef = useRef<ProFormInstance>();
  const detailRetryUuidRef = useRef<string | null>(null);
  const searchParamsRef = useRef<Record<string, unknown> | undefined>(undefined);
  const urlKeyword = String(searchParams.get('keyword') || searchParams.get('code') || '').trim();
  if (urlKeyword && searchParamsRef.current === undefined) {
    searchParamsRef.current = { keyword: urlKeyword };
  }

  const dataDictionaryDetailDescColumns = useMemo<ProDescriptionsItemProps<DataDictionary>[]>(
    () => [
      {
        title: t('field.dataDictionary.name'),
        dataIndex: 'name',
        render: (_: unknown, entity: DataDictionary) => resolveSystemDictionaryName(entity, t),
      },
      { title: t('field.dataDictionary.code'), dataIndex: 'code' },
      {
        title: t('common.remark'),
        dataIndex: 'description',
        render: (_: unknown, entity: DataDictionary) => resolveSystemDictionaryDescription(entity, t),
      },
      {
        title: t('field.dataDictionary.systemDictionary'),
        dataIndex: 'is_system',
        render: (_: unknown, entity: DataDictionary) =>
          entity?.is_system ? (
            <Tag color="purple">{t('common.yes')}</Tag>
          ) : (
            <Tag>{t('common.no')}</Tag>
          ),
      },
      {
        title: t('common.status'),
        dataIndex: 'is_active',
        render: (_: unknown, entity: DataDictionary) =>
          renderSystemActiveTag(t, entity?.is_active, 'common.enabled', 'common.disabled'),
      },
      { title: t('common.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
      { title: t('common.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
    ],
    [t]
  );

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [initializing, setInitializing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [currentDictionaryUuid, setCurrentDictionaryUuid] = useState<string | null>(null);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<DataDictionary | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [itemDrawerVisible, setItemDrawerVisible] = useState(false);
  const [currentDictionaryForItems, setCurrentDictionaryForItems] = useState<DataDictionary | null>(null);
  const [items, setItems] = useState<DictionaryItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [isEditItem, setIsEditItem] = useState(false);
  const [currentItemUuid, setCurrentItemUuid] = useState<string | null>(null);
  const [itemFormLoading, setItemFormLoading] = useState(false);

  const handleCreate = () => {
    setCurrentDictionaryUuid(null);
    setModalVisible(true);
  };

  const handleEdit = (record: DataDictionary) => {
    setCurrentDictionaryUuid(record.uuid);
    setModalVisible(true);
  };

  /**
   * 处理查看详情
   */
  const loadDetail = async (uuid: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await getDataDictionaryByUuid(uuid);
      setDetailData(detail);
    } catch (error) {
      setDetailData(null);
      setDetailError(getApiErrorMessage(error, t('common.loadFailed')));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleView = (record: DataDictionary) => {
    detailRetryUuidRef.current = record.uuid;
    setDrawerVisible(true);
    setDetailData(null);
    setDetailError(null);
    void loadDetail(record.uuid);
  };

  const handleDelete = async (record: DataDictionary) => {
    try {
      await deleteDataDictionary(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  const handleBatchDelete = (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning(t('pages.system.selectFirst'));
      return;
    }
    getAntdModal().confirm({
      title: t('common.confirm'),
      content: t('field.dataDictionary.batchDeleteConfirm', { count: keys.length }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: async () => {
        try {
          let successCount = 0;
          let failCount = 0;
          const errors: string[] = [];
          for (const key of keys) {
            try {
              await deleteDataDictionary(key.toString());
              successCount++;
            } catch (error: any) {
              failCount++;
              errors.push(error.message || t('common.deleteFailed'));
            }
          }
          if (successCount > 0) messageApi.success(t('common.deleteSuccess'));
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

  const handleManageItems = async (record: DataDictionary) => {
    try {
      setCurrentDictionaryForItems(record);
      setItemDrawerVisible(true);
      await loadItems(record.uuid);
    } catch (error: any) {
      messageApi.error(error.message || t('common.loadFailed'));
    }
  };

  const loadItems = async (dictionaryUuid: string) => {
    try {
      setItemsLoading(true);
      const itemList = await getDictionaryItemList(dictionaryUuid);
      setItems(itemList);
    } catch (error: any) {
      messageApi.error(error.message || t('common.loadFailed'));
    } finally {
      setItemsLoading(false);
    }
  };

  /**
   * 处理新建字典项
   */
  const handleCreateItem = () => {
    if (!currentDictionaryForItems) return;
    
    setIsEditItem(false);
    setCurrentItemUuid(null);
    setItemModalVisible(true);
    itemFormRef.current?.resetFields();
    itemFormRef.current?.setFieldsValue({
      sort_order: 0,
      is_active: true,
    });
  };

  /**
   * 处理编辑字典项
   */
  const handleEditItem = async (record: DictionaryItem) => {
    try {
      setIsEditItem(true);
      setCurrentItemUuid(record.uuid);
      setItemModalVisible(true);
      
      itemFormRef.current?.setFieldsValue({
        label: record.label,
        value: record.value,
        description: record.description,
        color: record.color,
        icon: record.icon,
        sort_order: record.sort_order,
        is_active: record.is_active,
      });
    } catch (error: any) {
      messageApi.error(error.message || t('common.loadFailed'));
    }
  };

  /**
   * 处理删除字典项
   */
  const handleDeleteItem = async (record: DictionaryItem) => {
    try {
      await deleteDictionaryItem(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      if (currentDictionaryForItems) {
        await loadItems(currentDictionaryForItems.uuid);
      }
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  const handleInitializeSystemDictionaries = async () => {
    try {
      setInitializing(true);
      const result = await initializeSystemDictionaries();
      messageApi.success(
        t('field.dataDictionary.loadSystemDictionariesSuccess', {
          dictCount: result.dictionaries_count,
          itemsCreated: result.items_created_count,
          itemsUpdated: result.items_updated_count,
        })
      );
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('common.loadFailed'));
    } finally {
      setInitializing(false);
    }
  };

  const normalizeDictionaryItemFormValues = (values: Record<string, unknown>): UpdateDictionaryItemData => {
    const payload: UpdateDictionaryItemData = {
      label: values.label as string,
      value: values.value as string,
      is_active: Boolean(values.is_active),
    };
    if (values.description !== undefined && values.description !== '') {
      payload.description = String(values.description);
    }
    if (values.color !== undefined && values.color !== '') {
      payload.color = String(values.color);
    }
    if (values.icon !== undefined && values.icon !== '') {
      payload.icon = String(values.icon);
    }
    if (values.sort_order !== undefined && values.sort_order !== null && values.sort_order !== '') {
      payload.sort_order = Number(values.sort_order);
    }
    return payload;
  };

  const handleSubmitItem = async () => {
    try {
      if (!currentDictionaryForItems) return;
      setItemFormLoading(true);
      const values = await itemFormRef.current?.validateFields();
      const payload = normalizeDictionaryItemFormValues(values);
      if (isEditItem && currentItemUuid) {
        await updateDictionaryItem(currentItemUuid, payload);
        messageApi.success(t('common.updateSuccess'));
      } else {
        await createDictionaryItem(currentDictionaryForItems.uuid, payload);
        messageApi.success(t('common.createSuccess'));
      }
      setItemModalVisible(false);
      await loadItems(currentDictionaryForItems.uuid);
    } catch (error: any) {
      messageApi.error(error.message || t('common.operationFailed'));
    } finally {
      setItemFormLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const columns = useMemo<ProColumns<DataDictionary>[]>(() => alignProColumns([
    {
      title: t('field.dataDictionary.name'),
      dataIndex: 'name',
      width: 150,
      fixed: 'left',
      render: (_, record) => resolveSystemDictionaryName(record, t),
    },
    {
      title: t('field.dataDictionary.code'),
      dataIndex: 'code',
      width: 150,
      minWidth: 150,
      uniTableKeepWidth: true,
      resizable: false,
    },
    {
      title: t('common.remark'),
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
      render: (_, record) => resolveSystemDictionaryDescription(record, t),
    },
    {
      title: t('field.dataDictionary.systemDictionary'),
      dataIndex: 'is_system',
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
      valueType: 'select',
      valueEnum: {
        true: { text: t('common.yes'), status: 'Default' },
        false: { text: t('common.no'), status: 'Processing' },
      },
      render: (_, record) => renderSystemYesNoTag(t, record.is_system),
    },
    {
      title: t('common.status'),
      dataIndex: 'is_active',
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
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
      valueType: 'option',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => [
            <Button {...rowActionKind('read')} key="view" onClick={() => handleView(record)}>
              {t('common.detail')}
            </Button>,
            <Button {...rowActionKind('update')}
              key="edit"
              type="link"
              size="small"
              onClick={() => handleEdit(record)}
              disabled={record.is_system}
            >
              {t('common.edit')}
            </Button>,
            <Button {...rowActionKind('read')} key="items" onClick={() => handleManageItems(record)}>
              {t('field.dataDictionary.items')}
            </Button>,
            <Popconfirm {...rowActionKind('delete')}
              key="delete"
              title={t('field.dataDictionary.deleteConfirm')}
              onConfirm={() => handleDelete(record)}
              disabled={record.is_system}
            >
              <Tooltip
                title={record.is_system ? t('field.dataDictionary.systemDictionaryNoDelete') : undefined}
              >
                <span>
                  <Button type="link" danger size="small" disabled={record.is_system}>
                    {t('common.delete')}
                  </Button>
                </span>
              </Tooltip>
            </Popconfirm>,
          ],
    },
  ], GLOBAL_DOC_LIST_FIELD_RANK), [t, handleView, handleEdit, handleManageItems, handleDelete]);

  /**
   * 字典项表格列定义
   */
  const itemColumns = useMemo(
    () => [
    {
      title: t('field.dataDictionary.itemLabel'),
      dataIndex: 'label',
      key: 'label',
      width: 120,
      ellipsis: true,
      render: (_: unknown, record: DictionaryItem) =>
        currentDictionaryForItems?.code
          ? resolveSystemDictionaryItemLabel(currentDictionaryForItems.code, record, t)
          : record.label,
    },
    {
      title: t('field.dataDictionary.itemValue'),
      dataIndex: 'value',
      key: 'value',
      width: 140,
      ellipsis: { showTitle: true },
    },
    {
      title: t('common.remark'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      width: 200,
      render: (_: unknown, record: DictionaryItem) =>
        currentDictionaryForItems?.code
          ? resolveSystemDictionaryItemDescription(currentDictionaryForItems.code, record, t)
          : record.description,
    },
    {
      title: t('field.dataDictionary.itemColor'),
      dataIndex: 'color',
      key: 'color',
      width: 80,
      render: (color: string) => (color ? <Tag color={color}>{color}</Tag> : '-'),
    },
    { title: t('field.dataDictionary.itemIcon'), dataIndex: 'icon', key: 'icon', width: 72, ellipsis: true },
    {
      title: t('field.department.sortOrder'),
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 72,
      sorter: (a: DictionaryItem, b: DictionaryItem) => a.sort_order - b.sort_order,
    },
    {
      title: t('common.status'),
      dataIndex: 'is_active',
      key: 'is_active',
      width: 88,
      render: (isActive: boolean) =>
        renderSystemActiveTag(t, isActive, 'common.enabled', 'common.disabled'),
    },
    {
      title: t('common.actions'),
      key: 'action',
      fixed: 'right' as const,
      hideInSearch: true,
      render: (_: any, record: DictionaryItem) => {
        const isPresetItem = Boolean(record.is_system_managed);
        return (
          <Space size={4}>
            <Button key="edit" {...rowActionKind('update')} onClick={() => handleEditItem(record)}>
              {t('common.edit')}
            </Button>
            <Popconfirm key="delete" {...rowActionKind('delete')} title={t('field.dataDictionary.itemDeleteConfirm')}
              onConfirm={() => handleDeleteItem(record)}
              disabled={isPresetItem}
            >
              <Tooltip title={isPresetItem ? t('field.dataDictionary.systemPresetItemNoDelete') : undefined}>
                <Button type="link" danger size="small" disabled={isPresetItem}>
                  {t('common.delete')}
                </Button>
              </Tooltip>
            </Popconfirm>
          </Space>
        );
      },
    },
  ],
    [t, currentDictionaryForItems?.code],
  );

  const dictionaryItemDrawerStyles = useMemo(() => {
    const floating = getDrawerFloatingWrapperStyle('right', token);
    return {
      wrapper: {
        ...floating,
        width: '70%',
      },
      body: { paddingBottom: 24 },
    };
  }, [token.borderRadiusLG, token.boxShadowSecondary]);

  return (
    <>
      <ListPageTemplate>
        <UniTable<DataDictionary>
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('system.dataDictionaries')}
        columnPersistenceId="pages.system.data-dictionaries.list-v1"
        actionRef={actionRef}
        searchParamsRef={searchParamsRef}
        columns={columns}
        request={async (params, sort, _filter, searchFormValues) => {
          // 处理搜索参数
          const apiParams: DataDictionaryListParams = {
            page: params.current || 1,
            page_size: params.pageSize || 20,
          };
          
          // 状态筛选
          if (searchFormValues?.is_active !== undefined && searchFormValues.is_active !== '' && searchFormValues.is_active !== null) {
            apiParams.is_active = searchFormValues.is_active === true || searchFormValues.is_active === 'true';
          }

          const keyword = String(searchFormValues?.keyword ?? '').trim();
          if (keyword) {
            // UniTable 顶栏模糊搜索走 keyword（名称/代码/备注 OR）
            apiParams.keyword = keyword;
          } else {
            // 高级搜索：名称、代码独立模糊
            if (searchFormValues?.name) {
              apiParams.name = searchFormValues.name as string;
            }
            if (searchFormValues?.code) {
              apiParams.code = searchFormValues.code as string;
            }
          }
          
          try {
            const response = await getDataDictionaryList(apiParams);
            return {
              data: response.items,
              success: true,
              total: response.total,
            };
          } catch (error: any) {
            console.error('Failed to fetch data dictionaries:', error);
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
        skipFuzzyPinyinClientFilter
        showCreateButton
        createButtonText={t('field.dataDictionary.createTitle')}
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
            const res = await getDataDictionaryList({ page: 1, page_size: 10000 });
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
              `data-dictionaries-${todaySiteDateString()}.xlsx`,
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
            onClick={handleInitializeSystemDictionaries}
            loading={initializing}
          >
            {t('field.dataDictionary.loadSystemDictionaries')}
          </Button>,
        ]}
      />
      </ListPageTemplate>

      <DataDictionaryFormModal
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentDictionaryUuid(null);
        }}
        editUuid={currentDictionaryUuid}
        onSuccess={() => actionRef.current?.reload()}
      />

      <SystemMasterDetailDrawer
        title={t('field.dataDictionary.detailTitle')}
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
          handleEdit(detailData);
        })}
        detail={detailData}
        detailColumns={dataDictionaryDetailDescColumns}
      />

      {/* 字典项管理 Drawer */}
      <Drawer
        title={`${t('field.dataDictionary.manageItems')} - ${
          currentDictionaryForItems
            ? resolveSystemDictionaryName(currentDictionaryForItems, t)
            : ''
        }`}
        open={itemDrawerVisible}
        onClose={() => {
          setItemDrawerVisible(false);
          setCurrentDictionaryForItems(null);
          setItems([]);
        }}
        rootClassName="drawer-slide-motion"
        styles={dictionaryItemDrawerStyles}
      >
        <div style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateItem}>
            {t('field.dataDictionary.createItem')}
          </Button>
        </div>
        <Table<DictionaryItem>
          size="small"
          columns={itemColumns}
          dataSource={items}
          rowKey="uuid"
          loading={itemsLoading}
          pagination={false}
          tableLayout="fixed"
          style={{ width: '100%' }}
        />
      </Drawer>

      {/* 创建/编辑字典项 Modal */}
      <Modal
        title={isEditItem ? t('field.dataDictionary.editItem') : t('field.dataDictionary.createItem')}
        open={itemModalVisible}
        onOk={handleSubmitItem}
        onCancel={() => setItemModalVisible(false)}
        confirmLoading={itemFormLoading}
        width={600}
      >
        <ProForm formRef={itemFormRef} submitter={false} layout="vertical">
          <ProFormText
            name="label"
            label={t('field.dataDictionary.itemLabel')}
            rules={[{ required: true, message: t('field.dataDictionary.itemLabelRequired') }]}
            placeholder={t('field.dataDictionary.itemLabelPlaceholder')}
          />
          <ProFormText
            name="value"
            label={t('field.dataDictionary.itemValue')}
            rules={[{ required: true, message: t('field.dataDictionary.itemValueRequired') }]}
            placeholder={t('field.dataDictionary.itemValuePlaceholder')}
          />
          <ProFormText
            name="color"
            label={t('field.dataDictionary.itemColor')}
            placeholder={t('field.dataDictionary.itemColorPlaceholder')}
          />
          <ProFormText
            name="icon"
            label={t('field.dataDictionary.itemIcon')}
            placeholder={t('field.dataDictionary.itemIconPlaceholder')}
          />
          <ProFormDigit
            name="sort_order"
            label={t('field.department.sortOrder')}
            min={0}
            fieldProps={{ precision: 0 }}
            initialValue={0}
          />
          <ProFormTextArea
            name="description"
            label={t('common.remark')}
            placeholder={t('field.dataDictionary.descriptionPlaceholder')}
          />
          <ProFormSwitch name="is_active" label={t('common.enabled')} />
        </ProForm>
      </Modal>
    </>
  );
};

export default DataDictionaryListPage;
