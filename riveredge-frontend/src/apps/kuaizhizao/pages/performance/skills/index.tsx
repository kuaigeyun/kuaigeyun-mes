import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 技能管理页面
 */

import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Space, theme as AntdTheme } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { UniTable, type UniTableRequestMeta} from '../../../../../components/uni-table';
import {
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
  UniTableStackedPrimaryCell,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { buildDetailDrawerEditExtra } from '../../equipment-management/shared/equipmentMasterDataDetail';
import { PerformanceConfigDetailDrawer } from '../shared/performanceConfigDetailDrawer';
import { skillApi } from '../../../services/performance';
import { SkillFormModal } from '../../../components/SkillFormModal';
import type { Skill } from '../../../types/performance';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import {
  getPerformanceActiveValueEnum,
  renderActiveTag,
  renderPerformanceTypeMarker,
} from '../components/performanceMeta';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import {
  normalizePerformanceListResponse,
  PERFORMANCE_PINNED_ACTIVE_FIELD,
  resolveSkillListParams,
} from '../../../utils/performanceListCore';

const SKILL_RESOURCE = 'kuaizhizao:performance-skills';

const SkillsPage: React.FC = () => {
  const { t } = useTranslation();
  const { token } = AntdTheme.useToken();
  const skillDetailDrawerZIndex = token.zIndexPopupBase;
  const { message: messageApi } = App.useApp();
  const skillPerms = useResourcePermissions(SKILL_RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [skillDetail, setSkillDetail] = useState<Skill | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryUuidRef = useRef<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);

  const {
    customFields,
    customFieldValues,
    generateCustomFieldColumns,
    enrichRecordsWithCustomFields,
    loadFieldValuesForDetail,
    resetDetailFieldValues,
  } = useCustomFieldsForList<Skill>({ tableName: 'master_data_skills' });
  const skillDetailColumns: ProDescriptionsItemProps<Skill>[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.performance.skills.columns.skillCode'), dataIndex: 'code' },
      { title: t('app.kuaizhizao.performance.skills.columns.skillName'), dataIndex: 'name' },
      {
        title: t('app.kuaizhizao.performance.skills.columns.category'),
        dataIndex: 'category',
        render: (_, record) => renderPerformanceTypeMarker(record?.category),
      },
      { title: t('common.remark'), dataIndex: 'description', span: 2 },
      {
        title: t('app.kuaizhizao.performance.holidays.columns.activeStatus'),
        dataIndex: 'isActive',
        render: (_, record) => renderActiveTag(t, record?.isActive),
      },
      { title: t('common.createdAt'), dataIndex: 'createdAt', valueType: 'dateTime' },
      { title: t('common.updatedAt'), dataIndex: 'updatedAt', valueType: 'dateTime' },
    ],
    [t],
  );

  const handleCreate = () => { setEditUuid(null); setModalVisible(true); };
  const handleEdit = (record: Skill) => { setEditUuid(record.uuid); setModalVisible(true); };
  const handleDelete = async (record: Skill) => {
    try {
      await skillApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) { messageApi.warning(t('common.selectToDelete')); return; }
    try {
      let successCount = 0, failCount = 0;
      const errors: string[] = [];
      for (const key of keys) {
        try { await skillApi.delete(key.toString()); successCount++; } catch (error: any) { failCount++; errors.push(error.message || t('common.deleteFailed')); }
      }
      if (successCount > 0) messageApi.success(t('common.batchDeleteSuccess', { count: successCount }));
      if (failCount > 0) messageApi.error(t('common.batchDeletePartial', { count: failCount, errors: errors.length > 0 ? '：' + errors.join('; ') : '' }));
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) { messageApi.error(error.message || t('common.batchDeleteFailed')); }
  };

  const loadDetail = async (uuid: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await skillApi.get(uuid);
      setSkillDetail(detail);
      if (detail.id != null) {
        await loadFieldValuesForDetail(detail.id);
      }
    } catch (error) {
      setSkillDetail(null);
      setDetailError(getApiErrorMessage(error, t('app.master-data.skills.getDetailFailed')));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenDetail = (record: Skill) => {
    detailRetryUuidRef.current = record.uuid;
    setDrawerVisible(true);
    setSkillDetail(null);
    setDetailError(null);
    void loadDetail(record.uuid);
  };

  const handleModalSuccess = () => { setModalVisible(false); setEditUuid(null); actionRef.current?.reload(); };
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setSkillDetail(null);
    setDetailError(null);
    resetDetailFieldValues();
  };

  const columns: ProColumns<Skill>[] = useMemo(() => {
    const customFieldColumns = generateCustomFieldColumns();
    return alignProColumns<Skill>([
    {
      title: t('app.kuaizhizao.performance.skills.columns.skillName'),
      key: 'performance_name_code_stacked',
      dataIndex: 'name',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
      sorter: true,
      render: (_, r) => (
        <UniTableStackedPrimaryCell
          primary={String(r.name ?? '').trim() || '-'}
          secondary={String(r.code ?? '').trim() || '-'}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.performance.skills.columns.skillCode'),
      dataIndex: 'code',
      hideInTable: true,
      sorter: true,
    },
    {
      title: t('app.kuaizhizao.performance.skills.columns.category'),
      dataIndex: 'category',
      width: 110,
      minWidth: 110,
      uniTableKeepWidth: true,
      resizable: false,
      sorter: true,
      render: (_, r) => renderPerformanceTypeMarker(r.category),
    },
    {
      title: t('common.remark'),
      dataIndex: 'description',
      width: 200,
      minWidth: 200,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      hideInSearch: true,
    },
    ...customFieldColumns,
    {
      title: t('common.enabled'),
      dataIndex: 'isActive',
      hideInTable: true,
      valueType: 'select',
      valueEnum: getPerformanceActiveValueEnum(t),
    },
    ...buildDocumentAuditColumns<Skill>(t),
    {
      title: t('common.status'),
      dataIndex: 'isActive',
      width: 88,
      minWidth: 88,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      render: (_, r) => renderActiveTag(t, r.isActive),
    },
    {
      title: t('common.actions'),
      key: 'action',
      valueType: 'option',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => (
        <Space>
          {skillPerms.canRead ? (
            <Button key="view" {...rowActionKind('read')} onClick={() => handleOpenDetail(record)}>
              {t('common.detail')}
            </Button>
          ) : null}
          {skillPerms.canUpdate ? (
            <Button key="edit" {...rowActionKind('update')} onClick={() => handleEdit(record)}>
              {t('common.edit')}
            </Button>
          ) : null}
          {skillPerms.canDelete ? (
            <Popconfirm key="delete" {...rowActionKind('delete')} title={t('app.kuaizhizao.performance.skills.messages.deleteConfirm')} onConfirm={() => handleDelete(record)}>
              <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                {t('common.delete')}
              </Button>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
    ], SALES_DOC_LIST_FIELD_RANK);
  }, [t, customFields, skillPerms]);

  return (
    <>
      <ListPageTemplate>
        <UniTable<Skill>
          headerTitle={t('app.kuaizhizao.performance.skills.pageTitle')}
          actionRef={actionRef}
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.performance.skills.v1"
          request={async (params, sort, _filter, searchFormValues, meta?: UniTableRequestMeta) => {
            const pageSize = params.pageSize || 20;
            const skip = ((params.current || 1) - 1) * pageSize;
            const listParams = resolveSkillListParams(searchFormValues, sort);
            try {
              const result = await skillApi.list({ skip, limit: pageSize, ...listParams });
              const { data: raw, total } = normalizePerformanceListResponse(result);
              const enrichedRows = meta?.purpose === 'prefetch'
                ? raw as Skill[]
                : await enrichRecordsWithCustomFields(raw as Skill[]);
              return { data: enrichedRows, success: true, total };
            } catch (error: any) {
              messageApi.error(error?.message || t('app.kuaizhizao.performance.skills.messages.loadListFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          rowKey="uuid"
          showAdvancedSearch={true}
          skipFuzzyPinyinClientFilter
          pinnedTabsField={PERFORMANCE_PINNED_ACTIVE_FIELD}
          pagination={{ defaultPageSize: 20, showSizeChanger: true }}
          showCreateButton={skillPerms.canCreate}
          createButtonText={t('app.kuaizhizao.performance.skills.createButton')}
          onCreate={handleCreate}
          enableRowSelection={skillPerms.canDelete}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton={skillPerms.canDelete}
          onDelete={handleBatchDelete}
          deleteConfirmTitle={(count) => t('common.confirmBatchDeleteContent', { count })}
          deleteButtonText={t('common.batchDelete')}
        />
      </ListPageTemplate>
      <PerformanceConfigDetailDrawer
        title={t('app.kuaizhizao.performance.skills.detailTitle')}
        open={drawerVisible}
        zIndex={skillDetailDrawerZIndex}
        onClose={handleCloseDetail}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          const uuid = detailRetryUuidRef.current;
          if (uuid) void loadDetail(uuid);
        }}
        detail={skillDetail}
        detailColumns={skillDetailColumns}
        customFields={customFields}
        customFieldValues={customFieldValues}
        extra={buildDetailDrawerEditExtra(t, Boolean(skillDetail && skillPerms.canUpdate), () => {
          if (!skillDetail) return;
          setEditUuid(skillDetail.uuid);
          setModalVisible(true);
        })}
      />
      <SkillFormModal open={modalVisible} onClose={() => { setModalVisible(false); setEditUuid(null); }} editUuid={editUuid} onSuccess={handleModalSuccess} />
    </>
  );
};

export default SkillsPage;
