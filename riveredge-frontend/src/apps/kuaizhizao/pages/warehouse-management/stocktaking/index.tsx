/**
 * 库存盘点管理页面
 *
 * 提供库存盘点单的管理功能，包括创建盘点单、执行盘点、处理差异等。
 *
 * Author: Luigi Lu
 * Date: 2026-01-15
 */

import React, { useRef, useState, useCallback } from 'react';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormDigit, ProFormSwitch } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Card, Table, Row, Col, InputNumber } from 'antd';
import { PlusOutlined, EyeOutlined, PlayCircleOutlined, CheckCircleOutlined, DatabaseOutlined, RollbackOutlined } from '@ant-design/icons';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { UniTable } from '../../../../../components/uni-table';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG, WAREHOUSE_DETAIL_TABLE_STYLES } from '../../../../../components/layout-templates';
import { stocktakingApi, inventoryReportApi } from '../../../services/stocktaking';
import { getStocktakingLifecycle } from '../../../utils/stocktakingLifecycle';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { materialApi } from '../../../../master-data/services/material';
import dayjs from 'dayjs';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { resolveListLifecycleStageFromSearch } from '../../../../../utils/listLifecycleStage';

interface Stocktaking {
  id?: number;
  uuid?: string;
  code?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  stocktaking_date?: string;
  status?: string;
  stocktaking_type?: string;
  line_granularity?: string;
  include_zero_stock?: boolean;
  total_items?: number;
  counted_items?: number;
  total_differences?: number;
  total_difference_amount?: number;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
  items?: StocktakingItem[];
}

interface StocktakingItem {
  id?: number;
  uuid?: string;
  stocktaking_id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  warehouse_id?: number;
  location_id?: number;
  location_code?: string;
  batch_no?: string;
  book_quantity?: number;
  actual_quantity?: number;
  difference_quantity?: number;
  unit_price?: number;
  difference_amount?: number;
  counted_by?: number;
  counted_by_name?: string;
  counted_at?: string;
  status?: string;
  remarks?: string;
}

const STOCKTAKING_RESOURCE = 'kuaizhizao:warehouse-management-stocktaking';

const granularityLabel = (value?: string) => (value === 'material' ? '物料汇总' : '批次行');

const StocktakingPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const { canCreate, canUpdate, canDelete, canAction } = useResourcePermissions(STOCKTAKING_RESOURCE);
  const canRevoke = canAction?.('revoke') ?? false;

  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  // Modal 相关状态
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [inventoryPickerVisible, setInventoryPickerVisible] = useState(false);
  const formRef = useRef<any>(null);
  const itemFormRef = useRef<any>(null);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentStocktaking, setCurrentStocktaking] = useState<Stocktaking | null>(null);
  const [savingItemId, setSavingItemId] = useState<number | null>(null);
  const [editingActualQty, setEditingActualQty] = useState<Record<number, number>>({});

  const [materialList, setMaterialList] = useState<any[]>([]);
  const [currentStocktakingForItem, setCurrentStocktakingForItem] = useState<Stocktaking | null>(null);
  const [inventoryRows, setInventoryRows] = useState<any[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [selectedInventoryKeys, setSelectedInventoryKeys] = useState<React.Key[]>([]);

  /**
   * 加载物料列表
   */
  React.useEffect(() => {
    const loadMaterials = async () => {
      try {
        const { items } = await materialApi.list({ isActive: true, limit: 10000 });
        setMaterialList(items);
      } catch (error) {
        console.error('加载物料列表失败:', error);
        setMaterialList([]);
      }
    };
    loadMaterials();
  }, []);

  /**
   * 处理创建盘点单
   */
  const handleCreate = () => {
    setCreateModalVisible(true);
    setTimeout(() => {
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({
        stocktaking_date: dayjs(),
        stocktaking_type: 'full',
        line_granularity: 'batch',
        include_zero_stock: false,
      });
    }, 0);
  };

  /**
   * 处理提交创建盘点单
   */
  const handleCreateSubmit = async (values: any) => {
    try {
      const stocktakingDate = dayjs(values.stocktaking_date);
      await stocktakingApi.create({
        warehouse_id: values.warehouse_id,
        warehouse_name: values._warehouse_name || '', // _warehouse_name 可以由 UniWarehouseSelect 暴露或我们在 onChange 截获
        stocktaking_date: stocktakingDate.isValid()
          ? stocktakingDate.toISOString()
          : new Date().toISOString(),
        stocktaking_type: values.stocktaking_type || 'full',
        line_granularity: values.line_granularity || 'batch',
        include_zero_stock: Boolean(values.include_zero_stock),
        remarks: values.remarks,
        attachments: normalizeDocumentAttachments(values.attachments),
      });
      messageApi.success('盘点单创建成功');
      setCreateModalVisible(false);
      formRef.current?.resetFields();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '创建盘点单失败');
      throw error;
    }
  };

  const refreshCurrentDetail = useCallback(async (stocktakingId: number) => {
    const detail = await stocktakingApi.get(stocktakingId.toString());
    setCurrentStocktaking(detail);
    return detail;
  }, []);

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: Stocktaking) => {
    try {
      await refreshCurrentDetail(record.id!);
      setDetailDrawerVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取盘点单详情失败');
    }
  };

  /**
   * 处理开始盘点
   */
  const handleStart = async (record: Stocktaking) => {
    const isFull = record.stocktaking_type === 'full';
    const content = isFull
      ? `将按【${granularityLabel(record.line_granularity)}】载入仓库「${record.warehouse_name || ''}」的账面库存并进入盘点，确定开始吗？`
      : `确定要开始盘点单 "${record.code}" 吗？抽盘/循环盘点可在开始后从仓库库存勾选明细。`;

    Modal.confirm({
      title: '开始盘点',
      content,
      onOk: async () => {
        try {
          await stocktakingApi.start(record.id!.toString(), {
            line_granularity: record.line_granularity,
            include_zero_stock: record.include_zero_stock,
          });
          messageApi.success('盘点已开始');
          invalidateMenuBadgeCounts();
          actionRef.current?.reload();
          await refreshCurrentDetail(record.id!);
          setDetailDrawerVisible(true);
        } catch (error: any) {
          messageApi.error(error.message || '开始盘点失败');
        }
      },
    });
  };

  const isPartialType = (record?: Stocktaking | null) =>
    record?.stocktaking_type === 'partial' || record?.stocktaking_type === 'cycle';

  /**
   * 处理添加盘点明细（抽盘手工加行）
   */
  const handleAddItem = (record: Stocktaking) => {
    setCurrentStocktakingForItem(record);
    setItemModalVisible(true);
    itemFormRef.current?.resetFields();
  };

  const loadInventoryPicker = async (record: Stocktaking) => {
    if (!record.warehouse_id) {
      messageApi.error('盘点单未指定仓库');
      return;
    }
    setInventoryLoading(true);
    try {
      const params = {
        warehouse_id: record.warehouse_id,
        include_zero_stock: false,
        current: 1,
        page_size: 500,
      };
      const result = record.line_granularity === 'material'
        ? await inventoryReportApi.materialBalances(params)
        : await inventoryReportApi.batchLines(params);
      setInventoryRows(result.items || result.data || []);
      setSelectedInventoryKeys([]);
      setInventoryPickerVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '加载仓库库存失败');
    } finally {
      setInventoryLoading(false);
    }
  };

  const handleInventoryPickerSubmit = async () => {
    if (!currentStocktaking?.id) return;
    const selected = inventoryRows.filter((row) => selectedInventoryKeys.includes(row.id));
    if (!selected.length) {
      messageApi.warning('请至少选择一条库存');
      return;
    }
    try {
      await stocktakingApi.bulkCreateItems(
        currentStocktaking.id.toString(),
        selected.map((row) => ({
          stocktaking_id: currentStocktaking.id,
          material_id: row.material_id,
          material_code: row.material_code,
          material_name: row.material_name,
          batch_no: row.batch_no,
          unit_price: 0,
        })),
      );
      messageApi.success(`已添加 ${selected.length} 条盘点明细`);
      setInventoryPickerVisible(false);
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
      await refreshCurrentDetail(currentStocktaking.id);
    } catch (error: any) {
      messageApi.error(error.message || '批量添加盘点明细失败');
    }
  };

  /**
   * 处理提交添加盘点明细
   */
  const handleAddItemSubmit = async (values: any) => {
    try {
      if (!currentStocktakingForItem?.id) {
        messageApi.error('盘点单ID不存在');
        return;
      }

      const material = materialList.find((m: any) => m.id === values.material_id);
      if (!material) {
        messageApi.error('物料不存在');
        return;
      }

      await stocktakingApi.createItem(currentStocktakingForItem.id.toString(), {
        stocktaking_id: currentStocktakingForItem.id,
        material_id: values.material_id,
        material_code: material.mainCode ?? material.code ?? '',
        material_name: material.name,
        warehouse_id: currentStocktakingForItem.warehouse_id,
        location_code: values.location_code,
        batch_no: values.batch_no,
        unit_price: values.unit_price || 0,
        remarks: values.remarks,
      });
      const stocktakingId = currentStocktakingForItem.id;
      messageApi.success('盘点明细添加成功');
      setItemModalVisible(false);
      setCurrentStocktakingForItem(null);
      itemFormRef.current?.resetFields();
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
      if (currentStocktaking?.id === stocktakingId) {
        await refreshCurrentDetail(stocktakingId);
      }
    } catch (error: any) {
      messageApi.error(error.message || '添加盘点明细失败');
      throw error;
    }
  };

  const handleSaveActualQuantity = async (item: StocktakingItem) => {
    if (!currentStocktaking?.id || !item.id) return;
    const actualQty = editingActualQty[item.id] ?? item.actual_quantity ?? item.book_quantity ?? 0;
    setSavingItemId(item.id);
    try {
      await stocktakingApi.executeItem(
        currentStocktaking.id.toString(),
        item.id.toString(),
        Number(actualQty),
        item.remarks,
      );
      messageApi.success('实盘数量已保存');
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
      await refreshCurrentDetail(currentStocktaking.id);
    } catch (error: any) {
      messageApi.error(error.message || '保存实盘数量失败');
    } finally {
      setSavingItemId(null);
    }
  };

  const canComplete = (record?: Stocktaking | null) =>
    record?.status === 'in_progress'
    && (record.total_items ?? 0) > 0
    && record.counted_items === record.total_items;

  const handleComplete = async (record: Stocktaking) => {
    const hasDiff = (record.total_differences ?? 0) > 0;
    Modal.confirm({
      title: '完成盘点',
      content: hasDiff
        ? `盘点单 "${record.code}" 存在 ${record.total_differences} 处差异，完成后将调整库存。确定吗？`
        : `盘点单 "${record.code}" 账实相符，确定完成盘点吗？`,
      onOk: async () => {
        try {
          await stocktakingApi.complete(record.id!.toString());
          messageApi.success('盘点已完成');
          invalidateMenuBadgeCounts();
          actionRef.current?.reload();
          if (detailDrawerVisible && currentStocktaking?.id === record.id) {
            await refreshCurrentDetail(record.id!);
          }
        } catch (error: any) {
          messageApi.error(error.message || '完成盘点失败');
        }
      },
    });
  };

  const handleWithdraw = (record: Stocktaking) => {
    Modal.confirm({
      title: '撤回盘点',
      content: `确定将盘点单 "${record.code}" 撤回到草稿吗？未录入实盘的明细将被清空，之后可删除该盘点单。`,
      okText: '撤回',
      onOk: async () => {
        try {
          await stocktakingApi.withdraw(record.id!.toString());
          messageApi.success('盘点单已撤回为草稿');
          invalidateMenuBadgeCounts();
          actionRef.current?.reload();
          if (detailDrawerVisible && currentStocktaking?.id === record.id) {
            await refreshCurrentDetail(record.id!);
          }
        } catch (error: any) {
          messageApi.error(error.message || '撤回失败');
        }
      },
    });
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Stocktaking>[] = [
    {
      title: '仓库 / 盘点单号',
      key: 'code',
      dataIndex: 'code',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
      render: (_, r) => (
        <UniTableStackedPrimaryCell
          primary={String(r.warehouse_name ?? '')}
          secondary={String(r.code ?? '')}
        />
      ),
    },
    { title: '盘点单号', dataIndex: 'code', hideInTable: true },
    {
      title: '仓库',
      dataIndex: 'warehouse_name',
      hideInTable: true,
    },
    {
      title: '盘点日期',
      dataIndex: 'stocktaking_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '盘点类型',
      dataIndex: 'stocktaking_type',
      width: 100,
      valueEnum: {
        full: { text: '全盘', status: 'default' },
        partial: { text: '抽盘', status: 'default' },
        cycle: { text: '循环盘点', status: 'default' },
      },
    },
    {
      title: '盘点物料总数',
      dataIndex: 'total_items',
      width: 120,
      align: 'right',
    },
    {
      title: '已盘点物料数',
      dataIndex: 'counted_items',
      width: 120,
      align: 'right',
    },
    {
      title: '差异总数',
      dataIndex: 'total_differences',
      width: 100,
      align: 'right',
      render: (_, record) => (
        <span style={{ color: record.total_differences! > 0 ? '#ff4d4f' : '#52c41a' }}>
          {record.total_differences || 0}
        </span>
      ),
    },
    {
      title: '差异总金额',
      dataIndex: 'total_difference_amount',
      width: 120,
      align: 'right',
      render: (_, record) => {
        const amount = Number(record.total_difference_amount ?? 0);
        return (
          <span style={{ color: amount > 0 ? '#ff4d4f' : '#52c41a' }}>
            ¥{amount.toFixed(2)}
          </span>
        );
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      defaultSortOrder: 'descend',
      render: (_, r) => (r.updated_at ? dayjs(r.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getStocktakingLifecycle(record as Record<string, unknown>);
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
      width: 300,
      fixed: 'right',
      render: (_, record) => (
        <Space wrap>
          <Button {...rowActionKind('read')} onClick={() => handleDetail(record)} />
          {record.status === 'draft' && canUpdate && (
            <Button {...rowActionKind('execute')} {...rowActionLabelKeep()} onClick={() => handleStart(record)}>
              开始盘点
            </Button>
          )}
          {record.status === 'draft' && isPartialType(record) && canCreate && (
            <Button {...rowActionKind('create')} {...rowActionLabelKeep()} onClick={() => handleAddItem(record)}>
              添加明细
            </Button>
          )}
          {record.status === 'in_progress' && isPartialType(record) && canCreate && (
            <Button {...rowActionKind('create')} {...rowActionLabelKeep()} onClick={() => handleAddItem(record)}>
              添加明细
            </Button>
          )}
          {record.status === 'in_progress' && canComplete(record) && canUpdate && (
            <Button {...rowActionKind('complete')} {...rowActionLabelKeep()} onClick={() => handleComplete(record)}>
              完成盘点
            </Button>
          )}
          {record.status === 'in_progress' && canRevoke && (
            <Button {...rowActionKind('revoke')} {...rowActionLabelKeep()} onClick={() => handleWithdraw(record)}>
              撤回
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle="成品盘点"
        columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.stocktaking"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        showCreateButton={canCreate}
        createButtonText="新建盘点单"
        onCreate={canCreate ? handleCreate : undefined}
        request={async (params, _sort, _filter, searchFormValues) => {
          try {
            const lifecycleStage = resolveListLifecycleStageFromSearch(searchFormValues, params);
            const result = await stocktakingApi.list({
              skip: (params.current! - 1) * params.pageSize!,
              limit: params.pageSize,
              code: params.code,
              warehouse_id: params.warehouse_id,
              status: lifecycleStage ?? params.status,
              stocktaking_type: params.stocktaking_type,
              keyword: (params as any).keyword,
            });
            return {
              data: result.items || [],
              success: true,
              total: result.total || 0,
            };
          } catch (error) {
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        enableRowSelection={canDelete}
        showDeleteButton={canDelete}
        onDelete={async (keys) => {
          try {
            for (const id of keys) {
              await stocktakingApi.delete(String(id));
            }
            messageApi.success(`成功删除 ${keys.length} 条记录`);
            invalidateMenuBadgeCounts();
            actionRef.current?.reload();
          } catch (error: any) {
            messageApi.error(error.message || '删除失败');
          }
        }}
        deleteConfirmTitle={(count) => `确定要删除选中的 ${count} 条盘点单吗？`}
        scroll={{ x: 2200 }}
      />

      {/* 创建盘点单Modal */}
      <FormModalTemplate
        title="创建盘点单"
        open={createModalVisible}
        onClose={() => {
          setCreateModalVisible(false);
          formRef.current?.resetFields();
        }}
        onFinish={handleCreateSubmit}
        formRef={formRef}
        grid={false}
        {...MODAL_CONFIG}
      >
        <Row gutter={16}>
          <Col span={12}>
            <UniWarehouseSelect
              name="warehouse_id"
              label="仓库"
              placeholder="请选择仓库"
              required
              onChange={(_value, warehouse) => {
                formRef.current?.setFieldsValue({ _warehouse_name: warehouse?.name ?? '' });
              }}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="stocktaking_date"
              label="盘点日期"
              rules={[{ required: true, message: '请选择盘点日期' }]}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSelect
              name="stocktaking_type"
              label="盘点类型"
              rules={[{ required: true, message: '请选择盘点类型' }]}
              options={[
                { label: '全盘', value: 'full' },
                { label: '抽盘', value: 'partial' },
                { label: '循环盘点', value: 'cycle' },
              ]}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="line_granularity"
              label="明细粒度"
              rules={[{ required: true, message: '请选择明细粒度' }]}
              options={[
                { label: '批次行', value: 'batch' },
                { label: '物料汇总', value: 'material' },
              ]}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSwitch name="include_zero_stock" label="包含零库存" />
          </Col>
          <Col span={12} />
        </Row>
        <DocumentAttachmentsField category="stocktaking_attachments" />
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注"
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      {/* 添加盘点明细Modal */}
      <FormModalTemplate
        title="添加盘点明细"
        open={itemModalVisible}
        onClose={() => {
          setItemModalVisible(false);
          setCurrentStocktakingForItem(null);
          itemFormRef.current?.resetFields();
        }}
        onFinish={handleAddItemSubmit}
        formRef={itemFormRef}
        {...MODAL_CONFIG}
      >
        <ProFormSelect
          name="material_id"
          label="物料"
          placeholder="请选择物料"
          rules={[{ required: true, message: '请选择物料' }]}
          options={materialList.map((m: any) => ({
            label: `${m.mainCode ?? m.code ?? ''} - ${m.name}`,
            value: m.id,
          }))}
          fieldProps={{
            showSearch: true,
            filterOption: (input: string, option: any) =>
              option?.label?.toLowerCase().includes(input.toLowerCase()),
          }}
        />
        <ProFormDigit
          name="unit_price"
          label="单价"
          placeholder="请输入单价"
          min={0}
          fieldProps={{ precision: 2 }}
        />
        <ProFormText
          name="location_code"
          label="库位编号（可选）"
          placeholder="请输入库位编号"
        />
        <ProFormText
          name="batch_no"
          label="批次号（可选）"
          placeholder="请输入批次号"
        />
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注"
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      <Modal
        title="从仓库库存选择"
        open={inventoryPickerVisible}
        onCancel={() => setInventoryPickerVisible(false)}
        onOk={handleInventoryPickerSubmit}
        width={900}
        okText="添加到盘点单"
      >
        <Table
          rowKey="id"
          loading={inventoryLoading}
          dataSource={inventoryRows}
          rowSelection={{
            selectedRowKeys: selectedInventoryKeys,
            onChange: setSelectedInventoryKeys,
          }}
          pagination={false}
          scroll={{ y: 400 }}
          size="small"
          columns={[
            { title: '物料编码', dataIndex: 'material_code', width: 120 },
            { title: '物料名称', dataIndex: 'material_name', width: 160 },
            { title: '批次号', dataIndex: 'batch_no', width: 120, render: (v) => v || '-' },
            {
              title: '账面数量',
              dataIndex: 'quantity',
              width: 100,
              align: 'right',
              render: (v) => Number(v ?? 0).toFixed(2),
            },
          ]}
        />
      </Modal>

      {/* 详情Drawer */}
      <DetailDrawerTemplate
        title="盘点单详情"
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentStocktaking(null);
        }}
        dataSource={currentStocktaking || {}}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[
          {
            title: '盘点单号',
            dataIndex: 'code',
          },
          {
            title: '仓库',
            dataIndex: 'warehouse_name',
          },
          {
            title: '盘点日期',
            dataIndex: 'stocktaking_date',
            valueType: 'date',
          },
          {
            title: '盘点类型',
            dataIndex: 'stocktaking_type',
            valueEnum: {
              full: '全盘',
              partial: '抽盘',
              cycle: '循环盘点',
            },
          },
          {
            title: '明细粒度',
            dataIndex: 'line_granularity',
            render: (_: unknown, entity: Stocktaking) => granularityLabel(entity.line_granularity),
          },
          {
            title: '状态',
            dataIndex: 'status',
            valueEnum: {
              draft: { text: '草稿', status: 'default' },
              in_progress: { text: '盘点中', status: 'processing' },
              completed: { text: '已完成', status: 'success' },
              cancelled: { text: '已取消', status: 'error' },
            },
          },
          {
            title: '盘点物料总数',
            dataIndex: 'total_items',
          },
          {
            title: '已盘点物料数',
            dataIndex: 'counted_items',
          },
          {
            title: '差异总数',
            dataIndex: 'total_differences',
          },
          {
            title: '差异总金额',
            dataIndex: 'total_difference_amount',
            render: (dom: React.ReactNode, entity: Stocktaking) => `¥${Number(entity.total_difference_amount ?? 0).toFixed(2)}`,
          },
          {
            title: '备注',
            dataIndex: 'remarks',
          },
        ]}
        customContent={
          currentStocktaking && (
            <>
              {currentStocktaking.status === 'in_progress' && (
                <Space style={{ marginTop: 16 }}>
                  {isPartialType(currentStocktaking) && canCreate && (
                    <>
                      <Button
                        icon={<DatabaseOutlined />}
                        onClick={() => loadInventoryPicker(currentStocktaking)}
                      >
                        从仓库库存选择
                      </Button>
                      <Button
                        icon={<PlusOutlined />}
                        onClick={() => handleAddItem(currentStocktaking)}
                      >
                        手工添加明细
                      </Button>
                    </>
                  )}
                  {canComplete(currentStocktaking) && canUpdate && (
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      onClick={() => handleComplete(currentStocktaking)}
                    >
                      完成盘点
                    </Button>
                  )}
                  {canRevoke && (
                    <Button icon={<RollbackOutlined />} onClick={() => handleWithdraw(currentStocktaking)}>
                      撤回
                    </Button>
                  )}
                </Space>
              )}
              {currentStocktaking.items && currentStocktaking.items.length > 0 ? (
            <Card title="盘点明细" style={{ marginTop: 16 }}>
              <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
              <Table
                className="warehouse-detail-table"
                columns={[
                  {
                    title: '物料编号',
                    dataIndex: 'material_code',
                    width: 120,
                  },
                  {
                    title: '物料名称',
                    dataIndex: 'material_name',
                    width: 150,
                  },
                  {
                    title: '批次号',
                    dataIndex: 'batch_no',
                    width: 100,
                    render: (v) => v || '-',
                  },
                  {
                    title: '账面数量',
                    dataIndex: 'book_quantity',
                    width: 100,
                    align: 'right',
                    render: (v) => Number(v ?? 0).toFixed(2),
                  },
                  {
                    title: '实盘数量',
                    dataIndex: 'actual_quantity',
                    width: 140,
                    align: 'right',
                    render: (_: unknown, item: StocktakingItem) => {
                      if (currentStocktaking.status !== 'in_progress' || item.status !== 'pending') {
                        return Number(item.actual_quantity ?? 0).toFixed(2);
                      }
                      const itemId = item.id!;
                      return (
                        <InputNumber
                          size="small"
                          min={0}
                          precision={2}
                          style={{ width: '100%' }}
                          value={editingActualQty[itemId] ?? item.actual_quantity ?? item.book_quantity ?? 0}
                          onChange={(val) => {
                            setEditingActualQty((prev) => ({ ...prev, [itemId]: Number(val ?? 0) }));
                          }}
                        />
                      );
                    },
                  },
                  {
                    title: '差异数量',
                    dataIndex: 'difference_quantity',
                    width: 100,
                    align: 'right',
                    render: (value: number) => {
                      const qty = Number(value ?? 0);
                      return (
                        <span style={{ color: qty > 0 ? '#ff4d4f' : qty < 0 ? '#1890ff' : '#52c41a' }}>
                          {qty > 0 ? '+' : ''}{qty.toFixed(2)}
                        </span>
                      );
                    },
                  },
                  {
                    title: '差异金额',
                    dataIndex: 'difference_amount',
                    width: 100,
                    align: 'right',
                    render: (value: number) => {
                      const amount = Number(value ?? 0);
                      return (
                        <span style={{ color: amount > 0 ? '#ff4d4f' : amount < 0 ? '#1890ff' : '#52c41a' }}>
                          ¥{amount.toFixed(2)}
                        </span>
                      );
                    },
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    width: 100,
                    render: (status: string) => {
                      const statusMap: Record<string, { text: string; color: string }> = {
                        pending: { text: '待盘点', color: 'default' },
                        counted: { text: '已盘点', color: 'processing' },
                        adjusted: { text: '已调整', color: 'success' },
                      };
                      const statusInfo = statusMap[status] || { text: status, color: 'default' };
                      return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
                    },
                  },
                  {
                    title: '操作',
                    width: 100,
                    render: (_: unknown, item: StocktakingItem) => (
                      currentStocktaking.status === 'in_progress' && item.status === 'pending' && canUpdate ? (
                        <Button
                          type="link"
                          size="small"
                          loading={savingItemId === item.id}
                          onClick={() => handleSaveActualQuantity(item)}
                        >
                          保存
                        </Button>
                      ) : null
                    ),
                  },
                ]}
                dataSource={currentStocktaking.items}
                rowKey="id"
                pagination={false}
                size="small"
                scroll={{ x: 1000 }}
              />
            </Card>
              ) : (
                <Card style={{ marginTop: 16 }}>
                  {currentStocktaking.status === 'draft'
                    ? '开始盘点后将自动载入账面库存（全盘）或从仓库库存勾选明细（抽盘）。'
                    : '暂无盘点明细'}
                </Card>
              )}
            </>
          )
        }
      />
    </ListPageTemplate>
  );
};

export default StocktakingPage;
