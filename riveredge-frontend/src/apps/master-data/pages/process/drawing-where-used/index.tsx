/**
 * 图档反查：物料/工艺/工序/工单 → 图纸；图纸 → 引用方
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Select, Segmented, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { rowActionKind } from '../../../../../components/uni-action';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { downloadRecordsAsXlsx } from '../../../../../utils/exportRecordsXlsx';
import { alignProColumns } from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { MASTER_DATA_LIST_FIELD_RANK } from '../../../utils/masterListCore';
import { materialApi } from '../../../services/material';
import { operationApi, processRouteApi, unwrapProcessPagedList } from '../../../services/process';
import { drawingApi, type EngineeringDrawing } from '../../../services/drawing';
import {
  drawingWhereUsedApi,
  type DrawingWhereUsedKind,
  type DrawingWhereUsedUsage,
} from '../../../services/drawingWhereUsed';
import { workOrderApi } from '../../../../kuaizhizao/services/work-order';

const RESOURCE = 'master-data:process:drawing-where-used';

type QueryKind = 'material' | 'process_route' | 'operation' | 'work_order' | 'drawing';
type Direction = 'forward' | 'reverse';

type OptionItem = { label: string; value: string };

type QueryState = {
  direction: Direction;
  kind: QueryKind;
  entityUuid?: string;
};

function unwrapList(res: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(res)) return res as Array<Record<string, unknown>>;
  if (res && typeof res === 'object') {
    const obj = res as { items?: unknown; data?: unknown };
    if (Array.isArray(obj.items)) return obj.items as Array<Record<string, unknown>>;
    if (Array.isArray(obj.data)) return obj.data as Array<Record<string, unknown>>;
  }
  return [];
}

const DrawingWhereUsedPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const actionRef = useRef<ActionType>(null);
  const tableRowsRef = useRef<Array<EngineeringDrawing | DrawingWhereUsedUsage>>([]);
  const { canExport } = useResourcePermissions(RESOURCE);

  const [direction, setDirection] = useState<Direction>('forward');
  const [kind, setKind] = useState<QueryKind>('material');
  const [entityUuid, setEntityUuid] = useState<string>();
  const [options, setOptions] = useState<OptionItem[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const queryRef = useRef<QueryState>({ direction: 'forward', kind: 'material' });

  const loadOptions = useCallback(async (nextKind: QueryKind) => {
    setOptionsLoading(true);
    try {
      if (nextKind === 'material') {
        const res = await materialApi.list({ limit: 200 });
        setOptions(
          (res?.items ?? []).map((m: { uuid: string; mainCode?: string; code?: string; name: string }) => ({
            label: `${m.mainCode || m.code || ''} ${m.name}`.trim(),
            value: m.uuid,
          })),
        );
        return;
      }
      if (nextKind === 'process_route') {
        const res = await processRouteApi.list({ limit: 200 });
        setOptions(unwrapProcessPagedList(res).map((r) => ({ label: `${r.code} ${r.name}`, value: r.uuid })));
        return;
      }
      if (nextKind === 'operation') {
        const res = await operationApi.list({ limit: 200 });
        setOptions(unwrapProcessPagedList(res).map((o) => ({ label: `${o.code} ${o.name}`, value: o.uuid })));
        return;
      }
      if (nextKind === 'work_order') {
        const res = await workOrderApi.list({ skip: 0, limit: 200 });
        setOptions(
          unwrapList(res).map((row) => ({
            label: `${String(row.code ?? '')} ${String(row.name ?? row.product_name ?? row.productName ?? '')}`.trim(),
            value: String(row.uuid ?? ''),
          })).filter((item) => item.value),
        );
        return;
      }
      const res = await drawingApi.list({ skip: 0, limit: 200, view: 'current' });
      setOptions((res.data ?? []).map((d) => ({ label: `${d.code} ${d.name}`.trim(), value: d.uuid })));
    } catch (error) {
      setOptions([]);
      messageApi.error(getApiErrorMessage(error, t('app.master-data.drawingWhereUsed.optionsFailed')));
    } finally {
      setOptionsLoading(false);
    }
  }, [messageApi, t]);

  useEffect(() => {
    void loadOptions(kind);
  }, [kind, loadOptions]);

  useEffect(() => {
    const drawingUuid = searchParams.get('drawingUuid');
    if (!drawingUuid) return;
    setDirection('reverse');
    setKind('drawing');
    setEntityUuid(drawingUuid);
    queryRef.current = { direction: 'reverse', kind: 'drawing', entityUuid: drawingUuid };
    actionRef.current?.reload();
  }, [searchParams]);

  const runQuery = useCallback(() => {
    queryRef.current = { direction, kind, entityUuid };
    actionRef.current?.reload();
  }, [direction, kind, entityUuid]);

  const kindLabel = useCallback(
    (value: DrawingWhereUsedKind) => t(`app.master-data.drawingWhereUsed.kind.${value}`),
    [t],
  );

  const drawingColumns: ProColumns<EngineeringDrawing>[] = useMemo(
    () =>
      alignProColumns(
        [
          { title: t('app.master-data.drawings.code'), dataIndex: 'code', width: 140 },
          { title: t('app.master-data.drawings.name'), dataIndex: 'name', ellipsis: true, width: 200 },
          { title: t('app.master-data.drawings.revision'), dataIndex: 'revision', width: 72 },
          {
            title: t('app.master-data.drawings.status'),
            dataIndex: 'status',
            width: 88,
            render: (_, record) => (
              <MarkerTag color="processing">{t(`app.master-data.drawings.status.${record.status}`)}</MarkerTag>
            ),
          },
          {
            title: t('common.actions'),
            valueType: 'option',
            fixed: 'right' as const,
            render: (_, record) => (
              <Button
                {...rowActionKind('read')}
                onClick={() => navigate(`/apps/master-data/process/drawings?uuid=${record.uuid}`)}
              >
                {t('common.detail')}
              </Button>
            ),
          },
        ],
        MASTER_DATA_LIST_FIELD_RANK,
      ),
    [t, navigate],
  );

  const usageColumns: ProColumns<DrawingWhereUsedUsage>[] = useMemo(
    () => [
      {
        title: t('app.master-data.drawingWhereUsed.usageKind'),
        dataIndex: 'kind',
        width: 120,
        render: (_, record) => <MarkerTag color="default">{kindLabel(record.kind)}</MarkerTag>,
      },
      { title: t('app.master-data.drawingWhereUsed.usageCode'), dataIndex: 'code', width: 160 },
      { title: t('app.master-data.drawingWhereUsed.usageName'), dataIndex: 'name', ellipsis: true },
      { title: t('app.master-data.drawingWhereUsed.usageExtra'), dataIndex: 'extra', width: 140 },
    ],
    [t, kindLabel],
  );

  const handleExport = useCallback(async () => {
    const rows = tableRowsRef.current as Array<Record<string, unknown>>;
    if (!rows.length) {
      messageApi.warning(t('app.master-data.drawingWhereUsed.empty'));
      return;
    }
    await downloadRecordsAsXlsx(
      rows,
      t('app.master-data.menu.process.drawing-where-used'),
      {
        columns:
          queryRef.current.direction === 'reverse'
            ? [
                { key: 'kind', title: t('app.master-data.drawingWhereUsed.usageKind') },
                { key: 'code', title: t('app.master-data.drawingWhereUsed.usageCode') },
                { key: 'name', title: t('app.master-data.drawingWhereUsed.usageName') },
                { key: 'extra', title: t('app.master-data.drawingWhereUsed.usageExtra') },
              ]
            : [
                { key: 'code', title: t('app.master-data.drawings.code') },
                { key: 'name', title: t('app.master-data.drawings.name') },
                { key: 'revision', title: t('app.master-data.drawings.revision') },
                { key: 'status', title: t('app.master-data.drawings.status') },
              ],
      },
    );
  }, [messageApi, t]);

  return (
    <ListPageTemplate>
      <UniTable<EngineeringDrawing | DrawingWhereUsedUsage>
        actionRef={actionRef}
        rowKey="uuid"
        permissionResource={RESOURCE}
        headerTitle={t('app.master-data.menu.process.drawing-where-used')}
        columnPersistenceId="apps.master-data.pages.process.drawing-where-used.v1"
        columns={(queryRef.current.direction === 'reverse' ? usageColumns : drawingColumns) as ProColumns<EngineeringDrawing | DrawingWhereUsedUsage>[]}
        showCreateButton={false}
        showExportButton={canExport}
        onExport={handleExport}
        search={false}
        beforeSearchButtons={
          <Segmented
            value={direction}
            options={[
              { label: t('app.master-data.drawingWhereUsed.forward'), value: 'forward' },
              { label: t('app.master-data.drawingWhereUsed.reverse'), value: 'reverse' },
            ]}
            onChange={(value) => {
              const next = value as Direction;
              setDirection(next);
              const nextKind: QueryKind = next === 'reverse' ? 'drawing' : 'material';
              setKind(nextKind);
              setEntityUuid(undefined);
            }}
          />
        }
        toolBarRender={() => [
          <Space key="where-used-query" wrap>
            {direction === 'forward' ? (
              <Select
                style={{ width: 140 }}
                value={kind}
                options={[
                  { label: t('app.master-data.drawingWhereUsed.kind.material'), value: 'material' },
                  { label: t('app.master-data.drawingWhereUsed.kind.process_route'), value: 'process_route' },
                  { label: t('app.master-data.drawingWhereUsed.kind.operation'), value: 'operation' },
                  { label: t('app.master-data.drawingWhereUsed.kind.work_order'), value: 'work_order' },
                ]}
                onChange={(value) => {
                  setKind(value);
                  setEntityUuid(undefined);
                }}
              />
            ) : null}
            <Select
              showSearch
              allowClear
              style={{ minWidth: 280 }}
              loading={optionsLoading}
              value={entityUuid}
              options={options}
              optionFilterProp="label"
              placeholder={t('app.master-data.drawingWhereUsed.selectEntity')}
              onChange={(value) => setEntityUuid(value)}
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={runQuery}>
              {t('common.search')}
            </Button>
          </Space>,
        ]}
        request={async () => {
          const q = queryRef.current;
          if (!q.entityUuid) {
            return { data: [], success: true, total: 0 };
          }
          try {
            const params =
              q.direction === 'reverse'
                ? { drawingUuid: q.entityUuid }
                : q.kind === 'material'
                  ? { materialUuid: q.entityUuid }
                  : q.kind === 'process_route'
                    ? { processRouteUuid: q.entityUuid }
                    : q.kind === 'operation'
                      ? { operationUuid: q.entityUuid }
                      : { workOrderUuid: q.entityUuid };
            const res = await drawingWhereUsedApi.query(params);
            const rows = q.direction === 'reverse' ? res.usages : res.drawings;
            return { data: rows, success: true, total: rows.length };
          } catch (error) {
            messageApi.error(getApiErrorMessage(error, t('app.master-data.drawingWhereUsed.queryFailed')));
            return { data: [], success: false, total: 0 };
          }
        }}
        onTableDataChange={(rows) => {
          tableRowsRef.current = rows;
        }}
      />
    </ListPageTemplate>
  );
};

export default DrawingWhereUsedPage;
