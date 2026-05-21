/**
 * 装箱打包绑定管理页面
 *
 * 提供装箱打包绑定记录的管理功能，包括查看、更新、删除等。
 * 归属生产管理：产线末端打包/装箱时记录每箱内含产品批次，用于出货追溯。
 *
 * Author: Luigi Lu
 * Date: 2026-01-15
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import type { DescriptionsProps } from 'antd';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormText,
  ProFormDigit,
  ProFormTextArea,
} from '@ant-design/pro-components';
import {
  App,
  Button,
  Popconfirm,
  Row,
  Col,
  Descriptions,
  Typography,
  Dropdown,
  Empty,
  Spin,
  theme as AntdTheme,
  Tag,
} from 'antd';
import { EyeOutlined, EditOutlined, DeleteOutlined, QrcodeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import {
  ListPageTemplate,
  FormModalTemplate,
  DetailDrawerTemplate,
  DetailDrawerSection, DetailDrawerInlineFullChain,
  MODAL_CONFIG,
  DRAWER_CONFIG,
  type StatCard,
} from '../../../../../components/layout-templates';
import { SimpleSparkline } from '../../../../../components';
import { packingBindingApi } from '../../../services/packing-binding';

import { qrcodeApi } from '../../../../../services/qrcode';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter';
import { getPackingBindingLifecycle } from '../../../utils/packingBindingLifecycle';
import dayjs from 'dayjs';
import { renderRowActionsOverflow } from '../../../../../utils/renderRowActionsOverflow';
import { useTranslation } from 'react-i18next';

interface PackingBinding {
  id?: number;
  uuid?: string;
  finished_goods_receipt_id?: number;
  sales_delivery_id?: number;
  product_id?: number;
  product_code?: string;
  product_name?: string;
  product_serial_no?: string;
  packing_material_id?: number;
  packing_material_code?: string;
  packing_material_name?: string;
  packing_quantity?: number;
  box_no?: string;
  binding_method?: string;
  barcode?: string;
  bound_by?: number;
  bound_by_name?: string;
  bound_at?: string;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
}

function buildDescriptionItemsFromColumns<T extends Record<string, any>>(
  dataSource: T,
  cols: ProDescriptionsItemProps<T>[]
): NonNullable<DescriptionsProps['items']> {
  return cols.map((col, index) => {
    const dataIndex = col.dataIndex as keyof T | undefined;
    const value = dataIndex != null ? dataSource[dataIndex] : undefined;
    let content: React.ReactNode = value as React.ReactNode;
    if (col.valueType === 'dateTime' && value) {
      content = dayjs(value as string).format('YYYY-MM-DD HH:mm:ss');
    } else if (col.valueType === 'date' && value) {
      content = dayjs(value as string).format('YYYY-MM-DD');
    }
    if (col.render && dataSource != null) {
            content = (col.render as (dom: import('react').ReactNode, entity: T, i: number) => import('react').ReactNode)(
        content,
        dataSource,
        index,
      );
    }
    return {
      key: String(col.key ?? col.dataIndex ?? index),
      label: col.title as React.ReactNode,
      children: content !== undefined && content !== null ? content : '-',
      span: col.span ?? 1,
    };
  });
}

function renderPbRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return renderRowActionsOverflow(nodes, keyPrefix);
}

const PB_STAT_SPARK_1 = [3, 4, 5, 4, 6, 5, 7];
const PB_STAT_SPARK_2 = [2, 3, 2, 4, 3, 5, 4];
const PB_STAT_SPARK_3 = [1, 2, 1, 2, 1, 2, 2];

const PackingBindingPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = AntdTheme.useToken();
  const packingBindingDetailDrawerZIndex = token.zIndexPopupBase;
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();

  const [statsVersion, setStatsVersion] = useState(0);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const formRef = useRef<any>(null);

  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentBinding, setCurrentBinding] = useState<PackingBinding | null>(null);

  const [pbTrackingRefreshKey, setPbTrackingRefreshKey] = useState(0);

  const handleDetail = useCallback(async (record: PackingBinding) => {
    try {
      const detail = await packingBindingApi.get(record.id!.toString());
      setCurrentBinding(detail);
      setDetailDrawerVisible(true);
      setPbTrackingRefreshKey((k) => k + 1);
    } catch (error: any) {
      messageApi.error(error.message || '获取装箱绑定记录详情失败');
    }
  }, [messageApi]);

  const [localStats, setLocalStats] = useState({ total: 0, scan: 0, manual: 0 });

  const refreshLocalStats = useCallback(async () => {
    try {
      const result = await packingBindingApi.list({ skip: 0, limit: 5000 });
      const arr = Array.isArray(result) ? result : [];
      setLocalStats({
        total: arr.length,
        scan: arr.filter((x: PackingBinding) => (x.binding_method || '').trim() === 'scan').length,
        manual: arr.filter((x: PackingBinding) => (x.binding_method || '').trim() === 'manual').length,
      });
    } catch {
      setLocalStats({ total: 0, scan: 0, manual: 0 });
    }
  }, []);

  useEffect(() => {
    void refreshLocalStats();
  }, [statsVersion, refreshLocalStats]);


  const packingTracking = useDocumentTracking(
    detailDrawerVisible && currentBinding?.id ? 'packing_binding' : undefined,
    currentBinding?.id,
    pbTrackingRefreshKey,
  );

  const [currentBindingId, setCurrentBindingId] = useState<number | null>(null);

  useEffect(() => {
    const boxUuid = searchParams.get('uuid');
    const action = searchParams.get('action');

    if (boxUuid && action === 'detail') {
      packingBindingApi
        .list({ box_no: boxUuid })
        .then((list) => {
          if (list && list.length > 0) {
            void handleDetail(list[0]);
            setSearchParams({}, { replace: true });
          } else {
            messageApi.warning('未找到对应的装箱记录');
          }
        })
        .catch(() => {
          messageApi.error('获取装箱记录失败');
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams]);

  const handleBatchGenerateQRCode = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要生成二维码的装箱记录');
      return;
    }

    try {
      const bindings = await Promise.all(
        selectedRowKeys.map(async (key) => {
          try {
            return await packingBindingApi.get(key.toString());
          } catch {
            return null;
          }
        })
      );

      const validBindings = bindings.filter((binding) => binding !== null) as PackingBinding[];

      if (validBindings.length === 0) {
        messageApi.error('无法获取选中的装箱记录数据');
        return;
      }

      const qrcodePromises = validBindings.map((binding) =>
        qrcodeApi.generateBox({
          box_uuid: binding.box_no || binding.uuid || '',
          box_code: binding.box_no || '',
          material_codes: binding.product_code ? [binding.product_code] : [],
        })
      );

      const qrcodes = await Promise.all(qrcodePromises);
      messageApi.success(`成功生成 ${qrcodes.length} 个装箱二维码`);
    } catch (error: any) {
      messageApi.error(`批量生成二维码失败: ${error.message || '未知错误'}`);
    }
  };


  const handleEdit = useCallback(async (record: PackingBinding) => {
    try {
      setCurrentBindingId(record.id!);
      setEditModalVisible(true);
      const detail = await packingBindingApi.get(record.id!.toString());
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({
        packing_quantity: detail.packing_quantity,
        box_no: detail.box_no,
        remarks: detail.remarks,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取装箱绑定记录详情失败');
    }
  }, [messageApi]);

  const handleEditSubmit = async (values: any) => {
    try {
      if (!currentBindingId) {
        messageApi.error('装箱绑定记录ID不存在');
        return;
      }

      await packingBindingApi.update(currentBindingId.toString(), {
        packing_quantity: values.packing_quantity,
        box_no: values.box_no,
        remarks: values.remarks,
      });
      messageApi.success('装箱绑定记录更新成功');
      const oid = currentBindingId;
      setEditModalVisible(false);
      setCurrentBindingId(null);
      formRef.current?.resetFields();
      setStatsVersion((v) => v + 1);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
      if (oid != null && currentBinding?.id === oid) {
        try {
          const fresh = await packingBindingApi.get(String(oid));
          setCurrentBinding(fresh);
        } catch {
          /* ignore */
        }
      }
    } catch (error: any) {
      messageApi.error(error.message || '更新装箱绑定记录失败');
      throw error;
    }
  };

  const handleDeleteOne = async (record: PackingBinding) => {
    try {
      await packingBindingApi.delete(record.id!.toString());
      messageApi.success('装箱绑定记录删除成功');
      if (currentBinding?.id === record.id) {
        setDetailDrawerVisible(false);
        setCurrentBinding(null);
      }
      setSelectedRowKeys([]);
      setStatsVersion((v) => v + 1);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除装箱绑定记录失败');
    }
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning('请选择要删除的装箱绑定记录');
      return;
    }
    try {
      await Promise.all(keys.map((k) => packingBindingApi.delete(String(k))));
      messageApi.success(`已删除 ${keys.length} 条记录`);
      setSelectedRowKeys([]);
      if (currentBinding?.id != null && keys.map(Number).includes(currentBinding.id)) {
        setDetailDrawerVisible(false);
        setCurrentBinding(null);
      }
      setStatsVersion((v) => v + 1);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '批量删除失败');
    }
  };

  const bindingMethodTag = (m?: string) => {
    const v = (m || '').trim();
    if (v === 'scan') return <Tag color="success">扫码</Tag>;
    if (v === 'manual') return <Tag>手动</Tag>;
    return <Tag>{v || '-'}</Tag>;
  };

  const detailBaseColumns: ProDescriptionsItemProps<PackingBinding>[] = [
    {
      title: '箱号',
      dataIndex: 'box_no',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.box_no ?? '') }}>{r.box_no ?? '-'}</Typography.Text>
      ),
    },
    {
      title: '产品编号',
      dataIndex: 'product_code',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.product_code ?? '') }}>{r.product_code ?? '-'}</Typography.Text>
      ),
    },
    { title: '产品名称', dataIndex: 'product_name' },
    { title: '产品序列号', dataIndex: 'product_serial_no', render: (t) => t || '-' },
    { title: '装箱数量', dataIndex: 'packing_quantity', valueType: 'digit' },
    { title: '包装物料编号', dataIndex: 'packing_material_code', render: (t) => t || '-' },
    { title: '包装物料名称', dataIndex: 'packing_material_name', render: (t) => t || '-' },
    {
      title: '绑定方式',
      dataIndex: 'binding_method',
      render: (_, r) => bindingMethodTag(r.binding_method),
    },
    {
      title: '条码',
      dataIndex: 'barcode',
      render: (t) =>
        t ? <Typography.Text copyable={{ text: String(t) }}>{String(t)}</Typography.Text> : '-',
    },
    {
      title: '成品入库单ID',
      dataIndex: 'finished_goods_receipt_id',
      render: (t) => (t != null ? String(t) : '-'),
    },
    {
      title: '销售出库单ID',
      dataIndex: 'sales_delivery_id',
      render: (t) => (t != null ? String(t) : '-'),
    },
    { title: '绑定人', dataIndex: 'bound_by_name' },
    { title: '绑定时间', dataIndex: 'bound_at', valueType: 'dateTime' },
    {
      title: '备注',
      dataIndex: 'remarks',
      span: 3,
      render: (text) => text || '-',
    },
  ];

  const renderPbRowActionNodes = (record: PackingBinding): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    nodes.push(
      <Button
        key="detail"
        type="link"
        size="small"
        icon={<EyeOutlined />}
        onClick={(e) => {
          e.stopPropagation();
          void handleDetail(record);
        }}
      >
        详情
      </Button>
    );
    nodes.push(
      <Button
        key="edit"
        type="link"
        size="small"
        icon={<EditOutlined />}
        onClick={(e) => {
          e.stopPropagation();
          void handleEdit(record);
        }}
      >
        编辑
      </Button>
    );
    nodes.push(
      <Popconfirm
        key="del"
        title="确定要删除这个装箱绑定记录吗？"
        onConfirm={() => void handleDeleteOne(record)}
        okText="确定"
        cancelText="取消"
      >
        <Button
          type="link"
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={(e) => e.stopPropagation()}
        >
          删除
        </Button>
      </Popconfirm>
    );
    return nodes;
  };

  const columns: ProColumns<PackingBinding>[] = [
    {
      title: '箱号',
      dataIndex: 'box_no',
      width: 168,
      ellipsis: true,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.box_no ?? '') }} ellipsis>
          {r.box_no ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '产品编号',
      dataIndex: 'product_code',
      width: 128,
      ellipsis: true,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.product_code ?? '') }} ellipsis>
          {r.product_code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '产品名称',
      dataIndex: 'product_name',
      width: 160,
      ellipsis: true,
    },
    {
      title: '产品序列号',
      dataIndex: 'product_serial_no',
      width: 140,
      ellipsis: true,
      render: (_, r) => r.product_serial_no || '-',
    },
    {
      title: '装箱数量',
      dataIndex: 'packing_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '包装物料',
      dataIndex: 'packing_material_name',
      width: 140,
      ellipsis: true,
      render: (_, r) => r.packing_material_name || '-',
    },
    {
      title: '绑定方式',
      dataIndex: 'binding_method',
      width: 100,
      render: (_, r) => bindingMethodTag(r.binding_method),
    },
    {
      title: '绑定人',
      dataIndex: 'bound_by_name',
      width: 100,
      ellipsis: true,
    },
    {
      title: '绑定时间',
      dataIndex: 'bound_at',
      valueType: 'dateTime',
      width: 168,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      defaultSortOrder: 'descend',
      render: (_, r) => {
        const d = r.updated_at;
        return d ? dayjs(d).format('YYYY-MM-DD HH:mm:ss') : '-';
      },
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      width: 132,
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getPackingBindingLifecycle(record as Record<string, unknown>);
        return (
          <UniLifecycle
            percent={lifecycle.percent}
            stageName={lifecycle.stageName}
            status={lifecycle.status}
            subStages={lifecycle.subStages}
            showLabel
            size="small"
            showCircleTooltip={false}
          />
        );
      },
    },
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) =>
        renderPbRowActions(renderPbRowActionNodes(record), `pb-${record.id ?? 'row'}`),
    },
  ];

  const handleRequest = async (params: any) => {
    try {
      const result = await packingBindingApi.list({
        skip: (params.current! - 1) * params.pageSize!,
        limit: params.pageSize,
        receipt_id: params.receipt_id,
        product_id: params.product_id,
        box_no: params.box_no,
        keyword: params.keyword,
      });
      const data = result || [];
      return {
        data,
        success: true,
        total: data?.length || 0,
      };
    } catch {
      messageApi.error('获取装箱绑定列表失败');
      return {
        data: [],
        success: false,
        total: 0,
      };
    }
  };

  const statCards: StatCard[] = [
    {
      title: '装箱绑定总数',
      value: localStats.total,
      valueStyle: { color: token.colorPrimary },
      backgroundChart: <SimpleSparkline data={PB_STAT_SPARK_1} color={token.colorPrimary} />,
    },
    {
      title: '扫码绑定',
      value: localStats.scan,
      valueStyle: { color: token.colorSuccess },
      backgroundChart: <SimpleSparkline data={PB_STAT_SPARK_2} color={token.colorSuccess} />,
    },
    {
      title: '手动绑定',
      value: localStats.manual,
      valueStyle: { color: token.colorWarning },
      backgroundChart: <SimpleSparkline data={PB_STAT_SPARK_3} color={token.colorWarning} />,
    },
  ];

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable<PackingBinding>
          headerTitle="装箱绑定"
          columnPersistenceId="apps.kuaizhizao.pages.production-execution.packing-binding"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          request={handleRequest}
          enableRowSelection={true}
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton={true}
          onDelete={handleBatchDelete}
          scroll={{ x: 1900 }}
          toolBarRender={() => [
            <Button
              key="batch-qrcode"
              icon={<QrcodeOutlined />}
              disabled={selectedRowKeys.length === 0}
              onClick={() => void handleBatchGenerateQRCode()}
            >
              批量生成二维码
            </Button>,
          ]}
          onRow={(record) => ({
            onClick: () => void handleDetail(record),
            style: { cursor: 'pointer' },
          })}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title="编辑装箱绑定记录"
        open={editModalVisible}
        onClose={() => {
          setEditModalVisible(false);
          setCurrentBindingId(null);
          formRef.current?.resetFields();
        }}
        onFinish={handleEditSubmit}
        formRef={formRef}
        {...MODAL_CONFIG}
      >
        <ProFormDigit
          name="packing_quantity"
          label="装箱数量"
          placeholder="请输入装箱数量"
          rules={[{ required: true, message: '请输入装箱数量' }]}
          min={0}
          fieldProps={{ precision: 2 }}
        />
        <ProFormText
          name="box_no"
          label="箱号"
          placeholder="请输入箱号（留空则自动生成）"
        />
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注"
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={`装箱绑定详情${currentBinding?.box_no ? ` - ${currentBinding.box_no}` : ''}`}
        open={detailDrawerVisible}
        zIndex={packingBindingDetailDrawerZIndex}
        width={DRAWER_CONFIG.HALF_WIDTH}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentBinding(null);
        }}
        columns={[]}
        column={3}
        dataSource={currentBinding || undefined}
        customContent={
          currentBinding && (
            <>
              <DetailDrawerSection title="基本信息">
                <Row gutter={16}>
                  <Col xs={24} lg={24}>
                    <Descriptions
                      column={3}
                      size="small"
                      items={buildDescriptionItemsFromColumns(currentBinding, detailBaseColumns)}
                    />
                  </Col>
                </Row>
              </DetailDrawerSection>

              <DetailDrawerSection title="生命周期">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lifecycle = getPackingBindingLifecycle(currentBinding as Record<string, unknown>);
                    const mainStages = lifecycle.mainStages ?? [];
                    if (mainStages.length === 0) return null;
                    return (
                      <UniLifecycleStepper
                        steps={mainStages}
                        status={lifecycle.status}
                        showLabels
                        nextStepSuggestions={lifecycle.nextStepSuggestions}
                        hideNextStepSuggestions
                      />
                    );
                  })()}
                  {currentBinding.id != null ? (
                    <DetailDrawerInlineFullChain
                      documentType='packing_binding'
                      documentId={currentBinding.id}
                      active={detailDrawerVisible}
                      selfDocumentId={currentBinding.id}
                      renderBriefActions={(doc) => (
                  <WarehouseTraceBriefPrimaryActions
                    doc={doc}
                    t={t}
                    navigate={navigate}
                    closeDrawer={() => {
                      setDetailDrawerVisible(false);
                      setCurrentBinding(null);
                    }}
                  />
                )}
                    />
                  ) : null}
                </div>
              </DetailDrawerSection>

              <DetailDrawerSection title="明细信息">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="装箱绑定无明细行表" />
              </DetailDrawerSection>

              <DetailDrawerSection title="操作记录">
                {packingTracking.loading && (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <Spin />
                  </div>
                )}
                {packingTracking.error && !packingTracking.loading && (
                  <Typography.Text type="danger">{packingTracking.error}</Typography.Text>
                )}
                {packingTracking.data && !packingTracking.loading && (
                  <DocumentTrackingTimelineBody data={packingTracking.data} />
                )}
                {!packingTracking.loading && !packingTracking.data && !packingTracking.error && (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无操作记录" />
                )}
              </DetailDrawerSection>
            </>
          )
        }
      />
    </>
  );
};

export default PackingBindingPage;
