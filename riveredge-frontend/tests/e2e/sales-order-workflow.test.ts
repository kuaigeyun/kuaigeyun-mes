/**
 * 销售订单完整流程E2E测试（前端）
 * 
 * 测试销售订单的前端交互流程。
 * 
 * 注意：这是一个API级别的测试，模拟前端调用。
 * 如果需要真正的浏览器E2E测试，需要安装Playwright。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listSalesOrders, createSalesOrder, getSalesOrder, updateSalesOrder } from '../../src/apps/kuaizhizao/services/sales'
import { api } from '../../src/services/api'

// Mock API模块
vi.mock('../../src/services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('销售订单完整流程E2E测试（前端）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('创建销售订单流程', () => {
    it('应该完成创建销售订单的完整流程', async () => {
      // 注意：这些mock在实际测试中可能不会被调用，因为createSalesOrder直接调用api.post
      // 如果需要测试获取客户/物料列表，应该单独测试

      // 3. 创建订单
      const orderData = {
        customer_id: 1,
        customer_name: '测试客户',
        order_date: '2026-01-15',
        delivery_date: '2026-02-15',
        order_type: 'MTO' as const,
        items: [
          {
            material_id: 1,
            material_code: 'MAT001',
            material_name: '物料1',
            material_unit: '个',
            order_quantity: 100,
            unit_price: 10,
            delivery_date: '2026-02-15',
          },
        ],
      }

      const mockCreatedOrder = {
        id: 1,
        order_code: 'SO202601150001',
        ...orderData,
        status: '草稿',
        total_quantity: 100,
        total_amount: 1000,
      }

      vi.mocked(api.post).mockResolvedValue(mockCreatedOrder)

      const result = await createSalesOrder(orderData as any)

      // 验证
      expect(api.post).toHaveBeenCalledWith('/apps/kuaizhizao/sales-orders', orderData)
      expect(result).toEqual(mockCreatedOrder)
      expect(result.order_code).toBe('SO202601150001')
      expect(result.total_quantity).toBe(100)
      expect(result.total_amount).toBe(1000)
    })
  })

  describe('销售订单列表流程', () => {
    it('应该完成获取和筛选销售订单的完整流程', async () => {
      const mockOrders = [
        {
          id: 1,
          order_code: 'SO202601150001',
          customer_id: 1,
          customer_name: '测试客户',
          order_type: 'MTO',
          status: '草稿',
        },
        {
          id: 2,
          order_code: 'SO202601150002',
          customer_id: 1,
          customer_name: '测试客户',
          order_type: 'MTS',
          status: '已审核',
        },
      ]

      // 1. 获取所有订单
      vi.mocked(api.get).mockResolvedValueOnce(mockOrders)
      const allOrders = await listSalesOrders({ skip: 0, limit: 20 })
      expect(allOrders).toHaveLength(2)
      expect(allOrders[0].order_code).toBe('SO202601150001')

      // 2. 按状态筛选
      const filteredOrders = mockOrders.filter((o) => o.status === '草稿')
      vi.mocked(api.get).mockResolvedValueOnce(filteredOrders)
      const draftOrders = await listSalesOrders({ skip: 0, limit: 20, status: '草稿' })
      expect(draftOrders).toHaveLength(1)
      expect(draftOrders[0].status).toBe('草稿')
    })
  })

  describe('销售订单详情流程', () => {
    it('应该完成获取和更新销售订单详情的完整流程', async () => {
      const mockOrder = {
        id: 1,
        order_code: 'SO202601150001',
        customer_id: 1,
        customer_name: '测试客户',
        order_type: 'MTO',
        status: '草稿',
        notes: '原始备注',
        items: [
          {
            id: 1,
            material_id: 1,
            material_code: 'MAT001',
            material_name: '物料1',
            order_quantity: 100,
            unit_price: 10,
          },
        ],
      }

      // 1. 获取订单详情
      vi.mocked(api.get).mockResolvedValueOnce(mockOrder)
      const order = await getSalesOrder(1)
      expect(order.id).toBe(1)
      expect(order.order_code).toBe('SO202601150001')
      expect(order.customer_id).toBe(1)

      // 2. 更新订单
      const updateData = {
        notes: '更新后的备注',
        shipping_address: '新地址',
      }

      const updatedOrder = {
        ...mockOrder,
        ...updateData,
      }

      vi.mocked(api.put).mockResolvedValueOnce(updatedOrder)
      const result = await updateSalesOrder(1, updateData)
      expect(result.notes).toBe('更新后的备注')
      expect(result.shipping_address).toBe('新地址')
    })
  })
})

