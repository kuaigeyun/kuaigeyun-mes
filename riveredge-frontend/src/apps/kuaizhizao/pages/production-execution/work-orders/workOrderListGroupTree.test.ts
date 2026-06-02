import { describe, expect, it } from 'vitest'
import {
  WORK_ORDER_GROUP_ROW_KIND,
  buildWorkOrderGroupForest,
  flattenWorkOrderListRows,
} from './workOrderListGroupTree'
import {
  normalizeWorkOrderListTreeData,
  parseWorkOrderGroupIdFromListRowKey,
  resolveDissolvableWorkOrderGroupIdsFromRowKeys,
  resolveWorkOrderGroupIdFromListRow,
} from './workOrderListTable'

describe('buildWorkOrderGroupForest', () => {
  it('builds group parent with bom hierarchy and split child', () => {
    const flat = [
      {
        id: 1,
        code: 'GD-ROOT',
        product_name: '成品A',
        work_order_group_id: 10,
        group_code: 'WG001',
        group_role: 'root',
      },
      {
        id: 2,
        code: 'GD-COMP',
        product_name: '半成品B',
        work_order_group_id: 10,
        group_code: 'WG001',
        group_role: 'component',
        bom_parent_work_order_id: 1,
      },
      {
        id: 3,
        code: 'GD-ROOT-001',
        product_name: '成品A',
        work_order_group_id: 10,
        group_code: 'WG001',
        parent_work_order_id: 1,
      },
    ]
    const forest = buildWorkOrderGroupForest(flat)
    expect(forest).toHaveLength(1)
    expect(forest[0].row_kind).toBe(WORK_ORDER_GROUP_ROW_KIND)
    expect(forest[0].code).toBe('WG001')
    expect(forest[0].children).toHaveLength(1)
    expect(forest[0].children![0].id).toBe(1)
    expect(forest[0].children![0].children).toHaveLength(2)
    const childIds = forest[0].children![0].children!.map((c) => c.id).sort()
    expect(childIds).toEqual([2, 3])
  })
})

describe('buildWorkOrderGroupForest group_name', () => {
  it('uses group_name from members as parent title for virtual peer group', () => {
    const flat = [
      {
        id: 1,
        code: 'GD-1',
        work_order_group_id: 10,
        group_code: 'WG001',
        group_name: '六月柜体批次',
        group_role: 'component',
      },
      {
        id: 2,
        code: 'GD-2',
        work_order_group_id: 10,
        group_code: 'WG001',
        group_name: '六月柜体批次',
        group_role: 'component',
      },
    ]
    const forest = buildWorkOrderGroupForest(flat)
    expect(forest[0].product_name).toBe('六月柜体批次')
    expect(forest[0].name).toBe('六月柜体批次')
  })
})

describe('parseWorkOrderGroupIdFromListRowKey', () => {
  it('parses work_order_group row key without row index', () => {
    expect(parseWorkOrderGroupIdFromListRowKey('work_order_group-10')).toBe(10)
    expect(parseWorkOrderGroupIdFromListRowKey(-10)).toBe(10)
  })
})

describe('resolveDissolvableWorkOrderGroupIdsFromRowKeys', () => {
  it('collects group id from group row key even when row map is empty', () => {
    expect(
      resolveDissolvableWorkOrderGroupIdsFromRowKeys(['work_order_group-10'], undefined)
    ).toEqual([10])
  })

  it('collects group id from group row and member rows without duplicates', () => {
    const rowByKey = new Map([
      [
        'work_order_group-10',
        { row_kind: 'work_order_group', work_order_group_id: 10, group_code: 'WG1' },
      ],
      ['work_order-1', { row_kind: 'work_order', id: 1, work_order_group_id: 10 }],
      ['work_order-2', { row_kind: 'work_order', id: 2, work_order_group_id: 10 }],
    ])
    expect(resolveWorkOrderGroupIdFromListRow(rowByKey.get('work_order_group-10')!)).toBe(10)
    expect(
      resolveDissolvableWorkOrderGroupIdsFromRowKeys(
        ['work_order_group-10', 'work_order-1', 'work_order-2'],
        rowByKey
      )
    ).toEqual([10])
  })
})

describe('normalizeWorkOrderListTreeData', () => {
  it('keeps ungrouped split tree separate from groups', () => {
    const rows = [
      { id: 100, code: 'SOLO', product_name: '独立' },
      { id: 101, code: 'SOLO-001', product_name: '独立', parent_work_order_id: 100 },
      {
        id: 1,
        code: 'G-ROOT',
        work_order_group_id: 5,
        group_code: 'WG5',
        group_role: 'root',
        product_name: '组内成品',
      },
    ]
    const tree = normalizeWorkOrderListTreeData(rows)
    expect(tree).toHaveLength(2)
    const groupNode = tree.find((r) => r.row_kind === WORK_ORDER_GROUP_ROW_KIND)
    const soloNode = tree.find((r) => r.code === 'SOLO')
    expect(groupNode).toBeDefined()
    expect(soloNode?.children).toHaveLength(1)
    expect(soloNode?.children![0].code).toBe('SOLO-001')
  })

  it('keeps split rework outsource under group member when children lack group id', () => {
    const rows = [
      {
        id: 1,
        code: 'GD-G1',
        work_order_group_id: 7,
        group_code: 'WG7',
        group_role: 'component',
        product_name: '全塔台式机箱',
      },
      { id: 201, code: 'GD-G1-001', row_kind: 'split', parent_work_order_id: 1 },
      { id: 301, code: 'RG-001', row_kind: 'rework', parent_work_order_id: 1 },
      { id: 401, code: 'OS-001', row_kind: 'outsource', parent_work_order_id: 1 },
    ]
    const tree = normalizeWorkOrderListTreeData(rows)
    const groupNode = tree.find((r) => r.row_kind === WORK_ORDER_GROUP_ROW_KIND)
    expect(groupNode?.children).toHaveLength(1)
    const member = groupNode!.children![0]
    expect(member.children).toHaveLength(3)
    const kinds = member.children!.map((c) => c.row_kind).sort()
    expect(kinds).toEqual(['outsource', 'rework', 'split'])
  })

  it('flattens api children before regrouping', () => {
    const rows = [
      {
        id: 1,
        code: 'G1',
        work_order_group_id: 9,
        group_code: 'WG9',
        group_role: 'root',
        children: [
          { id: 2, code: 'G1-001', row_kind: 'split', parent_work_order_id: 1 },
        ],
      },
    ]
    const flat = flattenWorkOrderListRows(rows)
    expect(flat).toHaveLength(2)
    const tree = normalizeWorkOrderListTreeData(rows)
    expect(tree[0].row_kind).toBe(WORK_ORDER_GROUP_ROW_KIND)
    expect(tree[0].children![0].children).toHaveLength(1)
  })
})
