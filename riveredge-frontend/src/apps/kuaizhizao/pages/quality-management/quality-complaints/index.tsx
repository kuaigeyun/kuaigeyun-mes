/**
 * 质量投诉列表（R-11 WP-11B 单头壳）
 */
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { useNavigate } from 'react-router-dom';
import { App, Button, Col, Descriptions, Input, Modal, Result, Row, Typography } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { UniTableStackedPrimaryCell } from '../../../../../components/uni-table/stackedPrimaryColumn';
import { rowActionKind } from '../../../../../components/uni-action';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
  detailDrawerBasicColumn,
  useDetailDrawerDescriptionItems,
} from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { formatDateTimeBySiteSetting, todaySiteDateString } from '../../../../../utils/format';
import { downloadRecordsAsXlsx, type ExportXlsxColumn } from '../../../../../utils/exportRecordsXlsx';
import { fetchAllListItems } from '../../../../../utils/fetchAllListPages';
import { renderDocumentStatusTag } from '../../../../../utils/documentLifecycleStatusTag';
import { MarkerTag } from '../../../../../constants/statusBadges';
import {
  alignDescriptionColumns,
  alignProColumns,
  GLOBAL_DOC_DETAIL_BASIC_FIELD_RANK,
  GLOBAL_DOC_LIST_FIELD_RANK,
} from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import {
  buildComplaintExtensionPayload,
  flattenComplaintForForm,
  getComplaintExtensionValue,
} from '../../../utils/qualityComplaintExtension';
import { pickListSearchKeyword, pickSearchString } from '../../../../../utils/tableQueryKey';
import {
  qualityComplaintApi,
  type QualityComplaint,
  type QualityComplaintBusinessType,
  type QualityComplaintStatus,
} from '../../../services/quality-complaint';

const RESOURCE = 'kuaizhizao:quality-complaint';

const BUSINESS_TYPES: QualityComplaintBusinessType[] = [
  'iqc_incoming',
  'line_incoming',
  'pqc',
  'oqc',
  'customer',
];

const DEFECT_CATEGORIES = ['performance', 'structure', 'appearance', 'other'] as const;

const STATUS_KEYS: QualityComplaintStatus[] = [
  'draft',
  'pending',
  'processing',
  'closed',
  'rejected',
  'revoked',
];

const EXPORT_COLUMNS: ExportXlsxColumn[] = [
  { key: 'code', title: '投诉单号' },
  { key: 'title', title: '标题' },
  { key: 'business_type_label', title: '类型' },
  { key: 'defect_category_label', title: '缺陷分类' },
  { key: 'status_label', title: '状态' },
  { key: 'material_code', title: '物料编码' },
  { key: 'material_name', title: '物料名称' },
  { key: 'batch_no', title: '批次' },
  { key: 'supplier_name', title: '供应商' },
  { key: 'customer_name', title: '客户' },
  { key: 'due_at', title: '截止日' },
  { key: 'created_by_name', title: '创建人' },
  { key: 'updated_by_name', title: '更新人' },
];

const QualityComplaintsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>();
  const tableRowsRef = useRef<QualityComplaint[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<QualityComplaint | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<QualityComplaint | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<QualityComplaint | null>(null);
  const [revokeReason, setRevokeReason] = useState('');

  const statusEnum = useMemo(
    () =>
      Object.fromEntries(
        STATUS_KEYS.map((key) => [
          key,
          { text: t(`app.kuaizhizao.qualityComplaint.status.${key}`) },
        ]),
      ),
    [t],
  );

  const typeOptions = useMemo(
    () =>
      BUSINESS_TYPES.map((value) => ({
        value,
        label: t(`app.kuaizhizao.qualityComplaint.businessType.${value}`),
      })),
    [t],
  );

  const defectOptions = useMemo(
    () =>
      DEFECT_CATEGORIES.map((value) => ({
        value,
        label: t(`app.kuaizhizao.qualityComplaint.defectCategory.${value}`),
      })),
    [t],
  );

  useNewShortcut(() => {
    if (perms.canCreate) {
      setEditing(null);
      setModalOpen(true);
    }
  });

  const openDetail = async (record: QualityComplaint) => {
    if (!record.id) return;
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);
    try {
      setDetail(await qualityComplaintApi.get(record.id));
    } catch (e) {
      setDetailError(getApiErrorMessage(e));
    } finally {
      setDetailLoading(false);
    }
  };

  const columns: ProColumns<QualityComplaint>[] = useMemo(
    () =>
      alignProColumns(
        [
          {
            title: t('app.kuaizhizao.qualityComplaint.colTitle'),
            dataIndex: 'title',
            key: 'title',
            minWidth: 200,
            uniTableRemainderFlex: true,
            uniTablePrimaryFlex: true,
            resizable: false,
            ellipsis: false,
            render: (_, record) => (
              <UniTableStackedPrimaryCell
                primary={record.title || '-'}
                secondary={record.code || '-'}
              />
            ),
          },
          {
            title: t('app.kuaizhizao.qualityComplaint.colBusinessType'),
            dataIndex: 'business_type',
            key: 'quality_complaint_business_type',
            valueType: 'select',
            fieldProps: { options: typeOptions },
            width: 152,
            minWidth: 152,
            uniTableKeepWidth: true,
            resizable: false,
            align: 'center',
            render: (_, record) => (
              <MarkerTag color="blue">
                {t(`app.kuaizhizao.qualityComplaint.businessType.${record.business_type || 'iqc_incoming'}`)}
              </MarkerTag>
            ),
          },
          {
            title: t('app.kuaizhizao.qualityComplaint.colDefectCategory'),
            dataIndex: 'defect_category',
            key: 'quality_complaint_defect_category',
            valueType: 'select',
            fieldProps: { options: defectOptions, allowClear: true },
            ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
            render: (_, record) =>
              record.defect_category ? (
                <MarkerTag color="geekblue">
                  {t(`app.kuaizhizao.qualityComplaint.defectCategory.${record.defect_category}`)}
                </MarkerTag>
              ) : (
                '-'
              ),
          },
          {
            title: t('app.kuaizhizao.qualityComplaint.colMaterial'),
            dataIndex: 'material_name',
            key: 'quality_complaint_material',
            hideInSearch: true,
            width: 160,
            minWidth: 160,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: true,
            render: (_, r) =>
              [r.material_code, r.material_name].filter(Boolean).join(' ') || '-',
          },
          {
            title: t('app.kuaizhizao.qualityComplaint.colBatchNo'),
            dataIndex: 'batch_no',
            hideInSearch: true,
            width: 120,
            minWidth: 120,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: true,
          },
          {
            title: t('app.kuaizhizao.qualityComplaint.colDueAt'),
            dataIndex: 'due_at',
            hideInSearch: true,
            width: 168,
            minWidth: 168,
            uniTableKeepWidth: true,
            resizable: false,
            render: (v) => formatDateTimeBySiteSetting(v),
          },
          {
            title: t('common.status'),
            dataIndex: 'status',
            key: 'lifecycle',
            valueType: 'select',
            valueEnum: statusEnum,
            fixed: 'right',
            render: (_, record) =>
              renderDocumentStatusTag(
                t(`app.kuaizhizao.qualityComplaint.status.${record.status || 'draft'}`),
                record.status || 'draft',
              ),
          },
          ...buildDocumentAuditColumns<QualityComplaint>(t),
          {
            title: t('common.actions'),
            key: 'option',
            fixed: 'right',
            hideInSearch: true,
            render: (_, record) => [
              <Button key="view" {...rowActionKind('read')} onClick={() => void openDetail(record)}>
                {t('common.detail')}
              </Button>,
              record.status === 'draft' || record.status === 'rejected' ? (
                <Button
                  key="edit"
                  {...rowActionKind('update')}
                  disabled={!perms.canUpdate}
                  onClick={() => {
                    setEditing(record);
                    setModalOpen(true);
                  }}
                >
                  {t('common.edit')}
                </Button>
              ) : null,
              record.status === 'draft' || record.status === 'rejected' ? (
                <Button
                  key="submit"
                  {...rowActionKind('submit')}
                  disabled={!perms.canAction('submit')}
                  onClick={async () => {
                    try {
                      await qualityComplaintApi.submit(String(record.id));
                      messageApi.success(t('app.kuaizhizao.qualityComplaint.submitSuccess'));
                      actionRef.current?.reload();
                    } catch (e) {
                      messageApi.error(getApiErrorMessage(e));
                    }
                  }}
                >
                  {t('app.kuaizhizao.qualityComplaint.actionSubmit')}
                </Button>
              ) : null,
              record.status === 'processing' ? (
                <Button
                  key="close"
                  {...rowActionKind('close')}
                  disabled={!perms.canAction('close')}
                  onClick={async () => {
                    try {
                      await qualityComplaintApi.close(String(record.id));
                      messageApi.success(t('app.kuaizhizao.qualityComplaint.closeSuccess'));
                      actionRef.current?.reload();
                    } catch (e) {
                      messageApi.error(getApiErrorMessage(e));
                    }
                  }}
                >
                  {t('app.kuaizhizao.qualityComplaint.actionClose')}
                </Button>
              ) : null,
              record.status === 'pending' || record.status === 'processing' ? (
                <Button
                  key="revoke"
                  {...rowActionKind('revoke')}
                  disabled={!perms.canAction('revoke')}
                  onClick={() => {
                    setRevokeTarget(record);
                    setRevokeReason('');
                    setRevokeOpen(true);
                  }}
                >
                  {t('app.kuaizhizao.qualityComplaint.actionRevoke')}
                </Button>
              ) : null,
            ],
          },
        ],
        GLOBAL_DOC_LIST_FIELD_RANK,
      ),
    [t, typeOptions, defectOptions, statusEnum, perms, messageApi],
  );

  const detailColumns: ProDescriptionsItemProps<QualityComplaint>[] = useMemo(
    () =>
      alignDescriptionColumns(
        [
          { title: t('app.kuaizhizao.qualityComplaint.colCode'), dataIndex: 'code' },
          { title: t('app.kuaizhizao.qualityComplaint.colTitle'), dataIndex: 'title' },
          {
            title: t('app.kuaizhizao.qualityComplaint.colBusinessType'),
            dataIndex: 'business_type',
            render: (_, r) =>
              t(`app.kuaizhizao.qualityComplaint.businessType.${r.business_type || 'iqc_incoming'}`),
          },
          {
            title: t('app.kuaizhizao.qualityComplaint.colDefectCategory'),
            dataIndex: 'defect_category',
            render: (_, r) =>
              r.defect_category
                ? t(`app.kuaizhizao.qualityComplaint.defectCategory.${r.defect_category}`)
                : '-',
          },
          {
            title: t('common.status'),
            dataIndex: 'status',
            render: (_, r) => t(`app.kuaizhizao.qualityComplaint.status.${r.status || 'draft'}`),
          },
          { title: t('app.kuaizhizao.qualityComplaint.colMaterialCode'), dataIndex: 'material_code' },
          { title: t('app.kuaizhizao.qualityComplaint.colMaterialName'), dataIndex: 'material_name' },
          { title: t('app.kuaizhizao.qualityComplaint.colBatchNo'), dataIndex: 'batch_no' },
          { title: t('app.kuaizhizao.qualityComplaint.colSupplier'), dataIndex: 'supplier_name' },
          { title: t('app.kuaizhizao.qualityComplaint.colCustomer'), dataIndex: 'customer_name' },
          {
            title: t('app.kuaizhizao.qualityComplaint.colEightD'),
            dataIndex: 'eight_d_report_id',
            render: (_, r) =>
              r.eight_d_report_id ? (
                <Typography.Link
                  onClick={() =>
                    navigate(`/apps/kuaizhizao/quality-management/eight-d-reports/${r.eight_d_report_id}`)
                  }
                >
                  {t('app.kuaizhizao.qualityComplaint.openEightD')} #{r.eight_d_report_id}
                </Typography.Link>
              ) : (
                '-'
              ),
          },
          {
            title: t('app.kuaizhizao.qualityComplaint.colDueAt'),
            dataIndex: 'due_at',
            render: (v) => formatDateTimeBySiteSetting(v),
          },
          { title: t('app.kuaizhizao.qualityComplaint.colDescription'), dataIndex: 'description', span: 2 },
          {
            title: t('app.kuaizhizao.qualityComplaint.colInspectionQty'),
            dataIndex: 'inspection_qty',
            render: (_, r) => {
              const v = getComplaintExtensionValue(r, 'inspection_qty');
              return v != null && v !== '' ? String(v) : '-';
            },
          },
          {
            title: t('app.kuaizhizao.qualityComplaint.colDefectQty'),
            dataIndex: 'defect_qty',
            render: (_, r) => {
              const v = getComplaintExtensionValue(r, 'defect_qty');
              return v != null && v !== '' ? String(v) : '-';
            },
          },
          {
            title: t('app.kuaizhizao.qualityComplaint.colDefectRatePct'),
            dataIndex: 'defect_rate_pct',
            render: (_, r) => {
              const v = getComplaintExtensionValue(r, 'defect_rate_pct');
              return v != null && v !== '' ? `${v}%` : '-';
            },
          },
          {
            title: t('app.kuaizhizao.qualityComplaint.colUsedQty'),
            dataIndex: 'used_qty',
            render: (_, r) => {
              const v = getComplaintExtensionValue(r, 'used_qty');
              return v != null && v !== '' ? String(v) : '-';
            },
          },
          {
            title: t('app.kuaizhizao.qualityComplaint.colRootCauseAnalysis'),
            dataIndex: 'root_cause_analysis',
            span: 2,
            render: (_, r) => {
              const v = getComplaintExtensionValue(r, 'root_cause_analysis');
              return v != null && v !== '' ? String(v) : '-';
            },
          },
          {
            title: t('app.kuaizhizao.qualityComplaint.colCorrectiveAction'),
            dataIndex: 'corrective_action',
            span: 2,
            render: (_, r) => {
              const v = getComplaintExtensionValue(r, 'corrective_action');
              return v != null && v !== '' ? String(v) : '-';
            },
          },
          {
            title: t('app.kuaizhizao.qualityComplaint.colContainmentAction'),
            dataIndex: 'containment_action',
            span: 2,
            render: (_, r) => {
              const v = getComplaintExtensionValue(r, 'containment_action');
              return v != null && v !== '' ? String(v) : '-';
            },
          },
          {
            title: t('app.kuaizhizao.qualityComplaint.colSupplierResponse'),
            dataIndex: 'supplier_response',
            span: 2,
          },
          { title: t('common.remark'), dataIndex: 'remarks', span: 2 },
        ],
        GLOBAL_DOC_DETAIL_BASIC_FIELD_RANK,
      ),
    [t, navigate],
  );

  const detailItems = useDetailDrawerDescriptionItems(detailColumns, detail, 'quality_complaint');

  return (
    <ListPageTemplate>
      <UniTable<QualityComplaint>
        columnPersistenceId="apps.kuaizhizao.pages.quality-management.quality-complaints-width-v4"
        showAdvancedSearch
        skipFuzzyPinyinClientFilter
        permissionResource={RESOURCE}
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        onTableDataChange={(rows) => {
          tableRowsRef.current = rows;
        }}
        showCreateButton={perms.canCreate}
        createButtonText={t('app.kuaizhizao.qualityComplaint.createButton')}
        onCreate={() => {
          setEditing(null);
          setModalOpen(true);
        }}
        showDeleteButton={perms.canDelete}
        onDelete={async (keys) => {
          for (const key of keys) {
            await qualityComplaintApi.delete(String(key));
          }
          messageApi.success(t('common.deleteSuccess'));
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        }}
        showExportButton={perms.canExport}
        onExport={async () => {
          try {
            const items = await fetchAllListItems(async ({ skip, limit }) => {
              const res = await qualityComplaintApi.list({
                skip,
                limit,
                include_export_masked: false,
              });
              return { items: res.data || [], total: res.total || 0 };
            });
            const rows = items.map((row) => ({
              ...row,
              business_type_label: t(
                `app.kuaizhizao.qualityComplaint.businessType.${row.business_type || 'iqc_incoming'}`,
              ),
              defect_category_label: row.defect_category
                ? t(`app.kuaizhizao.qualityComplaint.defectCategory.${row.defect_category}`)
                : '',
              status_label: t(`app.kuaizhizao.qualityComplaint.status.${row.status || 'draft'}`),
              due_at: formatDateTimeBySiteSetting(row.due_at),
            }));
            downloadRecordsAsXlsx(
              rows,
              EXPORT_COLUMNS,
              `quality-complaints-${todaySiteDateString()}`,
            );
          } catch (e) {
            messageApi.error(getApiErrorMessage(e, t('common.exportFailed')));
          }
        }}
        request={async (params, _sort, _filter, searchFormValues) => {
          const res = await qualityComplaintApi.list({
            skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
            limit: params.pageSize ?? 20,
            keyword: pickListSearchKeyword(searchFormValues),
            status: pickSearchString(searchFormValues, 'status'),
            business_type: pickSearchString(searchFormValues, 'business_type'),
            defect_category: pickSearchString(searchFormValues, 'defect_category'),
          });
          return { data: res.data || [], success: true, total: res.total || 0 };
        }}
      />

      <FormModalTemplate
        title={
          editing
            ? t('app.kuaizhizao.qualityComplaint.editTitle')
            : t('app.kuaizhizao.qualityComplaint.createTitle')
        }
        open={modalOpen}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        grid={false}
        initialValues={
          editing
            ? flattenComplaintForForm(editing)
            : {
                business_type: 'iqc_incoming',
                sla_workdays: 5,
              }
        }
        onClose={() => setModalOpen(false)}
        onFinish={async (values) => {
          try {
            const extension_payload = buildComplaintExtensionPayload(values);
            const {
              inspection_qty: _iq,
              defect_qty: _dq,
              defect_rate_pct: _dr,
              used_qty: _uq,
              root_cause_analysis: _rc,
              corrective_action: _ca,
              containment_action: _co,
              ...payload
            } = values;
            const body = { ...payload, extension_payload };
            if (editing?.id) {
              await qualityComplaintApi.update(editing.id, body);
              messageApi.success(t('common.updateSuccess'));
            } else {
              await qualityComplaintApi.create(body);
              messageApi.success(t('common.createSuccess'));
            }
            setModalOpen(false);
            actionRef.current?.reload();
          } catch (e) {
            messageApi.error(getApiErrorMessage(e));
            throw e;
          }
        }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormText
              name="title"
              label={t('app.kuaizhizao.qualityComplaint.colTitle')}
              rules={[{ required: true }]}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="business_type"
              label={t('app.kuaizhizao.qualityComplaint.colBusinessType')}
              options={typeOptions}
              rules={[{ required: true }]}
              disabled={Boolean(editing && editing.status !== 'draft')}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSelect
              name="defect_category"
              label={t('app.kuaizhizao.qualityComplaint.colDefectCategory')}
              options={defectOptions}
              allowClear
            />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="eight_d_report_id"
              label={t('app.kuaizhizao.qualityComplaint.colEightD')}
              min={1}
              fieldProps={{ precision: 0 }}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}>
            <ProFormText name="material_code" label={t('app.kuaizhizao.qualityComplaint.colMaterialCode')} />
          </Col>
          <Col span={8}>
            <ProFormText name="material_name" label={t('app.kuaizhizao.qualityComplaint.colMaterialName')} />
          </Col>
          <Col span={8}>
            <ProFormText name="batch_no" label={t('app.kuaizhizao.qualityComplaint.colBatchNo')} />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}>
            <ProFormText name="supplier_name" label={t('app.kuaizhizao.qualityComplaint.colSupplier')} />
          </Col>
          <Col span={8}>
            <ProFormText name="customer_name" label={t('app.kuaizhizao.qualityComplaint.colCustomer')} />
          </Col>
          <Col span={8}>
            <ProFormDigit
              name="sla_workdays"
              label={t('app.kuaizhizao.qualityComplaint.colSlaWorkdays')}
              min={1}
              max={365}
            />
          </Col>
        </Row>
        <ProFormTextArea name="description" label={t('app.kuaizhizao.qualityComplaint.colDescription')} />
        <Row gutter={16}>
          <Col span={8}>
            <ProFormDigit
              name="inspection_qty"
              label={t('app.kuaizhizao.qualityComplaint.colInspectionQty')}
              min={0}
              fieldProps={{ precision: 4, style: { width: '100%' } }}
            />
          </Col>
          <Col span={8}>
            <ProFormDigit
              name="defect_qty"
              label={t('app.kuaizhizao.qualityComplaint.colDefectQty')}
              min={0}
              fieldProps={{ precision: 4, style: { width: '100%' } }}
            />
          </Col>
          <Col span={8}>
            <ProFormDigit
              name="used_qty"
              label={t('app.kuaizhizao.qualityComplaint.colUsedQty')}
              min={0}
              fieldProps={{ precision: 4, style: { width: '100%' } }}
            />
          </Col>
        </Row>
        <ProFormTextArea
          name="root_cause_analysis"
          label={t('app.kuaizhizao.qualityComplaint.colRootCauseAnalysis')}
        />
        <ProFormTextArea
          name="corrective_action"
          label={t('app.kuaizhizao.qualityComplaint.colCorrectiveAction')}
        />
        <ProFormTextArea
          name="containment_action"
          label={t('app.kuaizhizao.qualityComplaint.colContainmentAction')}
        />
        {editing?.status === 'processing' ? (
          <ProFormTextArea
            name="supplier_response"
            label={t('app.kuaizhizao.qualityComplaint.colSupplierResponse')}
          />
        ) : null}
        <ProFormTextArea name="remarks" label={t('common.remark')} />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={detail?.code || t('app.kuaizhizao.qualityComplaint.title')}
        open={detailOpen}
        width={DRAWER_CONFIG.HALF_WIDTH}
        loading={detailLoading}
        onClose={() => setDetailOpen(false)}
        basic={
          detailError ? (
            <Result
              status="error"
              title={t('common.loadFailed')}
              subTitle={detailError}
              extra={
                <Button
                  type="primary"
                  onClick={() => detail?.id && void openDetail(detail)}
                >
                  {t('common.retry')}
                </Button>
              }
            />
          ) : detail ? (
            <Descriptions
              column={detailDrawerBasicColumn(false)}
              size="small"
              items={detailItems}
            />
          ) : undefined
        }
      />

      <Modal
        title={t('app.kuaizhizao.qualityComplaint.actionRevoke')}
        open={revokeOpen}
        destroyOnHidden
        onCancel={() => setRevokeOpen(false)}
        onOk={async () => {
          if (!revokeTarget?.id) return;
          if (!revokeReason.trim()) {
            messageApi.error(t('app.kuaizhizao.qualityComplaint.revokeReasonRequired'));
            return;
          }
          try {
            await qualityComplaintApi.revoke(revokeTarget.id, revokeReason.trim());
            messageApi.success(t('app.kuaizhizao.qualityComplaint.revokeSuccess'));
            setRevokeOpen(false);
            actionRef.current?.reload();
          } catch (e) {
            messageApi.error(getApiErrorMessage(e));
          }
        }}
      >
        <Input.TextArea
          rows={4}
          value={revokeReason}
          onChange={(e) => setRevokeReason(e.target.value)}
          placeholder={t('app.kuaizhizao.qualityComplaint.revokeReasonPlaceholder')}
        />
      </Modal>
    </ListPageTemplate>
  );
};

export default QualityComplaintsPage;
