import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Affix,
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Empty,
  List,
  Row,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
  theme,
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  MinusCircleOutlined,
  ReloadOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useRequest } from 'ahooks';
import { coordinationBoardApi, productionControlApi } from '../../../services/production';
import { getStatusLabel } from '../../../constants/documentStatus';
import { getDocumentLifecycleStageTagProps } from '../../../../../utils/documentLifecycleStatusTag';

const { Text, Link } = Typography;

/** 协调面板字号（整体比 antd small 规格略大一级） */
const TYPO = {
  panelTitle: 15,
  stageTitle: 16,
  deptLabel: 14,
  body: 14,
  secondary: 13,
  caption: 13,
};

type DocItem = { id: number; code: string; status: string; extra?: Record<string, unknown> };

type PipelineDocuments = {
  work_orders: DocItem[];
  outsource_work_orders: DocItem[];
  purchase_orders: DocItem[];
  purchase_requisitions?: DocItem[];
};

function DocStatusTag({ status }: { status: string }) {
  const tagProps = getDocumentLifecycleStageTagProps(status);
  return (
    <Tag {...tagProps} style={{ marginTop: 4, ...(tagProps.style ?? {}) }}>
      {getStatusLabel(status)}
    </Tag>
  );
}

interface RelatedDocumentsPanelProps {
  documents: PipelineDocuments;
  onNavigate: (path: string) => void;
}

const RelatedDocumentsPanel: React.FC<RelatedDocumentsPanelProps> = ({ documents, onNavigate }) => {
  const { token } = theme.useToken();
  const prList = documents.purchase_requisitions ?? [];

  const sections = [
    {
      key: 'pr',
      label: '采购申请',
      count: prList.length,
      items: prList,
      path: '/apps/kuaizhizao/purchase-management/purchase-requisitions',
    },
    {
      key: 'po',
      label: '采购订单',
      count: documents.purchase_orders.length,
      items: documents.purchase_orders,
      path: '/apps/kuaizhizao/purchase-management/purchase-orders',
    },
    {
      key: 'owo',
      label: '委外工单',
      count: documents.outsource_work_orders.length,
      items: documents.outsource_work_orders,
      path: '/apps/kuaizhizao/warehouse-management/batching-center?tab=outsource_issue',
    },
    {
      key: 'wo',
      label: '生产工单',
      count: documents.work_orders.length,
      items: documents.work_orders,
      path: '/apps/kuaizhizao/production-execution/work-orders',
    },
  ];

  return (
    <Affix offsetTop={16}>
      <Card
        title="关联单据"
        styles={{
          header: { fontSize: TYPO.panelTitle, minHeight: 40 },
          body: { padding: '8px 14px 14px', fontSize: TYPO.body },
        }}
        style={{
          width: '100%',
          borderRadius: token.borderRadiusLG,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        {sections.map((section, index) => (
          <div key={section.key}>
            {index > 0 && <Divider style={{ margin: '12px 0' }} />}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <Text strong style={{ fontSize: TYPO.body }}>
                {section.label}
              </Text>
              <Link
                style={{ fontSize: TYPO.secondary }}
                onClick={() => onNavigate(section.path)}
              >
                {section.count} 单 →
              </Link>
            </div>
            {section.items.length > 0 ? (
              <List
                split={false}
                dataSource={section.items}
                renderItem={(item) => (
                  <List.Item style={{ padding: '6px 0' }}>
                    <div style={{ width: '100%', minWidth: 0 }}>
                      <Link
                        ellipsis
                        onClick={() => onNavigate(section.path)}
                        style={{ fontSize: TYPO.body, display: 'block' }}
                      >
                        {item.code}
                      </Link>
                      <DocStatusTag status={item.status} />
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <Text type="secondary" style={{ fontSize: TYPO.secondary }}>暂无</Text>
            )}
          </div>
        ))}
      </Card>
    </Affix>
  );
};

type StageStatus = 'done' | 'pending' | 'blocked' | 'partial' | 'skipped';

type OrderLine = {
  material_id: number;
  material_code: string;
  material_name: string;
  material_spec?: string | null;
  unit?: string | null;
  quantity: number;
  delivery_date?: string | null;
  available_quantity: number;
};

type PipelineStage = {
  key: string;
  title: string;
  status: StageStatus;
  summary: string;
  blockers: string[];
  actions: { type: string; label: string; route?: string | null }[];
  lines?: OrderLine[];
};

type PipelineData = {
  computation?: { id?: number; code?: string; status?: string; demand_id?: number } | null;
  sales_order?: { id?: number; code?: string; delivery_date?: string };
  stages: PipelineStage[];
  documents: PipelineDocuments;
  work_order_ids: number[];
  dynamic_monitor_alerts: string[];
};

type ActiveOrderItem = {
  sales_order_id: number;
  sales_order_code: string;
  delivery_date?: string;
  computation_id?: number;
  computation_code?: string;
  demand_id?: number;
  bom_status?: string;
  incomplete_work_orders?: number;
  updated_at?: string;
};

const BOM_STATUS_LABEL: Record<string, string> = {
  done: 'BOM就绪',
  pending: 'BOM待检',
  blocked: '缺BOM',
  partial: 'BOM部分',
  skipped: '无需BOM',
};

const STATUS_ICON: Record<StageStatus, React.ReactNode> = {
  done: <CheckCircleOutlined />,
  pending: <ClockCircleOutlined />,
  blocked: <CloseCircleOutlined />,
  partial: <ExclamationCircleOutlined />,
  skipped: <MinusCircleOutlined />,
};

const STATUS_TAG: Record<StageStatus, { color: string; text: string }> = {
  done: { color: 'success', text: '完成' },
  pending: { color: 'warning', text: '待办' },
  blocked: { color: 'error', text: '阻塞' },
  partial: { color: 'processing', text: '进行中' },
  skipped: { color: 'default', text: '跳过' },
};

const STATUS_NODE_COLOR: Record<StageStatus, string> = {
  done: '#52c41a',
  pending: '#faad14',
  blocked: '#ff4d4f',
  partial: '#1677ff',
  skipped: '#d9d9d9',
};

/** 按责任部门分组；组内步骤横向并排，组与组之间纵向串联 */
const STAGE_GROUPS: { key: string; label: string; stageKeys: string[] }[] = [
  { key: 'sales', label: '销售订单', stageKeys: ['sales_order'] },
  { key: 'plan', label: '计划', stageKeys: ['bom_check', 'mrp'] },
  { key: 'purchase', label: '采购', stageKeys: ['purchase_follow', 'purchase_receipt'] },
  { key: 'warehouse', label: '仓储委外', stageKeys: ['outsource'] },
  { key: 'kitting', label: '物控齐套', stageKeys: ['kitting'] },
  { key: 'scheduling', label: '计划排程', stageKeys: ['scheduling'] },
  { key: 'production', label: '生产执行', stageKeys: ['release', 'production'] },
];

function aggregateGroupStatus(stages: PipelineStage[]): StageStatus {
  if (stages.some((s) => s.status === 'blocked')) return 'blocked';
  if (stages.some((s) => s.status === 'partial')) return 'partial';
  if (stages.some((s) => s.status === 'pending')) return 'pending';
  if (stages.every((s) => s.status === 'skipped')) return 'skipped';
  if (stages.every((s) => s.status === 'done' || s.status === 'skipped')) return 'done';
  return 'pending';
}

interface StageBlockProps {
  stage: PipelineStage;
  isActive: boolean;
  releasing: boolean;
  onAction: (action: { type: string; label: string; route?: string | null }) => void;
  token: ReturnType<typeof theme.useToken>['token'];
  horizontal?: boolean;
}

const StageBlock: React.FC<StageBlockProps> = ({ stage, isActive, releasing, onAction, token, horizontal }) => (
  <div
    style={{
      flex: horizontal ? '1 1 200px' : undefined,
      minWidth: horizontal ? 180 : undefined,
      width: stage.lines?.length ? '100%' : undefined,
      opacity: stage.status === 'skipped' ? 0.55 : 1,
    }}
  >
    {!(stage.lines?.length) && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <Text
          strong={isActive}
          style={{ fontSize: TYPO.stageTitle, color: isActive ? token.colorPrimary : undefined }}
        >
          {stage.title}
        </Text>
        <Tag color={STATUS_TAG[stage.status].color} style={{ margin: 0, fontSize: TYPO.caption }}>
          {STATUS_TAG[stage.status].text}
        </Tag>
        {isActive && <Tag color="blue" style={{ margin: 0, fontSize: TYPO.caption }}>当前</Tag>}
      </div>
    )}

    {stage.lines?.length ? (
      <>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
          <Space size={8} wrap>
            <Text strong style={{ fontSize: TYPO.stageTitle }}>{stage.title}</Text>
            <Tag color={STATUS_TAG[stage.status].color} style={{ margin: 0, fontSize: TYPO.caption }}>
              {STATUS_TAG[stage.status].text}
            </Tag>
            <Text type="secondary" style={{ fontSize: TYPO.secondary }}>{stage.summary}</Text>
          </Space>
          {stage.actions.length > 0 && (
            <Button size="small" onClick={() => onAction(stage.actions[0])}>
              {stage.actions[0].label}
            </Button>
          )}
        </div>
        <Table<OrderLine>
          size="small"
          pagination={false}
          rowKey={(row) => String(row.material_id)}
          scroll={{ x: 720 }}
          dataSource={stage.lines}
          columns={[
            {
              title: '商品编号',
              dataIndex: 'material_code',
              width: 110,
              ellipsis: true,
              render: (v: string) => <Text style={{ fontSize: TYPO.body }}>{v || '-'}</Text>,
            },
            {
              title: '名称',
              dataIndex: 'material_name',
              width: 140,
              ellipsis: true,
              render: (v: string) => <Text style={{ fontSize: TYPO.body }}>{v || '-'}</Text>,
            },
            {
              title: '规格',
              dataIndex: 'material_spec',
              width: 120,
              ellipsis: true,
              render: (v?: string | null) => (
                <Text type="secondary" style={{ fontSize: TYPO.secondary }}>{v || '-'}</Text>
              ),
            },
            {
              title: '数量',
              dataIndex: 'quantity',
              width: 90,
              align: 'right',
              render: (v: number, row) => (
                <Text style={{ fontSize: TYPO.body }}>
                  {v}{row.unit ? ` ${row.unit}` : ''}
                </Text>
              ),
            },
            {
              title: '交期',
              dataIndex: 'delivery_date',
              width: 100,
              render: (v?: string | null) => (
                <Text style={{ fontSize: TYPO.body }}>{v ? v.slice(0, 10) : '-'}</Text>
              ),
            },
            {
              title: '可用库存',
              dataIndex: 'available_quantity',
              width: 100,
              align: 'right',
              render: (v: number, row) => (
                <Text
                  style={{
                    fontSize: TYPO.body,
                    color: v < row.quantity ? token.colorWarning : undefined,
                    fontWeight: v < row.quantity ? 600 : undefined,
                  }}
                >
                  {v}{row.unit ? ` ${row.unit}` : ''}
                </Text>
              ),
            },
          ]}
        />
      </>
    ) : (
      <>
        <Text type="secondary" style={{ fontSize: TYPO.body, display: 'block', marginBottom: stage.blockers.length ? 6 : 8, lineHeight: 1.6 }}>
          {stage.summary}
        </Text>

        {stage.blockers.length > 0 && (
          <ul
            style={{
              margin: '0 0 8px',
              paddingLeft: 20,
              fontSize: TYPO.body,
              lineHeight: 1.6,
              color: stage.status === 'blocked' ? token.colorError : token.colorWarning,
            }}
          >
            {stage.blockers.slice(0, 4).map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        )}

        {stage.actions.length > 0 && (
          <Space wrap size={[6, 6]}>
            {stage.actions.map((action, i) => (
              <Button
                key={i}
                type={action.type === 'release_kitted' || isActive ? 'primary' : 'default'}
                ghost={isActive && action.type !== 'release_kitted'}
                loading={action.type === 'release_kitted' && releasing}
                icon={action.type === 'release_kitted' ? <RocketOutlined /> : undefined}
                onClick={() => onAction(action)}
              >
                {action.label}
              </Button>
            ))}
          </Space>
        )}
      </>
    )}
  </div>
);

interface CoordinationPipelinePanelProps {
  onRefreshSummary?: () => void;
}

const CoordinationPipelinePanel: React.FC<CoordinationPipelinePanelProps> = ({ onRefreshSummary }) => {
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const [selectedSalesOrderId, setSelectedSalesOrderId] = useState<number | undefined>();
  const [hoveredSalesOrderId, setHoveredSalesOrderId] = useState<number | null>(null);
  const [releasing, setReleasing] = useState(false);

  const { data: activeList, loading: listLoading, refresh: refreshList } = useRequest(async () => {
    return coordinationBoardApi.listActiveOrders(30);
  });

  const activeItems: ActiveOrderItem[] = activeList?.items ?? [];

  const incompleteItems = useMemo(
    () => activeItems.filter((item) => (item.incomplete_work_orders ?? 0) > 0),
    [activeItems],
  );

  const displayItems = incompleteItems.length > 0 ? incompleteItems : activeItems;

  useEffect(() => {
    if (!selectedSalesOrderId && displayItems.length > 0) {
      setSelectedSalesOrderId(displayItems[0].sales_order_id);
    }
  }, [displayItems, selectedSalesOrderId]);

  const {
    data: pipeline,
    loading: pipelineLoading,
    refresh: refreshPipeline,
  } = useRequest(
    async () => {
      if (!selectedSalesOrderId) return null;
      return coordinationBoardApi.getPipeline({ sales_order_id: selectedSalesOrderId });
    },
    { refreshDeps: [selectedSalesOrderId] },
  );

  const p = pipeline as PipelineData | null;

  const stageMap = useMemo(() => {
    const map = new Map<string, PipelineStage>();
    p?.stages?.forEach((s) => map.set(s.key, s));
    return map;
  }, [p]);

  const groupedStages = useMemo(() => {
    if (!p?.stages?.length) return [];
    return STAGE_GROUPS.map((group) => ({
      ...group,
      stages: group.stageKeys
        .map((key) => stageMap.get(key))
        .filter((s): s is PipelineStage => !!s),
    })).filter((g) => g.stages.length > 0);
  }, [p, stageMap]);

  const activeStageKey = useMemo(() => {
    if (!p?.stages?.length) return null;
    const found = p.stages.find((s) => s.status !== 'done' && s.status !== 'skipped');
    return found?.key ?? null;
  }, [p]);

  const handleRefresh = useCallback(() => {
    refreshList();
    refreshPipeline();
    onRefreshSummary?.();
  }, [refreshList, refreshPipeline, onRefreshSummary]);

  const handleAction = useCallback(
    async (action: { type: string; label: string; route?: string | null }) => {
      if (action.type === 'navigate' && action.route) {
        navigate(action.route);
        return;
      }
      if (action.type === 'refresh') {
        handleRefresh();
        message.success('已刷新协调管道');
        return;
      }
      if (action.type === 'release_kitted') {
        try {
          setReleasing(true);
          const res = await productionControlApi.releaseKitted([]);
          const count = res?.count ?? 0;
          if (count > 0) {
            message.success(`成功下达 ${count} 个齐套工单`);
          } else {
            message.info('当前无符合齐套条件的草稿工单');
          }
          handleRefresh();
        } catch (err: any) {
          message.error(err?.message || '齐套下达失败');
        } finally {
          setReleasing(false);
        }
      }
    },
    [navigate, handleRefresh],
  );

  if (listLoading && !activeItems.length) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin tip="加载协调数据..." />
      </div>
    );
  }

  if (!activeItems.length) {
    return (
      <Empty
        description="暂无已审核的销售订单，请先在「销售订单」中创建并审核订单"
        style={{ padding: 48 }}
      >
        <Button type="primary" onClick={() => navigate('/apps/kuaizhizao/sales-management/sales-orders')}>
          前往销售订单
        </Button>
      </Empty>
    );
  }

  return (
    <div style={{ marginTop: 12, fontSize: TYPO.body }}>
      <Row gutter={0} wrap={false}>
        {/* 左栏：未完成订单 */}
        <Col
          flex="0 0 280px"
          style={{
            borderRight: `1px solid ${token.colorBorderSecondary}`,
            paddingRight: 16,
            maxHeight: 'calc(100vh - 320px)',
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <Text strong style={{ fontSize: TYPO.panelTitle }}>未完成订单</Text>
            <Button type="text" icon={<ReloadOutlined />} onClick={handleRefresh} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {displayItems.map((item) => {
              const selected = item.sales_order_id === selectedSalesOrderId;
              const hovered = item.sales_order_id === hoveredSalesOrderId;
              const pending = item.incomplete_work_orders ?? 0;
              const bomLabel = BOM_STATUS_LABEL[item.bom_status ?? ''] ?? item.bom_status;
              const itemBg = selected
                ? token.colorFillSecondary
                : hovered
                  ? token.colorFillQuaternary
                  : 'transparent';
              return (
                <div
                  key={item.sales_order_id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedSalesOrderId(item.sales_order_id)}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedSalesOrderId(item.sales_order_id)}
                  onMouseEnter={() => setHoveredSalesOrderId(item.sales_order_id)}
                  onMouseLeave={() => setHoveredSalesOrderId(null)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: token.borderRadiusLG,
                    cursor: 'pointer',
                    background: itemBg,
                    transition: 'background 0.2s ease',
                  }}
                >
                  <Text
                    ellipsis
                    style={{
                      display: 'block',
                      fontSize: TYPO.body,
                      fontWeight: selected ? 600 : 400,
                      color: token.colorText,
                      lineHeight: 1.4,
                    }}
                  >
                    {item.sales_order_code}
                  </Text>
                  {item.computation_code && (
                    <Text
                      type="secondary"
                      ellipsis
                      style={{ display: 'block', fontSize: TYPO.caption, marginTop: 2, lineHeight: 1.4 }}
                    >
                      {item.computation_code}
                    </Text>
                  )}
                  <Space size={4} wrap style={{ marginTop: 6 }}>
                    {item.bom_status && item.bom_status !== 'done' && item.bom_status !== 'skipped' && (
                      <Tag
                        bordered={false}
                        color={
                          item.bom_status === 'blocked'
                            ? 'error'
                            : item.bom_status === 'partial'
                              ? 'processing'
                              : 'warning'
                        }
                        style={{ margin: 0, fontSize: 12 }}
                      >
                        {bomLabel}
                      </Tag>
                    )}
                    {pending > 0 ? (
                      <Tag bordered={false} color="processing" style={{ margin: 0, fontSize: 12 }}>
                        {pending} 单在制
                      </Tag>
                    ) : !item.computation_id ? (
                      <Tag bordered={false} color="orange" style={{ margin: 0, fontSize: 12 }}>
                        待MRP
                      </Tag>
                    ) : (
                      <Tag bordered={false} color="cyan" style={{ margin: 0, fontSize: 12 }}>
                        协调中
                      </Tag>
                    )}
                  </Space>
                </div>
              );
            })}
          </div>
        </Col>

        {/* 中栏：计划塔 */}
        <Col
          flex="1"
          style={{
            paddingLeft: 20,
            paddingRight: 16,
            minWidth: 0,
            borderRight: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          {p?.dynamic_monitor_alerts?.length ? (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message="上游/下游变更提醒"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {p.dynamic_monitor_alerts.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              }
            />
          ) : null}

          <Spin spinning={pipelineLoading}>
            {p ? (
              <>
                <div style={{ marginBottom: 14 }}>
                  <Space size={10} wrap>
                    {p.sales_order?.code && <Tag color="blue" style={{ fontSize: TYPO.caption }}>{p.sales_order.code}</Tag>}
                    {p.computation?.code && (
                      <Text type="secondary" style={{ fontSize: TYPO.body }}>{p.computation.code}</Text>
                    )}
                    {p.sales_order?.delivery_date && (
                      <Tag style={{ margin: 0, fontSize: TYPO.caption }}>交期 {p.sales_order.delivery_date.slice(0, 10)}</Tag>
                    )}
                  </Space>
                </div>

                {/* 塔身：部门纵向 + 组内横向 */}
                <div style={{ paddingLeft: 4 }}>
                  {groupedStages.map((group, groupIndex) => {
                    const isLastGroup = groupIndex === groupedStages.length - 1;
                    const groupStatus = aggregateGroupStatus(group.stages);
                    const nodeColor = STATUS_NODE_COLOR[groupStatus];
                    const isMulti = group.stages.length > 1;

                    return (
                      <div key={group.key} style={{ display: 'flex', gap: 16 }}>
                        {/* 部门时间线节点 */}
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            flexShrink: 0,
                            width: 32,
                          }}
                        >
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              background: nodeColor,
                              color: groupStatus === 'skipped' ? token.colorTextSecondary : '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 16,
                              flexShrink: 0,
                            }}
                          >
                            {STATUS_ICON[groupStatus]}
                          </div>
                          {!isLastGroup && (
                            <div
                              style={{
                                width: 2,
                                flex: 1,
                                minHeight: 16,
                                background: token.colorBorderSecondary,
                                margin: '4px 0',
                              }}
                            />
                          )}
                        </div>

                        {/* 部门内容区 */}
                        <div style={{ flex: 1, minWidth: 0, paddingBottom: isLastGroup ? 0 : 20 }}>
                          <Text
                            strong
                            style={{ fontSize: TYPO.deptLabel, display: 'block', marginBottom: 10 }}
                          >
                            {group.label}
                          </Text>

                          {isMulti ? (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 0,
                                flexWrap: 'wrap',
                              }}
                            >
                              {group.stages.map((stage, stageIndex) => (
                                <React.Fragment key={stage.key}>
                                  {stageIndex > 0 && (
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        alignSelf: 'stretch',
                                        padding: '0 12px',
                                        color: token.colorTextQuaternary,
                                        fontSize: 16,
                                        userSelect: 'none',
                                      }}
                                    >
                                      →
                                    </div>
                                  )}
                                  <StageBlock
                                    stage={stage}
                                    isActive={stage.key === activeStageKey}
                                    releasing={releasing}
                                    onAction={handleAction}
                                    token={token}
                                    horizontal
                                  />
                                </React.Fragment>
                              ))}
                            </div>
                          ) : (
                            <StageBlock
                              stage={group.stages[0]}
                              isActive={group.stages[0].key === activeStageKey}
                              releasing={releasing}
                              onAction={handleAction}
                              token={token}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: 12, paddingLeft: 48 }}>
                  <Text type="secondary" style={{ fontSize: TYPO.secondary }}>↓ 成品交付</Text>
                </div>
              </>
            ) : (
              <Empty description="请从左侧选择订单" />
            )}
          </Spin>
        </Col>

        {/* 右栏：关联单据 */}
        <Col
          flex="0 0 280px"
          style={{
            paddingLeft: 16,
            maxHeight: 'calc(100vh - 320px)',
            overflowY: 'auto',
          }}
        >
          <Spin spinning={pipelineLoading}>
            {p ? (
              <RelatedDocumentsPanel
                documents={p.documents}
                onNavigate={navigate}
              />
            ) : (
              <Card title="关联单据" styles={{ header: { fontSize: TYPO.panelTitle } }}>
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择订单" />
              </Card>
            )}
          </Spin>
        </Col>
      </Row>
    </div>
  );
};

export default CoordinationPipelinePanel;
