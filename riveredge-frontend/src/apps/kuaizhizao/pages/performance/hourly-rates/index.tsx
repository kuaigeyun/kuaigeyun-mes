/**
 * 工时单价配置页面
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProFormInstance } from '@ant-design/pro-components';
import { App, Popconfirm, Button, theme as AntdTheme } from 'antd';
import { ProFormSelect, ProFormDigit, ProFormSwitch } from '@ant-design/pro-components';
import { UniTable } from '../../../../../components/uni-table';
import { rowActionKind } from '../../../../../components/uni-action';
import {
  ListPageTemplate,
  FormModalTemplate,
  MODAL_CONFIG,
} from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { buildDetailDrawerEditExtra } from '../../equipment-management/shared/equipmentMasterDataDetail';
import { PerformanceConfigDetailDrawer } from '../shared/performanceConfigDetailDrawer';
import { employeePerformanceApi } from '../../../services/performance';
import type { HourlyRate } from '../../../types/performance';
import { getPerformanceYesNoValueEnum, renderActiveTag } from '../components/performanceMeta';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';
import {
  normalizePerformanceListResponse,
  PERFORMANCE_PINNED_IS_ACTIVE_FIELD,
  resolveHourlyRateListParams,
} from '../../../utils/performanceListCore';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';

const HOURLY_RATE_RESOURCE = 'kuaizhizao:performance-hourly-rates';

const HourlyRatesPage: React.FC = () => {
  const { t } = useTranslation();
  const { token } = AntdTheme.useToken();
  const detailDrawerZIndex = token.zIndexPopupBase;
  const { message: messageApi } = App.useApp();
  const ratePerms = useResourcePermissions(HOURLY_RATE_RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [positions, setPositions] = useState<{ id: number; name: string }[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detail, setDetail] = useState<HourlyRate | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryIdRef = useRef<number | null>(null);

  useEffect(() => {
    Promise.all([employeePerformanceApi.listDepartments(), employeePerformanceApi.listPositions()])
      .then(([d, p]) => {
        setDepartments(d.items || []);
        setPositions(p.items || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!modalVisible) return;
    formRef.current?.resetFields();
    if (!editId) {
      formRef.current?.setFieldsValue({ is_active: true });
      return;
    }
    employeePerformanceApi.getHourlyRate(editId).then((r) => {
      formRef.current?.setFieldsValue({
        department_id: r.department_id ?? '',
        position_id: r.position_id ?? '',
        rate: r.rate,
        is_active: r.is_active !== false,
      });
    }).catch((e: any) => messageApi.error(e?.message || t('common.loadFailed')));
  }, [modalVisible, editId, messageApi, t]);

  const detailColumns: ProDescriptionsItemProps<HourlyRate>[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.performance.common.columns.department'), dataIndex: 'department_name' },
      { title: t('app.kuaizhizao.performance.common.columns.position'), dataIndex: 'position_name' },
      { title: t('app.kuaizhizao.performance.hourlyRates.columns.rate'), dataIndex: 'rate' },
      {
        title: t('common.enabled'),
        dataIndex: 'is_active',
        render: (_, r) => renderActiveTag(t, r?.is_active !== false),
      },
      { title: t('common.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
      { title: t('common.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
    ],
    [t],
  );

  const handleCreate = () => {
    setEditId(null);
    setModalVisible(true);
  };
  const handleEdit = (r: HourlyRate) => {
    setEditId(r.id);
    setModalVisible(true);
  };
  const handleDelete = async (r: HourlyRate) => {
    try {
      await employeePerformanceApi.deleteHourlyRate(r.id);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || t('common.deleteFailed'));
    }
  };
  const loadDetail = async (id: number) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      setDetail(await employeePerformanceApi.getHourlyRate(id));
    } catch (error) {
      setDetail(null);
      setDetailError(getApiErrorMessage(error, t('common.loadFailed')));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenDetail = (r: HourlyRate) => {
    detailRetryIdRef.current = r.id;
    setDrawerVisible(true);
    setDetail(null);
    setDetailError(null);
    void loadDetail(r.id);
  };

  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setDetail(null);
    setDetailError(null);
  };

  const columns: ProColumns<HourlyRate>[] = useMemo(
    () => alignProColumns<HourlyRate>([
      {
        // 列稀疏：业务列不堆叠（表单序：部门 → 岗位 → 单价 → 启用）；审计叠列保留
        title: t('app.kuaizhizao.performance.common.columns.department'),
        key: 'performance_hourly_department',
        dataIndex: 'department_name',
        minWidth: 140,
        uniTableRemainderFlex: true,
        uniTablePrimaryFlex: true,
        resizable: false,
        ellipsis: true,
        fixed: 'left',
        sorter: true,
      },
      {
        title: t('app.kuaizhizao.performance.common.columns.position'),
        key: 'performance_hourly_position',
        dataIndex: 'position_name',
        width: 140,
        minWidth: 140,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        sorter: true,
      },
      {
        title: t('app.kuaizhizao.performance.hourlyRates.columns.rate'),
        dataIndex: 'rate',
        // 稀疏：表头「工时单价（元/时）」+ 排序钮
        width: 168,
        minWidth: 168,
        uniTableKeepWidth: true,
        resizable: false,
        align: 'right',
        sorter: true,
      },
      {
        title: t('common.enabled'),
        dataIndex: 'is_active',
        hideInTable: true,
        valueEnum: getPerformanceYesNoValueEnum(t),
      },
      ...buildDocumentAuditColumns<HourlyRate>(t),
      {
        title: t('common.enabled'),
        dataIndex: 'is_active',
        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
        hideInSearch: true,
        render: (_, r) => renderActiveTag(t, r.is_active),
      },
      {
        title: t('common.actions'),
        key: 'action',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => {
          const parts: React.ReactNode[] = [];
          if (ratePerms.canRead) {
            parts.push(
              <Button key="view" {...rowActionKind('read')} onClick={() => handleOpenDetail(record)} />,
            );
          }
          if (ratePerms.canUpdate) {
            parts.push(
              <Button key="edit" {...rowActionKind('update')} onClick={() => handleEdit(record)} />,
            );
          }
          if (ratePerms.canDelete) {
            parts.push(
              <Popconfirm
                key="delete"
                title={t('app.kuaizhizao.performance.hourlyRates.messages.deleteConfirm')}
                onConfirm={() => handleDelete(record)}
              >
                <Button {...rowActionKind('delete')} />
              </Popconfirm>,
            );
          }
          return parts;
        },
      },
    ], SALES_DOC_LIST_FIELD_RANK),
    [t, ratePerms],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<HourlyRate>
          headerTitle={t('app.kuaizhizao.performance.hourlyRates.pageTitle')}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.performance.hourly-rates.v3"
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('kuaizhizao.hourlyRates')}
          showAdvancedSearch
          skipFuzzyPinyinClientFilter
          pinnedTabsField={PERFORMANCE_PINNED_IS_ACTIVE_FIELD}
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const pageSize = params.pageSize || 20;
              const skip = ((params.current || 1) - 1) * pageSize;
              const listParams = resolveHourlyRateListParams(searchFormValues, sort);
              const response = await employeePerformanceApi.listHourlyRates({
                skip,
                limit: pageSize,
                ...listParams,
              });
              const { data, total } = normalizePerformanceListResponse(response);
              return { data: data as HourlyRate[], success: true, total };
            } catch (e: any) {
              messageApi.error(e?.message || t('common.loadFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          enableRowSelection={ratePerms.canDelete}
          showDeleteButton={ratePerms.canDelete}
          onDelete={async (keys) => {
            try {
              for (const id of keys) {
                await employeePerformanceApi.deleteHourlyRate(Number(id));
              }
              messageApi.success(t('app.kuaizhizao.performance.common.messages.deleteBatchSuccess', { count: keys.length }));
              actionRef.current?.reload();
            } catch (error: any) {
              messageApi.error(error?.message || t('common.deleteFailed'));
            }
          }}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.performance.hourlyRates.messages.deleteBatchConfirm', { count })}
          showCreateButton={ratePerms.canCreate}
          createButtonText={t('app.kuaizhizao.performance.hourlyRates.createButton')}
          onCreate={handleCreate}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={editId ? t('app.kuaizhizao.performance.hourlyRates.modal.editTitle') : t('app.kuaizhizao.performance.hourlyRates.modal.createTitle')}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditId(null);
        }}
        formRef={formRef as React.RefObject<ProFormInstance>}
        onFinish={async (values) => {
          const deptId =
            values.department_id == null || values.department_id === ''
              ? null
              : Number(values.department_id);
          const posId =
            values.position_id == null || values.position_id === ''
              ? null
              : Number(values.position_id);
          const payload = {
            department_id: deptId,
            department_name: deptId
              ? departments.find((d) => d.id === deptId)?.name ?? null
              : null,
            position_id: posId,
            position_name: posId
              ? positions.find((p) => p.id === posId)?.name ?? null
              : null,
            rate: values.rate,
            is_active: values.is_active !== false,
          };
          if (editId) {
            await employeePerformanceApi.updateHourlyRate(editId, payload);
            messageApi.success(t('common.updateSuccess'));
          } else {
            await employeePerformanceApi.createHourlyRate(payload);
            messageApi.success(t('common.createSuccess'));
          }
          setModalVisible(false);
          setEditId(null);
          actionRef.current?.reload();
        }}
        isEdit={!!editId}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        <ProFormSelect
          name="department_id"
          label={t('app.kuaizhizao.performance.common.columns.department')}
          options={[
            { label: t('app.kuaizhizao.performance.common.form.notSpecified'), value: '' },
            ...departments.map((d) => ({ label: d.name, value: d.id })),
          ]}
          fieldProps={{ allowClear: true }}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="position_id"
          label={t('app.kuaizhizao.performance.common.columns.position')}
          options={[
            { label: t('app.kuaizhizao.performance.common.form.notSpecified'), value: '' },
            ...positions.map((p) => ({ label: p.name, value: p.id })),
          ]}
          fieldProps={{ allowClear: true }}
          colProps={{ span: 12 }}
        />
        <ProFormDigit name="rate" label={t('app.kuaizhizao.performance.hourlyRates.form.rate')} rules={[{ required: true }]} min={0} fieldProps={{ precision: 2 }} colProps={{ span: 12 }} />
        <ProFormSwitch name="is_active" label={t('common.enabled')} colProps={{ span: 12 }} />
      </FormModalTemplate>

      <PerformanceConfigDetailDrawer
        title={t('app.kuaizhizao.performance.hourlyRates.detailTitle')}
        open={drawerVisible}
        zIndex={detailDrawerZIndex}
        onClose={handleCloseDetail}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          const id = detailRetryIdRef.current;
          if (id != null) void loadDetail(id);
        }}
        detail={detail}
        detailColumns={detailColumns}
        extra={buildDetailDrawerEditExtra(t, Boolean(detail && ratePerms.canUpdate), () => {
          if (!detail) return;
          setEditId(detail.id);
          setModalVisible(true);
        })}
      />
    </>
  );
};

export default HourlyRatesPage;
