/**
 * 产品工艺配置面板：路线指派 + 单表工序行（序列 / 工时 / 资源 / 计件）
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Select, Space, Typography, App } from 'antd';
import { EditOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import type { Material } from '../types/material';
import type { ProcessRoute } from '../types/process';
import { processRouteApi, operationApi, unwrapProcessPagedList } from '../services/process';
import { productProcessApi } from '../services/productProcess';
import { materialApi } from '../services/material';
import { ProductProcessLinesTable } from './ProductProcessLinesTable';
import { RouteFormModal } from './RouteFormModal';
import type { ProductProcessLine } from '../types/productProcess';
import {
  enrichLineFromOperation,
  linesFromProcessRoute,
  snapshotProductProcessState,
} from '../utils/productProcessLineUtils';
import { productProcessLineFromApi, productProcessLineToApi } from '../utils/manufacturingTimeUnits';
import { searchUserDisplay } from '../../../services/user';
import { resolveEffectiveProcessRouteUuid } from '../utils/productProcessMaterialUtils';

export type ProductProcessPanelProps = {
  material: Material;
  processRoutes: ProcessRoute[];
  processRoutesLoading: boolean;
  onMaterialUpdated?: (material: Material) => void;
  /** 路线模板保存后刷新下拉列表（编号/名称等） */
  onProcessRoutesRefresh?: () => void | Promise<void>;
  /** 两栏布局页不展示物料标题 */
  hideMaterialHeading?: boolean;
  /** 不展示顶部说明条 */
  hidePanelHint?: boolean;
};

export const ProductProcessPanel: React.FC<ProductProcessPanelProps> = ({
  material,
  processRoutes,
  processRoutesLoading,
  onMaterialUpdated,
  onProcessRoutesRefresh,
  hideMaterialHeading = false,
  hidePanelHint = false,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();

  const [routeUuid, setRouteUuid] = useState<string | undefined>();
  const [allowOperationJump, setAllowOperationJump] = useState(false);
  const [lines, setLines] = useState<ProductProcessLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [routeFormOpen, setRouteFormOpen] = useState(false);
  const [routeFormEditUuid, setRouteFormEditUuid] = useState<string | null>(null);

  const baselineRef = useRef('');
  const routeImportRef = useRef<string | undefined>();
  const isDirtyRef = useRef(false);
  const materialRef = useRef(material);
  const processRoutesRef = useRef(processRoutes);
  materialRef.current = material;
  processRoutesRef.current = processRoutes;

  const isDirty =
    snapshotProductProcessState({
      processRouteUuid: routeUuid,
      allowOperationJump,
      lines,
    }) !== baselineRef.current;
  isDirtyRef.current = isDirty;

  const canSave = isDirty && !loading && !saving;

  const applyConfig = useCallback(
    (processRouteUuid: string | undefined, jump: boolean, nextLines: ProductProcessLine[]) => {
      setRouteUuid(processRouteUuid);
      setAllowOperationJump(jump);
      setLines(nextLines);
      baselineRef.current = snapshotProductProcessState({
        processRouteUuid: processRouteUuid,
        allowOperationJump: jump,
        lines: nextLines,
      });
      if (nextLines.length > 0 || !processRouteUuid) {
        routeImportRef.current = processRouteUuid ?? '__cleared__';
      } else {
        routeImportRef.current = undefined;
      }
    },
    [],
  );

  const buildUserIdToUuidMap = useCallback(async () => {
    const usersRes = await searchUserDisplay({ page: 1, page_size: 200 });
    const map = new Map<number, string>();
    (usersRes?.items ?? []).forEach((u) => map.set(u.id, u.uuid));
    return map;
  }, []);

  const loadConfig = useCallback(async (options?: { force?: boolean }) => {
    const mat = materialRef.current;
    if (!mat.uuid) return;
    if (!options?.force && isDirtyRef.current) return;
    setLoading(true);
    try {
      const data = await productProcessApi.get(mat.uuid);
      const userIdToUuid = await buildUserIdToUuidMap();
      const allOps = unwrapProcessPagedList(await operationApi.list({ limit: 1000, is_active: true }));
      const byUuid: Record<string, (typeof allOps)[0]> = {};
      for (const o of allOps) byUuid[o.uuid] = o;
      const enriched = (data.lines ?? []).map((ln) =>
        productProcessLineFromApi(
          enrichLineFromOperation(ln, byUuid[ln.operationUuid], userIdToUuid),
        ),
      );
      const processRouteUuid = data.processRouteUuid;
      applyConfig(processRouteUuid, data.allowOperationJump, enriched);
    } catch (e: unknown) {
      messageApi.error((e as Error).message || t('common.loadFailed'));
      const fallbackRoute = resolveEffectiveProcessRouteUuid(mat, processRoutesRef.current);
      applyConfig(fallbackRoute, false, []);
    } finally {
      setLoading(false);
    }
  }, [applyConfig, messageApi, t, buildUserIdToUuidMap]);

  useEffect(() => {
    if (processRoutesLoading || !material.uuid) return;
    routeImportRef.current = undefined;
    void loadConfig({ force: true });
    // 仅随物料切换 / 路线列表就绪重载，避免 loadConfig 引用变化时覆盖未保存编辑
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material.uuid, processRoutesLoading]);

  const importLinesFromRoute = useCallback(
    async (uuid: string) => {
      const detail = await processRouteApi.get(uuid);
      const jump = Boolean(
        (detail as { allow_operation_jump?: boolean }).allow_operation_jump ??
          (detail as { allowOperationJump?: boolean }).allowOperationJump,
      );
      const userIdToUuid = await buildUserIdToUuidMap();
      const nextLines = await linesFromProcessRoute(
        detail.operation_sequence ?? (detail as { operationSequence?: unknown }).operationSequence,
        jump,
        t,
        async () => unwrapProcessPagedList(await operationApi.list({ limit: 1000, is_active: true })),
        userIdToUuid,
      );
      setAllowOperationJump(jump);
      setLines(nextLines);
    },
    [t, buildUserIdToUuidMap],
  );

  useEffect(() => {
    if (!routeUuid || loading) return;
    // 已有产品工艺行时不再从路线模板覆盖（仅在没有行时才自动导入）
    if (lines.length > 0) {
      routeImportRef.current = routeUuid;
      return;
    }
    if (routeImportRef.current === routeUuid) return;
    routeImportRef.current = routeUuid;
    void importLinesFromRoute(routeUuid).catch(() => {
      messageApi.warning(t('app.master-data.productProcess.routeImportFailed'));
    });
  }, [routeUuid, loading, lines.length, importLinesFromRoute, messageApi, t]);

  const handleRouteSelect = (uuid: string | undefined) => {
    routeImportRef.current = '';
    setRouteUuid(uuid);
    setLines([]);
    setAllowOperationJump(false);
  };

  const handleSave = async () => {
    if (!material.uuid || !canSave) return;
    if (routeUuid && lines.length === 0) {
      messageApi.warning(t('app.master-data.routes.operationRequired'));
      return;
    }
    setSaving(true);
    try {
      const saved = await productProcessApi.save(material.uuid, {
        processRouteUuid: routeUuid,
        allowOperationJump,
        lines: lines.map(productProcessLineToApi),
      });
      applyConfig(
        saved.processRouteUuid,
        saved.allowOperationJump,
        (saved.lines ?? []).map((ln) => productProcessLineFromApi(ln)),
      );
      messageApi.success(t('app.master-data.productProcess.saved'));
      const refreshed = await materialApi.get(material.uuid);
      onMaterialUpdated?.(refreshed);
    } catch (e: unknown) {
      messageApi.error((e as Error).message || t('common.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const openCreateRouteModal = () => {
    setRouteFormEditUuid(null);
    setRouteFormOpen(true);
  };

  const openEditRouteModal = () => {
    if (!routeUuid) return;
    setRouteFormEditUuid(routeUuid);
    setRouteFormOpen(true);
  };

  const handleRouteFormSuccess = async (route: ProcessRoute) => {
    const editingUuid = routeFormEditUuid;
    setRouteFormOpen(false);
    setRouteFormEditUuid(null);
    await onProcessRoutesRefresh?.();
    if (!editingUuid) {
      routeImportRef.current = '';
      setRouteUuid(route.uuid);
    }
  };

  return (
    <>
      {hideMaterialHeading ? null : (
        <Typography.Title level={5} style={{ marginTop: 0 }}>
          {material.code ?? ''} — {material.name ?? ''}
        </Typography.Title>
      )}
      {hidePanelHint ? null : (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('app.master-data.productProcess.panelHint')}
        />
      )}

      <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }} size="middle">
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <Space direction="vertical" size="middle" style={{ flex: 1, minWidth: 280 }}>
            <Typography.Text strong>{t('app.master-data.manufacturing.sectionRoute')}</Typography.Text>
            <Space wrap>
              <Select
                style={{ minWidth: 280 }}
                placeholder={t('app.master-data.source.selectProcessRoute')}
                loading={processRoutesLoading || loading}
                value={routeUuid}
                allowClear
                showSearch
                optionFilterProp="label"
                options={processRoutes.map((pr) => ({
                  label: `${pr.code} - ${pr.name}`,
                  value: pr.uuid,
                }))}
                onChange={handleRouteSelect}
              />
              <Button icon={<PlusOutlined />} onClick={openCreateRouteModal}>
                {t('app.master-data.manufacturing.newRoute')}
              </Button>
              <Button
                icon={<EditOutlined />}
                disabled={!routeUuid || loading}
                onClick={openEditRouteModal}
              >
                {t('app.master-data.manufacturing.editRoute')}
              </Button>
            </Space>
          </Space>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            disabled={!canSave}
            onClick={() => void handleSave()}
          >
            {t('app.master-data.productProcess.save')}
          </Button>
        </div>
      </Space>

      <Typography.Text strong style={{ display: 'block', marginBottom: 12 }}>
        {t('app.master-data.productProcess.unifiedTableTitle')}
      </Typography.Text>
      {routeUuid ? (
        <ProductProcessLinesTable
          lines={lines}
          onChange={setLines}
          allowOperationJump={allowOperationJump}
          onAllowOperationJumpChange={setAllowOperationJump}
          disabled={loading}
        />
      ) : (
        <Alert type="info" showIcon title={t('app.master-data.manufacturing.selectRouteFirst')} />
      )}

      <RouteFormModal
        open={routeFormOpen}
        onClose={() => {
          setRouteFormOpen(false);
          setRouteFormEditUuid(null);
        }}
        editUuid={routeFormEditUuid}
        onSuccess={(route) => void handleRouteFormSuccess(route)}
      />
    </>
  );
};
