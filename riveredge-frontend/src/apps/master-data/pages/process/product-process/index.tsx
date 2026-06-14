/**
 * 产品工艺 — 为自制件指派工艺路线并维护序列、资源、工价
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Alert, App, Empty, Select, Spin, Tag, Typography } from 'antd';
import { ListPageTemplate, TwoColumnLayout } from '../../../../../components/layout-templates';
import { materialApi } from '../../../services/material';
import { processRouteApi } from '../../../services/process';
import type { Material } from '../../../types/material';
import type { ProcessRoute } from '../../../types/process';
import { ProductProcessPanel } from '../../../components/ProductProcessPanel';
import {
  effectiveProcessRouteLabel,
  materialHasEffectiveProcessRoute,
  resolveEffectiveProcessRouteUuid,
} from '../../../utils/productProcessMaterialUtils';

type AssignFilter = 'all' | 'assigned' | 'unassigned';

const API_LIST_LIMIT = 1000;

const ProductProcessPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { message: messageApi } = App.useApp();

  const materialUuidFromUrl = searchParams.get('materialUuid') ?? undefined;
  const routeUuidFromUrl = searchParams.get('routeUuid') ?? undefined;

  const [keyword, setKeyword] = useState('');
  const [assignFilter, setAssignFilter] = useState<AssignFilter>('all');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsTotal, setMaterialsTotal] = useState(0);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);

  const [processRoutes, setProcessRoutes] = useState<ProcessRoute[]>([]);
  const [processRoutesLoading, setProcessRoutesLoading] = useState(false);

  const filterRoute = useMemo(
    () => (routeUuidFromUrl ? processRoutes.find((r) => r.uuid === routeUuidFromUrl) : undefined),
    [routeUuidFromUrl, processRoutes],
  );

  const notSetText = t('app.master-data.source.processRouteNotSet');

  const loadProcessRoutes = useCallback(async () => {
    setProcessRoutesLoading(true);
    try {
      const result = await processRouteApi.list({ limit: API_LIST_LIMIT, is_active: true });
      const list = Array.isArray(result) ? result : result?.data ?? [];
      setProcessRoutes(list);
    } catch (e: unknown) {
      messageApi.error((e as Error).message || t('app.master-data.materialForm.fetchProcessRoutesFailed'));
      setProcessRoutes([]);
    } finally {
      setProcessRoutesLoading(false);
    }
  }, [messageApi, t]);

  const loadMaterials = useCallback(
    async (searchKeyword = '') => {
      setMaterialsLoading(true);
      try {
        const kw = searchKeyword.trim();
        const { items, total } = await materialApi.list({
          skip: 0,
          limit: API_LIST_LIMIT,
          sourceType: 'Make',
          mastersOnly: true,
          isActive: true,
          ...(kw ? { keyword: kw } : {}),
        });
        setMaterials(items ?? []);
        setMaterialsTotal(typeof total === 'number' ? total : items?.length ?? 0);
      } catch (e: unknown) {
        messageApi.error((e as Error).message || t('common.loadFailed'));
        setMaterials([]);
        setMaterialsTotal(0);
      } finally {
        setMaterialsLoading(false);
      }
    },
    [messageApi, t],
  );

  useEffect(() => {
    void loadProcessRoutes();
  }, [loadProcessRoutes]);

  useEffect(() => {
    void loadMaterials();
  }, [loadMaterials]);

  const selectMaterial = useCallback(
    async (record: Material) => {
      setSelectedLoading(true);
      try {
        const detail = await materialApi.get(record.uuid);
        setSelectedMaterial(detail);
        const next = new URLSearchParams(searchParams);
        next.set('materialUuid', record.uuid);
        setSearchParams(next, { replace: true });
      } catch (e: unknown) {
        messageApi.error((e as Error).message || t('common.loadFailed'));
      } finally {
        setSelectedLoading(false);
      }
    },
    [messageApi, searchParams, setSearchParams, t],
  );

  useEffect(() => {
    if (!materialUuidFromUrl || materialsLoading) return;
    const inList = materials.find((m) => m.uuid === materialUuidFromUrl);
    if (inList && selectedMaterial?.uuid !== materialUuidFromUrl) {
      void selectMaterial(inList);
    } else if (!inList && materialUuidFromUrl && !selectedLoading) {
      setSelectedLoading(true);
      materialApi
        .get(materialUuidFromUrl)
        .then((detail) => {
          if (detail.sourceType === 'Make' || (detail as { source_type?: string }).source_type === 'Make') {
            setSelectedMaterial(detail);
          }
        })
        .catch((e: Error) => messageApi.error(e.message || t('common.loadFailed')))
        .finally(() => setSelectedLoading(false));
    }
  }, [materialUuidFromUrl, materials, materialsLoading, selectMaterial, selectedMaterial?.uuid, selectedLoading, messageApi, t]);

  const displayedMaterials = useMemo(() => {
    let rows = materials;
    if (filterRoute) {
      rows = rows.filter(
        (m) => resolveEffectiveProcessRouteUuid(m, processRoutes) === filterRoute.uuid,
      );
    }
    if (assignFilter === 'assigned') {
      rows = rows.filter((m) => materialHasEffectiveProcessRoute(m, processRoutes));
    } else if (assignFilter === 'unassigned') {
      rows = rows.filter((m) => !materialHasEffectiveProcessRoute(m, processRoutes));
    }
    return rows;
  }, [materials, assignFilter, filterRoute, processRoutes]);

  const clearRouteFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('routeUuid');
    setSearchParams(next, { replace: true });
  };

  const leftMaterialList = (
    <div className="product-process-material-list">
      {materialsLoading ? (
        <div className="product-process-material-list__loading">
          <Spin />
        </div>
      ) : displayedMaterials.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.master-data.productProcess.noMaterials')} />
      ) : (
        displayedMaterials.map((m) => {
          const hasRoute = materialHasEffectiveProcessRoute(m, processRoutes);
          const routeLabel = effectiveProcessRouteLabel(m, processRoutes, notSetText);
          const active = selectedMaterial?.uuid === m.uuid;
          return (
            <button
              key={m.uuid}
              type="button"
              className={`product-process-material-list__item${active ? ' product-process-material-list__item--active' : ''}`}
              onClick={() => void selectMaterial(m)}
            >
              <div className="product-process-material-list__row">
                <span className="product-process-material-list__code">{m.code}</span>
                <Tag
                  variant="filled"
                  color={hasRoute ? 'processing' : 'default'}
                  className="product-process-material-list__tag"
                >
                  {routeLabel}
                </Tag>
              </div>
              <div className="product-process-material-list__name" title={m.name}>
                {m.name}
              </div>
            </button>
          );
        })
      )}
    </div>
  );

  return (
    <ListPageTemplate fillMain>
      {filterRoute ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 8, flexShrink: 0 }}
          message={t('app.master-data.productProcess.filteredByRoute', {
            code: filterRoute.code,
            name: filterRoute.name,
          })}
          action={
            <Typography.Link onClick={clearRouteFilter}>
              {t('app.master-data.productProcess.clearRouteFilter')}
            </Typography.Link>
          }
        />
      ) : null}

      <TwoColumnLayout
        style={{ flex: 1, minHeight: 0 }}
        leftPanel={{
          width: 280,
          minWidth: 220,
          search: {
            placeholder: t('app.master-data.productProcess.searchMaterial'),
            value: keyword,
            onChange: setKeyword,
            onSearch: (v) => void loadMaterials(v),
            allowClear: true,
          },
          actions: [
            <Select
              key="assign-filter"
              size="small"
              style={{ width: '100%' }}
              value={assignFilter}
              onChange={setAssignFilter}
              options={[
                { label: t('app.master-data.productProcess.filterAll'), value: 'all' },
                { label: t('app.master-data.productProcess.filterAssigned'), value: 'assigned' },
                { label: t('app.master-data.productProcess.filterUnassigned'), value: 'unassigned' },
              ]}
            />,
            materialsTotal > API_LIST_LIMIT ? (
              <Typography.Text key="trunc-hint" type="warning" style={{ fontSize: 12, display: 'block' }}>
                {t('app.master-data.productProcess.listTruncated', {
                  total: materialsTotal,
                  limit: API_LIST_LIMIT,
                })}
              </Typography.Text>
            ) : null,
          ].filter(Boolean),
          leftContent: leftMaterialList,
        }}
        rightPanel={{
          contentPadding: 12,
          content: (
            <Spin spinning={selectedLoading}>
              {selectedMaterial ? (
                <ProductProcessPanel
                  material={selectedMaterial}
                  processRoutes={processRoutes}
                  processRoutesLoading={processRoutesLoading}
                  hideMaterialHeading
                  hidePanelHint
                  onMaterialUpdated={(m) => {
                    setSelectedMaterial(m);
                    setMaterials((prev) => prev.map((row) => (row.uuid === m.uuid ? { ...row, ...m } : row)));
                  }}
                  onProcessRoutesRefresh={loadProcessRoutes}
                />
              ) : (
                <Empty
                  style={{ marginTop: 80 }}
                  description={t('app.master-data.productProcess.selectMaterialHint')}
                />
              )}
            </Spin>
          ),
          footer: (
            <span>
              {displayedMaterials.length}
              {materialsTotal > displayedMaterials.length ? ` / ${materialsTotal}` : ''}
            </span>
          ),
        }}
      />
    </ListPageTemplate>
  );
};

export default ProductProcessPage;
