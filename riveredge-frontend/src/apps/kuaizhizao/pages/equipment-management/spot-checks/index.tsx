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
import { formatDateTime } from '../../../../../utils/format';

const P = 'app.kuaizhizao.equipmentOps.spotCheck';
const RESOURCE = 'kuaizhizao:equipment-spot-check';

interface SpotCheckLine {
  line_no?: number;
  item_id?: number;
  item_code?: string;
  item_name?: string;
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
    try {
      const res = await spotChecksApi.previewLines({
        equipment_id: equipmentId,
        scheme_id: schemeId,
      });
      setPreviewLines(res.lines ?? []);
    } catch {
      messageApi.error(t(`${P}.previewFailed`));
      setPreviewLines([]);
    }
  };

  const handleCreate = () => {
    setIsEdit(false);
    setCurrent(null);
    setPreviewLines([]);
    setModalVisible(true);
    void loadOptions();
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ check_date: dayjs() });
  };
  useNewShortcut(handleCreate);

  const handleEdit = async (record: SpotCheck) => {
    if (!record.id) return;
    const detail = await spotChecksApi.get(record.id);
    setIsEdit(true);
    setCurrent(detail);
    setPreviewLines(detail.lines ?? []);
    setModalVisible(true);
    void loadOptions();
    const inspectorUuid = await resolveUserUuidById(detail.inspector_id);
    formRef.current?.setFieldsValue({
      equipment_id: detail.equipment_id,
      scheme_id: detail.scheme_id,
      check_date: detail.check_date ? dayjs(detail.check_date) : dayjs(),
      inspector_uuid: inspectorUuid,
      inspector_id: detail.inspector_id,
      inspector_name: detail.inspector_name,
      remark: detail.remark,
    });
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
    const payload = {
      equipment_id: values.equipment_id,
      scheme_id: values.scheme_id,
      check_date: (values.check_date as dayjs.Dayjs)?.format('YYYY-MM-DD'),
      inspector_id: values.inspector_id,
      inspector_name: values.inspector_name,
      remark: values.remark,
      lines: previewLines.map((l) => ({
        line_no: l.line_no,
        item_id: l.item_id,
        item_code: l.item_code,
        item_name: l.item_name,
        value_type: l.value_type,
        unit: l.unit,
        measured_value: l.measured_value,
        is_pass: l.is_pass ?? true,
        remark: l.remark,
      })),
    };
    if (isEdit && current?.id) {
      await spotChecksApi.update(current.id, payload);
      messageApi.success(t('common.updateSuccess'));
    } else {
      await spotChecksApi.create(payload);
      messageApi.success(t('common.createSuccess'));
    }
    setModalVisible(false);
    actionRef.current?.reload();
  };

  const lineColumns = [
    { title: t(`${P}.line.item`), dataIndex: 'item_name', width: 140 },
    { title: t(`${P}.line.requirement`), dataIndex: 'requirement', ellipsis: true },
    { title: t(`${P}.line.unit`), dataIndex: 'unit', width: 60 },
    {
      title: t(`${P}.line.measuredValue`),
      dataIndex: 'measured_value',
      width: 120,
      render: (_: unknown, row: SpotCheckLine, index: number) => (
        <Input
          size="small"
          value={row.measured_value}
          onChange={(e) => {
            const next = [...previewLines];
            next[index] = { ...next[index], measured_value: e.target.value };
            setPreviewLines(next);
          }}
        />
      ),
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
            next[index] = { ...next[index], is_pass: checked };
            setPreviewLines(next);
          }}
        />
      ),
    },
  ];

  const columns: ProColumns<SpotCheck>[] = useMemo(
    () => [
      { title: t(`${P}.col.documentNo`), dataIndex: 'document_no', width: 140, fixed: 'left' },
      { title: t(`${P}.col.equipment`), dataIndex: 'equipment_name', width: 160, ellipsis: true },
      { title: t(`${P}.col.checkDate`), dataIndex: 'check_date', width: 110, valueType: 'date' },
      { title: t(`${P}.col.inspector`), dataIndex: 'inspector_name', width: 100 },
      {
        title: t(`${P}.col.status`),
        dataIndex: 'status',
        width: 90,
        render: (_, r) => <Tag>{r.status ?? '-'}</Tag>,
      },
      {
        title: t(`${P}.col.abnormality`),
        dataIndex: 'has_abnormality',
        width: 80,
        render: (_, r) =>
          r.has_abnormality ? <Tag color="error">{t(`${P}.abnormal`)}</Tag> : <Tag color="success">{t(`${P}.normal`)}</Tag>,
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at',
        width: 168,
        hideInSearch: true,
        render: (_, r) => (r.updated_at ? formatDateTime(r.updated_at) : '-'),
      },
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
    ],
    [t, perms],
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
          request={async (params) => {
            try {
              const res = await spotChecksApi.list({
                skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
                limit: params.pageSize,
              });
              return { data: res.items ?? [], success: true, total: res.total ?? 0 };
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
        onClose={() => setModalVisible(false)}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
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
