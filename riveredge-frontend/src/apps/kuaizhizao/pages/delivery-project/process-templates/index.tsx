/**
 * 交付流程模板（样式对齐 kuaiplm 阶段管理）
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Badge,
  Button,
  Empty,
  Input,
  InputNumber,
  List,
  Popconfirm,
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
import { ListPageTemplate, TwoColumnLayout } from '../../../../../components/layout-templates';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { formatDateTimeBySiteSetting } from '../../../../../utils/format';
import {
  deliveryProcessTemplateApi,
  type DeliveryProcessTemplate,
  type DeliveryProcessTemplateNode,
} from '../../../services/delivery-project';

const RESOURCE = 'kuaizhizao:delivery-process-template';
const GT = 'app.kuaiplm.gateTemplates';

type EditableNode = DeliveryProcessTemplateNode & { _key: string };

const newNodeKey = () => `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const emptyNode = (sort: number, label: string): EditableNode => ({
  _key: newNodeKey(),
  node_key: `node_${sort}`,
  node_name: label,
  sort_order: sort,
  planned_duration_days: 1,
  is_critical: false,
  is_milestone: false,
  tasks: [],
});

const ProcessTemplatesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi, modal } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);

  const [templates, setTemplates] = useState<DeliveryProcessTemplate[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<number>();
  const [detail, setDetail] = useState<DeliveryProcessTemplate | null>(null);
  const [nodes, setNodes] = useState<EditableNode[]>([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);

  const loadTemplates = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await deliveryProcessTemplateApi.list({ limit: 100 });
      setTemplates(res.items);
      if (res.items.length === 0) {
        setSelectedId(undefined);
        setDetail(null);
        setNodes([]);
        return;
      }
      setSelectedId((prev) => {
        if (prev && res.items.some((item) => item.id === prev)) return prev;
        const defaultTpl = res.items.find((item) => item.is_default) ?? res.items[0];
        return defaultTpl.id;
      });
    } catch (error: unknown) {
      messageApi.error((error as Error)?.message || t(`${GT}.messages.loadFailed`));
      setTemplates([]);
    } finally {
      setListLoading(false);
    }
  }, [messageApi, t]);

  const loadDetail = useCallback(
    async (id: number) => {
      setDetailLoading(true);
      try {
        const res = await deliveryProcessTemplateApi.get(id);
        setDetail(res);
        setNodes(
          (res.nodes ?? []).map((node) => ({
            ...node,
            tasks: node.tasks ?? [],
            _key: String(node.id ?? newNodeKey()),
          })),
        );
      } catch (error: unknown) {
        messageApi.error((error as Error)?.message || t(`${GT}.messages.loadDetailFailed`));
        setDetail(null);
        setNodes([]);
      } finally {
        setDetailLoading(false);
      }
    },
    [messageApi, t],
  );

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else {
      setDetail(null);
      setNodes([]);
    }
  }, [selectedId, loadDetail]);

  const handleCreateTemplate = useCallback(() => {
    let name = '';
    modal.confirm({
      title: t(`${GT}.actions.create`),
      content: (
        <Input
          placeholder={t(`${GT}.form.templateName`)}
          onChange={(e) => {
            name = e.target.value;
          }}
        />
      ),
      onOk: async () => {
        if (!name.trim()) {
          messageApi.warning(t(`${GT}.messages.nameRequired`));
          return Promise.reject();
        }
        try {
          const created = await deliveryProcessTemplateApi.create({
            template_name: name.trim(),
            project_type: 'ETO',
            nodes: detail?.nodes?.length
              ? detail.nodes.map((n, idx) => ({
                  node_key: n.node_key,
                  node_name: n.node_name,
                  sort_order: n.sort_order || idx + 1,
                  planned_duration_days: n.planned_duration_days,
                  is_critical: n.is_critical,
                  is_milestone: n.is_milestone,
                  default_owner_role: n.default_owner_role,
                }))
              : [emptyNode(1, t(`${GT}.newStageName`, { order: 1 }))],
          });
          messageApi.success(t('common.createSuccess'));
          await loadTemplates();
          setSelectedId(created.id);
        } catch (error: unknown) {
          messageApi.error((error as Error)?.message || t('common.createFailed'));
          return Promise.reject();
        }
      },
    });
  }, [detail?.nodes, loadTemplates, messageApi, modal, t]);

  useNewShortcut(perms.canCreate ? handleCreateTemplate : undefined);

  const handleCopyTemplate = async (tpl: DeliveryProcessTemplate) => {
    try {
      const full = tpl.nodes?.length ? tpl : await deliveryProcessTemplateApi.get(tpl.id);
      const created = await deliveryProcessTemplateApi.create({
        template_name: `${tpl.template_name} ${t(`${GT}.copySuffix`)}`,
        project_type: tpl.project_type ?? 'ETO',
        nodes: (full.nodes ?? []).map((n, idx) => ({
          node_key: n.node_key,
          node_name: n.node_name,
          sort_order: n.sort_order || idx + 1,
          planned_duration_days: n.planned_duration_days,
          is_critical: n.is_critical,
          is_milestone: n.is_milestone,
          default_owner_role: n.default_owner_role,
        })),
      });
      messageApi.success(t('common.createSuccess'));
      await loadTemplates();
      setSelectedId(created.id);
    } catch (error: unknown) {
      messageApi.error((error as Error)?.message || t('common.createFailed'));
    }
  };

  const handleSetDefault = async () => {
    if (!detail?.id) return;
    try {
      await deliveryProcessTemplateApi.setDefault(detail.id);
      messageApi.success(t(`${GT}.messages.setDefaultSuccess`));
      await loadTemplates();
      await loadDetail(detail.id);
    } catch (error: unknown) {
      messageApi.error((error as Error)?.message || t(`${GT}.messages.setDefaultFailed`));
    }
  };

  const handleToggleActive = async (checked: boolean) => {
    if (!detail?.id) return;
    try {
      await deliveryProcessTemplateApi.update(detail.id, { is_active: checked });
      messageApi.success(t('common.updateSuccess'));
      await loadTemplates();
      await loadDetail(detail.id);
    } catch (error: unknown) {
      messageApi.error((error as Error)?.message || t('common.updateFailed'));
    }
  };

  const handleDeleteTemplate = async (tpl: DeliveryProcessTemplate) => {
    try {
      await deliveryProcessTemplateApi.delete(tpl.id);
      messageApi.success(t('common.deleteSuccess'));
      await loadTemplates();
    } catch (error: unknown) {
      messageApi.error((error as Error)?.message || t('common.deleteFailed'));
    }
  };

  const handleAddStage = () => {
    const nextOrder = nodes.length > 0 ? Math.max(...nodes.map((n) => n.sort_order ?? 0)) + 1 : 1;
    setNodes((prev) => [
      ...prev,
      emptyNode(nextOrder, t(`${GT}.newStageName`, { order: nextOrder })),
    ]);
  };

  const handleSaveStages = async () => {
    if (!detail?.id) return;
    if (nodes.length === 0) {
      messageApi.warning(t(`${GT}.messages.stageRequired`));
      return;
    }
    const keys = nodes.map((n) => n.node_key.trim());
    if (new Set(keys).size !== keys.length) {
      messageApi.warning(t(`${GT}.messages.duplicateGateKey`));
      return;
    }

    setSaving(true);
    try {
      const payload = nodes.map((node, idx) => ({
        node_key: node.node_key.trim(),
        node_name: node.node_name.trim(),
        sort_order: node.sort_order || idx + 1,
        planned_duration_days: node.planned_duration_days ?? 0,
        is_critical: node.is_critical,
        is_milestone: node.is_milestone,
        default_owner_role: node.default_owner_role,
        tasks: (node.tasks ?? []).map((task, tIdx) => ({
          task_key: (task.task_key || `task_${tIdx + 1}`).trim(),
          task_name: task.task_name.trim(),
          sort_order: task.sort_order ?? tIdx + 1,
          default_owner_role: task.default_owner_role,
          planned_duration_days: task.planned_duration_days ?? 0,
        })),
      }));
      const updated = await deliveryProcessTemplateApi.update(detail.id, { nodes: payload });
      messageApi.success(t('common.updateSuccess'));
      setDetail(updated);
      setNodes(
        (updated.nodes ?? []).map((node) => ({
          ...node,
          tasks: node.tasks ?? [],
          _key: String(node.id ?? newNodeKey()),
        })),
      );
      await loadTemplates();
    } catch (error: unknown) {
      messageApi.error((error as Error)?.message || t('common.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  const stageColumns: ColumnsType<EditableNode> = useMemo(
    () => [
      {
        title: t(`${GT}.columns.sortOrder`),
        width: 72,
        render: (_, __, index) => index + 1,
      },
      {
        title: t(`${GT}.columns.gateKey`),
        dataIndex: 'node_key',
        width: 140,
        render: (_, record, index) => (
          <Input
            value={record.node_key}
            disabled={!perms.canUpdate}
            onChange={(e) => {
              const val = e.target.value;
              setNodes((prev) => prev.map((n, i) => (i === index ? { ...n, node_key: val } : n)));
            }}
          />
        ),
      },
      {
        title: t(`${GT}.columns.gateName`),
        dataIndex: 'node_name',
        render: (_, record, index) => (
          <Input
            value={record.node_name}
            disabled={!perms.canUpdate}
            onChange={(e) => {
              const val = e.target.value;
              setNodes((prev) => prev.map((n, i) => (i === index ? { ...n, node_name: val } : n)));
            }}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.deliveryProject.fields.durationDays'),
        dataIndex: 'planned_duration_days',
        width: 100,
        render: (_, record, index) => (
          <InputNumber
            min={0}
            style={{ width: '100%' }}
            value={record.planned_duration_days}
            disabled={!perms.canUpdate}
            onChange={(val) => {
              setNodes((prev) =>
                prev.map((n, i) =>
                  i === index ? { ...n, planned_duration_days: Number(val ?? 0) } : n,
                ),
              );
            }}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.deliveryProject.fields.isCritical'),
        dataIndex: 'is_critical',
        width: 88,
        render: (_, record, index) => (
          <Switch
            size="small"
            checked={record.is_critical}
            disabled={!perms.canUpdate}
            onChange={(checked) => {
              setNodes((prev) => prev.map((n, i) => (i === index ? { ...n, is_critical: checked } : n)));
            }}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.deliveryProject.fields.isMilestone'),
        dataIndex: 'is_milestone',
        width: 88,
        render: (_, record, index) => (
          <Switch
            size="small"
            checked={record.is_milestone}
            disabled={!perms.canUpdate}
            onChange={(checked) => {
              setNodes((prev) => prev.map((n, i) => (i === index ? { ...n, is_milestone: checked } : n)));
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
              onClick={() => setNodes((prev) => prev.filter((_, i) => i !== index))}
            >
              {t('common.delete')}
            </Button>
          ) : null,
      },
    ],
    [perms.canUpdate, t],
  );

  const leftPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, padding: 8 }}>
      <Space style={{ marginBottom: 12, flexShrink: 0 }} wrap>
        {perms.canCreate ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateTemplate}>
            {t(`${GT}.actions.create`) + NEW_SHORTCUT_HINT}
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
            locale={{ emptyText: <Empty description={t(`${GT}.emptyTemplates`)} /> }}
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
                      title={t(`${GT}.confirmDelete`)}
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
                      {!item.is_active ? <Tag>{t(`${GT}.inactive`)}</Tag> : null}
                    </Space>
                  }
                  description={
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {`${item.template_code} - ${t(`${GT}.stageCount`, { count: item.nodes?.length ?? 0 })}${
                        item.updated_at ? ` - ${formatDateTimeBySiteSetting(item.updated_at)}` : ''
                      }`}
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
    <Empty description={t(`${GT}.selectTemplate`)} />
  ) : (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Typography.Title level={5} style={{ margin: 0 }}>
          {detail.template_name}
        </Typography.Title>
        {detail.is_default ? (
          <Badge count={t(`${GT}.defaultBadge`)} style={{ backgroundColor: '#faad14' }} />
        ) : null}
        <Typography.Text type="secondary">{detail.template_code}</Typography.Text>
      </Space>

      <Space style={{ marginBottom: 16 }} wrap>
        {perms.canUpdate && !detail.is_default ? (
          <Button icon={<StarOutlined />} onClick={() => void handleSetDefault()}>
            {t(`${GT}.actions.setDefault`)}
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
            {t(`${GT}.actions.addStage`)}
          </Button>
        ) : null}
        {perms.canUpdate ? (
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => void handleSaveStages()}>
            {t(`${GT}.actions.saveStages`)}
          </Button>
        ) : null}
      </Space>

      <Table<EditableNode>
        rowKey="_key"
        size="small"
        pagination={false}
        columns={stageColumns}
        dataSource={nodes}
        expandable={{
          expandedRowKeys,
          onExpandedRowsChange: (keys) => setExpandedRowKeys([...keys]),
          expandedRowRender: (record, index) => {
            const tasks = record.tasks ?? [];
            return (
              <div style={{ padding: '8px 0' }}>
                <Space style={{ marginBottom: 8 }}>
                  <Typography.Text strong>
                    {t('app.kuaizhizao.deliveryProject.templateNodeTasks')}
                  </Typography.Text>
                  {perms.canUpdate ? (
                    <Button
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        const nextOrder = tasks.length + 1;
                        setNodes((prev) =>
                          prev.map((n, i) =>
                            i === index
                              ? {
                                  ...n,
                                  tasks: [
                                    ...(n.tasks ?? []),
                                    {
                                      task_key: `task_${nextOrder}`,
                                      task_name: t('app.kuaizhizao.deliveryProject.newTemplateTask'),
                                      sort_order: nextOrder,
                                      planned_duration_days: 0,
                                    },
                                  ],
                                }
                              : n,
                          ),
                        );
                      }}
                    >
                      {t('app.kuaizhizao.deliveryProject.addTemplateTask')}
                    </Button>
                  ) : null}
                </Space>
                <Table
                  size="small"
                  pagination={false}
                  rowKey={(_, tIdx) => `${record._key}-t-${tIdx}`}
                  dataSource={tasks}
                  columns={[
                    {
                      title: t('app.kuaizhizao.deliveryProject.fields.taskKey'),
                      width: 140,
                      render: (_, task, tIdx) => (
                        <Input
                          value={task.task_key}
                          disabled={!perms.canUpdate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNodes((prev) =>
                              prev.map((n, i) => {
                                if (i !== index) return n;
                                const next = [...(n.tasks ?? [])];
                                next[tIdx] = { ...next[tIdx], task_key: val };
                                return { ...n, tasks: next };
                              }),
                            );
                          }}
                        />
                      ),
                    },
                    {
                      title: t('app.kuaizhizao.deliveryProject.fields.taskName'),
                      render: (_, task, tIdx) => (
                        <Input
                          value={task.task_name}
                          disabled={!perms.canUpdate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNodes((prev) =>
                              prev.map((n, i) => {
                                if (i !== index) return n;
                                const next = [...(n.tasks ?? [])];
                                next[tIdx] = { ...next[tIdx], task_name: val };
                                return { ...n, tasks: next };
                              }),
                            );
                          }}
                        />
                      ),
                    },
                    {
                      title: t('app.kuaizhizao.deliveryProject.fields.durationDays'),
                      width: 100,
                      render: (_, task, tIdx) => (
                        <InputNumber
                          min={0}
                          style={{ width: '100%' }}
                          value={task.planned_duration_days ?? 0}
                          disabled={!perms.canUpdate}
                          onChange={(val) => {
                            setNodes((prev) =>
                              prev.map((n, i) => {
                                if (i !== index) return n;
                                const next = [...(n.tasks ?? [])];
                                next[tIdx] = {
                                  ...next[tIdx],
                                  planned_duration_days: Number(val ?? 0),
                                };
                                return { ...n, tasks: next };
                              }),
                            );
                          }}
                        />
                      ),
                    },
                    {
                      title: t('common.actions'),
                      width: 80,
                      render: (_, __, tIdx) =>
                        perms.canUpdate ? (
                          <Button
                            type="link"
                            danger
                            size="small"
                            onClick={() => {
                              setNodes((prev) =>
                                prev.map((n, i) => {
                                  if (i !== index) return n;
                                  return {
                                    ...n,
                                    tasks: (n.tasks ?? []).filter((_, j) => j !== tIdx),
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
    <ListPageTemplate fillMain>
      <div style={{ flex: 1, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <TwoColumnLayout
          style={{ flex: 1, minHeight: 0, height: '100%' }}
          layoutPersistenceId="kuaizhizao.delivery-process-templates"
          leftPanel={{ leftContent: leftPanel }}
          rightPanel={{ content: rightPanel }}
        />
      </div>
    </ListPageTemplate>
  );
};

export default ProcessTemplatesPage;
