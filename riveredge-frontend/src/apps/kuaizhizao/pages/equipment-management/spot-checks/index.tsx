import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProFormDatePicker,
  ProFormSelect,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { EquipmentPersonSelect, resolveUserUuidById } from '../../../components/EquipmentPersonSelect';
import { EQUIPMENT_DATE_FIELD_PROPS } from '../../../utils/equipmentFormFieldProps';
import { App, Button, Modal, Row, Col, Tag, Table, Switch, Input } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { rowActionKind } from '../../../../../components/uni-action';
import { equipmentApi } from '../../../services/equipment';
import { inspectionSchemesApi, spotChecksApi } from '../../../services/equipmentOps';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { formatDateTime } from '../../../../../utils/format';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import {
  buildAbnormalityValueEnum,
  buildSpotCheckStatusValueEnum,
  EQUIPMENT_OPS_PINNED_STATUS_FIELD,
  normalizeEquipmentListResponse,
  resolveSpotCheckListParams,
} from '../../../utils/equipmentListCore';

const P = 'app.kuaizhizao.equipmentOps.spotCheck';
const RESOURCE = 'kuaizhizao:equipment-spot-check';

function formatSpotCheckFormDate(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  if (dayjs.isDayjs(value)) return value.format('YYYY-MM-DD');
  const parsed = dayjs(value as string | number | Date);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : undefined;
}

interface SpotCheckLine {
  line_no?: number;
  item_id?: number;
  item_code?: string;
  item_name?: string;
  requirement?: string;
  value_type?: string;
  unit?: string;
  measured_value?: string;
  is_pass?: boolean;
  remark?: string;
}

interface SpotCheck {
  id?: number;
  document_no?: string;
  equipment_id?: number;
  equipment_code?: string;
  equipment_name?: string;
  scheme_id?: number;
  check_date?: string;
  inspector_name?: string;
  status?: string;
  has_abnormality?: boolean;
  updated_at?: string;
  lines?: SpotCheckLine[];
}

const SpotChecksPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [current, setCurrent] = useState<SpotCheck | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(
    undefined,
  );
  const [submitting, setSubmitting] = useState(false);
  const [previewLines, setPreviewLines] = useState<SpotCheckLine[]>([]);
  const [equipmentOptions, setEquipmentOptions] = useState<{ label: string; value: number }[]>([]);
  const [schemeOptions, setSchemeOptions] = useState<{ label: string; value: number }[]>([]);

  const loadOptions = async () => {
    const [eqRes, schRes] = await Promise.all([
      equipmentApi.list({ limit: 1000 }),
      inspectionSchemesApi.list({ limit: 1000, is_active: true }),
    ]);
    setEquipmentOptions(
      (eqRes.items ?? []).map((eq: { id: number; code: string; name: string }) => ({
        label: `${eq.code} - ${eq.name}`,
        value: eq.id,
      })),
    );
    setSchemeOptions(
      (schRes.items ?? []).map((s: { id: number; code: string; name: string }) => ({
        label: `${s.code} - ${s.name}`,
        value: s.id,
      })),
    );
  };

  const handlePreview = async (equipmentId?: number, schemeId?: number) => {
    if (!equipmentId) {
      setPreviewLines([]);
      return;
    }
    if (!schemeId) {
      setPreviewLines([]);
      return;
    }
    try {
      const res = await spotChecksApi.previewLines({
        equipment_id: equipmentId,
        scheme_id: schemeId,
      });
      setPreviewLines(
        (res.lines ?? []).map((l) => {
          const valueType = String(l.value_type || 'boolean').toLowerCase();
          const isBoolean =
            valueType === 'boolean' || valueType === 'bool' || valueType === '是/否';
          const isPass = l.is_pass ?? true;
          return {
            ...l,
            is_pass: isPass,
            measured_value: isBoolean
              ? l.measured_value?.trim()
                ? l.measured_value
                : isPass
                  ? '是'
                  : '否'
              : l.measured_value,
          };
        }),
      );
      if (res.scheme_id) {
        formRef.current?.setFieldsValue({ scheme_id: res.scheme_id });
      }
    } catch (error: unknown) {
      messageApi.error(getApiErrorMessage(error, t(`${P}.previewFailed`)));
      setPreviewLines([]);
    }
  };

  const handleCreate = () => {
    setIsEdit(false);
    setCurrent(null);
    setPreviewLines([]);
    setFormInitialValues({ check_date: dayjs() });
    setModalVisible(true);
    void loadOptions();
  };
  useNewShortcut(handleCreate);

  const handleEdit = async (record: SpotCheck) => {
    if (!record.id) return;
    try {
      const detail = await spotChecksApi.get(record.id);
      const inspectorUuid = await resolveUserUuidById(detail.inspector_id);
      setIsEdit(true);
      setCurrent(detail);
      setPreviewLines(detail.lines ?? []);
      setFormInitialValues({
        equipment_id: detail.equipment_id,
        scheme_id: detail.scheme_id,
        check_date: detail.check_date ? dayjs(detail.check_date) : dayjs(),
        inspector_uuid: inspectorUuid,
        inspector_id: detail.inspector_id,
        inspector_name: detail.inspector_name,
        remark: detail.remark,
      });
      setModalVisible(true);
      void loadOptions();
    } catch (error: unknown) {
      messageApi.error(getApiErrorMessage(error, t(`${P}.listFailed`)));
    }
  };

  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
      title: t('common.batchDeleteTitle'),
      content: t('common.batchDeleteContent', { count: keys.length }),
      onOk: async () => {
        for (const id of keys) {
          await spotChecksApi.delete(Number(id));
        }
        messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
        actionRef.current?.reload();
      },
    });
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!previewLines.length) {
      messageApi.warning(t(`${P}.noPreviewLines`));
      return;
    }
    const payload = {
      equipment_id: values.equipment_id,
      scheme_id: values.scheme_id,
      check_date: formatSpotCheckFormDate(values.check_date),
      inspector_id: values.inspector_id,
      inspector_name: values.inspector_name,
      remark: values.remark,
      lines: previewLines.map((l) => ({
        line_no: l.line_no,
        item_id: l.item_id,
        item_code: l.item_code,
        item_name: l.item_name,
        requirement: l.requirement,
        value_type: l.value_type,
        unit: l.unit,
        measured_value: l.measured_value,
        is_pass: l.is_pass ?? true,
        remark: l.remark,
      })),
    };
    setSubmitting(true);
    try {
      if (isEdit && current?.id) {
        await spotChecksApi.update(current.id, payload);
        messageApi.success(t('common.updateSuccess'));
      } else {
        await spotChecksApi.create(payload);
        messageApi.success(t('common.createSuccess'));
      }
      setModalVisible(false);
      setFormInitialValues(undefined);
      setPreviewLines([]);
      actionRef.current?.reload();
    } catch (error: unknown) {
      messageApi.error(getApiErrorMessage(error, t(`${P}.submitFailed`)));
    } finally {
      setSubmitting(false);
    }
  };

  const lineColumns = [
    { title: t(`${P}.line.item`), dataIndex: 'item_name', width: 140 },
    { title: t(`${P}.line.requirement`), dataIndex: 'requirement', ellipsis: true },
    { title: t(`${P}.line.unit`), dataIndex: 'unit', width: 60 },
    {
      title: t(`${P}.line.measuredValue`),
      dataIndex: 'measured_value',
      width: 120,
      render: (_: unknown, row: SpotCheckLine, index: number) => {
        const valueType = String(row.value_type || 'boolean').toLowerCase();
        // 是/否项只需合格开关，不展示实测值录入
        if (valueType === 'boolean' || valueType === 'bool' || valueType === '是/否') {
          return <span>—</span>;
        }
        return (
          <Input
            size="small"
            value={row.measured_value}
            onChange={(e) => {
              const next = [...previewLines];
              next[index] = { ...next[index], measured_value: e.target.value };
              setPreviewLines(next);
            }}
          />
        );
      },
    },
    {
      title: t(`${P}.line.isPass`),
      dataIndex: 'is_pass',
      width: 80,
      render: (_: unknown, row: SpotCheckLine, index: number) => (
        <Switch
          size="small"
          checked={row.is_pass ?? true}
          onChange={(checked) => {
            const next = [...previewLines];
            const valueType = String(row.value_type || 'boolean').toLowerCase();
            const isBoolean =
              valueType === 'boolean' || valueType === 'bool' || valueType === '是/否';
            next[index] = {
              ...next[index],
              is_pass: checked,
              ...(isBoolean ? { measured_value: checked ? '是' : '否' } : {}),
            };
            setPreviewLines(next);
          }}
        />
      ),
    },
  ];

  const spotCheckStatusValueEnum = useMemo(() => buildSpotCheckStatusValueEnum(t), [t]);
  const abnormalityValueEnum = useMemo(() => buildAbnormalityValueEnum(t, P), [t]);

  const columns: ProColumns<SpotCheck>[] = useMemo(() => alignProColumns<SpotCheck>([
      {
        title: t(`${P}.col.checkDate`),
        dataIndex: 'check_date_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 10 } as ProColumns['search'],
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'created_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 11 } as ProColumns['search'],
      },
      {
        title: t(`${P}.col.status`),
        dataIndex: 'status',
        valueType: 'select',
        valueEnum: spotCheckStatusValueEnum,
        hideInTable: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t(`${P}.col.abnormality`),
        dataIndex: 'has_abnormality',
        valueType: 'select',
        valueEnum: abnormalityValueEnum,
        hideInTable: true,
        search: { order: 21 } as ProColumns['search'],
      },
      {
        title: t(`${P}.col.documentNo`),
        dataIndex: 'document_no',
        width: 140,
        fixed: 'left',
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
      },
      {
        title: t(`${P}.col.equipment`),
        dataIndex: 'equipment_name',
        width: 160,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t(`${P}.col.checkDate`),
        dataIndex: 'check_date',
        width: 132,
        uniTableKeepWidth: true,
        valueType: 'date',
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t(`${P}.col.inspector`),
        dataIndex: 'inspector_name',
        width: 100,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t(`${P}.col.status`),
        dataIndex: 'status',
        width: 90,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => <Tag>{r.status ?? '-'}</Tag>,
      },
      {
        title: t(`${P}.col.abnormality`),
        dataIndex: 'has_abnormality',
        width: 80,
        sorter: true,
        hideInSearch: true,
        render: (_, r) =>
          r.has_abnormality ? <Tag color="error">{t(`${P}.abnormal`)}</Tag> : <Tag color="success">{t(`${P}.normal`)}</Tag>,
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at',
        hideInTable: true,
        hideInSearch: true,
      },
      ...buildDocumentAuditColumns<SpotCheck>(t),
      {
        title: t('common.actions'),
        key: 'action',
        width: 160,
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => (
          <>
            <Button
              {...rowActionKind('read')}
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                void handleEdit(record);
              }}
            >
              {t('common.detail')}
            </Button>
            {perms.canUpdate && (
              <Button
                {...rowActionKind('update')}
                type="link"
                size="small"
                icon={<EditOutlined />}
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
                icon={<DeleteOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  Modal.confirm({
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
    [t, perms, spotCheckStatusValueEnum, abnormalityValueEnum],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<SpotCheck>
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.spot-checks"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          pinnedTabsField={EQUIPMENT_OPS_PINNED_STATUS_FIELD}
          skipFuzzyPinyinClientFilter
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const listParams = resolveSpotCheckListParams(searchFormValues, sort);
              const res = await spotChecksApi.list({
                skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
                limit: params.pageSize,
                ...listParams,
              });
              const { data, total } = normalizeEquipmentListResponse(res);
              return { data: data as SpotCheck[], success: true, total };
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
          setPreviewLines([]);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={submitting}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        initialValues={formInitialValues}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSelect
              name="equipment_id"
              label={t(`${P}.form.equipment`)}
              options={equipmentOptions}
              rules={[{ required: true }]}
              showSearch
              fieldProps={{
                onChange: (val: number) => {
                  const schemeId = formRef.current?.getFieldValue('scheme_id');
                  void handlePreview(val, schemeId);
                },
              }}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="scheme_id"
              label={t(`${P}.form.scheme`)}
              options={schemeOptions}
              rules={[{ required: true, message: t(`${P}.schemeRequired`) }]}
              showSearch
              allowClear
              fieldProps={{
                onChange: (val: number) => {
                  const equipmentId = formRef.current?.getFieldValue('equipment_id');
                  void handlePreview(equipmentId, val);
                },
              }}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="check_date"
              label={t(`${P}.col.checkDate`)}
              rules={[{ required: true }]}
              fieldProps={EQUIPMENT_DATE_FIELD_PROPS}
            />
          </Col>
          <Col span={12}>
            <EquipmentPersonSelect
              uuidFieldName="inspector_uuid"
              idFieldName="inspector_id"
              nameFieldName="inspector_name"
              label={t(`${P}.col.inspector`)}
              formRef={formRef}
            />
          </Col>
          <Col span={24}>
            <ProFormTextArea name="remark" label={t(`${P}.form.remark`)} fieldProps={{ rows: 2 }} />
          </Col>
        </Row>
        {previewLines.length > 0 && (
          <Table
            size="small"
            rowKey={(r) => String(r.line_no ?? r.item_id)}
            columns={lineColumns}
            dataSource={previewLines}
            pagination={false}
            style={{ marginTop: 16 }}
          />
        )}
      </FormModalTemplate>
    </>
  );
};

export default SpotChecksPage;
