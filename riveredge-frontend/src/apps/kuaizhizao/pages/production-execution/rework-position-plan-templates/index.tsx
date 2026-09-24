/**
 * 返工排位策划模板主数据（R-11 WP-11A）
 */
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Col, Form as AntForm, Input, InputNumber, Row, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { UniTable } from '../../../../../components/uni-table';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import { rowActionKind } from '../../../../../components/uni-action';
import {
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
} from '../../../../../components/layout-templates';
import { MasterDataDetailDrawer } from '../../../../master-data/pages/shared/masterDataDetailDrawer';
import {
  buildDetailDrawerEditExtra,
  renderIsActiveTag,
} from '../../equipment-management/shared/equipmentMasterDataDetail';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  alignProColumns,
  GLOBAL_DOC_LIST_FIELD_RANK,
} from '../../sales-management/shared/documentFieldAlignment';
import {
  reworkPositionPlanTemplateApi,
  type ReworkPositionPlanTemplate,
} from '../../../services/rework-position-plan-template';

const RESOURCE = 'kuaizhizao:rework-position-plan-template';

const EMPTY_POSITION_ITEM = {
  sequence: 1,
  station_name: '',
  section_name: '',
  station_code: '',
  planned_headcount: undefined as number | undefined,
  standard_minutes: undefined as number | undefined,
  owner_user_name: '',
};
const ReworkPositionPlanTemplatesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>();
  const formRef = useRef<any>(null);
  const tableRowsRef = useRef<ReworkPositionPlanTemplate[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ReworkPositionPlanTemplate | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<ReworkPositionPlanTemplate | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryIdRef = useRef<number | null>(null);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const loadDetail = async (id: number) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const row = await reworkPositionPlanTemplateApi.get(id);
      setDetail(row);
    } catch (error) {
      setDetail(null);
      setDetailError(
        getApiErrorMessage(error, t('app.kuaizhizao.reworkPositionPlanTemplate.loadFailed')),
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const openDetail = (record: ReworkPositionPlanTemplate) => {
    if (record.id == null) return;
    detailRetryIdRef.current = record.id;
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    void loadDetail(record.id);
  };

  const openEdit = async (record: ReworkPositionPlanTemplate) => {
    try {
      const row = await reworkPositionPlanTemplateApi.get(record.id!);
      setEditing(row);
      setModalOpen(true);
    } catch (error) {
      messageApi.error(
        getApiErrorMessage(error, t('app.kuaizhizao.reworkPositionPlanTemplate.loadFailed')),
      );
    }
  };

  const columns = useMemo<ProColumns<ReworkPositionPlanTemplate>[]>(
    () =>
      alignProColumns(
        [
          {
            title: t('app.kuaizhizao.reworkPositionPlanTemplate.colTemplate'),
            dataIndex: 'template_name',
            key: 'template_name',
            ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
            render: (_, record) => (
              <UniTableStackedPrimaryCell
                primary={record.template_name}
                secondary={record.template_code}
              />
            ),
          },
          {
            title: t('app.kuaizhizao.reworkPositionPlanTemplate.colProductLine'),
            dataIndex: 'product_line_code',
            key: 'product_line_code',
            width: 120,
            search: false,
          },
          {
            title: t('app.kuaizhizao.reworkPositionPlanTemplate.colTotalItems'),
            dataIndex: 'total_items',
            key: 'total_items',
            width: 88,
            search: false,
            uniTableKeepWidth: true,
          },
          {
            title: t('app.kuaizhizao.reworkPositionPlanTemplate.colActive'),
            dataIndex: 'is_active',
            key: 'is_active',
            valueType: 'select',
            valueEnum: {
              true: { text: t('app.kuaizhizao.reworkPositionPlanTemplate.activeYes') },
              false: { text: t('app.kuaizhizao.reworkPositionPlanTemplate.activeNo') },
            },
            ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
            render: (_, record) =>
              record.is_active ? (
                <MarkerTag color="success" variant="filled">
                  {t('app.kuaizhizao.reworkPositionPlanTemplate.activeYes')}
                </MarkerTag>
              ) : (
                <MarkerTag color="default" variant="filled">
                  {t('app.kuaizhizao.reworkPositionPlanTemplate.activeNo')}
                </MarkerTag>
              ),
          },
          ...buildDocumentAuditColumns<ReworkPositionPlanTemplate>(t),
          {
            title: t('common.action'),
            valueType: 'option',
            key: 'option',
            fixed: 'right',
            render: (_, record) => [
              {
                key: 'detail',
                ...rowActionKind('read'),
                onClick: () => openDetail(record),
              },
              perms.canUpdate
                ? {
                    key: 'edit',
                    ...rowActionKind('update'),
                    onClick: () => void openEdit(record),
                  }
                : null,
              perms.canDelete
                ? {
                    key: 'delete',
                    ...rowActionKind('delete'),
                    confirm: {
                      title: t('app.kuaizhizao.reworkPositionPlanTemplate.deleteConfirm'),
                      onConfirm: async () => {
                        try {
                          await reworkPositionPlanTemplateApi.delete(record.id!);
                          messageApi.success(
                            t('app.kuaizhizao.reworkPositionPlanTemplate.deleteSuccess'),
                          );
                          actionRef.current?.reload();
                        } catch (error) {
                          messageApi.error(getApiErrorMessage(error));
                        }
                      },
                    },
                  }
                : null,
            ].filter(Boolean),
          },
        ],
        GLOBAL_DOC_LIST_FIELD_RANK,
      ),
    [t, perms.canUpdate, perms.canDelete, messageApi],
  );

  const detailColumns = useMemo<ProDescriptionsItemProps<ReworkPositionPlanTemplate>[]>(
    () => [
      {
        title: t('app.kuaizhizao.reworkPositionPlanTemplate.colCode'),
        dataIndex: 'template_code',
        key: 'template_code',
      },
      {
        title: t('app.kuaizhizao.reworkPositionPlanTemplate.colName'),
        dataIndex: 'template_name',
        key: 'template_name',
      },
      {
        title: t('app.kuaizhizao.reworkPositionPlanTemplate.colProductLine'),
        dataIndex: 'product_line_code',
        key: 'product_line_code',
      },
      {
        title: t('app.kuaizhizao.reworkPositionPlanTemplate.colActive'),
        dataIndex: 'is_active',
        key: 'is_active',
        render: (_, record) => renderIsActiveTag(t, record.is_active),
      },
      {
        title: t('app.kuaizhizao.reworkPositionPlanTemplate.colTotalItems'),
        dataIndex: 'total_items',
        key: 'total_items',
      },
      {
        title: t('app.kuaizhizao.reworkPositionPlanTemplate.colRemarks'),
        dataIndex: 'remarks',
        key: 'remarks',
        span: 2,
      },
    ],
    [t],
  );

  const itemColumns = useMemo<ColumnsType>(
    () => [
      {
        title: t('app.kuaizhizao.reworkOrder.colSequence'),
        dataIndex: 'sequence',
        width: 72,
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item name={[index, 'sequence']} style={{ marginBottom: 0 }}>
            <InputNumber size="small" min={1} style={{ width: '100%' }} />
          </AntForm.Item>
        ),
      },
      {
        title: t('app.kuaizhizao.reworkOrder.colStationName'),
        dataIndex: 'station_name',
        width: 140,
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item
            name={[index, 'station_name']}
            rules={[{ required: true, message: t('common.required') }]}
            style={{ marginBottom: 0 }}
          >
            <Input size="small" />
          </AntForm.Item>
        ),
      },
      {
        title: t('app.kuaizhizao.reworkOrder.colSectionName'),
        dataIndex: 'section_name',
        width: 120,
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item name={[index, 'section_name']} style={{ marginBottom: 0 }}>
            <Input size="small" />
          </AntForm.Item>
        ),
      },
      {
        title: t('app.kuaizhizao.reworkOrder.colStationCode'),
        dataIndex: 'station_code',
        width: 120,
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item name={[index, 'station_code']} style={{ marginBottom: 0 }}>
            <Input size="small" />
          </AntForm.Item>
        ),
      },
      {
        title: t('app.kuaizhizao.reworkOrder.colPlannedHeadcount'),
        dataIndex: 'planned_headcount',
        width: 96,
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item name={[index, 'planned_headcount']} style={{ marginBottom: 0 }}>
            <InputNumber size="small" min={0} style={{ width: '100%' }} />
          </AntForm.Item>
        ),
      },
      {
        title: t('app.kuaizhizao.reworkOrder.colStandardMinutes'),
        dataIndex: 'standard_minutes',
        width: 110,
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item name={[index, 'standard_minutes']} style={{ marginBottom: 0 }}>
            <InputNumber size="small" min={0} style={{ width: '100%' }} />
          </AntForm.Item>
        ),
      },
      {
        title: t('app.kuaizhizao.reworkOrder.colOwner'),
        dataIndex: 'owner_user_name',
        width: 110,
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item name={[index, 'owner_user_name']} style={{ marginBottom: 0 }}>
            <Input size="small" />
          </AntForm.Item>
        ),
      },
    ],
    [t],
  );

  return (
    <ListPageTemplate>
      <UniTable<ReworkPositionPlanTemplate>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        permissionResource={RESOURCE}
        columnPersistenceId="apps.kuaizhizao.pages.production-execution.rework-position-plan-templates-v1"
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onSelectedRowKeysChange={setSelectedRowKeys}
        onTableDataChange={(rows) => {
          tableRowsRef.current = rows;
        }}
        showCreateButton
        createButtonText={t('app.kuaizhizao.reworkPositionPlanTemplate.createButton')}
        onCreate={openCreate}
        request={async (params) => {
          const res = await reworkPositionPlanTemplateApi.list({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            keyword: params.keyword || params.template_name,
            product_line_code: params.product_line_code,
            is_active:
              params.is_active === true || params.is_active === 'true'
                ? true
                : params.is_active === false || params.is_active === 'false'
                  ? false
                  : undefined,
          });
          return { data: res.data || [], success: true, total: res.total || 0 };
        }}
      />

      <MasterDataDetailDrawer
        title={detail?.template_name || t('app.kuaizhizao.reworkPositionPlanTemplate.detailTitle')}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        detail={detail}
        detailColumns={detailColumns}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          if (detailRetryIdRef.current != null) void loadDetail(detailRetryIdRef.current);
        }}
        extra={buildDetailDrawerEditExtra(t, Boolean(perms.canUpdate), () => {
          if (!detail) return;
          setDetailOpen(false);
          void openEdit(detail);
        })}
        linesTitle={t('app.kuaizhizao.reworkPositionPlanTemplate.sectionItems')}
        lines={
          <Table
            size="small"
            pagination={false}
            rowKey={(row, i) => String((row as any).id ?? i)}
            dataSource={detail?.items || []}
            columns={[
              {
                title: t('app.kuaizhizao.reworkOrder.colSequence'),
                dataIndex: 'sequence',
                width: 72,
              },
              {
                title: t('app.kuaizhizao.reworkOrder.colStationName'),
                dataIndex: 'station_name',
              },
              {
                title: t('app.kuaizhizao.reworkOrder.colSectionName'),
                dataIndex: 'section_name',
              },
              {
                title: t('app.kuaizhizao.reworkOrder.colStationCode'),
                dataIndex: 'station_code',
              },
              {
                title: t('app.kuaizhizao.reworkOrder.colPlannedHeadcount'),
                dataIndex: 'planned_headcount',
              },
              {
                title: t('app.kuaizhizao.reworkOrder.colStandardMinutes'),
                dataIndex: 'standard_minutes',
              },
              {
                title: t('app.kuaizhizao.reworkOrder.colOwner'),
                dataIndex: 'owner_user_name',
              },
            ]}
            locale={{ emptyText: t('app.kuaizhizao.salesOrder.emptyItems') }}
          />
        }
      />

      <FormModalTemplate
        key={editing?.id ?? 'create'}
        title={
          editing
            ? t('app.kuaizhizao.reworkPositionPlanTemplate.editTitle')
            : t('app.kuaizhizao.reworkPositionPlanTemplate.createTitle')
        }
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditing(null);
        }}
        formRef={formRef}
        grid={false}
        width={MODAL_CONFIG.LARGE_WIDTH}
        modalProps={{ destroyOnHidden: true }}
        initialValues={
          editing
            ? {
                template_code: editing.template_code,
                template_name: editing.template_name,
                product_line_code: editing.product_line_code,
                is_active: editing.is_active ?? true,
                remarks: editing.remarks,
                items: (editing.items || []).map((item, idx) => ({
                  ...item,
                  line_no: item.line_no || idx + 1,
                  sequence: item.sequence || idx + 1,
                })),
              }
            : { is_active: true, items: [] }
        }
        onFinish={async (values) => {
          const payload = {
            template_code: values.template_code || undefined,
            template_name: values.template_name,
            product_line_code: values.product_line_code || undefined,
            is_active: values.is_active ?? true,
            remarks: values.remarks,
            items: (values.items || []).map((row: any, idx: number) => ({
              line_no: row.line_no || idx + 1,
              sequence: row.sequence || idx + 1,
              station_name: row.station_name,
              section_name: row.section_name,
              station_code: row.station_code,
              planned_headcount: row.planned_headcount,
              standard_minutes: row.standard_minutes,
              planned_qty: row.planned_qty,
              owner_user_name: row.owner_user_name,
              remarks: row.remarks,
            })),
          };
          try {
            if (editing?.id) {
              await reworkPositionPlanTemplateApi.update(editing.id, payload);
              messageApi.success(t('app.kuaizhizao.reworkPositionPlanTemplate.updateSuccess'));
            } else {
              await reworkPositionPlanTemplateApi.create(payload);
              messageApi.success(t('app.kuaizhizao.reworkPositionPlanTemplate.createSuccess'));
            }
            setModalOpen(false);
            actionRef.current?.reload();
            return true;
          } catch (error) {
            messageApi.error(getApiErrorMessage(error));
            return false;
          }
        }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormText
              name="template_code"
              label={t('app.kuaizhizao.reworkPositionPlanTemplate.colCode')}
              disabled={Boolean(editing)}
              placeholder={t('app.kuaizhizao.reworkPositionPlanTemplate.codeAuto')}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="template_name"
              label={t('app.kuaizhizao.reworkPositionPlanTemplate.colName')}
              rules={[{ required: true }]}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="product_line_code"
              label={t('app.kuaizhizao.reworkPositionPlanTemplate.colProductLine')}
            />
          </Col>
        </Row>
        <UniTableDetail
          name="items"
          title={t('app.kuaizhizao.reworkPositionPlanTemplate.sectionItems')}
          required={false}
          columns={itemColumns}
          addText={t('app.kuaizhizao.reworkOrder.addPositionPlan')}
          initialValue={() => {
            const items = formRef.current?.getFieldValue('items') || [];
            return {
              ...EMPTY_POSITION_ITEM,
              sequence: items.length + 1,
            };
          }}
          tableProps={{
            size: 'small',
            style: { width: '100%', margin: 0 },
          }}
        />
        <Row gutter={16}>
          <Col span={24}>
            <ProFormTextArea
              name="remarks"
              label={t('app.kuaizhizao.reworkPositionPlanTemplate.colRemarks')}
              fieldProps={{ rows: 2 }}
            />
          </Col>
          <Col span={12}>
            <ProFormSwitch
              name="is_active"
              label={t('app.kuaizhizao.reworkPositionPlanTemplate.colActive')}
            />
          </Col>
        </Row>
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default ReworkPositionPlanTemplatesPage;
