/**
 * STP 装配体 → BOM 导入向导
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  App,
  Button,
  Input,
  Modal,
  Result,
  Select,
  Space,
  Spin,
  Steps,
  Table,
  Tree,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { getFilePreview } from '../../../services/file';
import type { EngineeringDrawing } from '../services/drawing';
import { drawingApi } from '../services/drawing';
import { materialApi, materialGroupApi } from '../services/material';
import type { Material } from '../types/material';
import { isStepFile } from '../../../utils/filePreviewKind';
import { parseStepAssemblyFromUrl } from '../../../utils/stepFileLoader';
import {
  sanitizeStepMaterialCode,
  stepAssemblyToTreeData,
  type StepAssemblyParseResult,
  type StepBomEdge,
} from '../../../utils/stepAssemblyParser';

export interface StepBomImportWizardProps {
  open: boolean;
  onClose: () => void;
  drawingUuid: string;
  drawing?: Pick<EngineeringDrawing, 'code' | 'revision' | 'materialUuids' | 'file' | 'fileUuid'>;
  onSuccess?: (result: Awaited<ReturnType<typeof drawingApi.importStepBom>>) => void;
}

type NodeMappingRow = {
  key: string;
  name: string;
  depth: number;
  hasChildren: boolean;
  quantity: number;
  matchStatus: 'matched' | 'auto_create' | 'manual';
  materialId?: number;
  materialCode: string;
  materialName?: string;
};

function flattenGroupTree(nodes: any[]): Array<{ id: number; title: string }> {
  const out: Array<{ id: number; title: string }> = [];
  const walk = (list: any[], prefix = '') => {
    list.forEach((n) => {
      const title = prefix ? `${prefix} / ${n.name ?? n.title}` : (n.name ?? n.title ?? '');
      const id = n.id ?? n.value;
      if (id != null && (!n.children || n.children.length === 0)) {
        out.push({ id: Number(id), title });
      }
      if (n.children?.length) walk(n.children, title);
    });
  };
  walk(nodes);
  return out;
}

export const StepBomImportWizard: React.FC<StepBomImportWizardProps> = ({
  open,
  onClose,
  drawingUuid,
  drawing,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();

  const [step, setStep] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [assembly, setAssembly] = useState<StepAssemblyParseResult | null>(null);
  const [bomEdges, setBomEdges] = useState<StepBomEdge[]>([]);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [groups, setGroups] = useState<Array<{ id: number; title: string }>>([]);
  const [rootMaterialId, setRootMaterialId] = useState<number | undefined>();
  const [defaultGroupId, setDefaultGroupId] = useState<number | undefined>();
  const [version, setVersion] = useState('1.0');
  const [codePrefix, setCodePrefix] = useState('STP-');

  const [rows, setRows] = useState<NodeMappingRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [importResult, setImportResult] = useState<Awaited<ReturnType<typeof drawingApi.importStepBom>> | null>(null);

  const reset = useCallback(() => {
    setStep(0);
    setParsing(false);
    setParseError('');
    setAssembly(null);
    setBomEdges([]);
    setRows([]);
    setImportResult(null);
    setSubmitting(false);
  }, []);

  const buildMappingRows = useCallback(
    (parsed: StepAssemblyParseResult, edges: StepBomEdge[], materialList: Material[]) => {
      const qtyByChild = new Map<string, number>();
      edges.forEach((e) => {
        qtyByChild.set(e.childKey, (qtyByChild.get(e.childKey) ?? 0) + e.quantity);
      });

      const nodeByKey = new Map(parsed.flatNodes.map((n) => [n.key, n]));
      const neededKeys = new Set<string>();
      edges.forEach((e) => {
        neededKeys.add(e.childKey);
        if (e.parentKey !== 'root') neededKeys.add(e.parentKey);
      });

      const codeIndex = new Map<string, Material>();
      const nameIndex = new Map<string, Material>();
      materialList.forEach((m) => {
        const code = (m as any).mainCode ?? (m as any).main_code ?? m.code;
        if (code) codeIndex.set(String(code).toUpperCase(), m);
        if (m.name) nameIndex.set(m.name.trim(), m);
      });

      const mappingRows: NodeMappingRow[] = Array.from(neededKeys).map((key) => {
        const node = nodeByKey.get(key);
        const name = node?.name ?? key;
        const suggestedCode = sanitizeStepMaterialCode(name, codePrefix);
        let matched: Material | undefined = codeIndex.get(suggestedCode.toUpperCase()) ?? nameIndex.get(name.trim());
        return {
          key,
          name,
          depth: node?.depth ?? 0,
          hasChildren: node?.hasChildren ?? false,
          quantity: qtyByChild.get(key) ?? 1,
          matchStatus: matched ? 'matched' : 'auto_create',
          materialId: matched?.id,
          materialCode: matched ? ((matched as any).mainCode ?? matched.code ?? suggestedCode) : suggestedCode,
          materialName: matched?.name,
        };
      });
      mappingRows.sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name));
      setRows(mappingRows);
    },
    [codePrefix],
  );

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    let cancelled = false;

    const run = async () => {
      setParsing(true);
      setParseError('');
      try {
        const [matRes, groupTree] = await Promise.all([
          materialApi.list({ limit: 500 }),
          materialGroupApi.tree(),
        ]);
        if (cancelled) return;
        const matList = matRes?.items ?? [];
        setMaterials(matList);
        setGroups(flattenGroupTree(groupTree ?? []));
        if (groupTree?.length && !defaultGroupId) {
          const flat = flattenGroupTree(groupTree);
          if (flat[0]) setDefaultGroupId(flat[0].id);
        }

        const firstMatUuid = drawing?.materialUuids?.[0];
        if (firstMatUuid) {
          const m = matList.find((x) => x.uuid === firstMatUuid);
          if (m) setRootMaterialId(m.id);
        }

        const fileUuid = drawing?.file?.uuid ?? drawing?.fileUuid;
        if (!fileUuid) throw new Error(t('app.master-data.drawings.stepBomWizard.noFile'));

        const preview = await getFilePreview(fileUuid);
        if (!preview?.preview_url) throw new Error(t('app.master-data.drawings.previewFailed'));

        const source = {
          fileName: drawing?.file?.originalName,
          fileExtension: drawing?.file?.fileExtension,
        };
        if (!isStepFile(source)) throw new Error(t('app.master-data.drawings.stepBomWizard.notStepFile'));

        const parsed = await parseStepAssemblyFromUrl(preview.preview_url);
        if (cancelled) return;
        if (!parsed.bomEdges.length) {
          throw new Error(t('app.master-data.drawings.stepBomWizard.noAssemblyStructure'));
        }
        setAssembly(parsed);
        setBomEdges(parsed.bomEdges);
        buildMappingRows(parsed, parsed.bomEdges, matList);
        setStep(1);
      } catch (e: unknown) {
        if (!cancelled) {
          setParseError(e instanceof Error ? e.message : t('app.master-data.drawings.stepBomWizard.parseFailed'));
        }
      } finally {
        if (!cancelled) setParsing(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [open, drawing, buildMappingRows, reset, t]);

  const treeData = useMemo(
    () => (assembly?.assemblyTree ? [stepAssemblyToTreeData(assembly.assemblyTree)] : []),
    [assembly],
  );

  const materialOptions = useMemo(
    () =>
      materials.map((m) => ({
        value: m.id,
        label: `${(m as any).mainCode ?? m.code ?? ''} - ${m.name}`,
      })),
    [materials],
  );

  const mappingColumns: ColumnsType<NodeMappingRow> = [
    { title: t('app.master-data.drawings.stepBomWizard.colName'), dataIndex: 'name', ellipsis: true },
    { title: t('app.master-data.drawings.stepBomWizard.colDepth'), dataIndex: 'depth', width: 64 },
    { title: t('app.master-data.drawings.stepBomWizard.colQty'), dataIndex: 'quantity', width: 72 },
    {
      title: t('app.master-data.drawings.stepBomWizard.colStatus'),
      dataIndex: 'matchStatus',
      width: 100,
      render: (v: NodeMappingRow['matchStatus']) => {
        const map = {
          matched: t('app.master-data.drawings.stepBomWizard.statusMatched'),
          auto_create: t('app.master-data.drawings.stepBomWizard.statusAutoCreate'),
          manual: t('app.master-data.drawings.stepBomWizard.statusManual'),
        };
        return map[v];
      },
    },
    {
      title: t('app.master-data.drawings.stepBomWizard.colMaterialCode'),
      dataIndex: 'materialCode',
      width: 160,
      render: (v, record) => (
        <Input
          size="small"
          value={v}
          onChange={(e) => {
            const code = e.target.value;
            setRows((prev) =>
              prev.map((r) =>
                r.key === record.key ? { ...r, materialCode: code, matchStatus: 'manual' as const } : r,
              ),
            );
          }}
        />
      ),
    },
    {
      title: t('app.master-data.drawings.stepBomWizard.colMaterial'),
      dataIndex: 'materialId',
      width: 220,
      render: (v, record) => (
        <Select
          size="small"
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ width: '100%' }}
          placeholder={t('app.master-data.drawings.stepBomWizard.selectMaterial')}
          value={v}
          options={materialOptions}
          onChange={(mid) => {
            const mat = materials.find((m) => m.id === mid);
            setRows((prev) =>
              prev.map((r) =>
                r.key === record.key
                  ? {
                      ...r,
                      materialId: mid,
                      materialName: mat?.name,
                      materialCode: mat ? ((mat as any).mainCode ?? mat.code ?? r.materialCode) : r.materialCode,
                      matchStatus: 'manual' as const,
                    }
                  : r,
              ),
            );
          }}
        />
      ),
    },
  ];

  const handleImport = async () => {
    if (!rootMaterialId) {
      messageApi.warning(t('app.master-data.drawings.stepBomWizard.rootMaterialRequired'));
      return;
    }
    if (!defaultGroupId) {
      messageApi.warning(t('app.master-data.drawings.stepBomWizard.groupRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const result = await drawingApi.importStepBom(drawingUuid, {
        rootMaterialId,
        version,
        defaultGroupId,
        defaultUnit: '个',
        createMissingMaterials: true,
        materialCodePrefix: codePrefix,
        edges: bomEdges.map((e) => ({
          parentKey: e.parentKey,
          childKey: e.childKey,
          childName: e.childName,
          quantity: e.quantity,
        })),
        nodes: rows.map((r) => ({
          key: r.key,
          name: r.name,
          hasChildren: r.hasChildren,
          materialId: r.materialId,
          materialCode: r.materialCode,
        })),
      });
      setImportResult(result);
      setStep(3);
      onSuccess?.(result);
      messageApi.success(t('app.master-data.drawings.stepBomWizard.importSuccess'));
    } catch (e: unknown) {
      messageApi.error(e instanceof Error ? e.message : t('app.master-data.drawings.stepBomWizard.importFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const footer = (
    <Space>
      <Button onClick={onClose}>{t('common.cancel')}</Button>
      {step === 1 && (
        <Button type="primary" disabled={parsing || !!parseError} onClick={() => setStep(2)}>
          {t('common.next')}
        </Button>
      )}
      {step === 2 && (
        <>
          <Button onClick={() => setStep(1)}>{t('common.previous')}</Button>
          <Button type="primary" loading={submitting} onClick={() => void handleImport()}>
            {t('app.master-data.drawings.stepBomWizard.confirmImport')}
          </Button>
        </>
      )}
      {step === 3 && importResult && (
        <Button
          type="primary"
          onClick={() => {
            navigate(importResult.bomDesignerPath);
            onClose();
          }}
        >
          {t('app.master-data.drawings.stepBomWizard.openDesigner')}
        </Button>
      )}
    </Space>
  );

  return (
    <Modal
      title={t('app.master-data.drawings.importStepBom')}
      open={open}
      onCancel={onClose}
      width={920}
      footer={footer}
      destroyOnHidden
    >
      <Steps
        current={step}
        size="small"
        style={{ marginBottom: 16 }}
        items={[
          { title: t('app.master-data.drawings.stepBomWizard.stepParse') },
          { title: t('app.master-data.drawings.stepBomWizard.stepConfig') },
          { title: t('app.master-data.drawings.stepBomWizard.stepMapping') },
          { title: t('app.master-data.drawings.stepBomWizard.stepResult') },
        ]}
      />

      {step === 0 && (
        <div style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {parsing ? (
            <Spin tip={t('app.master-data.drawings.stepBomWizard.parsing')} size="large">
              <div style={{ minHeight: 24 }} />
            </Spin>
          ) : parseError ? (
            <Alert type="error" showIcon title={parseError} />
          ) : null}
        </div>
      )}

      {step === 1 && assembly && (
        <Space orientation="vertical" style={{ width: '100%' }} size={12}>
          <Alert
            type="info"
            showIcon
            message={t('app.master-data.drawings.stepBomWizard.parseSummary', {
              name: assembly.rootName,
              count: bomEdges.length,
            })}
          />
          <div style={{ display: 'flex', gap: 16, minHeight: 220 }}>
            <div style={{ flex: 1, border: '1px solid var(--ant-color-border)', borderRadius: 8, padding: 8, overflow: 'auto' }}>
              <Typography.Text type="secondary">{t('app.master-data.drawings.stepBomWizard.assemblyTree')}</Typography.Text>
              <Tree treeData={treeData} defaultExpandAll blockNode />
            </div>
            <div style={{ flex: 1 }}>
              <Space orientation="vertical" style={{ width: '100%' }}>
                <div>
                  <Typography.Text>{t('app.master-data.drawings.stepBomWizard.rootMaterial')}</Typography.Text>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    style={{ width: '100%', marginTop: 4 }}
                    value={rootMaterialId}
                    options={materialOptions}
                    onChange={setRootMaterialId}
                    placeholder={t('app.master-data.drawings.stepBomWizard.selectRootMaterial')}
                  />
                </div>
                <div>
                  <Typography.Text>{t('app.master-data.drawings.stepBomWizard.defaultGroup')}</Typography.Text>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    style={{ width: '100%', marginTop: 4 }}
                    value={defaultGroupId}
                    options={groups.map((g) => ({ value: g.id, label: g.title }))}
                    onChange={setDefaultGroupId}
                    placeholder={t('app.master-data.drawings.stepBomWizard.selectGroup')}
                  />
                </div>
                <div>
                  <Typography.Text>{t('app.master-data.drawings.stepBomWizard.bomVersion')}</Typography.Text>
                  <Input style={{ marginTop: 4 }} value={version} onChange={(e) => setVersion(e.target.value)} />
                </div>
                <div>
                  <Typography.Text>{t('app.master-data.drawings.stepBomWizard.codePrefix')}</Typography.Text>
                  <Input style={{ marginTop: 4 }} value={codePrefix} onChange={(e) => setCodePrefix(e.target.value)} />
                </div>
              </Space>
            </div>
          </div>
        </Space>
      )}

      {step === 2 && (
        <Table<NodeMappingRow>
          rowKey="key"
          size="small"
          pagination={{ pageSize: 8 }}
          dataSource={rows}
          columns={mappingColumns}
          scroll={{ x: 720 }}
        />
      )}

      {step === 3 && importResult && (
        <Result
          status="success"
          title={t('app.master-data.drawings.stepBomWizard.resultTitle')}
          subTitle={t('app.master-data.drawings.stepBomWizard.resultSummary', {
            bom: importResult.bomItemsCreated,
            created: importResult.materialsCreated.length,
            matched: importResult.materialsMatched,
          })}
        />
      )}
    </Modal>
  );
};
