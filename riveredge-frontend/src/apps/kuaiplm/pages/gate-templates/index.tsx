/**
 * 阶段门模板管理（多 Tab 页面模板）
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Badge,
  Button,
  Empty,
  Input,
  List,
  Popconfirm,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CopyOutlined,
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { MultiTabListPageTemplate, TwoColumnLayout } from '../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../hooks/useResourcePermissions';
import {
  createGateTemplate,
  deleteGateTemplate,
  getGateTemplate,
  listGateTemplates,
  saveGateTemplateStages,
  setDefaultGateTemplate,
  updateGateTemplate,
  type GateMilestoneRole,
  type GateProjectType,
  type GateTemplateDetail,
  type GateTemplateStage,
  type GateTemplateSummary,
} from '../../services/gate-template';
import { resolvePlmPreferredAudit } from '../../utils/plmListCore';

const GATE_TEMPLATE_RESOURCE = 'kuaiplm.gate-template';

type EditableStage = GateTemplateStage & { _key: string };

const newStageKey = () => `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

interface GateTemplateTabPanelProps {
  projectType: GateProjectType;
}

const GateTemplateTabPanel: React.FC<GateTemplateTabPanelProps> = ({ projectType }) => {
  const { t } = useTranslation();
  const { message: messageApi, modal } = App.useApp();
  const perms = useResourcePermissions(GATE_TEMPLATE_RESOURCE);

  const [templates, setTemplates] = useState<GateTemplateSummary[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<number | undefined>();
  const [detail, setDetail] = useState<GateTemplateDetail | null>(null);
  const [stages, setStages] = useState<EditableStage[]>([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);

  const milestoneOptions = useMemo(
    () => [{ label: t('app.kuaiplm.gateTemplates.milestoneRole.none'), value: 'none' as GateMilestoneRole }],
    [t],
  );

  const loadTemplates = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await listGateTemplates({ project_type: projectType });
      setTemplates(res.items);
      if (res.items.length === 0) {
        setSelectedId(undefined);
        setDetail(null);
        setStages([]);
        return;
      }
      setSelectedId((prev) => {
        if (prev && res.items.some((item) => item.id === prev)) return prev;
        const defaultTpl = res.items.find((item) => item.is_default) ?? res.items[0];
        return defaultTpl.id;
      });
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaiplm.gateTemplates.messages.loadFailed'));
      setTemplates([]);
    } finally {
      setListLoading(false);
    }
  }, [messageApi, projectType, t]);

  const loadDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    try {
      const res = await getGateTemplate(id);
      setDetail(res);
      setStages(
        (res.stages ?? []).map((stage) => ({
          ...stage,
          deliverables: stage.deliverables ?? [],
          _key: String(stage.id ?? newStageKey()),
        })),
      );
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaiplm.gateTemplates.messages.loadDetailFailed'));
      setDetail(null);
      setStages([]);
    } finally {
      setDetailLoading(false);
    }
  }, [messageApi, t]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (selectedId) {
      void loadDetail(selectedId);
    } else {
      setDetail(null);
      setStages([]);
    }
  }, [selectedId, loadDetail]);

  const handleCreateTemplate = () => {
    let name = '';
    modal.confirm({
      title: t('app.kuaiplm.gateTemplates.actions.create'),
      content: (
        <Input
          placeholder={t('app.kuaiplm.gateTemplates.form.templateName')}
          onChange={(e) => {
            name = e.target.value;
          }}
        />
      ),
      onOk: async () => {
        if (!name.trim()) {
          messageApi.warning(t('app.kuaiplm.gateTemplates.messages.nameRequired'));
          return Promise.reject();
        }
        try {
          const created = await createGateTemplate({
            project_type: projectType,
            template_name: name.trim(),
            copy_from_id: detail?.id,
          });
          messageApi.success(t('common.createSuccess'));
          await loadTemplates();
          setSelectedId(created.id);
        } catch (error: any) {
          messageApi.error(error?.message || t('common.createFailed'));
          return Promise.reject();
        }
      },
    });
  };

  const handleCopyTemplate = async (tpl: GateTemplateSummary) => {
    try {
      const created = await createGateTemplate({
        project_type: tpl.project_type,
        template_name: `${tpl.template_name} ${t('app.kuaiplm.gateTemplates.copySuffix')}`,
        copy_from_id: tpl.id,
      });
      messageApi.success(t('common.createSuccess'));
      await loadTemplates();
      setSelectedId(created.id);
    } catch (error: any) {
      messageApi.error(error?.message || t('common.createFailed'));
    }
  };

  const handleSetDefault = async () => {
    if (!detail?.id) return;
    try {
      await setDefaultGateTemplate(detail.id);
      messageApi.success(t('app.kuaiplm.gateTemplates.messages.setDefaultSuccess'));
      await loadTemplates();
      await loadDetail(detail.id);
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaiplm.gateTemplates.messages.setDefaultFailed'));
    }
  };

  const handleToggleActive = async (checked: boolean) => {
    if (!detail?.id) return;
    try {
      await updateGateTemplate(detail.id, { is_active: checked });
      messageApi.success(t('common.updateSuccess'));
      await loadTemplates();
      await loadDetail(detail.id);
    } catch (error: any) {
      messageApi.error(error?.message || t('common.updateFailed'));
    }
  };

  const handleDeleteTemplate = async (tpl: GateTemplateSummary) => {
    try {
      await deleteGateTemplate(tpl.id);
      messageApi.success(t('common.deleteSuccess'));
      await loadTemplates();
    } catch (error: any) {
      messageApi.error(error?.message || t('common.deleteFailed'));
    }
  };

  const handleAddStage = () => {
    const nextOrder = stages.length > 0 ? Math.max(...stages.map((s) => s.sort_order ?? 0)) + 1 : 1;
    setStages((prev) => [
      ...prev,
      {
        _key: newStageKey(),
        gate_key: `stage_${nextOrder}`,
        gate_name: t('app.kuaiplm.gateTemplates.newStageName', { order: nextOrder }),
        sort_order: nextOrder,
        milestone_role: 'none',
        deliverables: [],
      },
    ]);
  };

  const handleSaveStages = async () => {
    if (!detail?.id) return;
    if (stages.length === 0) {
      messageApi.warning(t('app.kuaiplm.gateTemplates.messages.stageRequired'));
      return;
    }
    const keys = stages.map((s) => s.gate_key.trim());
    if (new Set(keys).size !== keys.length) {
      messageApi.warning(t('app.kuaiplm.gateTemplates.messages.duplicateGateKey'));
      return;
    }
    const spawnCount = stages.filter((s) => s.milestone_role === 'spawn_delivery').length;
    if (spawnCount > 1) {
      messageApi.warning(t('app.kuaiplm.gateTemplates.messages.spawnDeliveryLimit'));
      return;
    }

    setSaving(true);
    try {
      const payload = stages.map((stage, idx) => ({
        gate_key: stage.gate_key,
        gate_name: stage.gate_name,
        sort_order: stage.sort_order || idx + 1,
        milestone_role: stage.milestone_role === 'spawn_delivery' ? 'none' : stage.milestone_role || 'none',
        deliverables: (stage.deliverables ?? []).map((d, dIdx) => ({
          name: d.name,
          deliverable_type: d.deliverable_type,
          sort_order: d.sort_order ?? dIdx + 1,
        })),
      }));
      const updated = await saveGateTemplateStages(detail.id, payload);
      messageApi.success(t('common.updateSuccess'));
      setDetail(updated);
      setStages(
        (updated.stages ?? []).map((stage) => ({
          ...stage,
          deliverables: stage.deliverables ?? [],
          _key: String(stage.id ?? newStageKey()),
        })),
      );
      await loadTemplates();
    } catch (error: any) {
      messageApi.error(error?.message || t('common.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  const stageColumns: ColumnsType<EditableStage> = [
    {
      title: t('app.kuaiplm.gateTemplates.columns.sortOrder'),
      width: 72,
      render: (_, __, index) => index + 1,
    },
    {
      title: t('app.kuaiplm.gateTemplates.columns.gateKey'),
      dataIndex: 'gate_key',
      width: 140,
      render: (_, record, index) => (
        <Input
          value={record.gate_key}
          disabled={!perms.canUpdate}
          onChange={(e) => {
            const val = e.target.value;
            setStages((prev) => prev.map((s, i) => (i === index ? { ...s, gate_key: val } : s)));
          }}
        />
      ),
    },
    {
      title: t('app.kuaiplm.gateTemplates.columns.gateName'),
      dataIndex: 'gate_name',
      render: (_, record, index) => (
        <Input
          value={record.gate_name}
          disabled={!perms.canUpdate}
          onChange={(e) => {
            const val = e.target.value;
            setStages((prev) => prev.map((s, i) => (i === index ? { ...s, gate_name: val } : s)));
          }}
        />
      ),
    },
    {
      title: t('app.kuaiplm.gateTemplates.columns.milestoneRole'),
      dataIndex: 'milestone_role',
      width: 180,
      render: (_, record, index) => (
        <Select
          style={{ width: '100%' }}
          value={record.milestone_role || 'none'}
          options={milestoneOptions}
          disabled={!perms.canUpdate}
          onChange={(val: GateMilestoneRole) => {
            setStages((prev) =>
              prev.map((s, i) => (i === index ? { ...s, milestone_role: val } : s)),
            );
          }}
        />
      ),
    },
    {
      title: t('common.actions'),
      width: 100,
      render: (_, __, index) =>
        perms.canUpdate ? (
          <Button
            type="link"
            danger
            size="small"
            onClick={() => setStages((prev) => prev.filter((_, i) => i !== index))}
          >
            {t('common.delete')}
          </Button>
        ) : null,
    },
  ];

  const leftPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, padding: 8 }}>
      <Space style={{ marginBottom: 12, flexShrink: 0 }} wrap>
        {perms.canCreate ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateTemplate}>
            {t('app.kuaiplm.gateTemplates.actions.create')}
          </Button>
        ) : null}
        <Button icon={<ReloadOutlined />} onClick={() => void loadTemplates()}>
          {t('common.refresh')}
        </Button>
      </Space>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Spin spinning={listLoading}>
          <List
          dataSource={templates}
          locale={{ emptyText: <Empty description={t('app.kuaiplm.gateTemplates.emptyTemplates')} /> }}
          renderItem={(item) => (
            <List.Item
              style={{
                cursor: 'pointer',
                background: item.id === selectedId ? 'var(--ant-color-primary-bg)' : undefined,
                padding: '8px 12px',
                borderRadius: 6,
              }}
              onClick={() => setSelectedId(item.id)}
              actions={[
                perms.canCreate ? (
                  <Button
                    key="copy"
                    type="text"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleCopyTemplate(item);
                    }}
                  />
                ) : null,
                perms.canDelete && !item.is_default ? (
                  <Popconfirm
                    key="delete"
                    title={t('app.kuaiplm.gateTemplates.confirmDelete')}
                    onConfirm={(e) => {
                      e?.stopPropagation();
                      void handleDeleteTemplate(item);
                    }}
                    onCancel={(e) => e?.stopPropagation()}
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>
                ) : null,
              ].filter(Boolean)}
            >
              <List.Item.Meta
                title={
                  <Space>
                    {item.is_default ? (
                      <StarFilled style={{ color: 'var(--ant-color-warning)' }} />
                    ) : (
                      <StarOutlined style={{ opacity: 0.35 }} />
                    )}
                    <span>{item.template_name}</span>
                    {!item.is_active ? <Tag>{t('app.kuaiplm.gateTemplates.inactive')}</Tag> : null}
                  </Space>
                }
                description={
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {(() => {
                      const preferred = resolvePlmPreferredAudit(item as unknown as Record<string, unknown>);
                      return `${item.template_code} - ${t('app.kuaiplm.gateTemplates.stageCount', { count: item.stage_count ?? 0 })} - ${preferred.operator} - ${preferred.time}`;
                    })()}
                  </Typography.Text>
                }
              />
            </List.Item>
          )}
        />
        </Spin>
      </div>
    </div>
  );

  const rightPanel = detailLoading ? (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
      <Spin />
    </div>
  ) : !detail ? (
    <Empty description={t('app.kuaiplm.gateTemplates.selectTemplate')} />
  ) : (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Typography.Title level={5} style={{ margin: 0 }}>
          {detail.template_name}
        </Typography.Title>
        {detail.is_default ? (
          <Badge count={t('app.kuaiplm.gateTemplates.defaultBadge')} style={{ backgroundColor: '#faad14' }} />
        ) : null}
        <Typography.Text type="secondary">{detail.template_code}</Typography.Text>
      </Space>

      <Space style={{ marginBottom: 16 }} wrap>
        {perms.canUpdate && !detail.is_default ? (
          <Button icon={<StarOutlined />} onClick={() => void handleSetDefault()}>
            {t('app.kuaiplm.gateTemplates.actions.setDefault')}
          </Button>
        ) : null}
        {perms.canUpdate ? (
          <>
            <span>{t('common.enabled')}</span>
            <Switch
              checked={detail.is_active}
              disabled={detail.is_default}
              onChange={(checked) => void handleToggleActive(checked)}
            />
          </>
        ) : null}
        {perms.canUpdate ? (
          <Button icon={<PlusOutlined />} onClick={handleAddStage}>
            {t('app.kuaiplm.gateTemplates.actions.addStage')}
          </Button>
        ) : null}
        {perms.canUpdate ? (
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => void handleSaveStages()}>
            {t('app.kuaiplm.gateTemplates.actions.saveStages')}
          </Button>
        ) : null}
      </Space>

      <Table<EditableStage>
        rowKey="_key"
        size="small"
        pagination={false}
        columns={stageColumns}
        dataSource={stages}
        expandable={{
          expandedRowKeys,
          onExpandedRowsChange: (keys) => setExpandedRowKeys([...keys]),
          expandedRowRender: (record, index) => {
            const deliverables = record.deliverables ?? [];
            return (
              <div style={{ padding: '8px 0' }}>
                <Space style={{ marginBottom: 8 }}>
                  <Typography.Text strong>{t('app.kuaiplm.gateTemplates.defaultDeliverables')}</Typography.Text>
                  {perms.canUpdate ? (
                    <Button
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setStages((prev) =>
                          prev.map((s, i) =>
                            i === index
                              ? {
                                  ...s,
                                  deliverables: [
                                    ...(s.deliverables ?? []),
                                    { name: t('app.kuaiplm.gateTemplates.newDeliverable'), deliverable_type: 'document' },
                                  ],
                                }
                              : s,
                          ),
                        );
                      }}
                    >
                      {t('app.kuaiplm.gateTemplates.actions.addDeliverable')}
                    </Button>
                  ) : null}
                </Space>
                <Table
                  size="small"
                  pagination={false}
                  rowKey={(_, dIdx) => `${record._key}-d-${dIdx}`}
                  dataSource={deliverables}
                  columns={[
                    {
                      title: t('app.kuaiplm.gateTemplates.columns.deliverableName'),
                      render: (_, deliv, dIdx) => (
                        <Input
                          value={deliv.name}
                          disabled={!perms.canUpdate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setStages((prev) =>
                              prev.map((s, i) => {
                                if (i !== index) return s;
                                const next = [...(s.deliverables ?? [])];
                                next[dIdx] = { ...next[dIdx], name: val };
                                return { ...s, deliverables: next };
                              }),
                            );
                          }}
                        />
                      ),
                    },
                    {
                      title: t('app.kuaiplm.gateTemplates.columns.deliverableType'),
                      width: 160,
                      render: (_, deliv, dIdx) => (
                        <Input
                          value={deliv.deliverable_type ?? ''}
                          disabled={!perms.canUpdate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setStages((prev) =>
                              prev.map((s, i) => {
                                if (i !== index) return s;
                                const next = [...(s.deliverables ?? [])];
                                next[dIdx] = { ...next[dIdx], deliverable_type: val };
                                return { ...s, deliverables: next };
                              }),
                            );
                          }}
                        />
                      ),
                    },
                    {
                      title: t('common.actions'),
                      width: 80,
                      render: (_, __, dIdx) =>
                        perms.canUpdate ? (
                          <Button
                            type="link"
                            danger
                            size="small"
                            onClick={() => {
                              setStages((prev) =>
                                prev.map((s, i) => {
                                  if (i !== index) return s;
                                  return {
                                    ...s,
                                    deliverables: (s.deliverables ?? []).filter((_, j) => j !== dIdx),
                                  };
                                }),
                              );
                            }}
                          >
                            {t('common.delete')}
                          </Button>
                        ) : null,
                    },
                  ]}
                />
              </div>
            );
          },
        }}
      />
    </div>
  );

  return (
    <div style={{ flex: 1, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TwoColumnLayout
        style={{ flex: 1, minHeight: 0, height: '100%' }}
        leftPanel={{ width: 320, minWidth: 260, leftContent: leftPanel }}
        rightPanel={{ content: rightPanel }}
      />
    </div>
  );
};

const GateTemplatesPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTabKey, setActiveTabKey] = useState<GateProjectType>('RD');

  const tabs = useMemo(
    () => [
      {
        key: 'RD',
        label: t('app.kuaiplm.gateTemplates.tab.rd'),
        children: <GateTemplateTabPanel projectType="RD" />,
      },
      {
        key: 'DELIVERY',
        label: t('app.kuaiplm.gateTemplates.tab.delivery'),
        children: <GateTemplateTabPanel projectType="DELIVERY" />,
      },
    ],
    [t],
  );

  return (
    <MultiTabListPageTemplate
      activeTabKey={activeTabKey}
      onTabChange={(key) => setActiveTabKey(key as GateProjectType)}
      preserveMounted
      tabs={tabs}
    />
  );
};

export default GateTemplatesPage;
