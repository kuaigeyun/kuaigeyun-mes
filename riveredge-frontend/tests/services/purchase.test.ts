/**
 * 采购订单服务测试
 * 
 * 测试采购订单相关的API调用。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  listPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
} from '../../src/apps/kuaizhizao/services/purchase'
import { apiRequest } from '../../src/services/api'

// Mock API模块
vi.mock('../../src/services/api', () => ({
  apiRequest: vi.fn(),
}))

describe('采购订单服务', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('listPurchaseOrders', () => {
    it('应该成功获取采购订单列表', async () => {
      const mockOrders = [
        {
          id: 1,
          order_code: 'PO202601150001',
          supplier_id: 1,
          supplier_name: '测试供应商',
          status: '草稿',
        },
        {
          id: 2,
          order_code: 'PO202601150002',
          supplier_id: 1,
          supplier_name: '测试供应商',
          status: '已审核',
        },
      ]

      vi.mocked(apiRequest).mockResolvedValue({ data: mockOrders, total: 2, success: true })

      const result = await listPurchaseOrders({ skip: 0, limit: 20 })

      expect(apiRequest).toHaveBeenCalledWith({
        url: '/apps/kuaizhizao/purchase-orders',
        method: 'GET',
        params: { skip: 0, limit: 20 },
      })
      expect(result.data).toEqual(mockOrders)
    })

    it('应该支持筛选参数', async () => {
      const mockOrders = [
        {
          id: 1,
          order_code: 'PO202601150001',
          status: '草稿',
        },
      ]

      vi.mocked(apiRequest).mockResolvedValue({ data: mockOrders, total: 1, success: true })

      const result = await listPurchaseOrders({
        skip: 0,
        limit: 20,
        status: '草稿',
        supplier_id: 1,
      })

      expect(apiRequest).toHaveBeenCalledWith({
        url: '/apps/kuaizhizao/purchase-orders',
        method: 'GET',
        params: {
          skip: 0,
          limit: 20,
          status: '草稿',
          supplier_id: 1,
        },
      })
      expect(result.data).toEqual(mockOrders)
    })
  })

  describe('createPurchaseOrder', () => {
    it('应该成功创建采购订单', async () => {
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

      const mockResponse = {
        id: 1,
        order_code: 'PO202601150001',
        ...orderData,
        status: '草稿',
        total_quantity: 100,
        total_amount: 1000,
      }

      vi.mocked(apiRequest).mockResolvedValue(mockResponse)

      const result = await createPurchaseOrder(orderData)

      expect(apiRequest).toHaveBeenCalledWith({
        url: '/apps/kuaizhizao/purchase-orders',
        method: 'POST',
        data: orderData,
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('getPurchaseOrder', () => {
    it('应该成功获取采购订单详情', async () => {
      const mockOrder = {
        id: 1,
        order_code: 'PO202601150001',
        supplier_id: 1,
        supplier_name: '测试供应商',
        status: '草稿',
      }

      vi.mocked(apiRequest).mockResolvedValue(mockOrder)

      const result = await getPurchaseOrder(1)

      expect(apiRequest).toHaveBeenCalledWith({
        url: '/apps/kuaizhizao/purchase-orders/1',
        method: 'GET',
      })
      expect(result).toEqual(mockOrder)
    })
  })

  describe('updatePurchaseOrder', () => {
    it('应该成功更新采购订单', async () => {
      const updateData = {
        notes: '更新后的备注',
      }

      const mockResponse = {
        id: 1,
        order_code: 'PO202601150001',
        ...updateData,
      }

      vi.mocked(apiRequest).mockResolvedValue(mockResponse)

      const result = await updatePurchaseOrder(1, updateData)

      expect(apiRequest).toHaveBeenCalledWith({
        url: '/apps/kuaizhizao/purchase-orders/1',
        method: 'PUT',
        data: updateData,
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('deletePurchaseOrder', () => {
    it('应该成功删除采购订单', async () => {
      vi.mocked(apiRequest).mockResolvedValue(undefined)

      await deletePurchaseOrder(1)

      expect(apiRequest).toHaveBeenCalledWith({
        url: '/apps/kuaizhizao/purchase-orders/1',
        method: 'DELETE',
      })
    })
  })
})

