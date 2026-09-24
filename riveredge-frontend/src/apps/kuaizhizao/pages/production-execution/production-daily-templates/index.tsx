/**
 * 生产日报模板（R-13）— 可配置业务类型与字段 schema
 */
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  ProFormDigit,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Col, Input, Row, Select, Space, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { rowActionKind } from '../../../../../components/uni-action';
import {
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
} from '../../../../../components/layout-templates';
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
  productionDailyTemplateApi,
  type ProductionDailyFieldDef,
  type ProductionDailyTemplate,
} from '../../../services/production-daily';

const RESOURCE = 'kuaizhizao:production-daily-template';

const EMPTY_FIELD: ProductionDailyFieldDef = {
  key: '',
  label: '',
  type: 'text',
  required: false,
};

const ProductionDailyTemplatesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>();
  const tableRowsRef = useRef<ProductionDailyTemplate[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductionDailyTemplate | null>(null);
  const [fields, setFields] = useState<ProductionDailyFieldDef[]>([{ ...EMPTY_FIELD }]);

  const openCreate = () => {
    setEditing(null);
    setFields([{ ...EMPTY_FIELD, key: 'actual_qty', label: t('app.kuaizhizao.productionDaily.field.actualQty'), type: 'number', required: true }]);
    setModalOpen(true);
  };

  const openEdit = async (record: ProductionDailyTemplate) => {
    try {
      const row = await productionDailyTemplateApi.get(record.id);
      setEditing(row);
      setFields(
        Array.isArray(row.field_schema) && row.field_schema.length > 0
          ? row.field_schema.map((f) => ({ ...f }))
          : [{ ...EMPTY_FIELD }],
      );
      setModalOpen(true);
    } catch (error) {
      message.error(getApiErrorMessage(error, t('common.loadFailed')));
    }
  };

  const fieldColumns: ColumnsType<ProductionDailyFieldDef> = [
    {
      title: t('app.kuaizhizao.productionDaily.field.key'),
      dataIndex: 'key',
      width: 140,
      render: (_, __, index) => (
        <Input
          value={fields[index]?.key}
          onChange={(e) => {
            const next = [...fields];
            next[index] = { ...next[index], key: e.target.value };
            setFields(next);
          }}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.productionDaily.field.label'),
      dataIndex: 'label',
      width: 160,
      render: (_, __, index) => (
        <Input
          value={fields[index]?.label}
          onChange={(e) => {
            const next = [...fields];
            next[index] = { ...next[index], label: e.target.value };
            setFields(next);
          }}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.productionDaily.field.type'),
      dataIndex: 'type',
      width: 120,
      render: (_, __, index) => (
        <Select
          style={{ width: '100%' }}
          value={fields[index]?.type || 'text'}
          options={[
            { value: 'text', label: t('app.kuaizhizao.productionDaily.fieldType.text') },
            { value: 'number', label: t('app.kuaizhizao.productionDaily.fieldType.number') },
            { value: 'textarea', label: t('app.kuaizhizao.productionDaily.fieldType.textarea') },
            { value: 'select', label: t('app.kuaizhizao.productionDaily.fieldType.select') },
          ]}
          onChange={(value) => {
            const next = [...fields];
            next[index] = { ...next[index], type: value };
            setFields(next);
          }}
        />
      ),
    },
    {
      title: t('common.required'),
      dataIndex: 'required',
      width: 80,
      render: (_, __, index) => (
        <Select
          style={{ width: '100%' }}
          value={fields[index]?.required ? '1' : '0'}
          options={[
            { value: '1', label: t('common.yes') },
            { value: '0', label: t('common.no') },
          ]}
          onChange={(value) => {
            const next = [...fields];
            next[index] = { ...next[index], required: value === '1' };
            setFields(next);
          }}
        />
      ),
    },
    {
      title: t('common.action'),
      width: 64,
      render: (_, __, index) => (
        <Button
          type="link"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => setFields(fields.filter((_, i) => i !== index))}
        />
      ),
    },
  ];

  const columns = useMemo<ProColumns<ProductionDailyTemplate>[]>(
    () =>
      alignProColumns(
        [
          {
            title: t('app.kuaizhizao.productionDaily.templateCode'),
            dataIndex: 'template_code',
            width: 140,
            copyable: true,
          },
          {
            title: t('app.kuaizhizao.productionDaily.templateName'),
            dataIndex: 'template_name',
            width: 180,
            ellipsis: true,
          },
          {
            title: t('common.enabled'),
            dataIndex: 'is_active',
            width: 90,
            ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
            render: (_, record) => (
              <MarkerTag color={record.is_active ? 'success' : 'default'} variant="filled">
                {record.is_active ? t('common.enabled') : t('common.disabled')}
              </MarkerTag>
            ),
          },
          {
            title: t('app.kuaizhizao.productionDaily.systemPreset'),
            dataIndex: 'is_system',
            width: 90,
            ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
            render: (_, record) =>
              record.is_system ? (
                <MarkerTag color="processing" variant="filled">
                  {t('common.yes')}
                </MarkerTag>
              ) : (
                '-'
              ),
          },
          ...buildDocumentAuditColumns(t),
          {
            title: t('common.action'),
            valueType: 'option',
            fixed: 'right',
            render: (_, record) =>
              [
                perms.canUpdate ? (
                  <Button key="edit" {...rowActionKind('update')} onClick={() => void openEdit(record)} />
                ) : null,
              ].filter(Boolean),
          },
        ],
        GLOBAL_DOC_LIST_FIELD_RANK,
      ),
    [perms.canUpdate, t],
  );

  return (
    <ListPageTemplate>
      <UniTable<ProductionDailyTemplate>
        actionRef={actionRef}
        rowKey="id"
        headerTitle={t('app.kuaizhizao.menu.production-execution.production-daily-templates')}
        permissionResource={RESOURCE}
        columnPersistenceId="apps.kuaizhizao.production-daily-template.list-v1"
        columns={columns}
        onTableDataChange={(rows) => {
          tableRowsRef.current = rows;
        }}
        toolBarRender={() => [
          perms.canCreate ? (
            <Button key="create" type="primary" onClick={openCreate}>
              {t('app.kuaizhizao.productionDaily.createTemplateButton')}
            </Button>
          ) : null,
        ]}
        request={async (params) => {
          const res = await productionDailyTemplateApi.list({
            keyword: params.keyword,
          });
          return { data: res.items, success: true, total: res.total };
        }}
        rowActionKind={rowActionKind}
      />

      <FormModalTemplate
        open={modalOpen}
        title={
          editing
            ? t('app.kuaizhizao.productionDaily.editTemplateTitle')
            : t('app.kuaizhizao.productionDaily.createTemplateButton')
        }
        width={MODAL_CONFIG.LARGE_WIDTH}
        grid={false}
        onOpenChange={setModalOpen}
        initialValues={
          editing
            ? {
                template_code: editing.template_code,
                template_name: editing.template_name,
                description: editing.description,
                sort_order: editing.sort_order,
                is_active: editing.is_active,
              }
            : { is_active: true, sort_order: 100 }
        }
        onFinish={async (values) => {
          const schema = fields
            .map((f) => ({
              ...f,
              key: (f.key || '').trim(),
              label: (f.label || '').trim(),
            }))
            .filter((f) => f.key && f.label);
          if (!schema.length) {
            message.error(t('app.kuaizhizao.productionDaily.fieldsRequired'));
            return false;
          }
          const payload = {
            ...values,
            field_schema: schema,
          };
          try {
            if (editing) {
              await productionDailyTemplateApi.update(editing.id, payload);
            } else {
              await productionDailyTemplateApi.create(payload);
            }
            message.success(t('common.saveSuccess'));
            setModalOpen(false);
            actionRef.current?.reload();
            return true;
          } catch (error) {
            message.error(getApiErrorMessage(error, t('common.saveFailed')));
            return false;
          }
        }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormText
              name="template_code"
              label={t('app.kuaizhizao.productionDaily.templateCode')}
              disabled={!!editing}
              placeholder={t('common.autoCodePlaceholder')}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="template_name"
              label={t('app.kuaizhizao.productionDaily.templateName')}
              rules={[{ required: true }]}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit name="sort_order" label={t('common.sort')} />
          </Col>
        </Row>
        <div style={{ marginBottom: 8, marginTop: 8 }}>
          <Space>
            <strong>{t('app.kuaizhizao.productionDaily.fieldSchema')}</strong>
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={() => setFields([...fields, { ...EMPTY_FIELD }])}
            >
              {t('common.add')}
            </Button>
          </Space>
        </div>
        <Table
          size="small"
          pagination={false}
          rowKey={(_, index) => String(index)}
          columns={fieldColumns}
          dataSource={fields}
        />
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={24}>
            <ProFormTextArea name="description" label={t('common.remark')} />
          </Col>
          <Col span={12}>
            <ProFormSwitch name="is_active" label={t('common.enabled')} />
          </Col>
        </Row>
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default ProductionDailyTemplatesPage;
