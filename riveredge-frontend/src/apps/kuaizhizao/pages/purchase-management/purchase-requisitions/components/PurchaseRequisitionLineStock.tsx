/**
 * 采购申请明细：选料后展示各仓在库结存（走采购申请 read 专用接口）。
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Typography } from 'antd';
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

export function PurchaseRequisitionLineStockHint({ materialId }: { materialId: number | null | undefined }) {
  const { t } = useTranslation();
  const { status, byMaterial } = useContext(PurchaseRequisitionLineStockContext);
  const mid = materialId != null ? Number(materialId) : 0;
  if (!mid) return null;

  if (status === 'loading') {
    return (
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
        {t('app.kuaizhizao.purchaseRequisition.form.stockLoading')}
      </Typography.Text>
    );
  }
  if (status === 'error') {
    return (
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
        {t('app.kuaizhizao.purchaseRequisition.form.stockUnavailable')}
      </Typography.Text>
    );
  }

  const lines = byMaterial[mid] ?? [];
  if (!lines.length) {
    return (
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
        {t('app.kuaizhizao.purchaseRequisition.form.stockEmpty')}
      </Typography.Text>
    );
  }

  const text = lines
    .map((line) =>
      t('app.kuaizhizao.purchaseRequisition.form.stockWarehouseQty', {
        warehouse: line.warehouse_name,
        qty: formatQuantity(line.quantity),
      }),
    )
    .join(' ');

  return (
    <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4, lineHeight: 1.4 }}>
      {text}
    </Typography.Text>
  );
}

/** 表格列：各仓库存 */
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

  return (
    <Typography.Text type="secondary" style={{ fontSize: 12, lineHeight: 1.45 }}>
      {lines.map((line, idx) => (
        <span key={`${line.warehouse_name}-${idx}`}>
          {idx > 0 ? ' ' : null}
          {t('app.kuaizhizao.purchaseRequisition.form.stockWarehouseQty', {
            warehouse: line.warehouse_name,
            qty: formatQuantity(line.quantity),
          })}
        </span>
      ))}
    </Typography.Text>
  );
}
