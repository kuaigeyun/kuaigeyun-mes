/**
 * 借料单管理页面
 *
 * 提供借料单的创建、查看、确认和管理功能（无工单借料：工具间、研发等）
 *
 * @author RiverEdge Team
 * @date 2026-02-19
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProFormItem, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Col, DatePicker, Descriptions, Dropdown, Form as AntForm, Input, InputNumber, Modal, Row, Select, Space, Table, Tag, Typography } from 'antd';
import { PlusOutlined, EyeOutlined, CheckCircleOutlined, DeleteOutlined, PrinterOutlined, ShoppingOutlined, MoreOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import { UniUserSelect } from '../../../../../components/uni-user-select';
import type { Material } from '../../../../master-data/types/material';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import CodeField from '../../../../../components/code-field';
import SyncFromDatasetModal from '../../../../../components/sync-from-dataset-modal';
import { UniTableDetailHeader } from '../../../../../components/uni-table-detail/UniTableDetail';
import { detailDrawerDescriptionItems, DetailDrawerTemplate, DRAWER_CONFIG, FormModalTemplate, ListPageTemplate, MODAL_CONFIG, WAREHOUSE_DETAIL_TABLE_STYLES } from '../../../../../components/layout-templates';
import { warehouseApi } from '../../../services/production';
import { getMaterialBorrowLifecycle } from '../../../utils/materialBorrowLifecycle';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { warehouseApi as masterDataWarehouseApi } from '../../../../master-data/services/warehouse';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { useKuaizhizaoPrintModal } from '../../../hooks/useKuaizhizaoPrintModal';
import { useTranslation } from 'react-i18next';
import { useWarehouseLocationOptions } from '../../../hooks/useWarehouseLocationOptions';
import { getDepartmentTree } from '../../../../../services/department';
import { FutureDatePicker } from '../../../../../utils/futureDatePickerShortcuts';
import { formatDateTime } from '../../../../../utils/format';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';

interface MaterialBorrow {
  id?: number;
  tenant_id?: number;
  borrow_code?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  borrower_id?: number;
  borrower_name?: string;
  department?: string;
  expected_return_date?: string;
  borrow_time?: string;
  status?: string;
  total_quantity?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

interface MaterialBorrowDetail extends MaterialBorrow {
  items?: MaterialBorrowItem[];
}

interface MaterialBorrowItem {
  id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  material_unit?: string;
  borrow_quantity?: number;
  returned_quantity?: number;
  status?: string;
}

const MATERIAL_BORROW_STATUS_I18N: Record<string, string> = {
  '待借出': 'app.kuaizhizao.materialBorrow.status.pending',
  '已借出': 'app.kuaizhizao.materialBorrow.status.borrowed',
  '已取消': 'app.kuaizhizao.materialBorrow.status.cancelled',
};

function translateMaterialBorrowStatus(t: (key: string) => string, status?: string): string {
  if (!status) return '-';
  const key = MATERIAL_BORROW_STATUS_I18N[status];
  return key ? t(key) : status;
}

const MaterialBorrowsPage: React.FC = () => {
  const { t } = useTranslation();
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [borrowDetail, setBorrowDetail] = useState<MaterialBorrowDetail | null>(null);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const formRef = useRef<any>(null);
  const [warehouseList, setWarehouseList] = useState<any[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<Array<{ label: string; value: string }>>([]);
  const {
    selectedWarehouseId,
    locationOptions,
    updateSelectedWarehouseId,
    resetSelectedWarehouseId,
  } = useWarehouseLocationOptions();
  const defaultBorrowItem = {
    material_id: undefined,
    material_code: '',
    material_name: '',
    material_unit: '',
    location_code: undefined,
    borrow_quantity: 1,
  };

  useEffect(() => {
    const load = async () => {
      try {
        const wh = await masterDataWarehouseApi.list({ limit: 1000, is_active: true });
        setWarehouseList(Array.isArray(wh) ? wh : (wh as any)?.items || []);
      } catch (e) {
        console.error('加载仓库失败', e);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const flatten = (items: any[] | undefined): Array<{ label: string; value: string }> => {
      if (!Array.isArray(items)) return [];
      const out: Array<{ label: string; value: string }> = [];
      const walk = (nodes: any[], prefix = '') => {
        nodes.forEach((node) => {
          const name = String(node?.name ?? '').trim();
          const uuid = String(node?.uuid ?? '').trim();
          if (name && uuid) {
            out.push({ label: prefix ? `${prefix} / ${name}` : name, value: uuid });
          }
          if (Array.isArray(node?.children) && node.children.length > 0) {
            walk(node.children, prefix ? `${prefix} / ${name}` : name);
          }
        });
      };
      walk(items);
      return out;
    };
    const loadDepartments = async () => {
      try {
        const res = await getDepartmentTree({ is_active: true });
        setDepartmentOptions(flatten(res?.items));
      } catch (e) {
        console.error('加载部门失败', e);
        setDepartmentOptions([]);
      }
    };
    void loadDepartments();
  }, []);

  const columns: ProColumns<MaterialBorrow>[] = useMemo(() => [
    {
      title: t('app.kuaizhizao.materialBorrow.col.borrowCode'),
      dataIndex: 'borrow_code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.borrow_code ?? '') }} ellipsis>
          {r.borrow_code ?? '-'}
        </Typography.Text>
      ),
    },
    { title: t('app.kuaizhizao.warehouseReports.colWarehouse'), dataIndex: 'warehouse_name', width: 120, ellipsis: true },
    { title: t('app.kuaizhizao.materialBorrow.col.borrower'), dataIndex: 'borrower_name', width: 100 },
    { title: t('app.kuaizhizao.materialBorrow.col.department'), dataIndex: 'department', width: 100 },
    { title: t('app.kuaizhizao.materialBorrow.col.expectedReturnDate'), dataIndex: 'expected_return_date', valueType: 'date', width: 120 },
    { title: t('app.kuaizhizao.materialBorrow.col.borrowTime'), dataIndex: 'borrow_time', valueType: 'dateTime', width: 160 },
    {
      title: t('app.kuaizhizao.warehouseOutbound.col.updatedAt'),
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      defaultSortOrder: 'descend',
      render: (_, r) => (r.updated_at ? formatDateTime(r.updated_at, 'YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: t('app.kuaizhizao.warehouseOutbound.col.lifecycle'),
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getMaterialBorrowLifecycle(record as Record<string, unknown>, t);
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
      title: t('app.kuaizhizao.warehouseOutbound.col.actions'),
      width: 220,
      fixed: 'right',
      render: (_, record) => {
        const showPrint = record.status === '待借出' || record.status === '已借出';
        const printInMore = record.status === '待借出';
        return (
          <Space size="small" wrap>
            <Button {...rowActionKind('read')} onClick={() => handleDetail(record)} />
            {record.status === '待借出' && (
              <>
                <Button
                  {...rowActionKind('execute')}
                  {...rowActionLabelKeep()}
                  onClick={() => handleConfirm(record)}
                >
                  {t('app.kuaizhizao.materialBorrow.action.confirmBorrow')}
                </Button>
                <Button {...rowActionKind('delete')} onClick={() => handleDelete(record)} />
              </>
            )}
            {record.status === '已借出' && (
              <Button {...rowActionKind('revoke')} {...rowActionLabelKeep()} onClick={() => handleWithdraw(record)}>
                {t('app.kuaizhizao.materialBorrow.action.withdrawBorrow')}
              </Button>
            )}
            {printInMore ? (
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'print',
                      icon: <PrinterOutlined />,
                      label: t('app.kuaizhizao.materialBorrow.action.print'),
                      onClick: () => handlePrint(record),
                    },
                  ],
                }}
                trigger={['click']}
              >
                <Button {...rowActionKind('display')} {...rowActionLabelKeep()} icon={<MoreOutlined />}>
                  {t('app.kuaizhizao.materialBorrow.action.more')}
                </Button>
              </Dropdown>
            ) : (
              showPrint && <Button {...rowActionKind('print')} onClick={() => handlePrint(record)} />
            )}
          </Space>
        );
      },
    },
  ], [t]);

  const handleDetail = async (record: MaterialBorrow) => {
    try {
      const detail = await warehouseApi.materialBorrow.get(record.id!.toString());
      setBorrowDetail(detail as MaterialBorrowDetail);
      setDetailDrawerVisible(true);
    } catch {
      messageApi.error(t('app.kuaizhizao.materialBorrow.msg.loadDetailFailed'));
    }
  };

  const handleConfirm = async (record: MaterialBorrow) => {
    Modal.confirm({
      title: t('app.kuaizhizao.materialBorrow.msg.confirmTitle'),
      content: t('app.kuaizhizao.materialBorrow.msg.confirmContent', { code: record.borrow_code }),
      onOk: async () => {
        try {
          await warehouseApi.materialBorrow.confirm(record.id!.toString());
          messageApi.success(t('app.kuaizhizao.materialBorrow.msg.confirmSuccess'));
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.materialBorrow.msg.confirmFailed'));
        }
      },
    });
  };

  const handleWithdraw = async (record: MaterialBorrow) => {
    Modal.confirm({
      title: t('app.kuaizhizao.materialBorrow.msg.withdrawTitle'),
      content: t('app.kuaizhizao.materialBorrow.msg.withdrawContent', { code: record.borrow_code }),
      onOk: async () => {
        try {
          await warehouseApi.materialBorrow.withdraw(record.id!.toString());
          messageApi.success(t('app.kuaizhizao.materialBorrow.msg.withdrawSuccess'));
          invalidateMenuBadgeCounts();
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.materialBorrow.msg.withdrawFailed'));
        }
      },
    });
  };

  const handleDelete = async (record: MaterialBorrow) => {
    Modal.confirm({
      title: t('app.kuaizhizao.materialBorrow.msg.deleteTitle'),
      content: t('app.kuaizhizao.materialBorrow.msg.deleteContent', { code: record.borrow_code }),
      onOk: async () => {
        try {
          await warehouseApi.materialBorrow.delete(record.id!.toString());
          messageApi.success(t('app.kuaizhizao.materialBorrow.msg.deleteSuccess'));
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.materialBorrow.msg.deleteFailed'));
        }
      },
    });
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) return;
    try {
      for (const k of keys) {
        await warehouseApi.materialBorrow.delete(String(k));
      }
      messageApi.success(t('app.kuaizhizao.materialBorrow.msg.batchDeleteSuccess', { count: keys.length }));
      setSelectedRowKeys([]);
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.materialBorrow.msg.batchDeleteFailed'));
    }
  };

  const handleSyncConfirm = async (rows: Record<string, any>[]) => {
    try {
      let successCount = 0;
      for (const row of rows) {
        const payload = {
          warehouse_id: row.warehouse_id ?? row.warehouseId,
          warehouse_name: row.warehouse_name || row.warehouseName,
          borrower_name: row.borrower_name || row.borrowerName,
          status: row.status || '待借出',
          items: Array.isArray(row.items) ? row.items : [],
        };
        await warehouseApi.materialBorrow.create(payload);
        successCount += 1;
      }
      messageApi.success(t('app.kuaizhizao.materialBorrow.msg.syncSuccess', { count: successCount }));
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.materialBorrow.msg.syncFailed'));
    }
  };

  const handlePrint = (record: MaterialBorrow) => {
    if (!record.id) return;
    openPrint({ documentType: 'material_borrow', documentId: record.id });
  };

  const appendBorrowItemsFromMaterials = useCallback(
    (selected: Material[]) => {
      const current = formRef.current?.getFieldValue('items') ?? [];
      const newRows = selected.map((m) => ({
        ...defaultBorrowItem,
        material_id: m.id,
        material_code: m.mainCode ?? m.code ?? '',
        material_name: m.name ?? '',
        material_unit: m.baseUnit ?? '',
      }));
      formRef.current?.setFieldsValue({ items: [...current, ...newRows] });
      messageApi.success(t('app.kuaizhizao.common.materialBatchAdded', { count: selected.length }));
    },
    [messageApi, t]
  );

  /** 参考销售订单：先打开弹窗，再让 CodeField 自动生成编号 */
  const handleCreate = () => {
    resetSelectedWarehouseId();
    setCreateModalVisible(true);
    // FormModalTemplate 设置了 destroyOnHidden，ProForm 每次打开都是全新挂载，无需 setTimeout + resetFields
  };
  useNewShortcut(handleCreate);
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t('app.kuaizhizao.materialBorrow.create')),
    [t],
  );

  const handleCreateSubmit = async (values: any) => {
    try {
      const validItems = (values.items ?? []).filter((it: any) => it.material_id && (Number(it.borrow_quantity) || 0) > 0);
      if (!validItems.length) {
        messageApi.error(t('app.kuaizhizao.materialBorrow.msg.needValidLines'));
        throw new Error(t('app.kuaizhizao.materialBorrow.msg.needValidLinesRule'));
      }
      const wh = warehouseList.find((w: any) => (w.id ?? w.warehouse_id) === values.warehouse_id);
      const warehouseName = values.warehouse_name ?? wh?.name ?? wh?.warehouse_name ?? '';
      await warehouseApi.materialBorrow.create({
        borrow_code: values.borrow_code,
        warehouse_id: values.warehouse_id,
        warehouse_name: warehouseName,
        borrower_id: values.borrower_id != null ? Number(values.borrower_id) : undefined,
        borrower_name: values.borrower_name,
        department: values.department,
        expected_return_date: values.expected_return_date ? formatDateTime(values.expected_return_date, 'YYYY-MM-DD') : undefined,
        notes: values.notes,
        attachments: normalizeDocumentAttachments(values.attachments),
        items: validItems.map((it: any) => ({
          material_id: it.material_id,
          material_code: it.material_code || '',
          material_name: it.material_name || '',
          material_unit: it.material_unit || '',
          location_code: it.location_code || undefined,
          borrow_quantity: Number(it.borrow_quantity) || 0,
          warehouse_id: values.warehouse_id,
          warehouse_name: warehouseName,
        })),
      });
      messageApi.success(t('app.kuaizhizao.materialBorrow.msg.createSuccess'));
      resetSelectedWarehouseId();
      setCreateModalVisible(false);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      if (error.message !== t('app.kuaizhizao.materialBorrow.msg.needValidLinesRule')) messageApi.error(error.message || t('app.kuaizhizao.materialBorrow.msg.createFailed'));
      throw error;
    }
  };

  const detailColumns: ProDescriptionsItemProps<MaterialBorrowDetail>[] = useMemo(() => [
    { title: t('app.kuaizhizao.materialBorrow.col.borrowCode'), dataIndex: 'borrow_code' },
    { title: t('app.kuaizhizao.warehouseReports.colWarehouse'), dataIndex: 'warehouse_name' },
    { title: t('app.kuaizhizao.materialBorrow.col.borrower'), dataIndex: 'borrower_name' },
    { title: t('app.kuaizhizao.materialBorrow.col.department'), dataIndex: 'department' },
    {
      title: t('app.kuaizhizao.warehouseOutbound.col.status'),
      dataIndex: 'status',
      render: (s) => {
        const status = (s as string) || '';
        const colorMap: Record<string, string> = {
          '待借出': 'default',
          '已借出': 'success',
          '已取消': 'error',
        };
        return <Tag color={colorMap[status] || 'default'}>{translateMaterialBorrowStatus(t, status)}</Tag>;
      },
    },
    { title: t('app.kuaizhizao.materialBorrow.col.expectedReturnDate'), dataIndex: 'expected_return_date', valueType: 'date' },
    { title: t('app.kuaizhizao.materialBorrow.col.borrowTime'), dataIndex: 'borrow_time', valueType: 'dateTime' },
    { title: t('app.kuaizhizao.common.fieldNotes'), dataIndex: 'notes', span: 2 },
  ], [t]);

  return (
    <>
      <ListPageTemplate>
        <UniTable
          headerTitle={t('app.kuaizhizao.materialBorrow.title')}
          columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.material-borrows"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          showCreateButton
          createButtonText={createButtonLabel}
          onCreate={handleCreate}
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.materialBorrow.msg.deleteConfirm', { count })}
          showImportButton={false}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              const response = await warehouseApi.materialBorrow.list({ skip: 0, limit: 10000 });
              const rawData = Array.isArray(response) ? response : response?.items || response?.data || [];
              let items = rawData;
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = rawData.filter((d: MaterialBorrow) => d.id != null && keys.includes(d.id));
              }
              if (items.length === 0) {
                messageApi.warning(t('app.kuaizhizao.materialBorrow.msg.noExportData'));
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `material-borrows-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(t('app.kuaizhizao.materialBorrow.msg.exportSuccess', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('app.kuaizhizao.materialBorrow.msg.exportFailed'));
            }
          }}
          showSyncButton
          onSync={() => setSyncModalVisible(true)}
          request={async (params) => {
            try {
              const response = await warehouseApi.materialBorrow.list({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                status: params.status,
                warehouse_id: params.warehouse_id,
                keyword: (params as any).keyword,
              });
              const data = Array.isArray(response) ? response : response?.items || response?.data || [];
              const total = Array.isArray(response) ? response.length : response?.total ?? data.length;
              return { data, success: true, total };
            } catch {
              messageApi.error(t('app.kuaizhizao.materialBorrow.msg.loadListFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 1200 }}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={`${t('app.kuaizhizao.materialBorrow.detailTitle')}${borrowDetail?.borrow_code ? ` - ${borrowDetail.borrow_code}` : ''}`}
        open={detailDrawerVisible}
        onClose={() => { setDetailDrawerVisible(false); setBorrowDetail(null); }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        basic={
          borrowDetail ? (
            <Descriptions column={2} items={detailDrawerDescriptionItems(detailColumns, borrowDetail)} />
          ) : undefined
        }
        lines={
          borrowDetail?.items && borrowDetail.items.length > 0 ? (
            <>
              <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
              <Table
                className="warehouse-detail-table"
                size="small"
                rowKey="id"
                columns={[
                  { title: t('app.kuaizhizao.warehouseOutbound.col.materialCode'), dataIndex: 'material_code', width: 120 },
                  { title: t('app.kuaizhizao.warehouseOutbound.col.materialName'), dataIndex: 'material_name', width: 150 },
                  { title: t('app.kuaizhizao.warehouseOutbound.col.unit'), dataIndex: 'material_unit', width: 60 },
                  { title: t('app.kuaizhizao.warehouseOutbound.col.location'), dataIndex: 'location_code', width: 120, render: (v) => v || '-' },
                  { title: t('app.kuaizhizao.materialBorrow.col.borrowQty'), dataIndex: 'borrow_quantity', width: 100, align: 'right' },
                  { title: t('app.kuaizhizao.materialBorrow.col.returnedQty'), dataIndex: 'returned_quantity', width: 100, align: 'right' },
                  { title: t('app.kuaizhizao.warehouseOutbound.col.status'), dataIndex: 'status', width: 80 },
                ]}
                dataSource={borrowDetail.items}
                pagination={false}
              />
            </>
          ) : undefined
        }
      />

      <FormModalTemplate
        title={t('app.kuaizhizao.materialBorrow.createModal')}
        open={createModalVisible}
        onClose={() => {
          resetSelectedWarehouseId();
          setCreateModalVisible(false);
        }}
        formRef={formRef}
        onFinish={handleCreateSubmit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <CodeField
              pageCode="kuaizhizao-warehouse-material-borrow"
              name="borrow_code"
              label={t('app.kuaizhizao.materialBorrow.field.borrowCode')}
              autoGenerateOnCreate={true}
              showGenerateButton={false}
              context={{}}
            />
          </Col>
          <Col span={12}>
            <UniWarehouseSelect
              name="warehouse_id"
              label={t('app.kuaizhizao.warehouseReports.colWarehouse')}
              placeholder={t('app.kuaizhizao.warehouseOutbound.field.selectWarehouse')}
              required
              onChange={(val, wh) => {
                updateSelectedWarehouseId(val);
                formRef.current?.setFieldsValue({ warehouse_name: wh?.name ?? '' });
              }}
            />
          </Col>
        </Row>
        <AntForm.Item name="warehouse_name" hidden />
        <AntForm.Item name="borrower_id" hidden />
        <AntForm.Item name="department_uuid" hidden />
        <Row gutter={16}>
          <Col span={12}>
            <UniUserSelect
              name="borrower_uuid"
              label={t('app.kuaizhizao.materialBorrow.field.borrower')}
              placeholder={t('app.kuaizhizao.materialBorrow.field.selectBorrower')}
              onChange={(_value: any, user: any) => {
                const picked = Array.isArray(user) ? user[0] : user;
                formRef.current?.setFieldsValue({
                  borrower_id: picked?.id,
                  borrower_name: picked?.full_name || picked?.username || undefined,
                });
              }}
            />
            <AntForm.Item name="borrower_name" hidden>
              <Input />
            </AntForm.Item>
          </Col>
          <Col span={12}>
            <ProFormItem name="department_uuid" label={t('app.kuaizhizao.materialBorrow.col.department')}>
              <UniDropdown
                placeholder={t('app.kuaizhizao.materialBorrow.field.selectDepartment')}
                options={departmentOptions}
                showSearch
                optionFilterProp="label"
                onChange={(value) => {
                  const selected = departmentOptions.find((d) => d.value === value);
                  const label = selected?.label;
                  const deptName = label ? String(label).split(' / ').pop() || label : undefined;
                  formRef.current?.setFieldsValue({ department: deptName });
                }}
              />
            </ProFormItem>
            <AntForm.Item name="department" hidden>
              <Input />
            </AntForm.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormItem name="expected_return_date" label={t('app.kuaizhizao.materialBorrow.field.expectedReturnDate')}>
              <FutureDatePicker getForm={() => formRef.current} t={t} style={{ width: '100%' }} />
            </ProFormItem>
          </Col>
          <Col span={12} />
        </Row>
        <div className="uni-table-detail" style={{ width: '100%' }}>
          <UniTableDetailHeader title={t('app.kuaizhizao.warehouseOutbound.section.lines')} required />
          <AntForm.Item name="items" noStyle rules={[{ type: 'array', min: 1, message: t('app.kuaizhizao.materialBorrow.msg.needValidLinesRule') }]}>
            <AntForm.List name="items">
              {(fields, { add, remove }) => {
                const cols = [
                  {
                    title: t('app.kuaizhizao.warehouseOutbound.field.material'),
                    dataIndex: 'material_id',
                    width: 260,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items?.[index] !== curr?.items?.[index]}>
                        {({ getFieldValue }: any) => {
                          const row = getFieldValue('items')?.[index];
                          const mid = row?.material_id ? Number(row.material_id) : null;
                          const fallback = mid && (row?.material_code || row?.material_name)
                            ? { value: mid, label: `${row.material_code || ''} - ${row.material_name || ''}`.trim() || String(mid) }
                            : undefined;
                          return (
                            <div className="warehouse-detail-material-cell">
                              <UniMaterialSelect
                                name={[index, 'material_id']}
                                label=""
                                placeholder={t('app.kuaizhizao.warehouseOutbound.field.selectMaterial')}
                                required
                                size="small"
                                listFieldKey={index}
                                listFieldName="items"
                                fillMapping={{
                                  material_code: 'mainCode',
                                  material_name: 'name',
                                  material_unit: 'baseUnit',
                                }}
                                fallbackOption={fallback}
                                formItemProps={{ style: { margin: 0 } }}
                                showQuickCreate
                                showAdvancedSearch
                              />
                            </div>
                          );
                        }}
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.warehouseOutbound.col.unit'),
                    dataIndex: 'material_unit',
                    width: 80,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'material_unit']} style={{ margin: 0 }}>
                        <Input placeholder={t('app.kuaizhizao.warehouseOutbound.col.unit')} size="small" />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.warehouseOutbound.col.location'),
                    dataIndex: 'location_code',
                    width: 180,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'location_code']} style={{ margin: 0 }}>
                        <Select
                          options={locationOptions}
                          placeholder={selectedWarehouseId ? t('app.kuaizhizao.warehouseOutbound.field.selectLocation') : t('app.kuaizhizao.warehouseOutbound.field.selectWarehouseFirst')}
                          style={{ width: '100%' }}
                          size="small"
                          showSearch
                          optionFilterProp="label"
                          allowClear
                          disabled={!selectedWarehouseId}
                        />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.warehouseOutbound.field.quantity'),
                    dataIndex: 'borrow_quantity',
                    width: 100,
                    align: 'right' as const,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'borrow_quantity']} rules={[{ required: true, message: t('app.kuaizhizao.warehouseOutbound.field.required') }, { type: 'number', min: 0.01, message: '>0' }]} style={{ margin: 0 }}>
                        <InputNumber placeholder={t('app.kuaizhizao.warehouseOutbound.field.quantity')} min={0} precision={2} style={{ width: '100%' }} size="small" />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.warehouseOutbound.col.actions'),
                    width: 60,
                    render: (_: any, __: any, index: number) => (
                      <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(index)} disabled={fields.length <= 1} />
                    ),
                  },
                ];
                const totalWidth = cols.reduce((s, c) => s + (c.width as number || 0), 0);
                return (
                  <div style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                    <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
                    <div style={{ width: '100%', overflowX: 'auto' }}>
                      <Table
                        className="warehouse-detail-table"
                        size="small"
                        dataSource={fields.map((f, i) => ({ ...f, key: f.key ?? i }))}
                        rowKey="key"
                        pagination={false}
                        columns={cols}
                        scroll={fields.length > 0 ? { x: totalWidth } : undefined}
                        style={{ width: '100%', margin: 0 }}
                        footer={() => (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%' }}>
                            <Button type="dashed" icon={<PlusOutlined />} style={{ flex: 1, minWidth: 120 }} onClick={() => add(defaultBorrowItem)}>
                              {t('app.kuaizhizao.warehouseOutbound.action.addLine')}
                            </Button>
                            <Button
                              type="default"
                              icon={<ShoppingOutlined />}
                              style={{ flex: 1, minWidth: 120 }}
                              onClick={() => setMaterialPickerOpen(true)}
                            >
                              {t('app.kuaizhizao.common.materialBatchSelect')}
                            </Button>
                          </div>
                        )}
                      />
                    </div>
                  </div>
                );
              }}
            </AntForm.List>
          </AntForm.Item>
        </div>
        <DocumentAttachmentsField category="material_borrow_attachments" />
        <ProFormTextArea name="notes" label={t('app.kuaizhizao.common.fieldNotes')} placeholder={t('app.kuaizhizao.warehouseOutbound.field.optional')} fieldProps={{ rows: 2 }} />
      </FormModalTemplate>

      <SyncFromDatasetModal
        open={syncModalVisible}
        onClose={() => setSyncModalVisible(false)}
        onConfirm={handleSyncConfirm}
        title={t('app.kuaizhizao.materialBorrow.syncTitle')}
      />

      <UniMaterialBatchPicker
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendBorrowItemsFromMaterials}
      />
      {PrintModal}
    </>
  );
};

export default MaterialBorrowsPage;
