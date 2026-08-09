/**
 * 工时单价配置页面
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProFormInstance } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Space, Typography, theme as AntdTheme } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { ProFormSelect, ProFormDigit, ProFormSwitch } from '@ant-design/pro-components';
import { UniTable } from '../../../../../components/uni-table';
import { rowActionKind } from '../../../../../components/uni-action';
import {
  ListPageTemplate,
  FormModalTemplate,
  MODAL_CONFIG,
} from '../../../../../components/layout-templates';
import { PerformanceConfigDetailDrawer } from '../shared/performanceConfigDetailDrawer';
import { employeePerformanceApi } from '../../../services/performance';
import type { HourlyRate } from '../../../types/performance';
import { getPerformanceYesNoValueEnum, renderActiveTag } from '../components/performanceMeta';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import {
  normalizePerformanceListResponse,
  PERFORMANCE_PINNED_IS_ACTIVE_FIELD,
  resolveHourlyRateListParams,
} from '../../../utils/performanceListCore';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';

const HourlyRatesPage: React.FC = () => {
  const { t } = useTranslation();
  const { token } = AntdTheme.useToken();
  const detailDrawerZIndex = token.zIndexPopupBase;
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [positions, setPositions] = useState<{ id: number; name: string }[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detail, setDetail] = useState<HourlyRate | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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
    }).catch((e: any) => messageApi.error(e?.message || t('app.kuaizhizao.performance.common.messages.loadFailed')));
  }, [modalVisible, editId, messageApi, t]);

  const detailColumns: ProDescriptionsItemProps<HourlyRate>[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.performance.common.columns.department'), dataIndex: 'department_name' },
      { title: t('app.kuaizhizao.performance.common.columns.position'), dataIndex: 'position_name' },
      { title: t('app.kuaizhizao.performance.hourlyRates.columns.rate'), dataIndex: 'rate' },
      {
        title: t('app.kuaizhizao.performance.common.form.active'),
        dataIndex: 'is_active',
        render: (_, r) => renderActiveTag(t, r?.is_active !== false),
      },
      { title: t('app.kuaizhizao.performance.common.columns.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
      { title: t('app.kuaizhizao.performance.common.columns.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
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
      messageApi.success(t('app.kuaizhizao.performance.common.messages.deleteSuccess'));
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.performance.common.messages.deleteFailed'));
    }
  };
  const handleOpenDetail = async (r: HourlyRate) => {
    try {
      setDrawerVisible(true);
      setDetail(null);
      setDetailLoading(true);
      setDetail(await employeePerformanceApi.getHourlyRate(r.id));
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.performance.common.messages.loadFailed'));
      setDrawerVisible(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const columns: ProColumns<HourlyRate>[] = useMemo(
    () => alignProColumns<HourlyRate>([
      {
        title: t('app.kuaizhizao.performance.common.columns.department'),
        dataIndex: 'department_name',
        width: 120,
        ellipsis: true,
        sorter: true,
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.department_name ?? '') }} ellipsis>
            {r.department_name ?? '-'}
          </Typography.Text>
        ),
      },
      {
        title: t('app.kuaizhizao.performance.common.columns.position'),
        dataIndex: 'position_name',
        width: 120,
        ellipsis: true,
        sorter: true,
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.position_name ?? '') }} ellipsis>
            {r.position_name ?? '-'}
          </Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.performance.hourlyRates.columns.rate'), dataIndex: 'rate', width: 120, align: 'right', sorter: true },
      {
        title: t('app.kuaizhizao.performance.common.form.active'),
        dataIndex: 'is_active',
        hideInTable: true,
        valueEnum: getPerformanceYesNoValueEnum(t),
      },
      ...buildDocumentAuditColumns<HourlyRate>(t),
      {
        title: t('app.kuaizhizao.performance.common.columns.actions'),
        valueType: 'option',
        width: 160,
        fixed: 'right',
        render: (_, record) => (
          <Space>
            <Button key="view" {...rowActionKind('read')} onClick={() => handleOpenDetail(record)}>
              {t('app.kuaizhizao.performance.common.actions.detail')}
            </Button>
            <Button key="edit" {...rowActionKind('update')} onClick={() => handleEdit(record)}>
              {t('app.kuaizhizao.performance.common.actions.edit')}
            </Button>
            <Popconfirm key="delete" {...rowActionKind('delete')} title={t('app.kuaizhizao.performance.hourlyRates.messages.deleteConfirm')} onConfirm={() => handleDelete(record)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                {t('app.kuaizhizao.performance.common.actions.delete')}
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ], SALES_DOC_LIST_FIELD_RANK),
    [t],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<HourlyRate>
          headerTitle={t('app.kuaizhizao.performance.hourlyRates.pageTitle')}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.performance.hourly-rates"
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
              messageApi.error(e?.message || t('app.kuaizhizao.performance.common.messages.loadFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          enableRowSelection={true}
          showDeleteButton={true}
          onDelete={async (keys) => {
            try {
              for (const id of keys) {
                await employeePerformanceApi.deleteHourlyRate(Number(id));
              }
              messageApi.success(t('app.kuaizhizao.performance.common.messages.deleteBatchSuccess', { count: keys.length }));
              actionRef.current?.reload();
            } catch (error: any) {
              messageApi.error(error?.message || t('app.kuaizhizao.performance.common.messages.deleteFailed'));
            }
          }}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.performance.hourlyRates.messages.deleteBatchConfirm', { count })}
          showCreateButton
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
            messageApi.success(t('app.kuaizhizao.performance.common.messages.updateSuccess'));
          } else {
            await employeePerformanceApi.createHourlyRate(payload);
            messageApi.success(t('app.kuaizhizao.performance.common.messages.createSuccess'));
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
        <ProFormSwitch name="is_active" label={t('app.kuaizhizao.performance.common.form.active')} colProps={{ span: 12 }} />
      </FormModalTemplate>

      <PerformanceConfigDetailDrawer
        title={t('app.kuaizhizao.performance.hourlyRates.detailTitle')}
        open={drawerVisible}
        zIndex={detailDrawerZIndex}
        onClose={() => {
          setDrawerVisible(false);
          setDetail(null);
        }}
        loading={detailLoading}
        detail={detail}
        detailColumns={detailColumns}
        t={t}
      />
    </>
  );
};

export default HourlyRatesPage;
