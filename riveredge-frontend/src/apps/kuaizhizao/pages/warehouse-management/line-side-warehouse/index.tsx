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
import {
  MaterialStackedCell,
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { LinkedDocumentCode } from '../../../../../components/linked-document-code';
import { QuantityWithUnitDisplay } from '../../../../../components/quantity-with-unit';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { StatusTag } from '../../../../../constants/statusBadges';
import { formatBusinessDateOnly } from '../../../../../utils/format';
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
            title: t('app.kuaizhizao.warehouseCommon.colMaterial'),
            key: 'material_name',
            dataIndex: 'material_name',
            ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
            fixed: 'left',
            render: (_, record) => (
              <MaterialStackedCell
                material_name={record.material_name}
                material_code={record.material_code}
                material_spec={record.material_spec}
              />
            ),
          },
          {
            title: t('app.kuaizhizao.warehouseReports.colMaterialCode'),
            dataIndex: 'material_code',
            hideInTable: true,
            sorter: true,
          },
          {
            title: t('app.kuaizhizao.warehouseReports.colMaterialName'),
            key: 'material_name_search',
            dataIndex: 'material_name',
            hideInTable: true,
          },
          {
            title: t(`${P}.colSpec`),
            dataIndex: 'material_spec',
            hideInTable: true,
          },
          {
            title: t(`${P}.colLineSideWarehouse`),
            key: 'line_side_warehouse',
            dataIndex: 'warehouse_name',
            width: 176,
            minWidth: 176,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: false,
            sorter: true,
            render: (_, record) => {
              const wh = warehouseById.get(record.warehouse_id);
              const secondary =
                [wh?.workshop_name, wh?.work_center_name].filter(Boolean).join(' / ') ||
                wh?.code ||
                '-';
              return (
                <UniTableStackedPrimaryCell
                  primary={String(record.warehouse_name || wh?.name || '-')}
                  secondary={secondary}
                  secondaryCopyable={Boolean(wh?.code && secondary === wh.code)}
                />
              );
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
            ellipsis: false,
            sorter: true,
            render: (_, record) => {
              const batch = String(record.batch_no ?? '').trim();
              const expiryText = record.expiry_date
                ? formatBusinessDateOnly(record.expiry_date, '')
                : '';
              if (!batch && !expiryText) return '-';
              return (
                <UniTableStackedPrimaryCell
                  primary={batch || '-'}
                  secondary={expiryText ? t(`${P}.expiryLabel`, { date: expiryText }) : '-'}
                  secondaryCopyable={false}
                />
              );
            },
          },
          {
            title: t(`${P}.colAvailableStock`),
            key: 'line_side_qty',
            dataIndex: 'quantity',
            width: 168,
            minWidth: 168,
            uniTableKeepWidth: true,
            resizable: false,
            align: 'right',
            sorter: true,
            render: (_, record) => {
              const qty = Number(record.quantity);
              const reserved = Number(record.reserved_quantity);
              const avail = qty - reserved;
              return (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: 1,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      color: avail <= 0 ? token.colorError : token.colorSuccess,
                      fontWeight: 600,
                    }}
                  >
                    <QuantityWithUnitDisplay quantity={avail} unit={record.material_unit} />
                  </span>
                  <span
                    style={{
                      fontSize: token.fontSizeSM,
                      color: token.colorTextSecondary,
                      lineHeight: 1.2,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span style={{ color: qty <= 0 ? token.colorError : undefined }}>
                      {t(`${P}.stockPrefix`)}{' '}
                      <QuantityWithUnitDisplay quantity={qty} unit={record.material_unit} />
                    </span>
                    <span style={{ margin: '0 4px', opacity: 0.45 }}>/</span>
                    <span style={{ color: reserved > 0 ? token.colorWarning : undefined }}>
                      {t(`${P}.reservedPrefix`)}{' '}
                      <QuantityWithUnitDisplay quantity={reserved} unit={record.material_unit} />
                    </span>
                  </span>
                </div>
              );
            },
          },
          {
            title: t(`${P}.colReservedWorkOrder`),
            key: 'reserved_work_order_code',
            dataIndex: 'work_order_code',
            width: 160,
            minWidth: 160,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: false,
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
                    ellipsis={false}
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
            width: 88,
            minWidth: 88,
            uniTableKeepWidth: true,
            resizable: false,
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
        columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.line-side-warehouse.rich-v5"
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
