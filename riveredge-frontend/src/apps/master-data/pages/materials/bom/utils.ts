import { Material } from '../../../types/material';
import { message } from 'antd'; // Add message import if needed or use arg

export interface MindMapNode {
  id: string;
  value: string;
  material?: Material;
  quantity?: number;
  unit?: string;
  wasteRate?: number;
  isRequired?: boolean;
  componentId?: number;
  children?: MindMapNode[];
  [key: string]: any;
}

/**
 * 查找节点（递归）
 */
export const findNode = (node: MindMapNode | null, nodeId: string): MindMapNode | null => {
  if (!node) return null;
  if (node.id === nodeId) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNode(child, nodeId);
      if (found) return found;
    }
  }
  return null;
};

/**
 * 更新节点（递归）
 */
export const updateNode = (
  node: MindMapNode,
  nodeId: string,
  action: (node: MindMapNode) => MindMapNode
): MindMapNode => {
  if (node.id === nodeId) return action(node);
  if (node.children) {
    return {
      ...node,
      children: node.children.map((child) => updateNode(child, nodeId, action)),
    };
  }
  return node;
};

/**
 * 删除节点（递归）
 */
export const removeNode = (node: MindMapNode, nodeId: string): MindMapNode | null => {
  if (node.id === nodeId) return null;
  if (node.children) {
    return {
      ...node,
      children: node.children.map((child) => removeNode(child, nodeId)).filter(Boolean) as MindMapNode[],
    };
  }
  return node;
};

/**
 * 查找父节点
 */
export const findParentNode = (data: MindMapNode, targetId: string): MindMapNode | null => {
  if (data.children) {
    if (data.children.some((child) => child.id === targetId)) {
      return data;
    }
    for (const child of data.children) {
      const parent = findParentNode(child, targetId);
      if (parent) return parent;
    }
  }
  return null;
};

/**
 * 移动节点
 */
export const handleMoveNodeLogic = (
  root: MindMapNode,
  nodeId: string,
  newParentId: string
): MindMapNode | null => {
  if (nodeId === 'root') return null; // Cannot move root
  if (nodeId === newParentId) return null; // Cannot move to self

  const nodeToMove = findNode(root, nodeId);
  if (!nodeToMove) return null;

  // Check if target is descendant of node (cannot move to own child)
  const isDescendant = findNode(nodeToMove, newParentId);
  if (isDescendant) return null;

  // Remove from old parent
  const treeAfterRemove = removeNode(root, nodeId);
  if (!treeAfterRemove) return null;

  // Add to new parent
  const treeAfterAdd = updateNode(treeAfterRemove, newParentId, (parent) => ({
    ...parent,
    children: [...(parent.children || []), nodeToMove],
  }));

  return treeAfterAdd;
};

/**
 * 处理添加子节点
 */
export const handleAddChildNode = (
  parentNodeId: string,
  mindMapDataRef: React.MutableRefObject<MindMapNode | null>,
  setMindMapData: (data: MindMapNode) => void,
  setSelectedNodeId: (id: string) => void,
  mindMapInstanceRef: React.MutableRefObject<any>,
  selectedIdInGraphRef: React.MutableRefObject<string | null>,
  nodeConfigForm: any,
  materialNotSelectedLabel: string = '未选择物料'
) => {
  if (!mindMapDataRef.current) return;

  const newNode: MindMapNode = {
    id: `material_new_${Date.now()}`,
    value: materialNotSelectedLabel,
    quantity: 1,
    unit: '',
    wasteRate: 0,
    isRequired: true,
  };

  const updated = updateNode(mindMapDataRef.current, parentNodeId, (node) => {
    return {
      ...node,
      children: [...(node.children || []), newNode],
    };
  });

  if (updated) {
    setMindMapData(updated);
    setSelectedNodeId(newNode.id);
    
    setTimeout(() => {
      if (mindMapInstanceRef.current && newNode.id) {
        const graph = mindMapInstanceRef.current;
        
        // 视觉焦点切换
        if (selectedIdInGraphRef.current && graph.setItemState) {
          graph.setItemState(selectedIdInGraphRef.current, 'selected', false);
        }
        if (graph.setItemState) {
          graph.setItemState(newNode.id, 'selected', true);
        }
        selectedIdInGraphRef.current = newNode.id;

        // 强力聚焦：确保在布局完成后进行
        if (graph.focusItem) {
          graph.focusItem(newNode.id, true, { duration: 0 });
        } else if (graph.focusElement) {
          graph.focusElement(newNode.id, true);
        }

        // 二次聚焦补偿
        setTimeout(() => {
           if (graph.focusItem) graph.focusItem(newNode.id, true, { duration: 0 });
        }, 100);
      }
    }, 150);

    nodeConfigForm.resetFields();
    nodeConfigForm.setFieldsValue({
      quantity: 1,
      wasteRate: 0,
      isRequired: true,
    });
  }
};

/**
 * 处理添加同级节点
 */
export const handleAddSiblingNode = (
  siblingNodeId: string,
  mindMapDataRef: React.MutableRefObject<MindMapNode | null>,
  setMindMapData: (data: MindMapNode) => void,
  setSelectedNodeId: (id: string) => void,
  mindMapInstanceRef: React.MutableRefObject<any>,
  selectedIdInGraphRef: React.MutableRefObject<string | null>,
  nodeConfigForm: any,
  materialNotSelectedLabel: string = '未选择物料'
) => {
  if (!mindMapDataRef.current) return;

  const parent = findParentNode(mindMapDataRef.current, siblingNodeId);
  if (!parent) {
    handleAddChildNode(
      'root',
      mindMapDataRef,
      setMindMapData,
      setSelectedNodeId,
      mindMapInstanceRef,
      selectedIdInGraphRef,
      nodeConfigForm,
      materialNotSelectedLabel
    );
    return;
  }

  handleAddChildNode(
    parent.id,
    mindMapDataRef,
    setMindMapData,
    setSelectedNodeId,
    mindMapInstanceRef,
    selectedIdInGraphRef,
    nodeConfigForm,
    materialNotSelectedLabel
  );
};

/**
 * 处理删除节点
 */
export const handleDeleteNode = (
  nodeId: string,
  mindMapDataRef: React.MutableRefObject<MindMapNode | null>,
  setMindMapData: (data: MindMapNode) => void,
  setSelectedNodeId: (id: string | null) => void,
  messageApi: any,
  t: (key: string) => string
) => {
  if (nodeId === 'root') {
    messageApi.warning(t('app.master-data.bom.cannotDeleteRoot'));
    return;
  }

  if (!mindMapDataRef.current) return;

  const updated = removeNode(mindMapDataRef.current, nodeId);
  if (updated) {
    setMindMapData(updated as MindMapNode);
    setSelectedNodeId(null);
    messageApi.success(t('app.master-data.bom.nodeDeleted'));
  }
};

/**
 * 处理选择节点
 */
export const handleNodeSelect = (
  nodeId: string,
  mindMapDataRef: React.MutableRefObject<MindMapNode | null>,
  setSelectedNodeId: (id: string) => void,
  nodeConfigForm: any
) => {
  setSelectedNodeId(nodeId);
  if (mindMapDataRef.current) {
    const node = findNode(mindMapDataRef.current, nodeId);
    if (node) {
      nodeConfigForm.setFieldsValue({
        materialId: node.material?.id || null,
        quantity: node.quantity || 1,
        unit: node.unit || '',
        wasteRate: node.wasteRate || 0,
        isRequired: node.isRequired !== false,
      });
    }
  }
};
