import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormDatePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Modal, Row, Col } from 'antd';
import dayjs from 'dayjs';
import { EQUIPMENT_DATE_FIELD_PROPS } from '../../../utils/equipmentFormFieldProps';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { rowActionKind } from '../../../../../components/uni-action';
import { moldApi } from '../../../services/equipment';
import { trialsApi } from '../../../services/moldOps';
import { formatDateTime } from '../../../../../utils/format';
import { formDateRangeFormItemProps, formDateFormItemProps, toApiDateString } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import {
  normalizeEquipmentListResponse,
  resolveAssetWorkflowListParams,
} from '../../../utils/equipmentListCore';
import {
  buildDetailDrawerEditExtra,
  EquipmentMasterDetailDrawer,
  useEquipmentDetailDrawer,
} from '../shared/equipmentMasterDataDetail';
import { getAntdModal } from '../../../../../utils/antdAppApis';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';

const P = 'app.kuaizhizao.moldOps.trial';
const RESOURCE = 'kuaizhizao:mold-trial';

interface MoldTrial {
  id?: number;
  trial_no?: string;
  document_no?: string;
  mold_id?: number;
  mold_code?: string;
  mold_name?: string;
  trial_date?: string;
  trial_result?: string;
  supplier?: string;
  trial_count?: number;
  remark?: string;
  updated_at?: string;
}

function buildMoldTrialSubmitPayload(values: Record<string, unknown>) {
  const remarkParts: string[] = [];
  if (values.supplier) remarkParts.push(`供应商: ${values.supplier}`);
  if (values.trial_count != null && values.trial_count !== '') {
    remarkParts.push(`试模次数: ${values.trial_count}`);
  }
  if (values.remark) remarkParts.push(String(values.remark));
  return {
    mold_id: values.mold_id,
    trial_date: toApiDateString(values.trial_date),
    trial_result: values.result,
    remark: remarkParts.length ? remarkParts.join('\n') : undefined,
  };
}

const MoldTrialsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [current, setCurrent] = useState<MoldTrial | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(
    undefined,
  );
  const [submitting, setSubmitting] = useState(false);
  const [moldOptions, setMoldOptions] = useState<{ label: string; value: number }[]>([]);
  const { open: detailVisible, loading: detailLoading, detail, openDetail, closeDetail } =
    useEquipmentDetailDrawer<MoldTrial>();

  const handleDetail = (record: MoldTrial) => {
    if (!record.id) return;
    void openDetail(() => trialsApi.get(record.id!), t(`${P}.listFailed`));
  };

  const resultOptions = useMemo(
    () => [
      { label: t(`${P}.result.pass`), value: '合格' },
      { label: t(`${P}.result.fail`), value: '不合格' },
      { label: t(`${P}.result.pendingProduction`), value: '待试产' },
    ],
    [t],
  );

  const loadMoldOptions = async () => {
    const res = await moldApi.list({ limit: 1000 });
    setMoldOptions(
      (res.items ?? []).map((m: { id: number; code: string; name: string }) => ({
        label: `${m.code} - ${m.name}`,
        value: m.id,
      })),
    );
  };

  const handleCreate = () => {
    setIsEdit(false);
    setCurrent(null);
    setFormInitialValues({ trial_date: dayjs(), trial_count: 1, result: '合格' });
    setModalVisible(true);
    void loadMoldOptions();
  };
  useNewShortcut(handleCreate);

  const handleEdit = async (record: MoldTrial) => {
    if (!record.id) return;
    try {
      const detail = await trialsApi.get(record.id);
      setIsEdit(true);
      setCurrent(detail);
      setFormInitialValues({
        mold_id: detail.mold_id,
        trial_date: detail.trial_date ? dayjs(detail.trial_date) : dayjs(),
        supplier: detail.supplier,
        trial_count: detail.trial_count ?? 1,
        result: detail.trial_result,
        remark: detail.remark,
      });
      setModalVisible(true);
      void loadMoldOptions();
    } catch (error: unknown) {
      messageApi.error(getApiErrorMessage(error, t(`${P}.listFailed`)));
    }
  };

  const handleDelete = async (keys: React.Key[]) => {
    getAntdModal().confirm({
      title: t('common.batchDeleteTitle'),
      content: t('common.batchDeleteContent', { count: keys.length }),
      onOk: async () => {
        for (const id of keys) {
          await trialsApi.delete(Number(id));
        }
        messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
        actionRef.current?.reload();
      },
    });
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const payload = buildMoldTrialSubmitPayload(values);
    setSubmitting(true);
    try {
      if (isEdit && current?.id) {
        await trialsApi.update(current.id, payload);
        messageApi.success(t('common.updateSuccess'));
      } else {
        await trialsApi.create(payload);
        messageApi.success(t('common.createSuccess'));
      }
      setModalVisible(false);
      setFormInitialValues(undefined);
      actionRef.current?.reload();
    } catch (error: unknown) {
      messageApi.error(getApiErrorMessage(error, t(`${P}.submitFailed`)));
    } finally {
      setSubmitting(false);
    }
  };

  const detailColumns: ProDescriptionsItemProps<MoldTrial>[] = useMemo(
    () => [
      {
        title: t(`${P}.col.trialNo`),
        dataIndex: 'document_no',
        render: (_, r) => r.document_no ?? r.trial_no ?? '-',
      },
      { title: t(`${P}.col.mold`), dataIndex: 'mold_name' },
      { title: t(`${P}.col.trialDate`), dataIndex: 'trial_date', valueType: 'date' },
      { title: t(`${P}.col.supplier`), dataIndex: 'supplier' },
      { title: t(`${P}.col.trialCount`), dataIndex: 'trial_count' },
      {
        title: t(`${P}.col.result`),
        dataIndex: 'trial_result',
        render: (_, r) => {
          const color =
            r.trial_result === '合格' ? 'success' : r.trial_result === '不合格' ? 'error' : 'warning';
          return <MarkerTag color={color}>{r.trial_result ?? '-'}</MarkerTag>;
        },
      },
      { title: t('common.remark'), dataIndex: 'remark', span: 2 },
    ],
    [t],
  );

  const columns: ProColumns<MoldTrial>[] = useMemo(() => alignProColumns<MoldTrial>([
      {
        title: t(`${P}.col.trialDate`),
        dataIndex: 'doc_date_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 10 } as ProColumns['search'],
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 11 } as ProColumns['search'],
      },
      {
        title: t(`${P}.col.trialNo`),
        dataIndex: 'document_no',
        width: 160,
        minWidth: 160,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        fixed: 'left',
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
        render: (_, r) => {
          const no = r.document_no ?? r.trial_no;
          return no != null && no !== '' ? String(no) : '-';
        },
      },
      {
        title: t(`${P}.col.mold`),
        dataIndex: 'mold_name',
        minWidth: 160,
        uniTablePrimaryFlex: true,
        uniTableRemainderFlex: true,
        resizable: false,
        ellipsis: true,
        hideInSearch: true,
        render: (_, r) => (r.mold_name != null && r.mold_name !== '' ? String(r.mold_name) : '-'),
      },
      {
        title: t(`${P}.col.trialDate`),
        dataIndex: 'trial_date',
        width: 132,
        minWidth: 132,
        uniTableKeepWidth: true,
        resizable: false,
        sorter: true,
        hideInSearch: true,
        valueType: 'date',
      },
      {
        title: t(`${P}.col.supplier`),
        dataIndex: 'supplier',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => (r.supplier != null && r.supplier !== '' ? String(r.supplier) : '-'),
      },
      {
        title: t(`${P}.col.trialCount`),
        dataIndex: 'trial_count',
        width: 90,
        minWidth: 90,
        uniTableKeepWidth: true,
        resizable: false,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => (r.trial_count != null ? String(r.trial_count) : '-'),
      },
      {
        title: t(`${P}.col.result`),
        dataIndex: 'trial_result',
        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => {
          const color =
            r.trial_result === '合格' ? 'success' : r.trial_result === '不合格' ? 'error' : 'warning';
          return <MarkerTag color={color}>{r.trial_result ?? '-'}</MarkerTag>;
        },
      },
      ...buildDocumentAuditColumns<Record<string, unknown>>(t),
      {
        title: t('common.actions'),
        key: 'option',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => (
          <>
            <Button
              {...rowActionKind('read')}
              type="link"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleDetail(record);
              }}
            >
              {t('common.detail')}
            </Button>
            {perms.canUpdate && (
              <Button
                {...rowActionKind('update')}
                type="link"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleEdit(record);
                }}
              >
                {t('common.edit')}
              </Button>
            )}
            {perms.canDelete && (
              <Button
                {...rowActionKind('delete')}
                type="link"
                size="small"
                danger
                onClick={(e) => {
                  e.stopPropagation();
                  getAntdModal().confirm({
                    title: t('common.deleteTitle'),
                    onOk: () => record.id && handleDelete([record.id]),
                  });
                }}
              >
                {t('common.delete')}
              </Button>
            )}
          </>
        ),
      },
    ], SALES_DOC_LIST_FIELD_RANK),
    [t, perms],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<MoldTrial>
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.moldTrials)}
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.mold-trials-width-v2"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          skipFuzzyPinyinClientFilter
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const listParams = resolveAssetWorkflowListParams(searchFormValues, sort);
              const res = await trialsApi.list({
                skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
                limit: params.pageSize,
                ...listParams,
              });
              const { data, total } = normalizeEquipmentListResponse(res);
              return { data: data as MoldTrial[], success: true, total };
            } catch {
              messageApi.error(t(`${P}.listFailed`));
              return { data: [], success: false, total: 0 };
            }
          }}
          showCreateButton={perms.canCreate}
          createButtonText={withSingleNewShortcutHint(t(`${P}.create`))}
          onCreate={handleCreate}
          showDeleteButton={perms.canDelete}
          onDelete={handleDelete}
          enableRowSelection={perms.canDelete}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={isEdit ? t(`${P}.editModal`) : t(`${P}.createModal`)}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setFormInitialValues(undefined);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={submitting}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        initialValues={formInitialValues}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={24}>
            <ProFormSelect
              name="mold_id"
              label={t(`${P}.form.mold`)}
              options={moldOptions}
              rules={[{ required: true }]}
              showSearch
              disabled={isEdit}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="trial_date"
              label={t(`${P}.col.trialDate`)}
              rules={[{ required: true }]}
              formItemProps={formDateFormItemProps}
              fieldProps={EQUIPMENT_DATE_FIELD_PROPS}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit name="trial_count" label={t(`${P}.col.trialCount`)} min={1} />
          </Col>
          <Col span={12}>
            <ProFormText name="supplier" label={t(`${P}.col.supplier`)} />
          </Col>
          <Col span={12}>
            <ProFormSelect name="result" label={t(`${P}.col.result`)} options={resultOptions} />
          </Col>
          <Col span={24}>
            <ProFormTextArea name="remark" label={t('common.remark')} fieldProps={{ rows: 2 }} />
          </Col>
        </Row>
      </FormModalTemplate>

      <EquipmentMasterDetailDrawer
        open={detailVisible}
        loading={detailLoading}
        detail={detail}
        title={`${t('common.detail')}${detail?.document_no ?? detail?.trial_no ? ` - ${detail.document_no ?? detail.trial_no}` : ''}`}
        onClose={closeDetail}
        basicColumns={detailColumns}
        extra={buildDetailDrawerEditExtra(t, Boolean(detail && perms.canUpdate), () => {
          if (!detail) return;
          closeDetail();
          void handleEdit(detail);
        })}
      />
    </>
  );
};

export default MoldTrialsPage;
