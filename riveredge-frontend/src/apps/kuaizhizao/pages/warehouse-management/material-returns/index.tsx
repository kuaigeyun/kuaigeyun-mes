/**
 * 还料单管理页面
 *
 * 提供还料单的创建、查看、确认和管理功能（必须关联借料单）
 *
 * @author RiverEdge Team
 * @date 2026-02-19
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProFormItem, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Col, Descriptions, Dropdown, Form, Input, InputNumber, Modal, Row, Space, Table, Typography } from 'antd';
import { EyeOutlined, CheckCircleOutlined, DeleteOutlined, PrinterOutlined, MoreOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { UniTableDetailHeader } from '../../../../../components/uni-table-detail/UniTableDetail';
import CodeField from '../../../../../components/code-field';
import { detailDrawerDescriptionItems, DetailDrawerTemplate, DRAWER_CONFIG, FormModalTemplate, ListPageTemplate, MODAL_CONFIG, WAREHOUSE_DETAIL_TABLE_STYLES } from '../../../../../components/layout-templates';
import { warehouseApi } from '../../../services/production';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { getMaterialReturnLifecycle } from '../../../utils/materialReturnLifecycle';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { useKuaizhizaoPrintModal } from '../../../hooks/useKuaizhizaoPrintModal';
import { formatDateTime } from '../../../../../utils/format';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';

interface MaterialReturn {
  id?: number;
  tenant_id?: number;
  return_code?: string;
  borrow_id?: number;
  borrow_code?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  returner_id?: number;
  returner_name?: string;
  return_time?: string;
  status?: string;
  total_quantity?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

interface MaterialReturnDetail extends MaterialReturn {
  items?: MaterialReturnItem[];
}

interface MaterialReturnItem {
  id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_unit?: string;
  return_quantity?: number;
  status?: string;
}

interface BorrowItemForReturn {
  id: number;
  material_id: number;
  material_code: string;
  material_name: string;
  material_unit: string;
  borrow_quantity: number;
  returned_quantity: number;
  warehouse_id: number;
  warehouse_name: string;
}

const MaterialReturnsPage: React.FC = () => {
  const { t } = useTranslation();
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [returnDetail, setReturnDetail] = useState<MaterialReturnDetail | null>(null);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const [borrowList, setBorrowList] = useState<any[]>([]);
  const [borrowLoading, setBorrowLoading] = useState(false);
  const [selectedBorrowDetail, setSelectedBorrowDetail] = useState<{ borrow_id: number; borrow_code: string; warehouse_id: number; warehouse_name: string; items: BorrowItemForReturn[] } | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<number, number>>({});

  useEffect(() => {
    const load = async () => {
      if (!createModalVisible) return;
      setBorrowLoading(true);
      try {
        const chunkSize = 100;
        const maxRows = 500;
        const rows: any[] = [];
        let skip = 0;
        while (rows.length < maxRows) {
          const res = await warehouseApi.materialBorrow.list({ status: '已借出', skip, limit: chunkSize });
          const chunk = Array.isArray(res) ? res : (res as any)?.items || (res as any)?.data || [];
          if (!Array.isArray(chunk) || chunk.length === 0) break;
          rows.push(...chunk);
          if (chunk.length < chunkSize) break;
          skip += chunkSize;
        }
        setBorrowList(rows.slice(0, maxRows));
      } catch {
        setBorrowList([]);
      } finally {
        setBorrowLoading(false);
      }
    };
    load();
  }, [createModalVisible]);

  const onBorrowSelect = async (borrowId: number) => {
    if (!borrowId) {
      setSelectedBorrowDetail(null);
      setReturnQuantities({});
      return;
    }
    try {
      const detail = await warehouseApi.materialBorrow.get(borrowId.toString());
      const items = (detail as any).items || [];
      const borrowItems: BorrowItemForReturn[] = items.map((it: any) => ({
        id: it.id,
        material_id: it.material_id,
        material_code: it.material_code,
        material_name: it.material_name,
        material_unit: it.material_unit,
        borrow_quantity: it.borrow_quantity ?? 0,
        returned_quantity: it.returned_quantity ?? 0,
        warehouse_id: it.warehouse_id ?? (detail as any).warehouse_id,
        warehouse_name: it.warehouse_name ?? (detail as any).warehouse_name,
      }));
      setSelectedBorrowDetail({
        borrow_id: (detail as any).id,
        borrow_code: (detail as any).borrow_code,
        warehouse_id: (detail as any).warehouse_id,
        warehouse_name: (detail as any).warehouse_name,
        items: borrowItems,
      });
      const qtyMap: Record<number, number> = {};
      borrowItems.forEach((it) => {
        const maxRet = Math.max(0, it.borrow_quantity - it.returned_quantity);
        qtyMap[it.id] = maxRet > 0 ? maxRet : 0;
      });
      setReturnQuantities(qtyMap);
    } catch {
      messageApi.error(t('app.kuaizhizao.warehouseMaterialReturn.msg.loadBorrowDetailFailed'));
      setSelectedBorrowDetail(null);
    }
  };

  const handleDetail = async (record: MaterialReturn) => {
    try {
      const detail = await warehouseApi.materialReturn.get(record.id!.toString());
      setReturnDetail(detail as MaterialReturnDetail);
      setDetailDrawerVisible(true);
    } catch {
      messageApi.error(t('app.kuaizhizao.warehouseMaterialReturn.msg.loadDetailFailed'));
    }
  };

  const handleConfirm = async (record: MaterialReturn) => {
    Modal.confirm({
      title: t('app.kuaizhizao.warehouseMaterialReturn.confirm.title'),
      content: t('app.kuaizhizao.warehouseMaterialReturn.confirm.content', { code: record.return_code }),
      onOk: async () => {
        try {
          await warehouseApi.materialReturn.confirm(record.id!.toString());
          messageApi.success(t('app.kuaizhizao.warehouseMaterialReturn.msg.confirmSuccess'));
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.warehouseMaterialReturn.msg.confirmFailed'));
        }
      },
    });
  };

  const handleDelete = async (record: MaterialReturn) => {
    Modal.confirm({
      title: t('app.kuaizhizao.warehouseMaterialReturn.confirm.deleteTitle'),
      content: t('app.kuaizhizao.warehouseMaterialReturn.confirm.deleteContent', { code: record.return_code }),
      onOk: async () => {
        try {
          await warehouseApi.materialReturn.delete(record.id!.toString());
          messageApi.success(t('app.kuaizhizao.warehouseMaterialReturn.msg.deleteSuccess'));
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.warehouseMaterialReturn.msg.deleteFailed'));
        }
      },
    });
  };

  const handlePrint = (record: MaterialReturn) => {
    if (!record.id) return;
    openPrint({ documentType: 'material_return', documentId: record.id });
  };

  const handleCreate = () => {
    setCreateModalVisible(true);
    setSelectedBorrowDetail(null);
    setReturnQuantities({});
  };
  useNewShortcut(handleCreate);
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t('app.kuaizhizao.warehouseMaterialReturn.create')),
    [t],
  );

  const handleCreateSubmit = async (values: any) => {
    if (!selectedBorrowDetail) {
      messageApi.error(t('app.kuaizhizao.warehouseMaterialReturn.msg.selectBorrow'));
      throw new Error(t('app.kuaizhizao.warehouseMaterialReturn.msg.selectBorrow'));
    }
    const validItems = selectedBorrowDetail.items
      .filter((it) => (returnQuantities[it.id] ?? 0) > 0)
      .map((it) => ({
        borrow_item_id: it.id,
        material_id: it.material_id,
        material_code: it.material_code,
        material_name: it.material_name,
        material_unit: it.material_unit,
        return_quantity: returnQuantities[it.id],
        warehouse_id: selectedBorrowDetail.warehouse_id,
        warehouse_name: selectedBorrowDetail.warehouse_name,
      }));
    if (!validItems.length) {
      messageApi.error(t('app.kuaizhizao.warehouseMaterialReturn.msg.needValidReturnQty'));
      throw new Error(t('app.kuaizhizao.warehouseMaterialReturn.msg.needValidReturnQty'));
    }
    try {
      await warehouseApi.materialReturn.create({
        return_code: values.return_code,
        borrow_id: selectedBorrowDetail.borrow_id,
        borrow_code: selectedBorrowDetail.borrow_code,
        warehouse_id: selectedBorrowDetail.warehouse_id,
        warehouse_name: selectedBorrowDetail.warehouse_name,
        returner_name: values.returner_name,
        notes: values.notes,
        attachments: normalizeDocumentAttachments(values.attachments),
        items: validItems,
      });
      messageApi.success(t('app.kuaizhizao.warehouseMaterialReturn.msg.createSuccess'));
      setCreateModalVisible(false);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.warehouseMaterialReturn.msg.createFailed'));
      throw error;
    }
  };

  const columns: ProColumns<MaterialReturn>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.warehouseMaterialReturn.col.returnCode'),
        dataIndex: 'return_code',
        width: 140,
        ellipsis: true,
        fixed: 'left',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.return_code ?? '') }} ellipsis>
            {r.return_code ?? '-'}
          </Typography.Text>
        ),
      },
      {
        title: t('app.kuaizhizao.warehouseMaterialReturn.col.borrowCode'),
        dataIndex: 'borrow_code',
        width: 140,
        ellipsis: true,
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.borrow_code ?? '') }} ellipsis>
            {r.borrow_code ?? '-'}
          </Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.warehouseMaterialReturn.col.warehouse'), dataIndex: 'warehouse_name', width: 120, ellipsis: true },
      { title: t('app.kuaizhizao.warehouseMaterialReturn.col.returner'), dataIndex: 'returner_name', width: 100 },
      { title: t('app.kuaizhizao.warehouseMaterialReturn.col.returnTime'), dataIndex: 'return_time', valueType: 'dateTime', width: 160 },
      { title: t('app.kuaizhizao.warehouseMaterialReturn.col.createdAt'), dataIndex: 'created_at', valueType: 'dateTime', width: 160 },
      {
        title: t('app.kuaizhizao.warehouseMaterialReturn.col.updatedAt'),
        dataIndex: 'updated_at',
        width: 168,
        hideInSearch: true,
        render: (_, r) => (r.updated_at ? formatDateTime(r.updated_at, 'YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: t('app.kuaizhizao.warehouseMaterialReturn.col.lifecycle'),
        dataIndex: 'lifecycle_stage',
        fixed: 'right',
        align: 'left',
        hideInSearch: true,
        render: (_, record) => {
          const lifecycle = getMaterialReturnLifecycle(record as Record<string, unknown>);
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
        title: t('app.kuaizhizao.warehouseMaterialReturn.col.actions'),
        width: 220,
        fixed: 'right',
        render: (_, record) => {
          const showPrint = record.status === '待归还' || record.status === '已归还';
          const printInMore = record.status === '待归还';
          return (
            <Space size="small" wrap>
              <Button {...rowActionKind('read')} onClick={() => handleDetail(record)} />
              {record.status === '待归还' && (
                <>
                  <Button
                    {...rowActionKind('execute')}
                    {...rowActionLabelKeep()}
                    onClick={() => handleConfirm(record)}
                  >
                    {t('app.kuaizhizao.warehouseMaterialReturn.action.confirmInbound')}
                  </Button>
                  <Button {...rowActionKind('delete')} onClick={() => handleDelete(record)} />
                </>
              )}
              {printInMore ? (
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: 'print',
                        icon: <PrinterOutlined />,
                        label: t('app.kuaizhizao.warehouseMaterialReturn.action.print'),
                        onClick: () => handlePrint(record),
                      },
                    ],
                  }}
                  trigger={['click']}
                >
                  <Button {...rowActionKind('display')} {...rowActionLabelKeep()} icon={<MoreOutlined />}>
                    {t('app.kuaizhizao.warehouseMaterialReturn.action.more')}
                  </Button>
                </Dropdown>
              ) : (
                showPrint && <Button {...rowActionKind('print')} onClick={() => handlePrint(record)} />
              )}
            </Space>
          );
        },
      },
    ],
    [t],
  );

  const detailColumns: ProDescriptionsItemProps<MaterialReturnDetail>[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.warehouseMaterialReturn.col.returnCode'), dataIndex: 'return_code' },
      { title: t('app.kuaizhizao.warehouseMaterialReturn.col.borrowCode'), dataIndex: 'borrow_code' },
      { title: t('app.kuaizhizao.warehouseMaterialReturn.col.warehouse'), dataIndex: 'warehouse_name' },
      { title: t('app.kuaizhizao.warehouseMaterialReturn.col.returner'), dataIndex: 'returner_name' },
      {
        title: t('app.kuaizhizao.warehouseMaterialReturn.col.status'),
        dataIndex: 'status',
        render: (_, record) => {
          const lifecycle = getMaterialReturnLifecycle(record as unknown as Record<string, unknown>);
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
      { title: t('app.kuaizhizao.warehouseMaterialReturn.col.returnTime'), dataIndex: 'return_time', valueType: 'dateTime' },
      { title: t('app.kuaizhizao.warehouseMaterialReturn.field.notes'), dataIndex: 'notes', span: 2 },
    ],
    [t],
  );

  const detailItemColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.warehouseMaterialReturn.col.materialCode'), dataIndex: 'material_code', width: 120 },
      { title: t('app.kuaizhizao.warehouseMaterialReturn.col.materialName'), dataIndex: 'material_name', width: 150 },
      { title: t('app.kuaizhizao.warehouseMaterialReturn.col.unit'), dataIndex: 'material_unit', width: 60 },
      { title: t('app.kuaizhizao.warehouseMaterialReturn.col.returnQty'), dataIndex: 'return_quantity', width: 100, align: 'right' as const },
      { title: t('app.kuaizhizao.warehouseMaterialReturn.col.status'), dataIndex: 'status', width: 80 },
    ],
    [t],
  );

  const createFormItemColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.warehouseMaterialReturn.col.materialCode'), dataIndex: 'material_code', width: 120 },
      { title: t('app.kuaizhizao.warehouseMaterialReturn.col.materialName'), dataIndex: 'material_name', width: 150 },
      { title: t('app.kuaizhizao.warehouseMaterialReturn.col.unit'), dataIndex: 'material_unit', width: 60 },
      { title: t('app.kuaizhizao.warehouseMaterialReturn.col.borrowQty'), dataIndex: 'borrow_quantity', width: 90, align: 'right' as const },
      { title: t('app.kuaizhizao.warehouseMaterialReturn.col.returnedQty'), dataIndex: 'returned_quantity', width: 90, align: 'right' as const },
      {
        title: t('app.kuaizhizao.warehouseMaterialReturn.col.thisReturnQty'),
        width: 120,
        render: (_: unknown, record: BorrowItemForReturn) => {
          const maxRet = Math.max(0, record.borrow_quantity - record.returned_quantity);
          return (
            <InputNumber
              min={0}
              max={maxRet}
              value={returnQuantities[record.id] ?? 0}
              onChange={(v) => setReturnQuantities((prev) => ({ ...prev, [record.id]: v ?? 0 }))}
              style={{ width: '100%' }}
            />
          );
        },
      },
    ],
    [t, returnQuantities],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable
          headerTitle={t('app.kuaizhizao.warehouseMaterialReturn.title')}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.material-returns"
          showAdvancedSearch
          showCreateButton
          createButtonText={createButtonLabel}
          onCreate={handleCreate}
          request={async (params) => {
            try {
              const response = await warehouseApi.materialReturn.list({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                status: params.status,
                borrow_id: params.borrow_id,
                warehouse_id: params.warehouse_id,
              });
              const data = Array.isArray(response) ? response : response?.items || response?.data || [];
              const total = Array.isArray(response) ? response.length : response?.total ?? data.length;
              return { data, success: true, total };
            } catch {
              messageApi.error(t('app.kuaizhizao.warehouseMaterialReturn.msg.loadListFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          enableRowSelection={true}
          showDeleteButton={true}
          onDelete={async (keys) => {
            try {
              for (const id of keys) {
                await warehouseApi.materialReturn.delete(String(id));
              }
              messageApi.success(t('app.kuaizhizao.warehouseMaterialReturn.msg.batchDeleteSuccess', { count: keys.length }));
              invalidateMenuBadgeCounts();
              actionRef.current?.reload();
            } catch (error: any) {
              messageApi.error(error.message || t('app.kuaizhizao.warehouseMaterialReturn.msg.deleteFailed'));
            }
          }}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.warehouseMaterialReturn.confirm.batchDelete', { count })}
          scroll={{ x: 1200 }}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={`${t('app.kuaizhizao.warehouseMaterialReturn.detailTitle')}${returnDetail?.return_code ? ` - ${returnDetail.return_code}` : ''}`}
        open={detailDrawerVisible}
        onClose={() => { setDetailDrawerVisible(false); setReturnDetail(null); }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        basic={
          returnDetail ? (
            <Descriptions column={2} items={detailDrawerDescriptionItems(detailColumns, returnDetail)} />
          ) : undefined
        }
        lines={
          returnDetail?.items && returnDetail.items.length > 0 ? (
            <>
              <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
              <Table
                className="warehouse-detail-table"
                size="small"
                rowKey="id"
                columns={detailItemColumns}
                dataSource={returnDetail.items}
                pagination={false}
              />
            </>
          ) : undefined
        }
      />

      <FormModalTemplate
        title={t('app.kuaizhizao.warehouseMaterialReturn.createModal')}
        open={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        formRef={formRef}
        onFinish={handleCreateSubmit}
        submitText={t('app.kuaizhizao.warehouseMaterialReturn.action.saveDraft')}
        width={MODAL_CONFIG.LARGE_WIDTH}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <CodeField
              pageCode="kuaizhizao-warehouse-material-return"
              name="return_code"
              label={t('app.kuaizhizao.warehouseMaterialReturn.field.returnCode')}
              autoGenerateOnCreate={true}
              showGenerateButton={false}
              context={{}}
            />
          </Col>
          <Col span={12}>
            <ProFormItem
              name="borrow_id"
              label={t('app.kuaizhizao.warehouseMaterialReturn.field.borrow')}
              rules={[{ required: true, message: t('app.kuaizhizao.warehouseMaterialReturn.field.selectBorrowRequired') }]}
            >
              <UniDropdown
                placeholder={t('app.kuaizhizao.warehouseMaterialReturn.field.selectBorrowPlaceholder')}
                showSearch
                allowClear
                loading={borrowLoading}
                style={{ width: '100%' }}
                options={borrowList.map((b: any) => ({
                  value: b.id,
                  label: `${b.borrow_code ?? b.borrowCode ?? ''} - ${b.warehouse_name ?? b.warehouseName ?? ''}`.trim() || String(b.id),
                }))}
                onChange={(v) => onBorrowSelect(v as number)}
              />
            </ProFormItem>
          </Col>
        </Row>
        {selectedBorrowDetail && (
          <>
            <div className="uni-table-detail" style={{ width: '100%' }}>
              <UniTableDetailHeader title={t('app.kuaizhizao.warehouseMaterialReturn.field.returnDetails')} />
              <div style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
                <Table
                  className="warehouse-detail-table"
                  size="small"
                  rowKey="id"
                  pagination={false}
                  columns={createFormItemColumns}
                  dataSource={selectedBorrowDetail.items}
                />
              </div>
            </div>
          </>
        )}
        <Row gutter={16}>
          <Col span={12}>
            <ProFormItem name="returner_name" label={t('app.kuaizhizao.warehouseMaterialReturn.field.returner')}>
              <Input placeholder={t('app.kuaizhizao.warehouseMaterialReturn.field.returnerPlaceholder')} />
            </ProFormItem>
          </Col>
          <Col span={12} />
        </Row>
        <DocumentAttachmentsField category="material_return_attachments" />
        <ProFormTextArea
          name="notes"
          label={t('app.kuaizhizao.warehouseMaterialReturn.field.notes')}
          placeholder={t('app.kuaizhizao.warehouseMaterialReturn.field.optional')}
          fieldProps={{ rows: 2 }}
        />
      </FormModalTemplate>
      {PrintModal}
    </>
  );
};

export default MaterialReturnsPage;
