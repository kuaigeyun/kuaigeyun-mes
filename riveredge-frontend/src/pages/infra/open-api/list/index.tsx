/**
 * 开放 API 账套鉴权管理（金蝶式：账套 ID + 应用秘钥 + 细粒度 GET/POST 授权）
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Collapse,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import {
  CopyOutlined,
  KeyOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { ListPageTemplate } from '../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../utils/errorHandler';
import { useResourcePermissions } from '../../../../hooks/useResourcePermissions';
import {
  createOpenApiApp,
  deleteOpenApiApp,
  getOpenApiAccount,
  getOpenApiAppList,
  getOpenApiIntegrationGuide,
  getOpenApiModuleCatalog,
  OpenApiAccount,
  OpenApiApp,
  OpenApiIntegrationGuide,
  OpenApiModuleCatalogItem,
  resetOpenApiAppSecret,
  rotateOpenApiAcctId,
  updateOpenApiApp,
} from '../../../../services/openApi';
import { CODE_FONT_FAMILY } from '../../../../constants/fonts';
import { getTenantId, setTenantId } from '../../../../utils/auth';
import { resolveIsInfraSuperAdminSession } from '../../../../utils/infraSuperAdminSession';

const codeBlockStyle: React.CSSProperties = {
  fontFamily: CODE_FONT_FAMILY,
  fontSize: 12,
  background: 'var(--ant-color-fill-quaternary, #f5f5f5)',
  padding: 12,
  borderRadius: 6,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  margin: 0,
  maxHeight: 280,
  overflow: 'auto',
};

/** 按业务分组的细粒度权限勾选（value=permission_codes） */
const PermissionCodesPicker: React.FC<{
  catalog: OpenApiModuleCatalogItem[];
  value?: string[];
  onChange?: (codes: string[]) => void;
}> = ({ catalog, value = [], onChange }) => {
  const selected = useMemo(() => new Set(value), [value]);

  const setCodes = (next: string[]) => {
    onChange?.(Array.from(new Set(next)));
  };

  const toggleModule = (mod: OpenApiModuleCatalogItem, checked: boolean) => {
    const codes = mod.codes || (mod.actions || []).map((a) => a.code);
    if (checked) {
      setCodes([...value, ...codes]);
    } else {
      const drop = new Set(codes);
      setCodes(value.filter((c) => !drop.has(c)));
    }
  };

  const groups = useMemo(() => {
    const order = ['销售', '采购', '仓存', '生产', '质检', '委外', '计划交付', '售后物流', '主数据', '其他'];
    const map = new Map<string, OpenApiModuleCatalogItem[]>();
    catalog.forEach((m) => {
      const g = m.group || '其他';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(m);
    });
    return order
      .filter((g) => map.has(g))
      .concat([...map.keys()].filter((g) => !order.includes(g)))
      .map((g) => ({ group: g, modules: map.get(g)! }));
  }, [catalog]);

  const renderModule = (mod: OpenApiModuleCatalogItem) => {
    const actions = mod.actions || [];
    const codes = mod.codes || actions.map((a) => a.code);
    const picked = codes.filter((c) => selected.has(c));
    const all = codes.length > 0 && picked.length === codes.length;
    const some = picked.length > 0 && !all;
    return (
      <Card
        key={mod.module_key}
        size="small"
        style={{ marginBottom: 8 }}
        title={
          <Space wrap>
            <Checkbox
              checked={all}
              indeterminate={some}
              onChange={(e) => toggleModule(mod, e.target.checked)}
            >
              {mod.label}
            </Checkbox>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {mod.module_key}
            </Typography.Text>
          </Space>
        }
        extra={
          <Button type="link" size="small" onClick={() => toggleModule(mod, true)}>
            全选
          </Button>
        }
      >
        <Checkbox.Group
          style={{ width: '100%' }}
          value={picked}
          onChange={(vals) => {
            const drop = new Set(codes);
            const kept = value.filter((c) => !drop.has(c));
            setCodes([...kept, ...(vals as string[])]);
          }}
        >
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            {actions.map((a) => (
              <Checkbox key={a.code} value={a.code}>
                <Space size={6} wrap>
                  <span>{a.label}</span>
                  {(a.http_methods || []).map((m) => (
                    <Tag key={m} color={m === 'GET' ? 'blue' : m === 'DELETE' ? 'red' : 'orange'}>
                      {m}
                    </Tag>
                  ))}
                  <Typography.Text type="secondary" style={{ fontSize: 11, fontFamily: CODE_FONT_FAMILY }}>
                    {a.code}
                  </Typography.Text>
                </Space>
              </Checkbox>
            ))}
          </Space>
        </Checkbox.Group>
      </Card>
    );
  };

  return (
    <Collapse
      size="small"
      defaultActiveKey={groups.slice(0, 2).map((g) => g.group)}
      items={groups.map(({ group, modules }) => {
        const allCodes = modules.flatMap((m) => m.codes || (m.actions || []).map((a) => a.code));
        const pickedCount = allCodes.filter((c) => selected.has(c)).length;
        return {
          key: group,
          label: (
            <Space>
              <span>{group}</span>
              <Typography.Text type="secondary">
                {modules.length} 个单据
                {pickedCount > 0 ? ` · 已选 ${pickedCount}` : ''}
              </Typography.Text>
            </Space>
          ),
          children: modules.map(renderModule),
        };
      })}
    />
  );
};

const OpenApiPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const isInfraSuperAdmin = resolveIsInfraSuperAdminSession();
  const { canAction } = useResourcePermissions('system:open-api');
  const canManage = isInfraSuperAdmin || Boolean(canAction?.('manage'));

  const [tenantInput, setTenantInput] = useState<string>(() => {
    const tid = getTenantId();
    return tid != null ? String(tid) : '';
  });
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState<OpenApiAccount | null>(null);
  const [apps, setApps] = useState<OpenApiApp[]>([]);
  const [catalog, setCatalog] = useState<OpenApiModuleCatalogItem[]>([]);
  const [guide, setGuide] = useState<OpenApiIntegrationGuide | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editApp, setEditApp] = useState<OpenApiApp | null>(null);
  const [secretOnce, setSecretOnce] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const grantLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    catalog.forEach((m) => {
      (m.actions || []).forEach((a) => {
        map[a.code] = a.label;
      });
    });
    return map;
  }, [catalog]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [acct, list, mods, g] = await Promise.all([
        getOpenApiAccount(),
        getOpenApiAppList(),
        getOpenApiModuleCatalog(),
        getOpenApiIntegrationGuide(),
      ]);
      setAccount(acct);
      setApps(list);
      setCatalog(mods);
      setGuide(g);
    } catch (e) {
      messageApi.error(getApiErrorMessage(e, '加载失败'));
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleApplyTenant = () => {
    const n = Number(String(tenantInput || '').trim());
    if (!Number.isFinite(n) || n <= 0) {
      messageApi.warning('请输入有效的组织 ID');
      return;
    }
    setTenantId(n);
    messageApi.success(`已切换到组织 ${n}`);
    void loadAll();
  };

  const copyText = async (text: string, tip = '已复制') => {
    try {
      await navigator.clipboard.writeText(text);
      messageApi.success(tip);
    } catch {
      messageApi.warning('复制失败，请手动选择');
    }
  };

  const handleRotateAcct = async () => {
    try {
      const next = await rotateOpenApiAcctId();
      setAccount(next);
      messageApi.success('账套 ID 已重置');
      void loadAll();
    } catch (e) {
      messageApi.error(getApiErrorMessage(e, '重置失败'));
    }
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const created = await createOpenApiApp({
        name: values.name,
        permission_codes: values.permission_codes || [],
        module_keys: [],
        ip_allowlist: values.ip_allowlist || undefined,
      });
      setCreateOpen(false);
      form.resetFields();
      if (created.app_secret) {
        setSecretOnce(created.app_secret);
      }
      messageApi.success('应用已创建');
      void loadAll();
    } catch (e) {
      if ((e as { errorFields?: unknown })?.errorFields) return;
      messageApi.error(getApiErrorMessage(e, '创建失败'));
    }
  };

  const handleResetSecret = async (record: OpenApiApp) => {
    try {
      const updated = await resetOpenApiAppSecret(record.uuid);
      if (updated.app_secret) {
        setSecretOnce(updated.app_secret);
      }
      messageApi.success('秘钥已重置，请立即保存');
      void loadAll();
    } catch (e) {
      messageApi.error(getApiErrorMessage(e, '重置秘钥失败'));
    }
  };

  const openEdit = (record: OpenApiApp) => {
    setEditApp(record);
    editForm.setFieldsValue({
      name: record.name,
      status: record.status,
      ip_allowlist: record.ip_allowlist || '',
      permission_codes: record.grants || [],
    });
  };

  const handleUpdate = async () => {
    if (!editApp) return;
    try {
      const values = await editForm.validateFields();
      await updateOpenApiApp(editApp.uuid, {
        name: values.name,
        status: values.status,
        ip_allowlist: values.ip_allowlist || '',
        permission_codes: values.permission_codes || [],
        module_keys: [],
        update_grants: true,
      });
      setEditApp(null);
      messageApi.success('已保存');
      void loadAll();
    } catch (e) {
      if ((e as { errorFields?: unknown })?.errorFields) return;
      messageApi.error(getApiErrorMessage(e, '保存失败'));
    }
  };

  const handleDelete = async (record: OpenApiApp) => {
    try {
      await deleteOpenApiApp(record.uuid);
      messageApi.success('已删除');
      void loadAll();
    } catch (e) {
      messageApi.error(getApiErrorMessage(e, '删除失败'));
    }
  };

  const columns = [
    {
      title: '应用名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'App ID',
      dataIndex: 'app_id',
      key: 'app_id',
      render: (v: string) => (
        <Typography.Text copyable style={{ fontFamily: CODE_FONT_FAMILY }}>
          {v}
        </Typography.Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) =>
        v === 'active' ? <Tag color="success">启用</Tag> : <Tag>停用</Tag>,
    },
    {
      title: '已授权接口',
      dataIndex: 'grants',
      key: 'grants',
      render: (grants: string[]) =>
        (grants || []).length ? (
          <Space wrap size={[4, 4]}>
            {grants.map((g) => (
              <Tag key={g} title={g}>
                {grantLabelMap[g] || g.split(':').slice(-1)[0]}
              </Tag>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">未授权</Typography.Text>
        ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      render: (_: unknown, record: OpenApiApp) => (
        <Space wrap>
          {canManage && (
            <Button type="link" size="small" onClick={() => openEdit(record)}>
              编辑授权
            </Button>
          )}
          {canManage && (
            <Popconfirm title="重置后旧秘钥立即失效，确认？" onConfirm={() => handleResetSecret(record)}>
              <Button type="link" size="small" icon={<KeyOutlined />}>
                重置秘钥
              </Button>
            </Popconfirm>
          )}
          {canManage && (
            <Popconfirm title="确认删除该应用？" onConfirm={() => handleDelete(record)}>
              <Button type="link" size="small" danger>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const docModulePanels = useMemo(() => {
    if (!guide?.modules?.length) return [];
    const order = ['销售', '采购', '仓存', '生产', '质检', '委外', '计划交付', '售后物流', '主数据', '其他'];
    const map = new Map<string, typeof guide.modules>();
    guide.modules.forEach((m) => {
      const g = m.group || '其他';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(m);
    });
    const groups = order
      .filter((g) => map.has(g))
      .concat([...map.keys()].filter((g) => !order.includes(g)));

    const renderEndpoints = (mod: (typeof guide.modules)[number]) => (
      <Collapse
        size="small"
        items={(mod.endpoints || []).map((ep) => ({
          key: ep.code,
          label: (
            <Space wrap>
              <span>{ep.label}</span>
              {(ep.http_methods || []).map((m) => (
                <Tag key={m} color={m === 'GET' ? 'blue' : 'orange'}>
                  {m}
                </Tag>
              ))}
              <Typography.Text type="secondary" style={{ fontFamily: CODE_FONT_FAMILY, fontSize: 11 }}>
                {ep.path}
              </Typography.Text>
            </Space>
          ),
          children: (
            <Tabs
              size="small"
              items={[
                {
                  key: 'curl',
                  label: 'curl',
                  children: (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Button type="link" size="small" icon={<CopyOutlined />} onClick={() => copyText(ep.curl)}>
                        复制
                      </Button>
                      <pre style={codeBlockStyle}>{ep.curl}</pre>
                      {ep.curl_detail && (
                        <>
                          <Typography.Text type="secondary">详情 GET</Typography.Text>
                          <Button
                            type="link"
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={() => copyText(ep.curl_detail || '')}
                          >
                            复制
                          </Button>
                          <pre style={codeBlockStyle}>{ep.curl_detail}</pre>
                        </>
                      )}
                    </Space>
                  ),
                },
                {
                  key: 'python',
                  label: 'Python',
                  children: (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Button type="link" size="small" icon={<CopyOutlined />} onClick={() => copyText(ep.python)}>
                        复制
                      </Button>
                      <pre style={codeBlockStyle}>{ep.python}</pre>
                    </Space>
                  ),
                },
                ...(ep.sample_body
                  ? [
                      {
                        key: 'body',
                        label: '请求体示例',
                        children: (
                          <Space direction="vertical" style={{ width: '100%' }}>
                            <Button
                              type="link"
                              size="small"
                              icon={<CopyOutlined />}
                              onClick={() => copyText(ep.sample_body || '')}
                            >
                              复制
                            </Button>
                            <pre style={codeBlockStyle}>{ep.sample_body}</pre>
                          </Space>
                        ),
                      },
                    ]
                  : []),
                ...(ep.request_fields?.groups?.length
                  ? [
                      {
                        key: 'fields',
                        label: `请求字段（${ep.request_fields.field_count}）`,
                        children: (
                          <Space direction="vertical" size={12} style={{ width: '100%' }}>
                            <Typography.Text type="secondary">
                              Schema：{ep.request_fields.schema}
                              {ep.request_fields.schema_module
                                ? ` · ${ep.request_fields.schema_module}`
                                : ''}
                            </Typography.Text>
                            {(ep.request_fields.groups || []).map((g) => (
                              <div key={g.category}>
                                <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>
                                  {g.category}
                                  <Typography.Text type="secondary" style={{ marginLeft: 8, fontWeight: 400 }}>
                                    {g.fields.length} 项
                                  </Typography.Text>
                                </Typography.Text>
                                <Table
                                  size="small"
                                  pagination={false}
                                  rowKey={(r) => r.name}
                                  dataSource={g.fields}
                                  columns={[
                                    {
                                      title: '字段',
                                      dataIndex: 'name',
                                      width: 220,
                                      render: (v: string) => (
                                        <Typography.Text code style={{ fontSize: 12 }}>
                                          {v}
                                        </Typography.Text>
                                      ),
                                    },
                                    {
                                      title: '类型',
                                      dataIndex: 'type',
                                      width: 160,
                                      ellipsis: true,
                                      render: (v: string) => (
                                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                          {v}
                                        </Typography.Text>
                                      ),
                                    },
                                    {
                                      title: '必填',
                                      dataIndex: 'required',
                                      width: 64,
                                      render: (v: boolean) =>
                                        v ? <Tag color="red">是</Tag> : <Tag>否</Tag>,
                                    },
                                    {
                                      title: '说明',
                                      dataIndex: 'description',
                                      render: (v?: string | null) => v || '—',
                                    },
                                  ]}
                                />
                              </div>
                            ))}
                          </Space>
                        ),
                      },
                    ]
                  : []),
                ...(ep.read_fields?.query?.groups?.length
                  ? [
                      {
                        key: 'query',
                        label: `查询参数（${ep.read_fields.query.field_count}）`,
                        children: (
                          <Space direction="vertical" size={12} style={{ width: '100%' }}>
                            {ep.read_fields.note ? (
                              <Typography.Text type="secondary">{ep.read_fields.note}</Typography.Text>
                            ) : null}
                            {ep.read_fields.list_path ? (
                              <Typography.Text type="secondary">
                                列表：<Typography.Text code>{ep.read_fields.list_path}</Typography.Text>
                              </Typography.Text>
                            ) : null}
                            {ep.read_fields.detail_path ? (
                              <Typography.Text type="secondary">
                                详情：<Typography.Text code>{ep.read_fields.detail_path}</Typography.Text>
                              </Typography.Text>
                            ) : null}
                            {(ep.read_fields.query.groups || []).map((g) => (
                              <div key={g.category}>
                                <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>
                                  {g.category}
                                  <Typography.Text type="secondary" style={{ marginLeft: 8, fontWeight: 400 }}>
                                    {g.fields.length} 项
                                  </Typography.Text>
                                </Typography.Text>
                                <Table
                                  size="small"
                                  pagination={false}
                                  rowKey={(r) => `${r.in || 'q'}-${r.name}`}
                                  dataSource={g.fields}
                                  columns={[
                                    {
                                      title: '参数',
                                      dataIndex: 'name',
                                      width: 180,
                                      render: (v: string) => (
                                        <Typography.Text code style={{ fontSize: 12 }}>
                                          {v}
                                        </Typography.Text>
                                      ),
                                    },
                                    {
                                      title: '位置',
                                      dataIndex: 'in',
                                      width: 72,
                                      render: (v?: string) => <Tag>{v === 'path' ? 'path' : 'query'}</Tag>,
                                    },
                                    {
                                      title: '类型',
                                      dataIndex: 'type',
                                      width: 140,
                                      ellipsis: true,
                                    },
                                    {
                                      title: '必填',
                                      dataIndex: 'required',
                                      width: 64,
                                      render: (v: boolean) =>
                                        v ? <Tag color="red">是</Tag> : <Tag>否</Tag>,
                                    },
                                    {
                                      title: '说明',
                                      dataIndex: 'description',
                                      render: (v?: string | null) => v || '—',
                                    },
                                  ]}
                                />
                              </div>
                            ))}
                          </Space>
                        ),
                      },
                    ]
                  : []),
                ...(ep.read_fields?.detail_response?.groups?.length ||
                ep.read_fields?.list_response?.groups?.length
                  ? [
                      {
                        key: 'response',
                        label: `响应字段（${
                          (ep.read_fields?.detail_response?.field_count ||
                            ep.read_fields?.list_response?.field_count ||
                            0)
                        }）`,
                        children: (
                          <Space direction="vertical" size={16} style={{ width: '100%' }}>
                            {ep.read_fields?.detail_response?.groups?.length ? (
                              <div>
                                <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                                  详情响应 · {ep.read_fields.detail_response.schema}
                                </Typography.Text>
                                {(ep.read_fields.detail_response.groups || []).map((g) => (
                                  <div key={`d-${g.category}`} style={{ marginBottom: 12 }}>
                                    <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>
                                      {g.category}
                                      <Typography.Text
                                        type="secondary"
                                        style={{ marginLeft: 8, fontWeight: 400 }}
                                      >
                                        {g.fields.length} 项
                                      </Typography.Text>
                                    </Typography.Text>
                                    <Table
                                      size="small"
                                      pagination={false}
                                      rowKey={(r) => `d-${r.name}`}
                                      dataSource={g.fields}
                                      columns={[
                                        {
                                          title: '字段',
                                          dataIndex: 'name',
                                          width: 220,
                                          render: (v: string) => (
                                            <Typography.Text code style={{ fontSize: 12 }}>
                                              {v}
                                            </Typography.Text>
                                          ),
                                        },
                                        {
                                          title: '类型',
                                          dataIndex: 'type',
                                          width: 160,
                                          ellipsis: true,
                                        },
                                        {
                                          title: '说明',
                                          dataIndex: 'description',
                                          render: (v?: string | null) => v || '—',
                                        },
                                      ]}
                                    />
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            {ep.read_fields?.list_response?.groups?.length ? (
                              <div>
                                <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                                  列表响应 · {ep.read_fields.list_response.schema}
                                </Typography.Text>
                                {(ep.read_fields.list_response.groups || []).map((g) => (
                                  <div key={`l-${g.category}`} style={{ marginBottom: 12 }}>
                                    <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>
                                      {g.category}
                                      <Typography.Text
                                        type="secondary"
                                        style={{ marginLeft: 8, fontWeight: 400 }}
                                      >
                                        {g.fields.length} 项
                                      </Typography.Text>
                                    </Typography.Text>
                                    <Table
                                      size="small"
                                      pagination={false}
                                      rowKey={(r) => `l-${r.name}`}
                                      dataSource={g.fields}
                                      columns={[
                                        {
                                          title: '字段',
                                          dataIndex: 'name',
                                          width: 220,
                                          render: (v: string) => (
                                            <Typography.Text code style={{ fontSize: 12 }}>
                                              {v}
                                            </Typography.Text>
                                          ),
                                        },
                                        {
                                          title: '类型',
                                          dataIndex: 'type',
                                          width: 160,
                                          ellipsis: true,
                                        },
                                        {
                                          title: '说明',
                                          dataIndex: 'description',
                                          render: (v?: string | null) => v || '—',
                                        },
                                      ]}
                                    />
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </Space>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          ),
        }))}
      />
    );

    return groups.map((g) => ({
      key: `group-${g}`,
      label: `${g}（${map.get(g)!.length}）`,
      children: (
        <Collapse
          size="small"
          items={map.get(g)!.map((mod) => ({
            key: mod.module_key,
            label: mod.label,
            children: renderEndpoints(mod),
          }))}
        />
      ),
    }));
  }, [guide, messageApi]);

  const authDocItems = guide
    ? [
        {
          key: 'auth',
          label: '换取 Token',
          children: (
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Typography.Text>
                POST{' '}
                <Typography.Text code>{guide.token_url_absolute || guide.token_url}</Typography.Text>
              </Typography.Text>
              <div>
                <Space style={{ marginBottom: 8 }}>
                  <Typography.Text strong>curl</Typography.Text>
                  <Button
                    type="link"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => copyText(guide.auth_examples?.curl || '')}
                  >
                    复制
                  </Button>
                </Space>
                <pre style={codeBlockStyle}>{guide.auth_examples?.curl}</pre>
              </div>
              <div>
                <Space style={{ marginBottom: 8 }}>
                  <Typography.Text strong>Python (httpx)</Typography.Text>
                  <Button
                    type="link"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => copyText(guide.auth_examples?.python || '')}
                  >
                    复制
                  </Button>
                </Space>
                <pre style={codeBlockStyle}>{guide.auth_examples?.python}</pre>
              </div>
              <div>
                <Typography.Text strong>响应示例</Typography.Text>
                <pre style={codeBlockStyle}>
                  {JSON.stringify(guide.auth_examples?.response_example, null, 2)}
                </pre>
              </div>
            </Space>
          ),
        },
        {
          key: 'matrix',
          label: '权限与 HTTP 对照',
          children: (
            <Table
              size="small"
              pagination={false}
              rowKey="action"
              dataSource={guide.permission_matrix || []}
              columns={[
                { title: '权限动作', dataIndex: 'action', key: 'action' },
                { title: 'HTTP', dataIndex: 'http', key: 'http' },
                { title: '说明', dataIndex: '说明', key: '说明' },
              ]}
            />
          ),
        },
        ...docModulePanels,
      ]
    : [];

  return (
    <ListPageTemplate
      title="开放 API"
      toolbarExtra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void loadAll()} loading={loading}>
            刷新
          </Button>
          {canManage && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                form.resetFields();
                form.setFieldsValue({ permission_codes: [] });
                setCreateOpen(true);
              }}
            >
              新建应用
            </Button>
          )}
        </Space>
      }
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="官方 PC/App 仍用登录 Token；对接与脚本请走账套+应用秘钥换票，并用 X-Client-Channel: integration。授权可细到 GET/POST 等动作。"
        />

        {isInfraSuperAdmin && (
          <Card title="组织上下文" size="small">
            <Space wrap>
              <Typography.Text>组织 ID：</Typography.Text>
              <Input
                style={{ width: 160 }}
                value={tenantInput}
                onChange={(e) => setTenantInput(e.target.value)}
                placeholder="X-Tenant-ID"
              />
              <Button type="primary" onClick={handleApplyTenant}>
                切换并加载
              </Button>
              <Typography.Text type="secondary">
                平台超管须指定组织后管理该租户的开放凭证
              </Typography.Text>
            </Space>
          </Card>
        )}

        <Card title="账套" size="small" loading={loading}>
          <Space wrap>
            <Typography.Text>账套 ID：</Typography.Text>
            <Typography.Text strong copyable style={{ fontFamily: CODE_FONT_FAMILY, fontSize: 16 }}>
              {account?.acct_id || '-'}
            </Typography.Text>
            {canManage && (
              <Popconfirm title="重置账套 ID 后，对接方需同步更新，确认？" onConfirm={handleRotateAcct}>
                <Button size="small">重置账套 ID</Button>
              </Popconfirm>
            )}
          </Space>
        </Card>

        <Card title="对接应用" size="small">
          <Table
            rowKey="uuid"
            loading={loading}
            columns={columns as any}
            dataSource={apps}
            pagination={false}
            size="middle"
          />
        </Card>

        {guide && (
          <Card title="API 使用文档（含完整示例）" size="small" loading={loading}>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="对接要点"
              description={
                <ul style={{ marginBottom: 0, paddingLeft: 18 }}>
                  {(guide.notes || []).map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              }
            />
            <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
              示例根地址：<Typography.Text code>{guide.base_url}</Typography.Text>
              （按当前站点自动生成，可复制后替换为正式域名）
            </Typography.Paragraph>
            <Collapse items={authDocItems} defaultActiveKey={['auth']} />
          </Card>
        )}
      </Space>

      <Modal
        title="新建开放应用"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        destroyOnClose
        width={720}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      >
        <Form form={form} layout="vertical" initialValues={{ permission_codes: [] }}>
          <Form.Item name="name" label="应用名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：正式 ERP 对接 / 测试脚本" maxLength={100} />
          </Form.Item>
          <Form.Item
            name="permission_codes"
            label="接口授权（按 HTTP / 动作）"
            extra="可只勾选 GET 查询，不必开放 POST 写权限"
          >
            <PermissionCodesPicker catalog={catalog} />
          </Form.Item>
          <Form.Item name="ip_allowlist" label="IP 白名单（可选，逗号分隔）">
            <Input placeholder="空=不限制" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑应用授权"
        open={!!editApp}
        onCancel={() => setEditApp(null)}
        onOk={handleUpdate}
        destroyOnClose
        width={720}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="应用名称" rules={[{ required: true }]}>
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select
              options={[
                { label: '启用', value: 'active' },
                { label: '停用', value: 'disabled' },
              ]}
            />
          </Form.Item>
          <Form.Item name="permission_codes" label="接口授权（按 HTTP / 动作）">
            <PermissionCodesPicker catalog={catalog} />
          </Form.Item>
          <Form.Item name="ip_allowlist" label="IP 白名单">
            <Input placeholder="空=不限制" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="请立即保存应用秘钥"
        open={!!secretOnce}
        onCancel={() => setSecretOnce(null)}
        footer={[
          <Button key="copy" type="primary" icon={<CopyOutlined />} onClick={() => secretOnce && copyText(secretOnce)}>
            复制秘钥
          </Button>,
          <Button key="ok" onClick={() => setSecretOnce(null)}>
            我已保存
          </Button>,
        ]}
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="秘钥仅显示一次，关闭后无法再次查看（可重置生成新秘钥）"
        />
        <Typography.Paragraph copyable style={{ fontFamily: CODE_FONT_FAMILY, fontSize: 15 }}>
          {secretOnce}
        </Typography.Paragraph>
      </Modal>
    </ListPageTemplate>
  );
};

export default OpenApiPage;
