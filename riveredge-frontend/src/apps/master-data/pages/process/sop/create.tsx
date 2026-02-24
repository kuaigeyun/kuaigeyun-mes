/**
 * 制造 SOP 创建向导
 *
 * 按工艺路线延伸思路：从物料/物料组出发，加载或创建工艺路线，按工序批量创建 SOP 草稿。
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Button, Card, message, Radio, Select, Space, Table, Steps, Empty, Modal, Input, Form } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, ApartmentOutlined, FormOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { processRouteApi, operationApi, sopApi } from '../../../services/process';
import { materialApi, materialGroupApi } from '../../../services/material';
import type { ProcessRoute, Operation } from '../../../types/process';
import type { Material, MaterialGroup } from '../../../types/material';
import type { SOP } from '../../../types/process';

/** 工序项（用于序列编辑） */
interface OperationItem {
  uuid: string;
  code: string;
  name: string;
  description?: string;
}

const SOPCreatePage: React.FC = () => {
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

  // 物料/物料组/工序列表
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialGroups, setMaterialGroups] = useState<MaterialGroup[]>([]);
  const [allOperations, setAllOperations] = useState<Operation[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [operationsLoading, setOperationsLoading] = useState(false);

  // 无工艺路线时创建新路线
  const [createRouteModalVisible, setCreateRouteModalVisible] = useState(false);
  const [newRouteCode, setNewRouteCode] = useState('');
  const [newRouteName, setNewRouteName] = useState('');
  const [newRouteSaving, setNewRouteSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setMaterialsLoading(true);
        setOperationsLoading(true);
        const [matRes, mgRes, opRes] = await Promise.all([
          materialApi.list({ limit: 1000, isActive: true }).catch(() => []),
          materialGroupApi.list({ limit: 1000 }).catch(() => []),
          operationApi.list({ is_active: true, limit: 1000 }),
        ]);
        setMaterials(Array.isArray(matRes) ? matRes : []);
        setMaterialGroups(Array.isArray(mgRes) ? mgRes : []);
        setAllOperations(opRes);
      } catch (e) {
        console.error('加载基础数据失败:', e);
      } finally {
        setMaterialsLoading(false);
        setOperationsLoading(false);
      }
    };
    load();
  }, []);

  /** Step 1: 加载工艺路线 */
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

  /** 解析工序序列 */
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

  /** 保存为新工艺路线并绑定 */
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

  /** 更新工艺路线工序序列 */
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

  /** 添加工序（无路线时） */
  const [addOpModalVisible, setAddOpModalVisible] = useState(false);
  const [selectedOpUuids, setSelectedOpUuids] = useState<string[]>([]);
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

  /** Step 3 确认：为工序创建 SOP */
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

  return (
    <ListPageTemplate>
      <Card
        title={null}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/apps/master-data/process/sop')}>
            返回列表
          </Button>
        }
      >
        <Steps
          current={currentStep}
          items={[
            { title: '选择物料/物料组' },
            { title: '工艺路线与工序' },
            { title: '确认工序' },
            { title: 'SOP 已创建' },
          ]}
          style={{ marginBottom: 24 }}
        />

        {/* Step 0: 选择类型与物料/物料组 */}
        {currentStep === 0 && (
          <Card title="Step 1：选择物料或物料组" size="small">
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

        {/* Step 1: 工艺路线与工序 */}
        {currentStep === 1 && (
          <Card title="Step 2：工艺路线与工序" size="small">
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
                    { title: '序号', width: 60, render: (_, __, i) => i + 1 },
                    { title: '工序编码', dataIndex: 'code', width: 120 },
                    { title: '工序名称', dataIndex: 'name' },
                    {
                      title: '操作',
                      width: 120,
                      render: (_, record, index) => (
                        <Space>
                          <Button size="small" onClick={() => moveUp(index)} disabled={index === 0}>
                            上移
                          </Button>
                          <Button size="small" onClick={() => moveDown(index)} disabled={index === operations.length - 1}>
                            下移
                          </Button>
                          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleRemoveOperation(record.uuid)}>
                            删除
                          </Button>
                        </Space>
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

        {/* Step 2: 确认工序 */}
        {currentStep === 2 && (
          <Card title="Step 3：确认工序" size="small">
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
                  { title: '序号', width: 60, render: (_, __, i) => i + 1 },
                  { title: '工序编码', dataIndex: 'code', width: 120 },
                  { title: '工序名称', dataIndex: 'name' },
                ]}
              />
              <Button type="primary" loading={createLoading} onClick={handleBatchCreateSops}>
                为工序创建 SOP
              </Button>
            </Space>
          </Card>
        )}

        {/* Step 3: SOP 已创建 */}
        {currentStep === 3 && (
          <Card title="Step 4：SOP 已创建" size="small">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                已创建 {createdSops.length} 个 SOP 草稿，可点击「设计流程」完善流程，或「添加数据采集项」配置报工表单。
              </div>
              <Table
                size="small"
                dataSource={createdSops}
                rowKey="uuid"
                pagination={false}
                columns={[
                  { title: 'SOP编码', dataIndex: 'code', width: 160 },
                  { title: 'SOP名称', dataIndex: 'name' },
                  {
                    title: '操作',
                    width: 220,
                    render: (_, record) => (
                      <Space>
                        <Button
                          type="link"
                          size="small"
                          icon={<ApartmentOutlined />}
                          onClick={() => navigate(`/apps/master-data/process/sop/designer?uuid=${record.uuid}`)}
                        >
                          设计流程
                        </Button>
                        <Button
                          type="link"
                          size="small"
                          icon={<FormOutlined />}
                          onClick={() => navigate(`/apps/master-data/process/sop?editUuid=${record.uuid}&tab=formConfig`)}
                        >
                          添加数据采集项
                        </Button>
                      </Space>
                    ),
                  },
                ]}
              />
              <Button type="primary" onClick={() => navigate('/apps/master-data/process/sop')}>
                返回 SOP 列表
              </Button>
            </Space>
          </Card>
        )}

        {/* 无工艺路线：创建新路线 */}
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
            <Form.Item label="工艺路线编码" required>
              <Input value={newRouteCode} onChange={(e) => setNewRouteCode(e.target.value)} placeholder="请输入编码" />
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
                  { title: '序号', width: 60, render: (_, __, i) => i + 1 },
                  { title: '工序编码', dataIndex: 'code', width: 120 },
                  { title: '工序名称', dataIndex: 'name' },
                  {
                    title: '操作',
                    width: 80,
                    render: (_, record) => (
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

        {/* 添加工序 */}
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
      </Card>
    </ListPageTemplate>
  );
};

export default SOPCreatePage;
