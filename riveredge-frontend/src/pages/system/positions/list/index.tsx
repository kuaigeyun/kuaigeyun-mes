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
import { App, Popconfirm, Button, Tag, Space, message, Modal, Table, Descriptions } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { flushDrawerOpen, ListPageTemplate, DRAWER_CONFIG } from '../../../../components/layout-templates';
import { UniDetail, detailDrawerDescriptionItems } from '../../../../components/uni-detail';
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
  const positionDetailReqRef = useRef(0);

  const positionDetailDescColumns = useMemo<ProDescriptionsItemProps<Position>[]>(
    () => [
      {
        title: t('field.position.name'),
        dataIndex: 'name',
        render: (_: unknown, record: Position) => resolvePresetPositionName(record, t),
      },
      { title: t('field.position.code'), dataIndex: 'code' },
      { title: t('field.position.remark'), dataIndex: 'description' },
      {
        title: t('field.position.departmentUuid'),
        dataIndex: ['department', 'name'],
        render: (_: unknown, record: Position) => record?.department?.name || '-',
      },
      {
        title: t('field.position.status'),
        dataIndex: 'is_active',
        render: (_: unknown, entity: Position) => (
          <Tag color={entity?.is_active ? 'success' : 'default'}>
            {entity?.is_active ? t('field.role.enabled') : t('field.role.disabled')}
          </Tag>
        ),
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

  const handleView = async (record: Position) => {
    const req = ++positionDetailReqRef.current;
    flushDrawerOpen(() => {
      setDrawerVisible(true);
      setDetailData(null);
      setDetailLoading(true);
    });
    try {
      const detail = await getPositionByUuid(record.uuid);
      if (positionDetailReqRef.current !== req) return;
      setDetailData(detail);
    } catch (error: any) {
      if (positionDetailReqRef.current === req) {
        messageApi.error(error.message || t('common.loadFailed'));
      }
    } finally {
      if (positionDetailReqRef.current === req) {
        setDetailLoading(false);
      }
    }
  };

  const handleDelete = async (record: Position) => {
    try {
      await deletePosition(record.uuid);
      messageApi.success(t('pages.system.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.deleteFailed'));
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
  };

  const columns: ProColumns<Position>[] = [
    {
      title: t('field.position.name'),
      dataIndex: 'name',
      width: 150,
      fixed: 'left',
      sorter: true,
      render: (_, record) => resolvePresetPositionName(record, t),
    },
    {
      title: t('field.position.code'),
      dataIndex: 'code',
      width: 150,
      copyable: true,
    },
    {
      title: t('field.position.departmentUuid'),
      dataIndex: 'department_uuid',
      width: 200,
      valueType: 'treeSelect',
      fieldProps: {
        treeData: deptTreeData,
        fieldNames: { label: 'title', value: 'value' },
      },
      render: (_, record) => record.department?.name || '-',
    },
    {
      title: t('field.position.remark'),
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('field.position.userCount'),
      dataIndex: 'user_count',
      width: 100,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('field.position.sortOrder'),
      dataIndex: 'sort_order',
      width: 100,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('field.position.status'),
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
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
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
              {t('field.position.view')}
            </Button>,
            <Button {...rowActionKind('update')} key="edit" onClick={() => handleEdit(record)}>
              {t('field.position.edit')}
            </Button>,
            <Popconfirm {...rowActionKind('delete')} key="delete" title={t('field.position.deleteConfirm')} onConfirm={() => handleDelete(record)}>
              <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                {t('field.position.delete')}
              </Button>
            </Popconfirm>,
          ],
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<Position>
          columnPersistenceId="pages.system.positions.list"
          viewTypes={['table', 'help']}
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
          deleteButtonText={t('pages.system.batchDelete')}
          deleteConfirmTitle={t('field.position.batchDeleteTitle')}
          deleteConfirmDescription={(c) => t('field.position.batchDeleteDescription', { count: c })}
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          showImportButton={true}
          onImport={handleImport}
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

      <UniDetail
        title={t('field.position.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        basic={
          detailData ? (
            <Descriptions
              column={1}
              items={detailDrawerDescriptionItems(positionDetailDescColumns, detailData)}
            />
          ) : null
        }
      />
    </>
  );
};

export default PositionListPage;
