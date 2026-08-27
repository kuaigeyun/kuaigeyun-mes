/**
 * 线边仓管理页面
 *
 * 查看线边仓列表及线边仓库存，支持从主仓库调拨物料至线边仓。
 */

import React, { useMemo, useRef, useState } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { App, Select, theme } from 'antd';
import { useTranslation } from 'react-i18next';
import { warehouseApi } from '../../../services/production';
import { UniTable } from '../../../../../components/uni-table';
import { LinkedDocumentCode } from '../../../../../components/linked-document-code';
import { QuantityWithUnitDisplay } from '../../../../../components/quantity-with-unit';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { StatusTag } from '../../../../../constants/statusBadges';
import { alignProColumns } from '../../sales-management/shared/documentFieldAlignment';
import { WAREHOUSE_DOC_LIST_FIELD_RANK } from '../shared/warehouseDocListFieldRank';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';
import {
  normalizeWarehouseListResponse,
  resolveLineSideInventoryListParams,
} from '../../../utils/warehouseListCore';

const P = 'app.kuaizhizao.lineSideWarehouse';

interface LineSideWarehouse {
  id: number;
  code: string;
  name: string;
  workshop_id: number | null;
  workshop_name: string | null;
  work_center_id: number | null;
  work_center_name: string | null;
}

interface LineSideInventoryItem {
  id: number;
  warehouse_id: number;
  warehouse_name: string | null;
  material_id: number;
  material_code: string;
  material_name: string;
  material_spec: string | null;
  material_unit: string | null;
  batch_no: string | null;
  production_date?: string | null;
  expiry_date?: string | null;
  quantity: number;
  reserved_quantity: number;
  work_order_id?: number | null;
  work_order_code: string | null;
  status: string;
}

function resolveLineSideStatusDisplay(
  t: (key: string) => string,
  status?: string | null,
): { label: string; color: string } {
  const raw = String(status ?? '').trim();
  if (raw === 'available') {
    return { label: t(`${P}.status.available`), color: 'success' };
  }
  if (raw === 'reserved') {
    return { label: t(`${P}.status.reserved`), color: 'warning' };
  }
  if (raw === 'consumed') {
    return { label: t(`${P}.status.consumed`), color: 'default' };
  }
  return { label: raw || '-', color: 'default' };
}

const LineSideWarehousePage: React.FC = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const actionRef = useRef<any>(null);
  const [warehouses, setWarehouses] = useState<LineSideWarehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | undefined>();

  const warehouseById = useMemo(() => {
    const map = new Map<number, LineSideWarehouse>();
    warehouses.forEach((w) => map.set(w.id, w));
    return map;
  }, [warehouses]);

  React.useEffect(() => {
    warehouseApi.lineSideWarehouse
      .listWarehouses()
      .then((res: any) => {
        setWarehouses(Array.isArray(res) ? res : []);
      })
      .catch(() => {
        message.error(t(`${P}.loadWarehousesFailed`));
      });
  }, [message, t]);

  const columns: ProColumns<LineSideInventoryItem>[] = useMemo(
    () =>
      alignProColumns<LineSideInventoryItem>(
        [
          {
            title: t('app.kuaizhizao.warehouseCommon.colMaterialCode'),
            dataIndex: 'material_code',
            width: 120,
            minWidth: 120,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: true,
            fixed: 'left',
            sorter: true,
          },
          {
            title: t('app.kuaizhizao.warehouseCommon.colMaterialName'),
            dataIndex: 'material_name',
            minWidth: 160,
            uniTableRemainderFlex: true,
            uniTablePrimaryFlex: true,
            resizable: false,
            ellipsis: true,
          },
          {
            title: t(`${P}.colSpec`),
            dataIndex: 'material_spec',
            width: 140,
            minWidth: 140,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: true,
            hideInSearch: true,
            render: (_, record) => String(record.material_spec ?? '').trim() || '-',
          },
          {
            title: t(`${P}.colLineSideWarehouse`),
            key: 'line_side_warehouse',
            dataIndex: 'warehouse_name',
            width: 180,
            minWidth: 180,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: true,
            sorter: true,
            render: (_, record) => {
              const wh = warehouseById.get(record.warehouse_id);
              return String(record.warehouse_name || wh?.name || '-');
            },
          },
          {
            title: t('app.kuaizhizao.batchInventoryQuery.colBatchNo'),
            key: 'line_side_batch',
            dataIndex: 'batch_no',
            width: 120,
            minWidth: 120,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: true,
            sorter: true,
            render: (_, record) => {
              const batch = String(record.batch_no ?? '').trim();
              return batch || '-';
            },
          },
          {
            title: t(`${P}.colAvailableQty`),
            key: 'available_quantity',
            width: 110,
            minWidth: 110,
            uniTableKeepWidth: true,
            resizable: false,
            align: 'right',
            hideInSearch: true,
            render: (_, record) => {
              const avail = Number(record.quantity) - Number(record.reserved_quantity);
              return (
                <span style={{ color: avail <= 0 ? token.colorError : token.colorSuccess }}>
                  <QuantityWithUnitDisplay quantity={avail} unit={record.material_unit} />
                </span>
              );
            },
          },
          {
            title: t('app.kuaizhizao.warehouseReports.colStockQty'),
            dataIndex: 'quantity',
            width: 110,
            minWidth: 110,
            uniTableKeepWidth: true,
            resizable: false,
            align: 'right',
            sorter: true,
            render: (_, record) => {
              const qty = Number(record.quantity);
              return (
                <span style={{ color: qty <= 0 ? token.colorError : undefined }}>
                  <QuantityWithUnitDisplay quantity={qty} unit={record.material_unit} />
                </span>
              );
            },
          },
          {
            title: t(`${P}.colReservedQty`),
            dataIndex: 'reserved_quantity',
            width: 110,
            minWidth: 110,
            uniTableKeepWidth: true,
            resizable: false,
            align: 'right',
            hideInSearch: true,
            render: (_, record) => {
              const reserved = Number(record.reserved_quantity);
              return (
                <span style={{ color: reserved > 0 ? token.colorWarning : undefined }}>
                  <QuantityWithUnitDisplay quantity={reserved} unit={record.material_unit} />
                </span>
              );
            },
          },
          {
            title: t(`${P}.colReservedWorkOrder`),
            key: 'reserved_work_order_code',
            dataIndex: 'work_order_code',
            width: 140,
            minWidth: 140,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: true,
            sorter: true,
            render: (_, record) => {
              const code = String(record.work_order_code ?? '').trim();
              if (!code) return '-';
              const id = record.work_order_id != null ? Number(record.work_order_id) : NaN;
              if (Number.isFinite(id) && id > 0) {
                return (
                  <LinkedDocumentCode
                    documentType="work_order"
                    documentId={id}
                    code={code}
                    ellipsis
                  />
                );
              }
              return code;
            },
          },
          {
            title: t('common.status'),
            key: 'lifecycle',
            dataIndex: 'status',
            fixed: 'right',
            hideInSearch: true,
            render: (_, record) => {
              const { label, color } = resolveLineSideStatusDisplay(t, record.status);
              if (label === '-') return '-';
              return <StatusTag color={color}>{label}</StatusTag>;
            },
          },
        ],
        WAREHOUSE_DOC_LIST_FIELD_RANK,
      ),
    [t, token, warehouseById],
  );

  const fetchInventory = async (
    params: any,
    sort: any,
    _filter: any,
    searchFormValues?: Record<string, unknown>,
  ) => {
    try {
      const listParams = resolveLineSideInventoryListParams(searchFormValues, sort);
      const res = await warehouseApi.lineSideWarehouse.listInventory({
        ...listParams,
        warehouse_id: selectedWarehouseId || listParams.warehouse_id,
        skip: ((params?.current || 1) - 1) * (params?.pageSize || 20),
        limit: params?.pageSize || 20,
      });
      const { data, total } = normalizeWarehouseListResponse(res);
      return { data, total, success: true };
    } catch {
      message.error(t('app.kuaizhizao.warehouseCommon.queryFailed'));
      return { data: [], total: 0, success: false };
    }
  };

  return (
    <ListPageTemplate>
      <UniTable<LineSideInventoryItem>
        headerTitle={t(`${P}.headerTitle`)}
        actionRef={actionRef}
        columns={columns}
        columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.line-side-warehouse-width-v5"
        viewTypes={['table', 'help']}
        helpViewConfig={buildListPageHelpViewConfig('kuaizhizao.lineSideWarehouse')}
        request={fetchInventory}
        showAdvancedSearch
        skipFuzzyPinyinClientFilter
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        params={{ warehouse_id: selectedWarehouseId }}
        toolBarRender={() => [
          <Select
            key="warehouse-select"
            placeholder={t(`${P}.filterPlaceholder`)}
            allowClear
            style={{ width: 200 }}
            options={warehouses.map((w) => ({ label: `${w.code} - ${w.name}`, value: w.id }))}
            value={selectedWarehouseId}
            onChange={(v) => {
              setSelectedWarehouseId(v);
            }}
          />,
        ]}
      />
    </ListPageTemplate>
  );
};

export default LineSideWarehousePage;
