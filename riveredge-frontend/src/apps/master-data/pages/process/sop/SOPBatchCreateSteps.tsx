/**
 * 批量创建 SOP 步骤组件
 *
 * 按工艺路线从物料/物料组出发，加载或创建工艺路线，按工序批量创建 SOP 草稿。
 * 供新建 Modal 的批量模式使用。
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Button, Card, Select, Space, Table, Steps, Modal, Input, Form, Typography, Segmented, Alert } from 'antd';
import { HighlightOutlined, FormOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { processRouteApi, operationApi, sopApi, unwrapProcessPagedList } from '../../../services/process';
import { materialApi, materialGroupApi } from '../../../services/material';
import { rowActionKind } from '../../../../../components/uni-action';
import type { ProcessRoute, Operation } from '../../../types/process';
import type { Material, MaterialGroup, MaterialListResponse } from '../../../types/material';
import type { SOP } from '../../../types/process';

const { Text } = Typography;

/** 工序项（用于序列编辑） */
interface OperationItem {
  uuid: string;
  code: string;
  name: string;
  description?: string;
}

export interface SOPBatchCreateStepsProps {
  /** 批量创建完成，点击关闭时调用 */
  onSuccess?: (createdSops: SOP[]) => void;
  /** 取消/关闭时调用 */
  onCancel?: () => void;
  /** 点击某条 SOP 的「编辑」时调用，用于关闭新建 Modal 并打开编辑 Modal */
  onEditSop?: (uuid: string, tab?: 'formConfig') => void;
}

const SOPBatchCreateSteps: React.FC<SOPBatchCreateStepsProps> = ({ onSuccess, onCancel, onEditSop }) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [type, setType] = useState<'material' | 'material_group'>('material_group');
  const [selectedMaterialUuids, setSelectedMaterialUuids] = useState<string[]>([]);
  const [selectedMaterialGroupUuids, setSelectedMaterialGroupUuids] = useState<string[]>([]);
  const [route, setRoute] = useState<ProcessRoute | null>(null);
  const [operations, setOperations] = useState<OperationItem[]>([]);
  const [createdSops, setCreatedSops] = useState<SOP[]>([]);
  const [loading, setLoading] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialGroups, setMaterialGroups] = useState<MaterialGroup[]>([]);
  const [allOperations, setAllOperations] = useState<Operation[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [operationsLoading, setOperationsLoading] = useState(false);

  const [createRouteModalVisible, setCreateRouteModalVisible] = useState(false);
  const [newRouteCode, setNewRouteCode] = useState('');
  const [newRouteName, setNewRouteName] = useState('');
  const [newRouteSaving, setNewRouteSaving] = useState(false);

  const [addOpModalVisible, setAddOpModalVisible] = useState(false);
  const [selectedOpUuids, setSelectedOpUuids] = useState<string[]>([]);

  /** 第二步：未绑定时从主数据中选择已有工艺路线 */
  const [routePickerOptions, setRoutePickerOptions] = useState<ProcessRoute[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [pickedRouteUuid, setPickedRouteUuid] = useState<string | undefined>(undefined);

  useEffect(() => {
    const load = async () => {
      try {
        setMaterialsLoading(true);
        setOperationsLoading(true);
        const [matRes, mgRes, opRes] = await Promise.all([
          materialApi.list({ limit: 1000, isActive: true }).catch(() => []),
          materialGroupApi.list({ limit: 1000 }).catch(() => []),
          operationApi.list({ isActive: true, limit: 1000 }),
        ]);
        setMaterials(
          Array.isArray(matRes) ? matRes : ((matRes as MaterialListResponse | undefined)?.items ?? [])
        );
        setMaterialGroups(Array.isArray(mgRes) ? mgRes : []);
        setAllOperations(unwrapProcessPagedList(opRes));
      } catch (e) {
        console.error('加载基础数据失败:', e);
      } finally {
        setMaterialsLoading(false);
        setOperationsLoading(false);
      }
    };
    load();
  }, []);

  const parseOperationSequence = (seq: any): OperationItem[] => {
    if (!seq) return [];
    let arr: any[] = [];
    if (Array.isArray(seq)) {
      arr = seq;
    } else if (seq?.operations && Array.isArray(seq.operations)) {
      arr = seq.operations;
    } else if (seq?.sequence && Array.isArray(seq.sequence)) {
      const ops = seq.operations as Record<string, any>[] | undefined;
      const byUuid = (ops || []).reduce((m: Record<string, any>, o) => {
        if (o?.uuid) m[o.uuid] = o;
        return m;
      }, {});
      for (const uuid of seq.sequence) {
        const o = byUuid[uuid] || (allOperations.find(op => op.uuid === uuid));
        if (o) arr.push({ uuid: o.uuid || uuid, code: o.code || '', name: o.name || '' });
      }
      return arr;
    }
    return arr
      .filter((o) => o && (o.uuid || o.code))
      .map((o) => ({
        uuid: o.uuid || o.code,
        code: o.code || '',
        name: o.name || '',
        description: o.description,
      }));
  };

  useEffect(() => {
    if (route && allOperations.length > 0) {
      const ops = parseOperationSequence(route.operation_sequence);
      setOperations(ops);
    }
  }, [route?.uuid, allOperations.length]);

  /** 第二步且无已选路线时，拉取工艺路线列表供选择 */
  useEffect(() => {
    if (currentStep !== 1 || route != null) return;
    let cancelled = false;
    (async () => {
      setRoutesLoading(true);
      try {
        const res = await processRouteApi.list({ limit: 500, isActive: true });
        const list = unwrapProcessPagedList(res);
        if (!cancelled) setRoutePickerOptions(list);
      } catch (e) {
        console.error(e);
        if (!cancelled) setRoutePickerOptions([]);
      } finally {
        if (!cancelled) setRoutesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentStep, route]);

  const handleLoadRoute = async () => {
    if (type === 'material' && selectedMaterialUuids.length === 0) {
      messageApi.warning(t('app.master-data.sop.selectMaterial'));
      return;
    }
    if (type === 'material_group' && selectedMaterialGroupUuids.length === 0) {
      messageApi.warning(t('app.master-data.sop.selectMaterialGroup'));
      return;
    }

    setRouteLoading(true);
    setRoute(null);
    setOperations([]);
    try {
      let r: ProcessRoute | null = null;
      if (type === 'material_group' && selectedMaterialGroupUuids.length > 0) {
        r = await processRouteApi.getProcessRouteForMaterialGroup(selectedMaterialGroupUuids[0]);
      } else if (type === 'material' && selectedMaterialUuids.length > 0) {
        r = await processRouteApi.getProcessRouteForMaterial(selectedMaterialUuids[0]);
      }
      if (r) {
        setRoute(r);
        const ops = parseOperationSequence(r.operation_sequence);
        setOperations(ops);
      } else {
        setRoute(null);
        setOperations([]);
        setPickedRouteUuid(undefined);
      }
      setCurrentStep(1);
    } catch (e: any) {
      messageApi.error(e?.message || t('app.master-data.sop.loadRouteFailed'));
    } finally {
      setRouteLoading(false);
    }
  };

  /** 使用下拉中选中的已有工艺路线（不写回绑定，仅本向导内使用） */
  const handleConfirmPickRoute = async () => {
    if (!pickedRouteUuid) {
      messageApi.warning(t('app.master-data.sop.pickRouteFirst'));
      return;
    }
    setRouteLoading(true);
    try {
      const full = await processRouteApi.get(pickedRouteUuid);
      setRoute(full);
      const ops = parseOperationSequence(full.operation_sequence);
      setOperations(ops);
      messageApi.success(t('app.master-data.sop.routeLoaded'));
    } catch (e: any) {
      messageApi.error(e?.message || t('app.master-data.sop.loadRouteFailed'));
    } finally {
      setRouteLoading(false);
    }
  };

  const handleBackToStep0 = () => {
    setCurrentStep(0);
    setRoute(null);
    setOperations([]);
    setPickedRouteUuid(undefined);
    setCreateRouteModalVisible(false);
  };

  const handleOpenCreateRouteModal = () => {
    setOperations([]);
    setNewRouteCode('');
    setNewRouteName('');
    setCreateRouteModalVisible(true);
  };

  const closeCreateRouteModal = () => {
    setCreateRouteModalVisible(false);
    setNewRouteCode('');
    setNewRouteName('');
    if (!route) setOperations([]);
  };

  const handleSaveNewRoute = async () => {
    const code = newRouteCode?.trim();
    const name = newRouteName?.trim();
    if (!code || !name) {
      messageApi.warning(t('app.master-data.sop.enterRouteCodeName'));
      return;
    }
    if (operations.length === 0) {
      messageApi.warning(t('app.master-data.sop.addAtLeastOneOp'));
      return;
    }

    setNewRouteSaving(true);
    try {
      const seqData = {
        sequence: operations.map((o) => o.uuid),
        operations: operations.map((o) => ({ uuid: o.uuid, code: o.code, name: o.name })),
      };
      const newRoute = await processRouteApi.create({
        code,
        name,
        operation_sequence: seqData,
        is_active: true,
      } as any);

      if (type === 'material_group' && selectedMaterialGroupUuids.length > 0) {
        await processRouteApi.bindMaterialGroup(newRoute.uuid, selectedMaterialGroupUuids[0]);
      } else if (type === 'material' && selectedMaterialUuids.length > 0) {
        await processRouteApi.bindMaterial(newRoute.uuid, selectedMaterialUuids[0]);
      }
      setRoute(newRoute);
      setCreateRouteModalVisible(false);
      setNewRouteCode('');
      setNewRouteName('');
      setCurrentStep(1);
      messageApi.success(t('app.master-data.sop.routeCreatedBound'));
    } catch (e: any) {
      messageApi.error(e?.message || t('app.master-data.sop.createRouteFailed'));
    } finally {
      setNewRouteSaving(false);
    }
  };

  const handleUpdateRoute = async () => {
    if (!route) return;
    if (operations.length === 0) {
      messageApi.warning(t('app.master-data.sop.keepAtLeastOneOp'));
      return;
    }
    setLoading(true);
    try {
      await processRouteApi.update(route.uuid, {
        operation_sequence: {
          sequence: operations.map((o) => o.uuid),
          operations: operations.map((o) => ({ uuid: o.uuid, code: o.code, name: o.name })),
        },
      } as any);
      setRoute({ ...route, operation_sequence: { sequence: operations.map((o) => o.uuid), operations } } as any);
      messageApi.success(t('app.master-data.sop.routeSaved'));
    } catch (e: any) {
      messageApi.error(e?.message || t('app.master-data.sop.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddOperations = () => {
    const toAdd = selectedOpUuids
      .map((uuid) => allOperations.find((o) => o.uuid === uuid))
      .filter((o): o is Operation => !!o && !operations.some((x) => x.uuid === o.uuid));
    if (toAdd.length === 0) {
      messageApi.warning(t('app.master-data.sop.selectUnaddedOp'));
      return;
    }
    setOperations([
      ...operations,
      ...toAdd.map((o) => ({ uuid: o.uuid, code: o.code, name: o.name, description: o.description })),
    ]);
    setSelectedOpUuids([]);
    setAddOpModalVisible(false);
  };

  const handleRemoveOperation = (uuid: string) => {
    setOperations(operations.filter((o) => o.uuid !== uuid));
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    const arr = [...operations];
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    setOperations(arr);
  };

  const moveDown = (index: number) => {
    if (index >= operations.length - 1) return;
    const arr = [...operations];
    [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
    setOperations(arr);
  };

  const batchSopCountPreview =
    operations.length *
    (type === 'material'
      ? Math.max(1, selectedMaterialUuids.length)
      : Math.max(1, selectedMaterialGroupUuids.length));

  const handleBatchCreateSops = async () => {
    if (!route) {
      messageApi.warning(t('app.master-data.sop.selectOrCreateRoute'));
      return;
    }
    if (operations.length === 0) {
      messageApi.warning(t('app.master-data.sop.atLeastOneOp'));
      return;
    }

    setCreateLoading(true);
    try {
      const sops = await sopApi.batchCreateFromRoute({
        process_route_uuid: route.uuid,
        material_uuids: type === 'material' ? selectedMaterialUuids : undefined,
        material_group_uuids: type === 'material_group' ? selectedMaterialGroupUuids : undefined,
      });
      setCreatedSops(sops);
      setCurrentStep(3);
      messageApi.success(t('app.master-data.sop.sopsCreated', { count: sops.length }));
    } catch (e: any) {
      messageApi.error(e?.message || t('app.master-data.sop.batchCreateFailed'));
    } finally {
      setCreateLoading(false);
    }
  };

  const handleClose = () => {
    onSuccess?.(createdSops);
  };

  const handleOpenEdit = (uuid: string, tab?: 'formConfig') => {
    if (onEditSop) {
      onEditSop(uuid, tab);
    } else {
      navigate(`/apps/master-data/process/sop?editUuid=${uuid}${tab ? '&tab=' + tab : ''}`);
    }
  };

  return (
    <>
      <Steps
        size="small"
        current={currentStep}
        items={[
          { title: t('app.master-data.sop.batchStep1Title') },
          { title: t('app.master-data.sop.batchStep2Title') },
          { title: t('app.master-data.sop.batchStep3Title') },
          { title: t('app.master-data.sop.batchStep4Title') },
        ]}
        style={{ marginBottom: 20 }}
        styles={{
          itemTitle: { fontSize: 12, lineHeight: 1.35, fontWeight: 400 },
        }}
      />

      {currentStep === 0 && (
        <Card title={t('app.master-data.sop.batchStep1Card')} size="small">
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('app.master-data.sop.selectType')}</div>
              <Segmented<'material_group' | 'material'>
                value={type}
                onChange={(v) => setType(v)}
                options={[
                  { label: t('app.master-data.sop.typeMaterialGroup'), value: 'material_group' },
                  { label: t('app.master-data.sop.typeMaterial'), value: 'material' },
                ]}
              />
            </div>
            {type === 'material_group' && (
              <div>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('app.master-data.sop.selectMaterialGroup')}</div>
                <Select
                  mode="multiple"
                  placeholder={t('app.master-data.sop.bindMaterialGroupPlaceholder')}
                  style={{ width: '100%', maxWidth: 480 }}
                  value={selectedMaterialGroupUuids}
                  onChange={setSelectedMaterialGroupUuids}
                  loading={materialsLoading}
                  showSearch
                  filterOption={(input, opt) =>
                    (opt?.label ?? '').toString().toLowerCase().includes((input || '').toLowerCase())
                  }
                  options={materialGroups.map((g) => ({
                    label: `${g.code ?? ''} - ${g.name ?? ''}`,
                    value: g.uuid,
                  }))}
                />
              </div>
            )}
            {type === 'material' && (
              <div>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('app.master-data.sop.typeMaterial')}</div>
                <Select
                  mode="multiple"
                  placeholder={t('app.master-data.sop.selectMaterialPlaceholder')}
                  style={{ width: '100%', maxWidth: 480 }}
                  value={selectedMaterialUuids}
                  onChange={setSelectedMaterialUuids}
                  loading={materialsLoading}
                  showSearch
                  filterOption={(input, opt) =>
                    (opt?.label ?? '').toString().toLowerCase().includes((input || '').toLowerCase())
                  }
                  options={materials.map((m: any) => ({
                    label: `${m.mainCode ?? m.code ?? ''} - ${m.name ?? ''}`,
                    value: m.uuid,
                  }))}
                />
              </div>
            )}
            <Button type="primary" loading={routeLoading} onClick={handleLoadRoute}>
              {t('app.master-data.sop.nextLoadRoute')}
            </Button>
          </Space>
        </Card>
      )}

      {currentStep === 1 && (
        <Card title={t('app.master-data.sop.batchStep2Card')} size="small">
          {route ? (
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <strong>{t('app.master-data.sop.routeLabel')}</strong>{route.code} - {route.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <strong>{t('app.master-data.sop.operationList')}</strong>
                <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setAddOpModalVisible(true)}>
                  {t('app.master-data.sop.addOperation')}
                </Button>
              </div>
              <Table
                size="small"
                dataSource={operations}
                rowKey="uuid"
                pagination={false}
                columns={[
                  { title: t('app.master-data.sop.seqNo'), width: 60, render: (_: any, __: any, i: number) => i + 1 },
                  {
                    title: t('field.operation.code'),
                    dataIndex: 'code',
                    width: 120,
                    render: (value: string) => <Text copyable>{value || '-'}</Text>,
                  },
                  { title: t('field.operation.name'), dataIndex: 'name' },
                  {
                    title: t('common.actions'),
                    width: 120,
                  render: (_: any, record: OperationItem, index: number) => [
                        <Button {...rowActionKind('skip')} key="move-up" onClick={() => moveUp(index)} disabled={index === 0}>
                          {t('app.master-data.sop.moveUp')}
                        </Button>,
                        <Button {...rowActionKind('skip')}
                          key="move-down"
                          size="small"
                          onClick={() => moveDown(index)}
                          disabled={index === operations.length - 1}
                        >
                          {t('app.master-data.sop.moveDown')}
                        </Button>,
                        <Button {...rowActionKind('delete')}
                          key="delete"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleRemoveOperation(record.uuid)}
                        >
                          {t('field.customField.delete')}
                        </Button>,
                      ],
                  },
                ]}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 8 }}>
                <Button onClick={() => setCurrentStep(0)}>
                  {t('components.layoutTemplates.wizard.prev')}
                </Button>
                <Button type="primary" loading={loading} onClick={handleUpdateRoute}>
                  {t('app.master-data.sop.saveRoute')}
                </Button>
                <Button type="primary" onClick={() => setCurrentStep(2)}>
                  {t('app.master-data.sop.nextConfirmOps')}
                </Button>
              </div>
            </Space>
          ) : (
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
              <Alert
                type="info"
                showIcon
                message={t('app.master-data.sop.noBoundRouteTitle')}
                description={t('app.master-data.sop.noBoundRouteDesc')}
              />
              <div>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('app.master-data.sop.pickExistingRoute')}</div>
                <Space wrap align="start">
                  <Select
                    showSearch
                    allowClear
                    placeholder={t('app.master-data.sop.pickRoutePlaceholder')}
                    style={{ width: '100%', minWidth: 280, maxWidth: 440 }}
                    loading={routesLoading}
                    value={pickedRouteUuid}
                    onChange={(v) => setPickedRouteUuid(v)}
                    filterOption={(input, opt) =>
                      String(opt?.label ?? '')
                        .toLowerCase()
                        .includes((input || '').toLowerCase())
                    }
                    options={routePickerOptions.map((r) => ({
                      label: `${r.code} - ${r.name}`,
                      value: r.uuid,
                    }))}
                  />
                  <Button type="primary" loading={routeLoading} onClick={handleConfirmPickRoute} disabled={!pickedRouteUuid}>
                    {t('app.master-data.sop.useSelectedRoute')}
                  </Button>
                </Space>
              </div>
              <div>
                <Button type="default" onClick={handleOpenCreateRouteModal}>
                  {t('app.master-data.sop.createNewRouteBind')}
                </Button>
              </div>
              <Button type="link" onClick={handleBackToStep0} style={{ paddingLeft: 0 }}>
                {t('app.master-data.sop.backToMaterialStep')}
              </Button>
            </Space>
          )}
        </Card>
      )}

      {currentStep === 2 && (
        <Card title={t('app.master-data.sop.batchStep3Card')} size="small">
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message={t('app.master-data.sop.batchRulesTitle')}
              description={
                type === 'material'
                  ? t('app.master-data.sop.batchRulesMaterialDesc', {
                      count: selectedMaterialUuids.length,
                      preview: batchSopCountPreview,
                    })
                  : t('app.master-data.sop.batchRulesGroupDesc', {
                      count: selectedMaterialGroupUuids.length,
                      preview: batchSopCountPreview,
                    })
              }
            />
            <div>
              {t('app.master-data.sop.batchConfirmHint', { count: operations.length })}
            </div>
            <Table
              size="small"
              dataSource={operations}
              rowKey="uuid"
              pagination={false}
              columns={[
                { title: t('app.master-data.sop.seqNo'), width: 60, render: (_: any, __: any, i: number) => i + 1 },
                {
                  title: t('field.operation.code'),
                  dataIndex: 'code',
                  width: 120,
                  render: (value: string) => <Text copyable>{value || '-'}</Text>,
                },
                { title: t('field.operation.name'), dataIndex: 'name' },
              ]}
            />
            <Space>
              <Button onClick={() => setCurrentStep(1)}>
                {t('components.layoutTemplates.wizard.prev')}
              </Button>
              <Button type="primary" loading={createLoading} onClick={handleBatchCreateSops}>
                {t('app.master-data.sop.createSopsForOps')}
              </Button>
            </Space>
          </Space>
        </Card>
      )}

      {currentStep === 3 && (
        <Card title={t('app.master-data.sop.batchStep4Card')} size="small">
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              {t('app.master-data.sop.batchCreatedHint', { count: createdSops.length })}
            </div>
            <Table
              size="small"
              dataSource={createdSops}
              rowKey="uuid"
              pagination={false}
              columns={[
                {
                  title: t('app.master-data.sop.codeLabel'),
                  dataIndex: 'code',
                  width: 280,
                  render: (value: string) => <Text copyable>{value || '-'}</Text>,
                },
                { title: t('app.master-data.sop.nameLabel'), dataIndex: 'name' },
                {
                  title: t('common.actions'),
                  width: 220,
                  render: (_: any, record: SOP) => [
                        <Button
                          key="design"
                          {...rowActionKind('update')}
                          type="link"
                          size="small"
                          icon={<HighlightOutlined />}
                          onClick={() => navigate(`/apps/master-data/process/sop/designer?uuid=${record.uuid}`)}
                        >
                          {t('app.master-data.sop.designFlow')}
                        </Button>,
                        <Button
                          key="edit"
                          {...rowActionKind('update')}
                          type="link"
                          size="small"
                          icon={<FormOutlined />}
                          onClick={() => handleOpenEdit(record.uuid, 'formConfig')}
                        >
                          {t('field.customField.edit')}
                        </Button>,
                      ],
                },
              ]}
            />
            <Space>
              <Button onClick={() => setCurrentStep(2)}>
                {t('components.layoutTemplates.wizard.prev')}
              </Button>
              <Button type="primary" onClick={handleClose}>
                {t('common.close')}
              </Button>
            </Space>
          </Space>
        </Card>
      )}

      <Modal
        title={t('app.master-data.sop.createRouteTitle')}
        open={createRouteModalVisible}
        onCancel={closeCreateRouteModal}
        footer={[
          <Button {...rowActionKind('revoke')} key="cancel" onClick={closeCreateRouteModal}>
            {t('common.cancel')}
          </Button>,
          <Button {...rowActionKind('submit')} key="submit" type="primary" loading={newRouteSaving} onClick={handleSaveNewRoute}>
            {t('app.master-data.sop.saveNewRouteBind')}
          </Button>,
        ]}
      >
        <Form layout="vertical">
          <Form.Item label={t('field.route.code')} required>
            <Input value={newRouteCode} onChange={(e) => setNewRouteCode(e.target.value)} placeholder={t('field.route.codePlaceholder')} />
          </Form.Item>
          <Form.Item label={t('field.route.name')} required>
            <Input value={newRouteName} onChange={(e) => setNewRouteName(e.target.value)} placeholder={t('field.route.namePlaceholder')} />
          </Form.Item>
          <Form.Item label={t('app.master-data.sop.operationList')}>
            <div style={{ marginBottom: 8 }}>
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setAddOpModalVisible(true)}>
                {t('app.master-data.sop.addOperation')}
              </Button>
            </div>
            <Table
              size="small"
              dataSource={operations}
              rowKey="uuid"
              pagination={false}
              columns={[
                { title: t('app.master-data.sop.seqNo'), width: 60, render: (_: any, __: any, i: number) => i + 1 },
                {
                  title: t('field.operation.code'),
                  dataIndex: 'code',
                  width: 120,
                  render: (value: string) => <Text copyable>{value || '-'}</Text>,
                },
                { title: t('field.operation.name'), dataIndex: 'name' },
                {
                  title: t('common.actions'),
                  width: 80,
                  render: (_: any, record: OperationItem) => (
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleRemoveOperation(record.uuid)}>
                      {t('field.customField.delete')}
                    </Button>
                  ),
                },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('app.master-data.sop.addOperationTitle')}
        open={addOpModalVisible}
        onCancel={() => { setAddOpModalVisible(false); setSelectedOpUuids([]); }}
        onOk={handleAddOperations}
        width={600}
      >
        <Select
          mode="multiple"
          placeholder={t('app.master-data.sop.selectOperationPlaceholder')}
          style={{ width: '100%' }}
          value={selectedOpUuids}
          onChange={setSelectedOpUuids}
          loading={operationsLoading}
          showSearch
          filterOption={(input, opt) =>
            (opt?.label ?? '').toString().toLowerCase().includes((input || '').toLowerCase())
          }
          options={allOperations
            .filter((o) => !operations.some((x) => x.uuid === o.uuid))
            .map((o) => ({ label: `${o.code} - ${o.name}`, value: o.uuid }))}
        />
      </Modal>
    </>
  );
};

export default SOPBatchCreateSteps;
