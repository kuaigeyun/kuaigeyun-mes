import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Col, Empty, Input, InputNumber, Row, Space, Table } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import CodeField from '../../../../../components/code-field';
import { UniTable } from '../../../../../components/uni-table';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import PermissionGuard from '../../../../../components/permission/PermissionGuard';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { alignProColumns, GLOBAL_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { faiOrderApi, FaiCharacteristic, FaiOrder } from '../../../services/fai-order';
import { inspectionPlanApi } from '../../../services/production';
import { renderFaiConclusionTag, renderFaiStatusTag } from '../components/qualityMeta';
import { faiBalloonPath } from './paths';

const RESOURCE = 'kuaizhizao:quality-management-fai-orders';

const TRIGGER_OPTIONS = [
  { value: 'new_part', labelKey: 'app.kuaizhizao.quality.fai.trigger.newPart' },
  { value: 'ecn', labelKey: 'app.kuaizhizao.quality.fai.trigger.ecn' },
  { value: 'changeover', labelKey: 'app.kuaizhizao.quality.fai.trigger.changeover' },
  { value: 'restart', labelKey: 'app.kuaizhizao.quality.fai.trigger.restart' },
  { value: 'customer', labelKey: 'app.kuaizhizao.quality.fai.trigger.customer' },
] as const;

const STATUS_OPTIONS = [
  { value: 'draft', labelKey: 'app.kuaizhizao.quality.fai.status.draft' },
  { value: 'in_progress', labelKey: 'app.kuaizhizao.quality.fai.status.inProgress' },
  { value: 'submitted', labelKey: 'app.kuaizhizao.quality.fai.status.submitted' },
  { value: 'approved', labelKey: 'app.kuaizhizao.quality.fai.status.approved' },
  { value: 'rejected', labelKey: 'app.kuaizhizao.quality.fai.status.rejected' },
  { value: 'closed', labelKey: 'app.kuaizhizao.quality.fai.status.closed' },
] as const;

function emptyChar(seq: number): FaiCharacteristic {
  return {
    sequence: seq,
    balloon_no: String(seq),
    characteristic_name: '',
    judgment: 'pending',
  };
}

const FaiOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FaiOrder | null>(null);
  const [chars, setChars] = useState<FaiCharacteristic[]>([emptyChar(1)]);
  const [importPlanId, setImportPlanId] = useState<number | null>(null);
  const { canCreate, canUpdate, canDelete, canRead, canAction } = useResourcePermissions(RESOURCE);
  const navigate = useNavigate();
  const canSubmit = !!canAction?.('submit');
  const canApprove = !!canAction?.('approve');
  const canReject = !!canAction?.('reject');
  const canExport = !!canAction?.('export');

  const statusEnum = useMemo(
    () => Object.fromEntries(STATUS_OPTIONS.map((o) => [o.value, { text: t(o.labelKey) }])),
    [t],
  );

  const editable = !editing || ['draft', 'in_progress', 'rejected'].includes(editing.status);

  const openCreate = useCallback(() => {
    setEditing(null);
    setChars([emptyChar(1)]);
    setImportPlanId(null);
    setOpen(true);
    setTimeout(() => {
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({ trigger_reason: 'new_part', sample_size: 1, attachments: [] });
    }, 0);
  }, []);
  useNewShortcut(() => {
    if (canCreate) openCreate();
  });

  const openEdit = async (row: FaiOrder) => {
    const detail = await faiOrderApi.get(row.id);
    setEditing(detail);
    setChars(detail.characteristics?.length ? detail.characteristics : [emptyChar(1)]);
    setOpen(true);
    setTimeout(() => {
      formRef.current?.setFieldsValue({
        ...detail,
        attachments: mapAttachmentsToUploadList(detail.attachments as any),
      });
    }, 0);
  };

  const openBalloon = useCallback(
    (row: FaiOrder) => {
      navigate(faiBalloonPath(row.id));
    },
    [navigate],
  );

  const columns: ProColumns<FaiOrder>[] = useMemo(
    () =>
      alignProColumns(
        [
          {
            title: t('app.kuaizhizao.quality.fai.faiCode'),
            dataIndex: 'fai_code',
            width: 140,
            copyable: true,
            hideInSearch: true,
          },
          {
            title: t('app.kuaizhizao.quality.fai.title'),
            dataIndex: 'title',
            ellipsis: true,
            hideInSearch: true,
          },
          {
            title: t('app.kuaizhizao.quality.fai.keyword'),
            dataIndex: 'keyword',
            hideInTable: true,
          },
          {
            title: t('app.kuaizhizao.quality.fai.material'),
            dataIndex: 'material_code',
            width: 120,
            hideInSearch: true,
            render: (_, r) => r.material_code || r.part_number || '-',
          },
          {
            title: t('app.kuaizhizao.quality.fai.workOrder'),
            dataIndex: 'work_order_code',
            width: 120,
            hideInSearch: true,
          },
          {
            title: t('app.kuaizhizao.quality.fai.conclusion'),
            dataIndex: 'conclusion',
            width: 88,
            minWidth: 88,
            uniTableKeepWidth: true,
            hideInSearch: true,
            render: (_, r) => renderFaiConclusionTag(t, r.conclusion),
          },
          {
            title: t('app.kuaizhizao.quality.fai.status'),
            dataIndex: 'status',
            hideInTable: true,
            valueEnum: statusEnum,
          },
          {
            title: t('app.kuaizhizao.quality.fai.status'),
            key: 'lifecycle',
            dataIndex: 'status',
            fixed: 'right',
            hideInSearch: true,
            width: 96,
            minWidth: 96,
            uniTableKeepWidth: true,
            render: (_, r) => renderFaiStatusTag(t, r.status),
          },
          {
            title: t('common.actions'),
            key: 'action',
            valueType: 'option',
            fixed: 'right',
            render: (_, row) => [
              <Button
                key="view"
                {...rowActionKind(
                  canUpdate && ['draft', 'in_progress', 'rejected'].includes(row.status)
                    ? 'update'
                    : 'read',
                )}
                onClick={() => void openEdit(row)}
              >
                {canUpdate && ['draft', 'in_progress', 'rejected'].includes(row.status)
                  ? t('common.edit')
                  : t('common.view')}
              </Button>,
              canRead || canUpdate ? (
                <Button
                  key="balloon"
                  {...rowActionKind('update')}
                  {...rowActionLabelKeep()}
                  onClick={() => openBalloon(row)}
                >
                  {t('app.kuaizhizao.quality.fai.actions.balloon')}
                </Button>
              ) : null,
              canSubmit && ['draft', 'in_progress', 'rejected'].includes(row.status) ? (
                <Button
                  key="submit"
                  {...rowActionKind('submit')}
                  onClick={async () => {
                    await faiOrderApi.submit(row.id);
                    messageApi.success(t('app.kuaizhizao.quality.fai.messages.submitSuccess'));
                    actionRef.current?.reload();
                  }}
                >
                  {t('app.kuaizhizao.quality.fai.actions.submit')}
                </Button>
              ) : null,
              canApprove && row.status === 'submitted' ? (
                <Button
                  key="approve"
                  {...rowActionKind('approve')}
                  onClick={async () => {
                    await faiOrderApi.approve(row.id);
                    messageApi.success(t('app.kuaizhizao.quality.fai.messages.approveSuccess'));
                    actionRef.current?.reload();
                  }}
                >
                  {t('app.kuaizhizao.quality.fai.actions.approve')}
                </Button>
              ) : null,
              canReject && row.status === 'submitted' ? (
                <Button
                  key="reject"
                  {...rowActionKind('reject')}
                  onClick={async () => {
                    await faiOrderApi.reject(row.id);
                    messageApi.success(t('app.kuaizhizao.quality.fai.messages.rejectSuccess'));
                    actionRef.current?.reload();
                  }}
                >
                  {t('app.kuaizhizao.quality.fai.actions.reject')}
                </Button>
              ) : null,
              canExport ? (
                <Button
                  key="export"
                  {...rowActionKind('export')}
                  {...rowActionLabelKeep()}
                  onClick={async () => {
                    const fair = await faiOrderApi.fairExport(row.id);
                    const blob = new Blob([JSON.stringify(fair, null, 2)], {
                      type: 'application/json',
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${fair.fai_code || 'FAIR'}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  {t('app.kuaizhizao.quality.fai.actions.exportFair')}
                </Button>
              ) : null,
              canDelete && ['draft', 'rejected'].includes(row.status) ? (
                <Button
                  key="delete"
                  {...rowActionKind('delete')}
                  onClick={async () => {
                    await faiOrderApi.delete(row.id);
                    messageApi.success(t('common.deleteSuccess'));
                    actionRef.current?.reload();
                  }}
                >
                  {t('common.delete')}
                </Button>
              ) : null,
            ],
          },
        ],
        GLOBAL_DOC_LIST_FIELD_RANK,
      ),
    [
      canApprove,
      canDelete,
      canExport,
      canRead,
      canReject,
      canSubmit,
      canUpdate,
      messageApi,
      openBalloon,
      statusEnum,
      t,
    ],
  );

  const charColumns = [
    {
      title: t('app.kuaizhizao.quality.fai.balloonNo'),
      dataIndex: 'balloon_no',
      width: 88,
      render: (_: any, __: any, idx: number) => (
        <Input
          disabled={!editable}
          style={{ width: '100%' }}
          value={chars[idx]?.balloon_no}
          onChange={(e) => {
            const next = [...chars];
            next[idx] = { ...next[idx], balloon_no: e.target.value };
            setChars(next);
          }}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.quality.fai.characteristicName'),
      dataIndex: 'characteristic_name',
      width: 160,
      ellipsis: true,
      render: (_: any, __: any, idx: number) => (
        <Input
          disabled={!editable}
          style={{ width: '100%' }}
          value={chars[idx]?.characteristic_name}
          onChange={(e) => {
            const next = [...chars];
            next[idx] = { ...next[idx], characteristic_name: e.target.value };
            setChars(next);
          }}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.quality.fai.nominal'),
      dataIndex: 'nominal_value',
      width: 100,
      render: (_: any, __: any, idx: number) => (
        <InputNumber
          disabled={!editable}
          style={{ width: '100%' }}
          value={chars[idx]?.nominal_value as number | null | undefined}
          onChange={(v) => {
            const next = [...chars];
            next[idx] = { ...next[idx], nominal_value: v as number | null };
            setChars(next);
          }}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.quality.fai.upperTol'),
      dataIndex: 'upper_tolerance',
      width: 90,
      render: (_: any, __: any, idx: number) => (
        <InputNumber
          disabled={!editable}
          style={{ width: '100%' }}
          value={chars[idx]?.upper_tolerance as number | null | undefined}
          onChange={(v) => {
            const next = [...chars];
            next[idx] = { ...next[idx], upper_tolerance: v as number | null };
            setChars(next);
          }}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.quality.fai.lowerTol'),
      dataIndex: 'lower_tolerance',
      width: 90,
      render: (_: any, __: any, idx: number) => (
        <InputNumber
          disabled={!editable}
          style={{ width: '100%' }}
          value={chars[idx]?.lower_tolerance as number | null | undefined}
          onChange={(v) => {
            const next = [...chars];
            next[idx] = { ...next[idx], lower_tolerance: v as number | null };
            setChars(next);
          }}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.quality.fai.measured'),
      dataIndex: 'measured_value',
      width: 100,
      render: (_: any, __: any, idx: number) => (
        <InputNumber
          disabled={!editable}
          style={{ width: '100%' }}
          value={chars[idx]?.measured_value as number | null | undefined}
          onChange={(v) => {
            const next = [...chars];
            next[idx] = { ...next[idx], measured_value: v as number | null };
            setChars(next);
          }}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.quality.fai.gaugeCode'),
      dataIndex: 'gauge_code',
      width: 120,
      render: (_: any, __: any, idx: number) => (
        <Input
          disabled={!editable}
          style={{ width: '100%' }}
          value={chars[idx]?.gauge_code}
          onChange={(e) => {
            const next = [...chars];
            next[idx] = { ...next[idx], gauge_code: e.target.value };
            setChars(next);
          }}
        />
      ),
    },
    {
      title: t('common.actions'),
      key: 'operation',
      width: 48,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (_: any, __: any, idx: number) =>
        editable ? (
          <Button
            type="link"
            danger
            size="small"
            icon={<DeleteOutlined />}
            aria-label={t('common.delete')}
            onClick={() => setChars(chars.filter((_, i) => i !== idx))}
          />
        ) : null,
    },
  ];

  return (
    <PermissionGuard
      permission="kuaizhizao:quality-management-fai-orders:read"
      fallback={<Empty description={t('app.kuaizhizao.quality.fai.noPermission')} style={{ marginTop: 120 }} />}
    >
      <ListPageTemplate>
        <UniTable<FaiOrder>
          headerTitle={t('app.kuaizhizao.menu.quality-management.fai-orders')}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          columnPersistenceId="apps.kuaizhizao.pages.quality-management.fai-orders.list-v3"
          toolBarRender={() =>
            canCreate
              ? [
                  <Button key="add" type="primary" onClick={openCreate}>
                    {withSingleNewShortcutHint(t('app.kuaizhizao.quality.fai.createOrder'))}
                  </Button>,
                ]
              : []
          }
          request={async (params) => {
            const pageSize = params.pageSize || 20;
            const skip = ((params.current || 1) - 1) * pageSize;
            const res = await faiOrderApi.list({
              skip,
              limit: pageSize,
              keyword: params.keyword,
              status: params.status,
            });
            return { success: true, data: res.items || [], total: res.total || 0 };
          }}
        />

        <FormModalTemplate
          title={
            editing
              ? t('app.kuaizhizao.quality.fai.editOrder')
              : t('app.kuaizhizao.quality.fai.createOrder')
          }
          open={open}
          width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
          grid={false}
          formRef={formRef}
          onClose={() => {
            setOpen(false);
            setEditing(null);
          }}
          onFinish={async (values) => {
            try {
              const payload = {
                ...values,
                attachments: normalizeDocumentAttachments(values.attachments),
                characteristics: chars.filter((c) => (c.characteristic_name || '').trim()),
              };
              let saved: FaiOrder;
              if (editing?.id) {
                saved = await faiOrderApi.update(editing.id, payload);
              } else {
                saved = await faiOrderApi.create(payload);
              }
              messageApi.success(t('common.saveSuccess'));
              setEditing(saved);
              setChars(saved.characteristics?.length ? saved.characteristics : chars);
              actionRef.current?.reload();
              return true;
            } catch (e: any) {
              messageApi.error(e?.message || t('common.saveFailed'));
              return false;
            }
          }}
        >
          {/* 表头三栏：与需求计划等单据一致，grid=false + Row/Col，明细表不进 ProForm grid */}
          <Row gutter={16}>
            <Col span={8}>
              <CodeField
                name="fai_code"
                label={t('app.kuaizhizao.quality.fai.faiCode')}
                pageCode="kuaizhizao-quality-fai-order"
                disabled={!!editing}
              />
            </Col>
            <Col span={8}>
              <ProFormText
                name="title"
                label={t('app.kuaizhizao.quality.fai.title')}
                rules={[{ required: true }]}
              />
            </Col>
            <Col span={8}>
              <ProFormSelect
                name="trigger_reason"
                label={t('app.kuaizhizao.quality.fai.triggerReason')}
                options={TRIGGER_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                rules={[{ required: true }]}
              />
            </Col>
            <Col span={8}>
              <ProFormText name="material_code" label={t('app.kuaizhizao.quality.fai.materialCode')} />
            </Col>
            <Col span={8}>
              <ProFormText name="material_name" label={t('app.kuaizhizao.quality.fai.materialName')} />
            </Col>
            <Col span={8}>
              <ProFormText name="drawing_no" label={t('app.kuaizhizao.quality.fai.drawingNo')} />
            </Col>
            <Col span={8}>
              <ProFormText name="drawing_revision" label={t('app.kuaizhizao.quality.fai.drawingRevision')} />
            </Col>
            <Col span={8}>
              <ProFormText name="work_order_code" label={t('app.kuaizhizao.quality.fai.workOrder')} />
            </Col>
            <Col span={8}>
              <ProFormDigit name="work_order_id" label={t('app.kuaizhizao.quality.fai.workOrderId')} />
            </Col>
            <Col span={8}>
              <ProFormText name="part_number" label={t('app.kuaizhizao.quality.fai.partNumber')} />
            </Col>
            <Col span={8}>
              <ProFormText name="serial_number" label={t('app.kuaizhizao.quality.fai.serialNumber')} />
            </Col>
            <Col span={8}>
              <ProFormText name="lot_number" label={t('app.kuaizhizao.quality.fai.lotNumber')} />
            </Col>
            <Col span={8}>
              <ProFormText name="material_spec" label={t('app.kuaizhizao.quality.fai.materialSpec')} />
            </Col>
            <Col span={8}>
              <ProFormDigit name="sample_size" label={t('app.kuaizhizao.quality.fai.sampleSize')} min={1} />
            </Col>
            <Col span={8}>
              <ProFormText name="drawing_file_url" label={t('app.kuaizhizao.quality.fai.drawingFileUrl')} />
            </Col>
            <Col span={24}>
              <ProFormTextArea
                name="process_spec"
                label={t('app.kuaizhizao.quality.fai.processSpec')}
                fieldProps={{ rows: 2 }}
              />
            </Col>
            <Col span={24}>
              <ProFormTextArea name="remarks" label={t('common.remark')} fieldProps={{ rows: 2 }} />
            </Col>
            <Col span={24}>
              <DocumentAttachmentsField category="fai_order_attachments" />
            </Col>
          </Row>

          <div style={{ width: '100%', marginTop: 8, marginBottom: 8 }}>
            <Space style={{ marginBottom: 8 }} wrap>
              <span>{t('app.kuaizhizao.quality.fai.characteristics')}</span>
              {editable ? (
                <Button size="small" onClick={() => setChars([...chars, emptyChar(chars.length + 1)])}>
                  {t('app.kuaizhizao.quality.fai.addCharacteristic')}
                </Button>
              ) : null}
              {editable && editing?.id ? (
                <>
                  <InputNumber
                    placeholder={t('app.kuaizhizao.quality.fai.inspectionPlanId')}
                    value={importPlanId ?? undefined}
                    onChange={(v) => setImportPlanId(v == null ? null : Number(v))}
                  />
                  <Button
                    size="small"
                    onClick={async () => {
                      if (!editing?.id || !importPlanId) {
                        messageApi.warning(t('app.kuaizhizao.quality.fai.messages.needPlanId'));
                        return;
                      }
                      try {
                        await inspectionPlanApi.get(String(importPlanId));
                        const updated = await faiOrderApi.importFromPlan(editing.id, importPlanId);
                        setChars(updated.characteristics || []);
                        setEditing(updated);
                        messageApi.success(t('app.kuaizhizao.quality.fai.messages.importSuccess'));
                      } catch (e: any) {
                        messageApi.error(e?.message || t('app.kuaizhizao.quality.fai.messages.importFailed'));
                      }
                    }}
                  >
                    {t('app.kuaizhizao.quality.fai.importFromPlan')}
                  </Button>
                </>
              ) : null}
            </Space>
            <Table
              size="small"
              pagination={false}
              tableLayout="fixed"
              rowKey={(_, idx) => String(idx)}
              dataSource={chars}
              columns={charColumns as any}
              scroll={{ x: 820 }}
              style={{ width: '100%', margin: 0 }}
            />

            {editing?.id ? (
              <Space style={{ marginTop: 8 }}>
                <Button type="primary" onClick={() => openBalloon(editing)}>
                  {t('app.kuaizhizao.quality.fai.balloon.openEditor')}
                </Button>
                <span style={{ color: 'var(--ant-color-text-secondary)' }}>
                  {t('app.kuaizhizao.quality.fai.balloon.openEditorHint')}
                </span>
              </Space>
            ) : (
              <div style={{ marginTop: 8, color: 'var(--ant-color-text-secondary)' }}>
                {t('app.kuaizhizao.quality.fai.balloon.saveFirst')}
              </div>
            )}
          </div>
        </FormModalTemplate>
      </ListPageTemplate>
    </PermissionGuard>
  );
};

export default FaiOrdersPage;
