/**
 * 好力 GO — 模具保养方案
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProForm,
  ProFormDigit,
  ProFormInstance,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
} from '@ant-design/pro-components';
import { App, Button, Col, Divider, Modal, Popconfirm, Row, Space, Switch, Table, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { UniTable } from '../../../../../components/uni-table';
import {
  DetailDrawerSection,
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  ListPageTemplate,
  FormModalTemplate,
  MODAL_CONFIG,
} from '../../../../../components/layout-templates';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import {
  addEquipmentUpkeepParamSetItem,
  createEquipmentUpkeepParamSetWithItems,
  deleteEquipmentUpkeepParamSet,
  deleteEquipmentUpkeepParamSetItem,
  listEquipmentUpkeepParamSetItems,
  listEquipmentUpkeepParamSets,
  listEquipmentUpkeepParams,
  updateEquipmentUpkeepParamSet,
  updateEquipmentUpkeepParamSetItem,
  type EquipmentUpkeepParamRow,
  type EquipmentUpkeepParamSetItemRow,
  type EquipmentUpkeepParamSetRow,
} from '../../../services/haoligo';
import { normalizeMoldUpkeepValueType } from '../../../utils/moldUpkeepParamValueType';

const { Text, Title } = Typography;

type LineRow = EquipmentUpkeepParamSetItemRow & {
  param_code: string;
  param_name: string;
  requirement?: string | null;
  value_type?: string;
};

type PendingLine = {
  tempId: string;
  param_id: number;
  sort_order: number;
  is_required: boolean;
  param_code: string;
  param_name: string;
  requirement?: string | null;
};

function newTempId(): string {
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const EquipmentUpkeepParamSetsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const editorFormRef = useRef<ProFormInstance>(null);
  const addItemFormRef = useRef<ProFormInstance>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorCreateMode, setEditorCreateMode] = useState(true);
  const [editorSetId, setEditorSetId] = useState<number | null>(null);
  const [editorSetCode, setEditorSetCode] = useState('');
  const [editorSaving, setEditorSaving] = useState(false);
  const [lines, setLines] = useState<LineRow[]>([]);
  const [pendingLines, setPendingLines] = useState<PendingLine[]>([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [allParams, setAllParams] = useState<EquipmentUpkeepParamRow[]>([]);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addItemLoading, setAddItemLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<EquipmentUpkeepParamSetRow | null>(null);
  const [detailLines, setDetailLines] = useState<LineRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadParams = useCallback(async () => {
    const params = await listEquipmentUpkeepParams();
    setAllParams(params);
    return params;
  }, []);

  const loadLines = useCallback(
    async (setId: number) => {
      setLinesLoading(true);
      try {
        const [params, rawItems] = await Promise.all([listEquipmentUpkeepParams(), listEquipmentUpkeepParamSetItems(setId)]);
        setAllParams(params);
        const enriched: LineRow[] = rawItems
          .map((it) => {
            const p = params.find((x) => x.id === it.param_id);
            return {
              ...it,
              param_code: p?.code ?? `#${it.param_id}`,
              param_name: p?.name ?? '—',
              requirement: p?.requirement,
              value_type: p?.value_type,
            };
          })
          .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
        setLines(enriched);
      } catch (e) {
        messageApi.error((e as Error).message || t('app.haoligo.equipment.upkeepParamSets.loadLinesFailed'));
        setLines([]);
      } finally {
        setLinesLoading(false);
      }
    },
    [messageApi, t],
  );

  const openCreateEditor = async () => {
    setEditorCreateMode(true);
    setEditorSetId(null);
    setEditorSetCode('');
    setLines([]);
    setPendingLines([]);
    setEditorOpen(true);
    await loadParams();
    setTimeout(() => editorFormRef.current?.resetFields(), 0);
  };

  useNewShortcut(openCreateEditor);

  const openEditEditor = async (record: EquipmentUpkeepParamSetRow) => {
    setEditorCreateMode(false);
    setEditorSetId(record.id);
    setEditorSetCode(record.code);
    setPendingLines([]);
    setEditorOpen(true);
    await loadLines(record.id);
    setTimeout(() => editorFormRef.current?.setFieldsValue({ code: record.code, name: record.name }), 0);
  };

  const handleDetail = async (record: EquipmentUpkeepParamSetRow) => {
    setDetailRecord(record);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const [params, rawItems] = await Promise.all([listEquipmentUpkeepParams(), listEquipmentUpkeepParamSetItems(record.id)]);
      setDetailLines(
        rawItems
          .map((it) => {
            const p = params.find((x) => x.id === it.param_id);
            return {
              ...it,
              param_code: p?.code ?? `#${it.param_id}`,
              param_name: p?.name ?? '—',
              requirement: p?.requirement,
              value_type: p?.value_type,
            };
          })
          .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
      );
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.upkeepParamSets.loadLinesFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditorSetId(null);
    setLines([]);
    setPendingLines([]);
  };

  const saveEditor = async () => {
    try {
      await editorFormRef.current?.validateFields();
    } catch {
      return;
    }
    const v = editorFormRef.current?.getFieldsValue() as { code?: string; name?: string };
    const name = String(v.name ?? '').trim();
    if (!name) {
      messageApi.warning(t('app.haoligo.equipment.upkeepParamSets.nameRequired'));
      return;
    }
    if (editorCreateMode) {
      const code = String(v.code ?? '').trim();
      if (!code) {
        messageApi.warning(t('app.haoligo.equipment.upkeepParamSets.codeRequired'));
        return;
      }
      if (pendingLines.length === 0) {
        messageApi.warning(t('app.haoligo.equipment.upkeepParamSets.atLeastOneItem'));
        return;
      }
      setEditorSaving(true);
      try {
        await createEquipmentUpkeepParamSetWithItems({
          code,
          name,
          items: pendingLines.map((ln, i) => ({
            param_id: ln.param_id,
            sort_order: i,
            is_required: ln.is_required,
          })),
        });
        messageApi.success(t('app.haoligo.equipment.createSuccess'));
        closeEditor();
        actionRef.current?.reload();
      } catch (e) {
        messageApi.error((e as Error).message);
      } finally {
        setEditorSaving(false);
      }
      return;
    }
    if (editorSetId == null) return;
    setEditorSaving(true);
    try {
      await updateEquipmentUpkeepParamSet(editorSetId, { name });
      messageApi.success(t('app.haoligo.equipment.updateSuccess'));
      closeEditor();
      actionRef.current?.reload();
    } catch (e) {
      messageApi.error((e as Error).message);
    } finally {
      setEditorSaving(false);
    }
  };

  const usedParamIds = useMemo(() => {
    const used = editorCreateMode ? pendingLines.map((l) => l.param_id) : lines.map((l) => l.param_id);
    return new Set(used);
  }, [editorCreateMode, pendingLines, lines]);

  const addableParamOptions = useMemo(
    () =>
      allParams
        .filter((p) => !usedParamIds.has(p.id))
        .map((p) => ({ label: `${p.code} · ${p.name}`, value: p.id })),
    [allParams, usedParamIds],
  );

  const openAddItem = () => {
    if (!addableParamOptions.length) {
      messageApi.info(t('app.haoligo.equipment.upkeepParamSets.noParamsToAdd'));
      return;
    }
    setAddItemOpen(true);
    setTimeout(() => {
      addItemFormRef.current?.resetFields();
      addItemFormRef.current?.setFieldsValue({ is_required: true });
    }, 0);
  };

  const handleAddItemSubmit = async (values: Record<string, unknown>) => {
    const raw = values.param_ids;
    const paramIds = (Array.isArray(raw) ? raw : raw != null ? [raw] : [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id));
    if (!paramIds.length) {
      messageApi.warning(t('app.haoligo.equipment.upkeepParamSets.pickParamRequired'));
      return;
    }

    const sortStart = editorCreateMode ? pendingLines.length : lines.length;
    const isRequired = values.is_required !== false;

    if (editorCreateMode) {
      const rows = paramIds
        .map((param_id, i) => {
          const p = allParams.find((x) => x.id === param_id);
          if (!p) return null;
          return {
            tempId: newTempId(),
            param_id,
            sort_order: sortStart + i,
            is_required: isRequired,
            param_code: p.code,
            param_name: p.name,
            requirement: p.requirement,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row != null);
      if (!rows.length) {
        messageApi.warning(t('app.haoligo.equipment.upkeepParamSets.pickParamRequired'));
        return;
      }
      setPendingLines((prev) => [...prev, ...rows]);
      setAddItemOpen(false);
      addItemFormRef.current?.resetFields();
      return;
    }

    if (editorSetId == null) return;
    setAddItemLoading(true);
    try {
      await Promise.all(
        paramIds.map((param_id, i) =>
          addEquipmentUpkeepParamSetItem(editorSetId, {
            param_id,
            sort_order: sortStart + i,
            is_required: isRequired,
          }),
        ),
      );
      messageApi.success(t('app.haoligo.equipment.updateSuccess'));
      setAddItemOpen(false);
      addItemFormRef.current?.resetFields();
      await loadLines(editorSetId);
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
      throw e;
    } finally {
      setAddItemLoading(false);
    }
  };

  const sortedLines = useMemo(() => [...lines].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id), [lines]);

  const columns: ProColumns<EquipmentUpkeepParamSetRow>[] = [
    { title: t('app.haoligo.equipment.upkeepParamSets.colSetCode'), dataIndex: 'code', width: 140 },
    { title: t('app.haoligo.equipment.upkeepParamSets.colSetName'), dataIndex: 'name', ellipsis: true },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button key="view" {...rowActionKind('read')} onClick={() => void handleDetail(record)}>
            {t('common.detail')}
          </Button>
          <Button key="edit" {...rowActionKind('update')} onClick={() => void openEditEditor(record)}>
            {t('common.edit')}
          </Button>
          <Button key="delete" {...rowActionKind('delete')}
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: t('app.haoligo.equipment.upkeepParamSets.deleteTitle'),
                content: record.name,
                okType: 'danger',
                onOk: async () => {
                  await deleteEquipmentUpkeepParamSet(record.id);
                  messageApi.success(t('app.haoligo.equipment.deleteSuccess'));
                  actionRef.current?.reload();
                },
              });
            }}
          >
            {t('common.delete')}
          </Button>
        </Space>
      ),
    },
  ];

  const lineColumns: ColumnsType<LineRow> = [
    { title: '#', width: 48, render: (_, __, i) => i + 1 },
    { title: t('app.haoligo.equipment.upkeepParams.colCode'), dataIndex: 'param_code', width: 120 },
    { title: t('app.haoligo.equipment.upkeepParams.colName'), dataIndex: 'param_name', ellipsis: true },
    {
      title: t('app.haoligo.equipment.upkeepParams.colValueType'),
      dataIndex: 'value_type',
      width: 72,
      render: (_, r) =>
        normalizeMoldUpkeepValueType(r.value_type) === 'multiselect'
          ? t('app.haoligo.equipment.upkeepParams.valueTypeMultiselect')
          : t('app.haoligo.equipment.upkeepParams.valueTypeText'),
    },
    {
      title: t('app.haoligo.equipment.upkeepParamSets.colRequired'),
      dataIndex: 'is_required',
      width: 88,
      render: (_, r) => (
        <Switch
          checked={r.is_required}
          size="small"
          disabled={editorCreateMode}
          onChange={async (checked) => {
            await updateEquipmentUpkeepParamSetItem(r.id, { is_required: checked });
            if (editorSetId) await loadLines(editorSetId);
          }}
        />
      ),
    },
    {
      title: t('common.actions'),
      key: 'op',
      render: (_, r) => (
        <Popconfirm
          title={t('app.haoligo.equipment.upkeepParamSets.removeConfirm')}
          onConfirm={async () => {
            await deleteEquipmentUpkeepParamSetItem(r.id);
            if (editorSetId) await loadLines(editorSetId);
          }}
        >
          <Button type="link" size="small" danger>
            {t('common.delete')}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<EquipmentUpkeepParamSetRow>
          headerTitle={t('app.haoligo.menu.equipment.upkeep-param-sets')}
          actionRef={actionRef}
          columns={columns}
          columnPersistenceId="apps.haoligo.pages.equipment.upkeep-param-sets"
          showCreateButton
          onCreate={() => void openCreateEditor()}
          request={async () => {
            const data = await listEquipmentUpkeepParamSets();
            return { data, success: true, total: data.length };
          }}
          rowKey="id"
          search={false}
        />
      </ListPageTemplate>

      <Modal
        title={editorCreateMode ? t('app.haoligo.equipment.upkeepParamSets.editorNew') : t('app.haoligo.equipment.upkeepParamSets.editorEdit', { code: editorSetCode })}
        open={editorOpen}
        onCancel={closeEditor}
        width={960}
        footer={[
          <Button {...rowActionKind('revoke')} key="cancel" onClick={closeEditor}>
            {t('common.cancel')}
          </Button>,
          <Button {...rowActionKind('skip')} key="save" type="primary" loading={editorSaving} onClick={() => void saveEditor()}>
            {t('common.save')}
          </Button>,
        ]}
        destroyOnHidden
      >
        <ProForm formRef={editorFormRef} submitter={false} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <ProFormText name="code" label={t('app.haoligo.equipment.upkeepParamSets.colSetCode')} disabled={!editorCreateMode} rules={[{ required: editorCreateMode }]} />
            </Col>
            <Col span={12}>
              <ProFormText name="name" label={t('app.haoligo.equipment.upkeepParamSets.colSetName')} rules={[{ required: true }]} />
            </Col>
          </Row>
        </ProForm>
        <Divider />
        <Space style={{ marginBottom: 8 }}>
          <Title level={5} style={{ margin: 0 }}>
            {t('app.haoligo.equipment.upkeepParamSets.itemsTitle')}
          </Title>
          {!editorCreateMode && editorSetId != null ? (
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openAddItem}>
              {t('app.haoligo.equipment.upkeepParamSets.addItem')}
            </Button>
          ) : null}
          <Link to="/apps/haoligo/equipment/upkeep-params">{t('app.haoligo.menu.equipment.upkeep-params')}</Link>
        </Space>
        {editorCreateMode ? (
          <Table
            size="small"
            rowKey="tempId"
            dataSource={pendingLines}
            pagination={false}
            columns={[
              { title: '#', width: 48, render: (_, __, i) => i + 1 },
              { title: t('app.haoligo.equipment.upkeepParams.colCode'), dataIndex: 'param_code' },
              { title: t('app.haoligo.equipment.upkeepParams.colName'), dataIndex: 'param_name' },
              {
                title: t('app.haoligo.equipment.upkeepParamSets.colRequired'),
                dataIndex: 'is_required',
                render: (_, r) => (
                  <Switch
                    checked={r.is_required}
                    size="small"
                    onChange={(c) =>
                      setPendingLines((prev) => prev.map((x) => (x.tempId === r.tempId ? { ...x, is_required: c } : x)))
                    }
                  />
                ),
              },
              {
                title: t('common.actions'),
                render: (_, r) => (
                  <Button type="link" danger size="small" onClick={() => setPendingLines((p) => p.filter((x) => x.tempId !== r.tempId))}>
                    {t('common.delete')}
                  </Button>
                ),
              },
            ]}
          />
        ) : (
          <Table size="small" rowKey="id" loading={linesLoading} dataSource={sortedLines} pagination={false} columns={lineColumns} />
        )}
        {editorCreateMode ? (
          <Button style={{ marginTop: 8 }} onClick={openAddItem} disabled={!addableParamOptions.length}>
            {t('app.haoligo.equipment.upkeepParamSets.addItem')}
          </Button>
        ) : null}
      </Modal>

      <FormModalTemplate
        title={t('app.haoligo.equipment.upkeepParamSets.addItem')}
        open={addItemOpen}
        onClose={() => setAddItemOpen(false)}
        formRef={addItemFormRef}
        loading={addItemLoading}
        width={MODAL_CONFIG.SMALL_WIDTH}
        onFinish={handleAddItemSubmit}
        initialValues={{ is_required: true }}
      >
        <ProFormSelect
          name="param_ids"
          label={t('app.haoligo.equipment.upkeepParamSets.pickParam')}
          placeholder={t('app.haoligo.equipment.upkeepParamSets.pickParamPh')}
          options={addableParamOptions}
          rules={[{ required: true, message: t('app.haoligo.equipment.upkeepParamSets.pickParamRequired') }]}
          showSearch
          fieldProps={{
            mode: 'multiple',
            optionFilterProp: 'label',
            maxTagCount: 'responsive',
          }}
        />
        <ProFormSwitch name="is_required" label={t('app.haoligo.equipment.upkeepParamSets.colRequired')} />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={t('app.haoligo.equipment.upkeepParamSets.detailTitle')}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailRecord(null);
          setDetailLines([]);
        }}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        dataSource={detailRecord}
        columns={[
          { title: t('app.haoligo.equipment.upkeepParamSets.colSetCode'), dataIndex: 'code' },
          { title: t('app.haoligo.equipment.upkeepParamSets.colSetName'), dataIndex: 'name' },
        ]}
      >
        <DetailDrawerSection title={t('app.haoligo.equipment.upkeepParamSets.itemsTitle')}>
          <Table
            size="small"
            rowKey="id"
            dataSource={detailLines}
            pagination={false}
            columns={[
              { title: '#', render: (_, __, i) => i + 1, width: 48 },
              { title: t('app.haoligo.equipment.upkeepParams.colCode'), dataIndex: 'param_code' },
              { title: t('app.haoligo.equipment.upkeepParams.colName'), dataIndex: 'param_name' },
              {
                title: t('app.haoligo.equipment.upkeepParamSets.colRequired'),
                dataIndex: 'is_required',
                render: (v) => (v ? '是' : '否'),
              },
            ]}
          />
        </DetailDrawerSection>
      </DetailDrawerTemplate>
    </>
  );
};

export default EquipmentUpkeepParamSetsPage;
