import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 技能管理页面
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Space, Typography, theme as AntdTheme } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { PerformanceConfigDetailDrawer } from '../shared/performanceConfigDetailDrawer';
import { skillApi } from '../../../services/performance';
import { SkillFormModal } from '../../../components/SkillFormModal';
import type { Skill } from '../../../types/performance';
import { getPerformanceConfigActiveLifecycle } from '../../../utils/performanceLifecycle';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { getPerformanceActiveValueEnum, renderActiveTag } from '../components/performanceMeta';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  normalizePerformanceListResponse,
  PERFORMANCE_PINNED_ACTIVE_FIELD,
  resolveSkillListParams,
} from '../../../utils/performanceListCore';

const SkillsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = AntdTheme.useToken();
  const skillDetailDrawerZIndex = token.zIndexPopupBase;
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [skillDetail, setSkillDetail] = useState<Skill | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [skillTrackingRefreshKey, setSkillTrackingRefreshKey] = useState(0);
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

  useEffect(() => {
    if (customFields.length > 0 && actionRef.current) {
      setTimeout(() => actionRef.current?.reload(), 200);
    }
  }, [customFields.length]);

  const skillTracking = useDocumentTracking(
    drawerVisible && skillDetail?.id != null ? 'performance_skill' : undefined,
    skillDetail?.id,
    skillTrackingRefreshKey,
  );

  const skillDetailColumns: ProDescriptionsItemProps<Skill>[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.performance.skills.columns.skillCode'), dataIndex: 'code' },
      { title: t('app.kuaizhizao.performance.skills.columns.skillName'), dataIndex: 'name' },
      { title: t('app.kuaizhizao.performance.skills.columns.category'), dataIndex: 'category' },
      { title: t('app.kuaizhizao.performance.common.columns.description'), dataIndex: 'description', span: 3 },
      {
        title: t('app.kuaizhizao.performance.holidays.columns.activeStatus'),
        dataIndex: 'isActive',
        render: (_, record) => renderActiveTag(t, record?.isActive),
      },
      { title: t('app.kuaizhizao.performance.common.columns.createdAt'), dataIndex: 'createdAt', valueType: 'dateTime' },
      { title: t('app.kuaizhizao.performance.common.columns.updatedAt'), dataIndex: 'updatedAt', valueType: 'dateTime' },
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

  const handleOpenDetail = async (record: Skill) => {
    try {
      setDrawerVisible(true);
      setSkillDetail(null);
      setDetailLoading(true);
      const detail = await skillApi.get(record.uuid);
      setSkillDetail(detail);
      if (detail.id != null) {
        await loadFieldValuesForDetail(detail.id);
      }
      setSkillTrackingRefreshKey((k) => k + 1);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.skills.getDetailFailed'));
      setDrawerVisible(false);
      setSkillDetail(null);
    } finally { setDetailLoading(false); }
  };

  const handleModalSuccess = () => { setModalVisible(false); setEditUuid(null); actionRef.current?.reload(); };
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setSkillDetail(null);
    resetDetailFieldValues();
  };

  const columns: ProColumns<Skill>[] = useMemo(() => {
    const customFieldColumns = generateCustomFieldColumns();
    return alignProColumns<Skill>([
    {
      title: t('app.kuaizhizao.performance.skills.columns.skillCode'),
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
      sorter: true,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.code ?? '') }} ellipsis>
          {r.code ?? '-'}
        </Typography.Text>
      ),
    },
    { title: t('app.kuaizhizao.performance.skills.columns.skillName'), dataIndex: 'name', width: 200, ellipsis: true, sorter: true },
    { title: t('app.kuaizhizao.performance.skills.columns.category'), dataIndex: 'category', width: 150, sorter: true },
    { title: t('app.kuaizhizao.performance.common.columns.description'), dataIndex: 'description', ellipsis: true, hideInSearch: true },
    ...customFieldColumns,
    {
      title: t('app.kuaizhizao.performance.common.active.enabled'),
      dataIndex: 'isActive',
      hideInTable: true,
      valueType: 'select',
      valueEnum: getPerformanceActiveValueEnum(t),
    },
    ...buildDocumentAuditColumns<Skill>(t),
    {
      title: t('app.kuaizhizao.performance.common.columns.actions'),
      valueType: 'option',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button key="view" {...rowActionKind('read')} onClick={() => handleOpenDetail(record)}>
            {t('app.kuaizhizao.performance.common.actions.detail')}
          </Button>
          <Button key="edit" {...rowActionKind('update')} onClick={() => handleEdit(record)}>
            {t('app.kuaizhizao.performance.common.actions.edit')}
          </Button>
          <Popconfirm key="delete" {...rowActionKind('delete')} title={t('app.kuaizhizao.performance.skills.messages.deleteConfirm')} onConfirm={() => handleDelete(record)}>
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
              {t('app.kuaizhizao.performance.common.actions.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
    ], SALES_DOC_LIST_FIELD_RANK);
  }, [t, customFields]);

  return (
    <>
      <ListPageTemplate>
        <UniTable<Skill>
          headerTitle={t('app.kuaizhizao.performance.skills.pageTitle')}
          actionRef={actionRef}
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.performance.skills"
          request={async (params, sort, _filter, searchFormValues) => {
            const pageSize = params.pageSize || 20;
            const skip = ((params.current || 1) - 1) * pageSize;
            const listParams = resolveSkillListParams(searchFormValues, sort);
            try {
              const result = await skillApi.list({ skip, limit: pageSize, ...listParams });
              const { data: raw, total } = normalizePerformanceListResponse(result);
              const enrichedRows = await enrichRecordsWithCustomFields(raw as Skill[]);
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
          showCreateButton
          createButtonText={t('app.kuaizhizao.performance.skills.createButton')}
          onCreate={handleCreate}
          enableRowSelection
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
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
        detail={skillDetail}
        detailColumns={skillDetailColumns}
        basicColumn={3}
        documentType="performance_skill"
        detailId={skillDetail?.id ?? null}
        lifecycleResolver={(row, tr) => getPerformanceConfigActiveLifecycle(row as Record<string, unknown>, tr)}
        tracking={skillTracking}
        customFields={customFields}
        customFieldValues={customFieldValues}
        showEmptyDetailPlaceholder
        t={t}
        navigate={navigate}
      />
      <SkillFormModal open={modalVisible} onClose={() => { setModalVisible(false); setEditUuid(null); }} editUuid={editUuid} onSuccess={handleModalSuccess} />
    </>
  );
};

export default SkillsPage;
