/**
 * 物料管理服务测试
 * 
 * 测试物料相关的API调用。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { materialApi } from '../../src/apps/master-data/services/material'
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

describe('物料管理服务', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('materialApi.list', () => {
    it('应该成功获取物料列表', async () => {
      const mockMaterials = [
        {
          id: 1,
          code: 'MAT001',
          name: '测试物料1',
          unit: '个',
        },
        {
          id: 2,
          code: 'MAT002',
          name: '测试物料2',
          unit: '个',
        },
      ]

      vi.mocked(api.get).mockResolvedValue(mockMaterials)

      const result = await materialApi.list({ skip: 0, limit: 20 })

      expect(api.get).toHaveBeenCalledWith('/apps/master-data/materials', {
        params: { skip: 0, limit: 20 },
      })
      expect(result).toEqual(mockMaterials)
    })

    it('应该支持筛选参数', async () => {
      const mockMaterials = [
        {
          id: 1,
          code: 'MAT001',
          name: '测试物料1',
          material_type: '成品',
        },
      ]

      vi.mocked(api.get).mockResolvedValue(mockMaterials)

      const result = await materialApi.list({
        skip: 0,
        limit: 20,
        material_type: '成品',
      })

      expect(api.get).toHaveBeenCalledWith('/apps/master-data/materials', {
        params: {
          skip: 0,
          limit: 20,
          material_type: '成品',
        },
      })
      expect(result).toEqual(mockMaterials)
    })
  })

  describe('materialApi.create', () => {
    it('应该成功创建物料', async () => {
      const materialData = {
        code: 'MAT001',
        name: '测试物料',
        unit: '个',
        material_type: '成品',
      }

      const mockResponse = {
        id: 1,
        uuid: 'uuid-123',
        ...materialData,
      }

      vi.mocked(api.post).mockResolvedValue(mockResponse)

      const result = await materialApi.create(materialData as any)

      expect(api.post).toHaveBeenCalledWith('/apps/master-data/materials', materialData)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('materialApi.get', () => {
    it('应该成功获取物料详情', async () => {
      const mockMaterial = {
        id: 1,
        uuid: 'uuid-123',
        code: 'MAT001',
        name: '测试物料',
        unit: '个',
      }

      vi.mocked(api.get).mockResolvedValue(mockMaterial)

      const result = await materialApi.get('uuid-123')

      expect(api.get).toHaveBeenCalledWith('/apps/master-data/materials/uuid-123')
      expect(result).toEqual(mockMaterial)
    })
  })

  describe('materialApi.update', () => {
    it('应该成功更新物料', async () => {
      const updateData = {
        name: '更新后的物料名称',
      }

      const mockResponse = {
        id: 1,
        uuid: 'uuid-123',
        code: 'MAT001',
        ...updateData,
      }

      vi.mocked(api.put).mockResolvedValue(mockResponse)

      const result = await materialApi.update('uuid-123', updateData as any)

      expect(api.put).toHaveBeenCalledWith('/apps/master-data/materials/uuid-123', updateData)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('materialApi.delete', () => {
    it('应该成功删除物料', async () => {
      vi.mocked(api.delete).mockResolvedValue(undefined)

      await materialApi.delete('uuid-123')

      expect(api.delete).toHaveBeenCalledWith('/apps/master-data/materials/uuid-123')
    })
  })
})







