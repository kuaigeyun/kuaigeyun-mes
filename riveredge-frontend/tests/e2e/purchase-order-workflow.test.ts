/**
 * 采购订单完整流程E2E测试（前端）
 * 
 * 测试采购订单的前端交互流程。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  listPurchaseOrders,
  createPurchaseOrder,
  getPurchaseOrder,
  updatePurchaseOrder,
} from '../../src/apps/kuaizhizao/services/purchase'
import { apiRequest } from '../../src/services/api'

// Mock API模块
vi.mock('../../src/services/api', () => ({
  apiRequest: vi.fn(),
}))

describe('采购订单完整流程E2E测试（前端）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('创建采购订单流程', () => {
    it('应该完成创建采购订单的完整流程', async () => {
      const orderData = {
        supplier_id: 1,
        supplier_name: '测试供应商',
        order_date: '2026-01-15',
        delivery_date: '2026-02-15',
        items: [
          {
            material_id: 1,
            material_code: 'MAT001',
            material_name: '测试物料',
            quantity: 100,
            unit_price: 10,
          },
        ],
      }

      const mockCreatedOrder = {
        id: 1,
        order_code: 'PO202601150001',
        ...orderData,
        status: '草稿',
        total_quantity: 100,
        total_amount: 1000,
      }

      vi.mocked(apiRequest).mockResolvedValue(mockCreatedOrder)

      const result = await createPurchaseOrder(orderData)

      expect(apiRequest).toHaveBeenCalledWith({
        url: '/apps/kuaizhizao/purchase-orders',
        method: 'POST',
        data: orderData,
      })
      expect(result).toEqual(mockCreatedOrder)
      expect(result.order_code).toBe('PO202601150001')
    })
  })

  describe('采购订单列表流程', () => {
    it('应该完成获取和筛选采购订单的完整流程', async () => {
      const mockOrders = [
        {
          id: 1,
          order_code: 'PO202601150001',
          supplier_id: 1,
          status: '草稿',
        },
        {
          id: 2,
          order_code: 'PO202601150002',
          supplier_id: 1,
          status: '已审核',
        },
      ]

      // 1. 获取所有订单
      vi.mocked(apiRequest).mockResolvedValueOnce({ data: mockOrders, total: 2, success: true })
      const allOrders = await listPurchaseOrders({ skip: 0, limit: 20 })
      expect(allOrders.data).toHaveLength(2)

      // 2. 按状态筛选
      const filteredOrders = mockOrders.filter((o) => o.status === '草稿')
      vi.mocked(apiRequest).mockResolvedValueOnce({ data: filteredOrders, total: 1, success: true })
      const draftOrders = await listPurchaseOrders({ skip: 0, limit: 20, status: '草稿' })
      expect(draftOrders.data).toHaveLength(1)
      expect(draftOrders.data[0].status).toBe('草稿')
    })
  })

  describe('采购订单详情流程', () => {
    it('应该完成获取和更新采购订单详情的完整流程', async () => {
      const mockOrder = {
        id: 1,
        order_code: 'PO202601150001',
        supplier_id: 1,
        supplier_name: '测试供应商',
        status: '草稿',
        items: [],
      }

      // 1. 获取订单详情
      vi.mocked(apiRequest).mockResolvedValueOnce(mockOrder)
      const order = await getPurchaseOrder(1)
      expect(order.id).toBe(1)
      expect(order.order_code).toBe('PO202601150001')

      // 2. 更新订单
      const updateData = {
        notes: '更新后的备注',
      }

      const updatedOrder = {
        ...mockOrder,
        ...updateData,
      }

      vi.mocked(apiRequest).mockResolvedValueOnce(updatedOrder)
      const result = await updatePurchaseOrder(1, updateData)
      expect(result.notes).toBe('更新后的备注')
    })
  })
})

