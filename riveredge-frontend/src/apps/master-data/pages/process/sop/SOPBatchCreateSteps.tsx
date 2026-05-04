/**
 * 批量创建 SOP 步骤组件
 *
 * 按工艺路线从物料/物料组出发，加载或创建工艺路线，按工序批量创建 SOP 草稿。
 * 供新建 Modal 的批量模式使用。
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Button, Card, Radio, Select, Space, Table, Steps, Empty, Modal, Input, Form, Typography } from 'antd';
import { ApartmentOutlined, FormOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { processRouteApi, operationApi, sopApi, unwrapProcessPagedList } from '../../../services/process';
import { materialApi, materialGroupApi } from '../../../services/material';
import { renderRowActionsOverflow } from '../../../../../utils/renderRowActionsOverflow';
import type { ProcessRoute, Operation } from '../../../types/process';
import type { Material, MaterialGroup } from '../../../types/material';
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
        setMaterials(Array.isArray(matRes) ? matRes : []);
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
        setCurrentStep(1);
      } else {
        setCreateRouteModalVisible(true);
      }
    } catch (e: any) {
      messageApi.error(e?.message || t('app.master-data.sop.loadRouteFailed'));
    } finally {
      setRouteLoading(false);
    }
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
        current={currentStep}
        items={[
          { title: '第一步：选择物料/物料组' },
          { title: '第二步：工艺路线与工序' },
          { title: '第三步：确认工序' },
          { title: '第四步：SOP 已创建' },
        ]}
        style={{ marginBottom: 24 }}
      />

      {currentStep === 0 && (
        <Card title="第一步：选择物料或物料组" size="small">
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>选择类型</div>
              <Radio.Group value={type} onChange={(e) => setType(e.target.value)}>
                <Radio value="material_group">物料组</Radio>
                <Radio value="material">物料</Radio>
              </Radio.Group>
            </div>
            {type === 'material_group' && (
              <div>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>选择物料组</div>
                <Select
                  mode="multiple"
                  placeholder="请选择物料组"
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
                <div style={{ marginBottom: 8, fontWeight: 500 }}>选择物料</div>
                <Select
                  mode="multiple"
                  placeholder="请选择物料"
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
              下一步：加载工艺路线
            </Button>
          </Space>
        </Card>
      )}

      {currentStep === 1 && (
        <Card title="第二步：工艺路线与工序" size="small">
          {route ? (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <strong>工艺路线：</strong>{route.code} - {route.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <strong>工序列表</strong>
                <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setAddOpModalVisible(true)}>
                  添加工序
                </Button>
              </div>
              <Table
                size="small"
                dataSource={operations}
                rowKey="uuid"
                pagination={false}
                columns={[
                  { title: '序号', width: 60, render: (_: any, __: any, i: number) => i + 1 },
                  {
                    title: '工序编号',
                    dataIndex: 'code',
                    width: 120,
                    render: (value: string) => <Text copyable>{value || '-'}</Text>,
                  },
                  { title: '工序名称', dataIndex: 'name' },
                  {
                    title: '操作',
                    width: 120,
                  render: (_: any, record: OperationItem, index: number) =>
                    renderRowActionsOverflow(
                      [
                        <Button key="move-up" size="small" onClick={() => moveUp(index)} disabled={index === 0}>
                          上移
                        </Button>,
                        <Button
                          key="move-down"
                          size="small"
                          onClick={() => moveDown(index)}
                          disabled={index === operations.length - 1}
                        >
                          下移
                        </Button>,
                        <Button
                          key="delete"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleRemoveOperation(record.uuid)}
                        >
                          删除
                        </Button>,
                      ],
                      `sop-op-${record.uuid ?? index}`,
                    ),
                  },
                ]}
              />
              <Button type="primary" loading={loading} onClick={handleUpdateRoute}>
                保存工艺路线
              </Button>
              <Button type="primary" onClick={() => setCurrentStep(2)} style={{ marginLeft: 8 }}>
                下一步：确认工序
              </Button>
            </Space>
          ) : (
            <Empty description="暂无工艺路线" />
          )}
        </Card>
      )}

      {currentStep === 2 && (
        <Card title="第三步：确认工序" size="small">
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              将按以下 {operations.length} 个工序批量创建 SOP 草稿，再逐工序进入设计器完善流程。
            </div>
            <Table
              size="small"
              dataSource={operations}
              rowKey="uuid"
              pagination={false}
              columns={[
                { title: '序号', width: 60, render: (_: any, __: any, i: number) => i + 1 },
                {
                  title: '工序编号',
                  dataIndex: 'code',
                  width: 120,
                  render: (value: string) => <Text copyable>{value || '-'}</Text>,
                },
                { title: '工序名称', dataIndex: 'name' },
              ]}
            />
            <Button type="primary" loading={createLoading} onClick={handleBatchCreateSops}>
              为工序创建 SOP
            </Button>
          </Space>
        </Card>
      )}

      {currentStep === 3 && (
        <Card title="第四步：SOP 已创建" size="small">
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              已创建 {createdSops.length} 个 SOP 草稿。建议逐条进入「编辑」完善基本信息、作业指导与报工采集。
            </div>
            <Table
              size="small"
              dataSource={createdSops}
              rowKey="uuid"
              pagination={false}
              columns={[
                {
                  title: 'SOP编号',
                  dataIndex: 'code',
                  width: 160,
                  render: (value: string) => <Text copyable>{value || '-'}</Text>,
                },
                { title: 'SOP名称', dataIndex: 'name' },
                {
                  title: '操作',
                  width: 220,
                  render: (_: any, record: SOP) =>
                    renderRowActionsOverflow(
                      [
                        <Button
                          key="design"
                          type="link"
                          size="small"
                          icon={<ApartmentOutlined />}
                          onClick={() => navigate(`/apps/master-data/process/sop/designer?uuid=${record.uuid}`)}
                        >
                          设计流程
                        </Button>,
                        <Button
                          key="edit"
                          type="link"
                          size="small"
                          icon={<FormOutlined />}
                          onClick={() => handleOpenEdit(record.uuid, 'formConfig')}
                        >
                          编辑
                        </Button>,
                      ],
                      `sop-created-${record.uuid ?? 'row'}`,
                    ),
                },
              ]}
            />
            <Button type="primary" onClick={handleClose}>
              关闭
            </Button>
          </Space>
        </Card>
      )}

      <Modal
        title="创建工艺路线"
        open={createRouteModalVisible}
        onCancel={() => {
          setCreateRouteModalVisible(false);
          setOperations([]);
        }}
        footer={[
          <Button key="cancel" onClick={() => setCreateRouteModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" loading={newRouteSaving} onClick={handleSaveNewRoute}>
            保存为新工艺路线并绑定
          </Button>,
        ]}
      >
        <Form layout="vertical">
          <Form.Item label="工艺路线编号" required>
            <Input value={newRouteCode} onChange={(e) => setNewRouteCode(e.target.value)} placeholder="请输入编号" />
          </Form.Item>
          <Form.Item label="工艺路线名称" required>
            <Input value={newRouteName} onChange={(e) => setNewRouteName(e.target.value)} placeholder="请输入名称" />
          </Form.Item>
          <Form.Item label="工序列表">
            <div style={{ marginBottom: 8 }}>
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setAddOpModalVisible(true)}>
                添加工序
              </Button>
            </div>
            <Table
              size="small"
              dataSource={operations}
              rowKey="uuid"
              pagination={false}
              columns={[
                { title: '序号', width: 60, render: (_: any, __: any, i: number) => i + 1 },
                {
                  title: '工序编号',
                  dataIndex: 'code',
                  width: 120,
                  render: (value: string) => <Text copyable>{value || '-'}</Text>,
                },
                { title: '工序名称', dataIndex: 'name' },
                {
                  title: '操作',
                  width: 80,
                  render: (_: any, record: OperationItem) => (
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleRemoveOperation(record.uuid)}>
                      删除
                    </Button>
                  ),
                },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="添加工序"
        open={addOpModalVisible}
        onCancel={() => { setAddOpModalVisible(false); setSelectedOpUuids([]); }}
        onOk={handleAddOperations}
        width={600}
      >
        <Select
          mode="multiple"
          placeholder="请选择工序"
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
