/**
 * 职位管理列表页面
 *
 * 用于系统管理员查看和管理组织内的职位。
 * 支持职位的 CRUD 操作。
 * Schema 驱动 + 国际化
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { rowActionKind } from '../../../../components/uni-action';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Space, message, Modal, Table } from 'antd';
import { alignProColumns, GLOBAL_DOC_LIST_FIELD_RANK } from '../../../../apps/kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { renderSystemActiveTag } from '../../utils/systemListPresentation';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../utils/uniTableLayoutColumns';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate } from '../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../utils/errorHandler';
import { buildDetailDrawerEditExtra } from '../../../../apps/kuaizhizao/pages/equipment-management/shared/equipmentMasterDataDetail';
import { SystemMasterDetailDrawer } from '../../shared/systemMasterDetailDrawer';
import { PositionFormModal } from '../components/PositionFormModal';
import {
  getPositionList,
  getPositionByUuid,
  deletePosition,
  loadPresetPositions,
  getPositionPresetPreview,
  type PresetPositionItem,
  Position,
} from '../../../../services/position';
import { getDepartmentTree, DepartmentTreeItem } from '../../../../services/department';
import { useTrialRunMode } from '../../../../hooks/useTrialRunMode';
import { resolvePresetPositionName } from '../../../../utils/presetEntityI18n';
import { buildListPageHelpViewConfig } from '../../../../components/page-help-wiki';

function toTreeData(items: DepartmentTreeItem[]): Array<{ title: string; value: string; key: string; children?: any[] }> {
  return items.map((item) => ({
    title: item.name,
    value: item.uuid,
    key: item.uuid,
    children: item.children?.length ? toTreeData(item.children) : undefined,
  }));
}

const PositionListPage: React.FC = () => {
  const { t } = useTranslation();
  const trialRunMode = useTrialRunMode();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const detailRetryUuidRef = useRef<string | null>(null);

  const positionDetailDescColumns = useMemo<ProDescriptionsItemProps<Position>[]>(
    () => [
      {
        title: t('field.position.name'),
        dataIndex: 'name',
        render: (_: unknown, record: Position) => resolvePresetPositionName(record, t),
      },
      { title: t('field.position.code'), dataIndex: 'code' },
      { title: t('common.remark'), dataIndex: 'description' },
      {
        title: t('field.position.departmentUuid'),
        dataIndex: ['department', 'name'],
        render: (_: unknown, record: Position) => record?.department?.name || '-',
      },
      {
        title: t('common.status'),
        dataIndex: 'is_active',
        render: (_: unknown, entity: Position) =>
          renderSystemActiveTag(t, entity?.is_active, 'common.enabled', 'common.disabled'),
      },
      { title: t('field.position.userCount'), dataIndex: 'user_count' },
      { title: t('field.position.sortOrder'), dataIndex: 'sort_order' },
      { title: t('common.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
      { title: t('common.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
    ],
    [t]
  );

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [deptTreeData, setDeptTreeData] = useState<Array<{ title: string; value: string; key: string; children?: any[] }>>([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [currentPositionUuid, setCurrentPositionUuid] = useState<string | null>(null);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<Position | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [loadPresetLoading, setLoadPresetLoading] = useState(false);
  const [presetModalVisible, setPresetModalVisible] = useState(false);
  const [presetList, setPresetList] = useState<PresetPositionItem[]>([]);
  const [selectedPresetCodes, setSelectedPresetCodes] = useState<string[]>([]);
  const [presetConfirmLoading, setPresetConfirmLoading] = useState(false);

  useEffect(() => {
    const refreshDeptTree = () => {
      getDepartmentTree()
        .then((res) => setDeptTreeData(toTreeData(res.items)))
        .catch(() => setDeptTreeData([]));
    };
    refreshDeptTree();
    window.addEventListener('focus', refreshDeptTree);
    return () => window.removeEventListener('focus', refreshDeptTree);
  }, []);

  const handleCreate = () => {
    setCurrentPositionUuid(null);
    setModalVisible(true);
  };

  const handleEdit = (record: Position) => {
    setCurrentPositionUuid(record.uuid);
    setModalVisible(true);
  };

  const handleImport = async (data: any[][]) => {
    message.info(t('pages.system.importDeveloping'));
    if (typeof window !== 'undefined') {
      window.console.log('导入数据:', data);
    }

  };

  const handleExport = (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: Position[]
  ) => {
    message.info(t('pages.system.exportDeveloping'));
    if (typeof window !== 'undefined') {
      window.console.log('导出类型:', type, '选中行:', selectedRowKeys, '当前页数据:', currentPageData);
    }

  };

  const loadDetail = async (uuid: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await getPositionByUuid(uuid);
      setDetailData(detail);
    } catch (error) {
      setDetailData(null);
      setDetailError(getApiErrorMessage(error, t('common.loadFailed')));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleView = (record: Position) => {
    detailRetryUuidRef.current = record.uuid;
    setDrawerVisible(true);
    setDetailData(null);
    setDetailError(null);
    void loadDetail(record.uuid);
  };

  const handleDelete = async (record: Position) => {
    try {
      await deletePosition(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    try {
      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];
      for (const key of keys) {
        try {
          await deletePosition(key.toString());
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
  };

  const columns = useMemo<ProColumns<Position>[]>(() => alignProColumns([
    {
      title: t('field.position.name'),
      dataIndex: 'name',
      key: 'name',
      width: 160,
      minWidth: 160,
      uniTableKeepWidth: true,
      resizable: false,
      sorter: true,
      ellipsis: true,
      render: (_, record) => resolvePresetPositionName(record, t),
    },
    {
      title: t('field.position.code'),
      dataIndex: 'code',
      key: 'code',
      width: 140,
      minWidth: 140,
      uniTableKeepWidth: true,
      resizable: false,
      copyable: true,
      ellipsis: true,
    },
    {
      title: t('field.position.departmentUuid'),
      dataIndex: 'department_uuid',
      width: 160,
      minWidth: 160,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      valueType: 'treeSelect',
      fieldProps: {
        treeData: deptTreeData,
        fieldNames: { label: 'title', value: 'value' },
      },
      render: (_, record) => record.department?.name || '-',
    },
    {
      // 备注长短不一：唯一 RemainderFlex
      title: t('common.remark'),
      dataIndex: 'description',
      minWidth: 140,
      uniTableRemainderFlex: true,
      uniTablePrimaryFlex: true,
      resizable: false,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('field.position.userCount'),
      dataIndex: 'user_count',
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('field.position.sortOrder'),
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
      key: 'is_active',
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
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
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
            <Popconfirm key="delete" title={t('field.position.deleteConfirm')} onConfirm={() => handleDelete(record)}>
              <Button {...rowActionKind('delete')} />
            </Popconfirm>,
          ],
    },
  ], GLOBAL_DOC_LIST_FIELD_RANK), [t, deptTreeData, handleView, handleEdit, handleDelete]);

  return (
    <>
      <ListPageTemplate>
        <UniTable<Position>
          columnPersistenceId="pages.system.positions.list-v2"
          viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('system.positions')}
          actionRef={actionRef}
          columns={columns}
          request={async (params, _sort, _filter, searchFormValues) => {
            const [response, deptRes] = await Promise.all([
              getPositionList({
                page: params.current || 1,
                page_size: params.pageSize || 20,
                keyword: searchFormValues?.keyword,
                name: searchFormValues?.name,
                code: searchFormValues?.code,
                department_uuid: searchFormValues?.department_uuid,
                is_active: searchFormValues?.is_active,
              }),
              getDepartmentTree(),
            ]);
            setDeptTreeData(toTreeData(deptRes.items));
            return { data: response.items, success: true, total: response.total };
          }}
          rowKey="uuid"
          showAdvancedSearch={true}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          showCreateButton
          createButtonText={t('field.position.createTitle')}
          onCreate={handleCreate}
          toolBarRender={() => [
            trialRunMode && (
            <Button {...rowActionKind('import')}
              key="loadPreset"
              loading={loadPresetLoading}
              onClick={async () => {
                try {
                  setLoadPresetLoading(true);
                  const list = await getPositionPresetPreview();
                  setPresetList(list);
                  setSelectedPresetCodes(list.map((x) => x.code));
                  setPresetModalVisible(true);
                } catch (e: any) {
                  messageApi.error(e?.message || t('common.operationFailed'));
                } finally {
                  setLoadPresetLoading(false);
                }
              }}
            >
              {t('field.position.loadPreset')}
            </Button>
            ),
          ]}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText={t('common.batchDelete')}
          deleteConfirmTitle={t('field.position.batchDeleteTitle')}
          deleteConfirmDescription={(c) => t('field.position.batchDeleteDescription', { count: c })}
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          showImportButton={true}
          onImport={handleImport}
          // 过渡：columns 自动生成模板；后续可改为 buildFactoryImportTemplate 显式模板
          autoGenerateImportConfig
          showExportButton={true}
          onExport={handleExport}
        />
      </ListPageTemplate>

      <Modal
        title={t('field.position.loadPreset')}
        open={presetModalVisible}
        onCancel={() => setPresetModalVisible(false)}
        width={560}
        destroyOnHidden
        footer={[
          <Button {...rowActionKind('revoke')} key="cancel" onClick={() => setPresetModalVisible(false)}>
            {t('common.cancel')}
          </Button>,
          <Button {...rowActionKind('audit')}
            key="confirm"
            type="primary"
            loading={presetConfirmLoading}
            disabled={selectedPresetCodes.length === 0}
            onClick={async () => {
              try {
                setPresetConfirmLoading(true);
                const res = await loadPresetPositions(selectedPresetCodes);
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
          {t('app.master-data.presetModalDesc')}
        </p>
        <Table<PresetPositionItem>
          size="small"
          rowKey="code"
          dataSource={presetList}
          pagination={false}
          scroll={{ y: 280 }}
          rowSelection={{
            selectedRowKeys: selectedPresetCodes,
            onChange: (keys) => setSelectedPresetCodes(keys as string[]),
          }}
          columns={[
            {
              title: t('field.position.name'),
              dataIndex: 'name',
              width: 140,
              render: (_: unknown, row: PresetPositionItem) => resolvePresetPositionName(row, t),
            },
            { title: t('field.position.code'), dataIndex: 'code', width: 100 },
            { title: t('field.position.sortOrder'), dataIndex: 'sort_order', width: 88 },
          ]}
        />
      </Modal>

      <PositionFormModal
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentPositionUuid(null);
        }}
        editUuid={currentPositionUuid}
        onSuccess={() => actionRef.current?.reload()}
      />

      <SystemMasterDetailDrawer
        title={t('field.position.detailTitle')}
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
        detailColumns={positionDetailDescColumns}
      />
    </>
  );
};

export default PositionListPage;
