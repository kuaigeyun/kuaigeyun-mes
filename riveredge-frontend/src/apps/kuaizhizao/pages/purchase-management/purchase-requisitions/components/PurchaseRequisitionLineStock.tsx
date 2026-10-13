/**
 * 采购申请明细：选料后展示总库存；hover Popover 展开各仓在库结存。
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Popover, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { formatQuantity } from '../../../../../../utils/format';
import { getPurchaseRequisitionMaterialWarehouseStock } from '../../../../services/purchase-requisition';

export type WarehouseStockLine = { warehouse_name: string; quantity: number };

type StockContextValue = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  byMaterial: Record<number, WarehouseStockLine[]>;
};

const PurchaseRequisitionLineStockContext = createContext<StockContextValue>({
  status: 'idle',
  byMaterial: {},
});

export function PurchaseRequisitionLineStockProvider({
  materialIds,
  children,
}: {
  materialIds: number[];
  children: React.ReactNode;
}) {
  const idsKey = useMemo(
    () =>
      [...new Set(materialIds.filter((id) => Number.isFinite(id) && id > 0))]
        .sort((a, b) => a - b)
        .join(','),
    [materialIds],
  );
  const [status, setStatus] = useState<StockContextValue['status']>('idle');
  const [byMaterial, setByMaterial] = useState<Record<number, WarehouseStockLine[]>>({});

  useEffect(() => {
    const mids = idsKey
      .split(',')
      .filter(Boolean)
      .map((s) => Number(s));
    if (!mids.length) {
      setByMaterial({});
      setStatus('idle');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    void getPurchaseRequisitionMaterialWarehouseStock(mids)
      .then((res) => {
        if (cancelled) return;
        const parsed: Record<number, WarehouseStockLine[]> = {};
        const raw = res.by_material ?? {};
        for (const [key, lines] of Object.entries(raw)) {
          const mid = Number(key);
          if (!Number.isFinite(mid) || mid <= 0) continue;
          parsed[mid] = (lines ?? []).map((line) => ({
            warehouse_name: String(line.warehouse_name ?? '').trim() || '—',
            quantity: Number(line.quantity) || 0,
          }));
        }
        setByMaterial(parsed);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setByMaterial({});
          setStatus('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  const value = useMemo(() => ({ status, byMaterial }), [status, byMaterial]);

  return (
    <PurchaseRequisitionLineStockContext.Provider value={value}>
      {children}
    </PurchaseRequisitionLineStockContext.Provider>
  );
}

function WarehouseStockPopoverContent({ lines }: { lines: WarehouseStockLine[] }) {
  return (
    <div style={{ maxWidth: 320, fontSize: 12 }}>
      {lines.map((line, idx) => (
        <div
          key={`${line.warehouse_name}-${idx}`}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: idx < lines.length - 1 ? 6 : 0,
          }}
        >
          <span>{line.warehouse_name}</span>
          <Typography.Text strong>{formatQuantity(line.quantity)}</Typography.Text>
        </div>
      ))}
    </div>
  );
}

/** 表格列：总库存；hover 展示各仓明细 */
export function PurchaseRequisitionLineStockCell({ materialId }: { materialId: number | null | undefined }) {
  const { t } = useTranslation();
  const { status, byMaterial } = useContext(PurchaseRequisitionLineStockContext);
  const mid = materialId != null ? Number(materialId) : 0;
  if (!mid) return <span>-</span>;

  if (status === 'loading') {
    return <Typography.Text type="secondary">{t('app.kuaizhizao.purchaseRequisition.form.stockLoading')}</Typography.Text>;
  }
  if (status === 'error') {
    return <Typography.Text type="secondary">-</Typography.Text>;
  }

  const lines = byMaterial[mid] ?? [];
  if (!lines.length) {
    return <Typography.Text type="secondary">{t('app.kuaizhizao.purchaseRequisition.form.stockEmpty')}</Typography.Text>;
  }

  const total = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);

  return (
    <Popover
      title={t('app.kuaizhizao.purchaseRequisition.form.warehouseStock')}
      content={<WarehouseStockPopoverContent lines={lines} />}
      trigger="hover"
      mouseEnterDelay={0.2}
    >
      <span style={{ cursor: 'help', borderBottom: '1px dashed rgba(0, 0, 0, 0.22)' }}>
        {formatQuantity(total)}
      </span>
    </Popover>
  );
}
