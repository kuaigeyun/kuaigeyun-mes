/**
 * 数据字典管理列表页面
 *
 * 用于系统管理员查看和管理组织内的数据字典。
 * 支持数据字典的 CRUD 操作和字典项管理。
 * Schema 驱动 + 国际化
 */

import React, { useMemo, useRef, useState } from 'react';
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
import { App, Popconfirm, Button, Tag, Drawer, Modal, Table, Tooltip, Descriptions, theme, Space } from 'antd';
import { SettingOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import {
  flushDrawerOpen,
  ListPageTemplate,
  DRAWER_CONFIG,
  getDrawerFloatingWrapperStyle,
} from '../../../../components/layout-templates';
import { UniDetail, detailDrawerDescriptionItems } from '../../../../components/uni-detail';
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
  CreateDictionaryItemData,
  UpdateDictionaryItemData,
} from '../../../../services/dataDictionary';
import {
  resolveSystemDictionaryDescription,
  resolveSystemDictionaryItemDescription,
  resolveSystemDictionaryItemLabel,
  resolveSystemDictionaryName,
} from '../../../../utils/systemDictionaryI18n';

const DataDictionaryListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const actionRef = useRef<ActionType>(null);
  const itemFormRef = useRef<ProFormInstance>();
  const dataDictionaryDetailReqRef = useRef(0);

  const dataDictionaryDetailDescColumns = useMemo<ProDescriptionsItemProps<DataDictionary>[]>(
    () => [
      {
        title: t('field.dataDictionary.name'),
        dataIndex: 'name',
        render: (_: unknown, entity: DataDictionary) => resolveSystemDictionaryName(entity, t),
      },
      { title: t('field.dataDictionary.code'), dataIndex: 'code' },
      {
        title: t('field.dataDictionary.description'),
        dataIndex: 'description',
        render: (_: unknown, entity: DataDictionary) => resolveSystemDictionaryDescription(entity, t),
      },
      {
        title: t('field.dataDictionary.systemDictionary'),
        dataIndex: 'is_system',
        render: (_: unknown, entity: DataDictionary) =>
          entity?.is_system ? (
            <Tag color="purple">{t('field.role.yes')}</Tag>
          ) : (
            <Tag>{t('field.role.no')}</Tag>
          ),
      },
      {
        title: t('field.role.status'),
        dataIndex: 'is_active',
        render: (_: unknown, entity: DataDictionary) => (
          <Tag color={entity?.is_active ? 'success' : 'default'}>
            {entity?.is_active ? t('field.role.enabled') : t('field.role.disabled')}
          </Tag>
        ),
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
  const handleView = async (record: DataDictionary) => {
    const req = ++dataDictionaryDetailReqRef.current;
    flushDrawerOpen(() => {
      setDrawerVisible(true);
      setDetailData(null);
      setDetailLoading(true);
    });
    try {
      const detail = await getDataDictionaryByUuid(record.uuid);
      if (dataDictionaryDetailReqRef.current !== req) return;
      setDetailData(detail);
    } catch (error: any) {
      if (dataDictionaryDetailReqRef.current === req) {
        messageApi.error(error.message || t('common.loadFailed'));
      }
    } finally {
      if (dataDictionaryDetailReqRef.current === req) {
        setDetailLoading(false);
      }
    }
  };

  const handleDelete = async (record: DataDictionary) => {
    try {
      await deleteDataDictionary(record.uuid);
      messageApi.success(t('pages.system.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.deleteFailed'));
    }
  };

  const handleBatchDelete = (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning(t('pages.system.selectFirst'));
      return;
    }
    Modal.confirm({
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
              errors.push(error.message || t('pages.system.deleteFailed'));
            }
          }
          if (successCount > 0) messageApi.success(t('pages.system.deleteSuccess'));
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
      messageApi.success(t('pages.system.deleteSuccess'));
      if (currentDictionaryForItems) {
        await loadItems(currentDictionaryForItems.uuid);
      }
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.deleteFailed'));
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
        messageApi.success(t('pages.system.updateSuccess'));
      } else {
        await createDictionaryItem(currentDictionaryForItems.uuid, payload);
        messageApi.success(t('pages.system.createSuccess'));
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
  const columns: ProColumns<DataDictionary>[] = [
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
    },
    {
      title: t('field.dataDictionary.description'),
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
      render: (_, record) => resolveSystemDictionaryDescription(record, t),
    },
    {
      title: t('field.dataDictionary.systemDictionary'),
      dataIndex: 'is_system',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('field.role.yes'), status: 'Default' },
        false: { text: t('field.role.no'), status: 'Processing' },
      },
      render: (_, record) => (
        <Tag color={record.is_system ? 'default' : 'blue'}>
          {record.is_system ? t('field.role.yes') : t('field.role.no')}
        </Tag>
      ),
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
      fixed: 'right',
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
              {t('field.dataDictionary.edit')}
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
                    {t('field.dataDictionary.delete')}
                  </Button>
                </span>
              </Tooltip>
            </Popconfirm>,
          ],
    },
  ];

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
      title: t('field.dataDictionary.description'),
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
      title: t('field.role.status'),
      dataIndex: 'is_active',
      key: 'is_active',
      width: 88,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? t('field.role.enabled') : t('field.role.disabled')}
        </Tag>
      ),
    },
    {
      title: t('common.actions'),
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: DictionaryItem) => {
        const isPresetItem = Boolean(record.is_system_managed);
        return (
          <Space size={4}>
            <Button key="edit" {...rowActionKind('update')} onClick={() => handleEditItem(record)}>
              {t('field.dataDictionary.edit')}
            </Button>
            <Popconfirm key="delete" {...rowActionKind('delete')} title={t('field.dataDictionary.itemDeleteConfirm')}
              onConfirm={() => handleDeleteItem(record)}
              disabled={isPresetItem}
            >
              <Tooltip title={isPresetItem ? t('field.dataDictionary.systemPresetItemNoDelete') : undefined}>
                <Button type="link" danger size="small" disabled={isPresetItem}>
                  {t('field.dataDictionary.delete')}
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
        columnPersistenceId="pages.system.data-dictionaries.list"
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
          
          // 搜索条件处理：name 和 code 使用模糊搜索
          if (searchFormValues?.name) {
            apiParams.name = searchFormValues.name as string;
          }
          if (searchFormValues?.code) {
            apiParams.code = searchFormValues.code as string;
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
        showCreateButton
        createButtonText={t('field.dataDictionary.createTitle')}
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
            const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `data-dictionaries-${new Date().toISOString().slice(0, 10)}.json`;
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

      <UniDetail
        title={t('field.dataDictionary.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        basic={
          detailData ? (
            <Descriptions
              column={1}
              items={detailDrawerDescriptionItems(dataDictionaryDetailDescColumns, detailData)}
            />
          ) : null
        }
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
            label={t('field.dataDictionary.description')}
            placeholder={t('field.dataDictionary.descriptionPlaceholder')}
          />
          <ProFormSwitch name="is_active" label={t('field.dataDictionary.isActive')} />
        </ProForm>
      </Modal>
    </>
  );
};

export default DataDictionaryListPage;
