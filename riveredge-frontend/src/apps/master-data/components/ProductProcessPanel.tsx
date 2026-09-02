/**
 * 产品工艺配置面板：路线指派 + 单表工序行（序列 / 工时 / 资源 / 计件）
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Dropdown, Select, Space, Typography, App } from 'antd';
import { DownOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { Material } from '../types/material';
import type { ProcessRoute } from '../types/process';
import { processRouteApi, operationApi, unwrapProcessPagedList } from '../services/process';
import { productProcessApi } from '../services/productProcess';
import { materialApi } from '../services/material';
import { ProductProcessLinesTable } from './ProductProcessLinesTable';
import { RouteFormModal } from './RouteFormModal';
import { ProductProcessSaveAsRouteModal } from './ProductProcessSaveAsRouteModal';
import type { MaterialProductProcessSave, ProductProcessLine } from '../types/productProcess';
import {
  enrichLineFromOperation,
  linesFromProcessRoute,
  reloadProductProcessLinesFromRouteTemplate,
  sameProductProcessLineSequence,
  snapshotProductProcessState,
} from '../utils/productProcessLineUtils';
import { productProcessLineFromApi, productProcessLineToApi } from '../utils/manufacturingTimeUnits';
import { searchUserDisplay } from '../../../services/user';
import { resolveEffectiveProcessRouteUuid } from '../utils/productProcessMaterialUtils';
import { formatDateTime } from '../../../utils/format';

function resolveProductProcessAudit(data: {
  updatedByName?: string;
  updated_by_name?: string;
  createdByName?: string;
  created_by_name?: string;
  updatedAt?: string;
  updated_at?: string;
  createdAt?: string;
  created_at?: string;
}): { operator: string; time: string } | null {
  const operator = (
    data.updatedByName ||
    data.updated_by_name ||
    data.createdByName ||
    data.created_by_name ||
    ''
  ).trim();
  const timeRaw = data.updatedAt || data.updated_at || data.createdAt || data.created_at;
  if (!operator && !timeRaw) return null;
  return {
    operator: operator || '-',
    time: timeRaw ? formatDateTime(timeRaw, 'YYYY-MM-DD HH:mm') : '-',
  };
}

export type ProductProcessPanelProps = {
  material: Material;
  processRoutes: ProcessRoute[];
  processRoutesLoading: boolean;
  onMaterialUpdated?: (material: Material) => void;
  /** 普通保存后同步产品工艺页左栏路线标签（不回写物料默认路线） */
  onProductProcessRouteSaved?: (materialUuid: string, processRouteUuid?: string | null) => void;
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
  onProductProcessRouteSaved,
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
  const [reloadingRoute, setReloadingRoute] = useState(false);
  const [routeFormOpen, setRouteFormOpen] = useState(false);
  const [routeFormEditUuid, setRouteFormEditUuid] = useState<string | null>(null);
  const [saveAsRouteOpen, setSaveAsRouteOpen] = useState(false);
  const [auditHint, setAuditHint] = useState<{ operator: string; time: string } | null>(null);

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

  const buildUserIdToUuidMap = useCallback(async (): Promise<Map<number, string>> => {
    try {
      const usersRes = await searchUserDisplay({ page: 1, page_size: 200 });
      const map = new Map<number, string>();
      (usersRes?.items ?? []).forEach((u) => map.set(u.id, u.uuid));
      return map;
    } catch {
      // 人员展示搜索依赖 system:user:display/read；缺失时不应阻断路线工序模板导入
      return new Map();
    }
  }, []);

  const loadAllOperations = useCallback(async () => {
    return unwrapProcessPagedList(await operationApi.list({ limit: 1000, isActive: true }));
  }, []);

  const resolveProcessRouteDetail = useCallback(async (uuid: string): Promise<ProcessRoute> => {
    try {
      return await processRouteApi.get(uuid);
    } catch (getError) {
      const cached = processRoutesRef.current.find((route) => route.uuid === uuid);
      const cachedSequence = cached?.operation_sequence ?? cached?.operationSequence;
      if (cached && cachedSequence) {
        return cached;
      }
      throw getError;
    }
  }, []);

  const fetchRouteTemplateLines = useCallback(
    async (uuid: string): Promise<{ allowOperationJump: boolean; lines: ProductProcessLine[] }> => {
      try {
        const template = await processRouteApi.getOperationTemplate(uuid);
        return {
          allowOperationJump: Boolean(template.allowOperationJump),
          lines: (template.lines ?? []).map((ln) => productProcessLineFromApi(ln)),
        };
      } catch {
        // 旧版后端无 operation-template 时回退客户端解析
      }

      const detail = await resolveProcessRouteDetail(uuid);
      const allowOperationJump = Boolean(
        (detail as { allow_operation_jump?: boolean }).allow_operation_jump ??
          (detail as { allowOperationJump?: boolean }).allowOperationJump,
      );
      const userIdToUuid = await buildUserIdToUuidMap();
      const operationSequence =
        detail.operation_sequence ??
        (detail as { operationSequence?: unknown }).operationSequence;
      const nextLines = await linesFromProcessRoute(
        operationSequence,
        allowOperationJump,
        t,
        loadAllOperations,
        userIdToUuid,
      );
      return { allowOperationJump, lines: nextLines };
    },
    [buildUserIdToUuidMap, loadAllOperations, resolveProcessRouteDetail, t],
  );

  const importLinesFromRoute = useCallback(
    async (uuid: string) => {
      const { allowOperationJump: jump, lines: nextLines } = await fetchRouteTemplateLines(uuid);
      setAllowOperationJump(jump);
      setLines(nextLines);
    },
    [fetchRouteTemplateLines],
  );

  const loadConfig = useCallback(async (options?: { force?: boolean }) => {
    const mat = materialRef.current;
    if (!mat.uuid) return;
    if (!options?.force && isDirtyRef.current) return;
    setLoading(true);
    try {
      const data = await productProcessApi.get(mat.uuid);
      if (!options?.force && isDirtyRef.current) return;
      const userIdToUuid = await buildUserIdToUuidMap();
      const allOps = await loadAllOperations();
      const byUuid: Record<string, (typeof allOps)[0]> = {};
      for (const o of allOps) byUuid[o.uuid] = o;
      const enriched = (data.lines ?? []).map((ln) =>
        productProcessLineFromApi(
          enrichLineFromOperation(ln, byUuid[ln.operationUuid], userIdToUuid),
        ),
      );
      const processRouteUuid = data.processRouteUuid;
      applyConfig(processRouteUuid, data.allowOperationJump, enriched);
      setAuditHint(resolveProductProcessAudit(data));
    } catch (e: unknown) {
      messageApi.error((e as Error).message || t('common.loadFailed'));
      if (!isDirtyRef.current) {
        const fallbackRoute = resolveEffectiveProcessRouteUuid(mat, processRoutesRef.current);
        applyConfig(fallbackRoute, false, []);
      }
    } finally {
      setLoading(false);
    }
  }, [applyConfig, messageApi, t, buildUserIdToUuidMap, loadAllOperations]);

  useEffect(() => {
    if (processRoutesLoading || !material.uuid) return;
    routeImportRef.current = undefined;
    void loadConfig({ force: true });
    // 仅随物料切换 / 路线列表就绪重载，避免 loadConfig 引用变化时覆盖未保存编辑
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material.uuid, processRoutesLoading]);

  useEffect(() => {
    if (!routeUuid) return;
    // 已有产品工艺行时不再从路线模板覆盖（仅在没有行时才自动导入）
    if (lines.length > 0) {
      routeImportRef.current = routeUuid;
      return;
    }
    if (routeImportRef.current === routeUuid) return;
    routeImportRef.current = routeUuid;
    void importLinesFromRoute(routeUuid).catch(() => {
      routeImportRef.current = undefined;
      messageApi.warning(t('app.master-data.productProcess.routeImportFailed'));
    });
  }, [routeUuid, lines.length, importLinesFromRoute, messageApi, t]);

  const handleReloadRoute = async () => {
    if (!routeUuid || loading || reloadingRoute) return;
    setReloadingRoute(true);
    try {
      const { allowOperationJump: jump, lines: routeLines } = await fetchRouteTemplateLines(routeUuid);
      if (routeLines.length === 0) {
        messageApi.warning(t('app.master-data.routes.operationRequired'));
        return;
      }
      const reloaded = reloadProductProcessLinesFromRouteTemplate(lines, routeLines);
      if (sameProductProcessLineSequence(reloaded, lines) && allowOperationJump === jump) {
        messageApi.info(t('app.master-data.productProcess.reloadRouteAlreadyComplete'));
        return;
      }
      setAllowOperationJump(jump);
      setLines(reloaded);
      messageApi.success(t('app.master-data.productProcess.reloadRouteSuccess'));
    } catch {
      messageApi.warning(t('app.master-data.productProcess.routeImportFailed'));
    } finally {
      setReloadingRoute(false);
    }
  };

  const handleRouteSelect = (uuid: string | undefined) => {
    routeImportRef.current = '';
    setRouteUuid(uuid);
    setLines([]);
    setAllowOperationJump(false);
  };

  const canSaveAsNewRoute = canSave && Boolean(routeUuid) && lines.length > 0;

  const persistConfig = useCallback(
    async (extra?: Pick<MaterialProductProcessSave, 'saveAsNewRoute' | 'newRouteCode' | 'newRouteName'>) => {
      if (!material.uuid) return;
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
          ...extra,
        });
        applyConfig(
          saved.processRouteUuid,
          saved.allowOperationJump,
          (saved.lines ?? []).map((ln) => productProcessLineFromApi(ln)),
        );
        setAuditHint(resolveProductProcessAudit(saved));
        onProductProcessRouteSaved?.(material.uuid, saved.processRouteUuid ?? null);
        if (extra?.saveAsNewRoute) {
          await onProcessRoutesRefresh?.();
          const refreshed = await materialApi.get(material.uuid);
          onMaterialUpdated?.(refreshed);
          setSaveAsRouteOpen(false);
          messageApi.success(t('app.master-data.productProcess.savedAsNewRoute'));
        } else {
          messageApi.success(t('app.master-data.productProcess.saved'));
        }
      } catch (e: unknown) {
        messageApi.error((e as Error).message || t('common.saveFailed'));
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [
      allowOperationJump,
      applyConfig,
      lines,
      material.uuid,
      messageApi,
      onMaterialUpdated,
      onProductProcessRouteSaved,
      onProcessRoutesRefresh,
      routeUuid,
      t,
    ],
  );

  const handleSave = async () => {
    if (!canSave) return;
    await persistConfig();
  };

  const handleSaveAsNewRoute = async (values: { newRouteCode: string; newRouteName: string }) => {
    if (!canSaveAsNewRoute) return;
    await persistConfig({
      saveAsNewRoute: true,
      newRouteCode: values.newRouteCode,
      newRouteName: values.newRouteName,
    });
  };

  const saveMenuItems: MenuProps['items'] = [
    {
      key: 'save-as-new-route',
      label: t('app.master-data.productProcess.saveAsNewRoute'),
      disabled: !canSaveAsNewRoute,
      onClick: () => setSaveAsRouteOpen(true),
    },
  ];

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
          title={t('app.master-data.productProcess.panelHint')}
        />
      )}

      <Space orientation="vertical" style={{ width: '100%', marginBottom: 16 }} size="medium">
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <Space orientation="vertical" size="medium" style={{ flex: 1, minWidth: 280 }}>
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
              <Button
                icon={<ReloadOutlined />}
                loading={reloadingRoute}
                disabled={!routeUuid || loading || reloadingRoute}
                onClick={() => void handleReloadRoute()}
              >
                {t('app.master-data.productProcess.reloadRoute')}
              </Button>
            </Space>
          </Space>
          <Space>
            {auditHint ? (
              <Typography.Text type="secondary">
                {auditHint.operator} - {auditHint.time}
              </Typography.Text>
            ) : null}
            <Space.Compact>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saving}
                disabled={!canSave}
                onClick={() => void handleSave()}
              >
                {t('common.save')}
              </Button>
              <Dropdown menu={{ items: saveMenuItems }} disabled={!canSave}>
                <Button type="primary" icon={<DownOutlined />} loading={saving} disabled={!canSave} />
              </Dropdown>
            </Space.Compact>
          </Space>
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

      <ProductProcessSaveAsRouteModal
        open={saveAsRouteOpen}
        material={material}
        loading={saving}
        onClose={() => setSaveAsRouteOpen(false)}
        onSubmit={handleSaveAsNewRoute}
      />
    </>
  );
};
