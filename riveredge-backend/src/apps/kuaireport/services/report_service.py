from typing import Optional, List, Any, Dict
from apps.base_service import AppBaseService
from apps.kuaireport.models.report import Report
from apps.kuaireport.schemas.report import ReportCreate, ReportUpdate
from infra.exceptions.exceptions import NotFoundError

class ReportService(AppBaseService[Report]):
    def __init__(self):
        super().__init__(Report)

    async def get_report_by_code(self, tenant_id: int, code: str) -> Optional[Report]:
        return await self.model.get_or_none(tenant_id=tenant_id, code=code)

    async def create(self, tenant_id: int, data: ReportCreate, created_by: int) -> Report:
        """创建报表"""
        return await self.create_with_user(tenant_id, created_by, **data.model_dump())

    async def update(self, tenant_id: int, id: int, data: ReportUpdate, updated_by: int) -> Report:
        """更新报表"""
        return await self.update_with_user(tenant_id, id, updated_by, **data.model_dump(exclude_unset=True))

    async def list(self, tenant_id: int, skip: int = 0, limit: int = 100) -> Dict[str, Any]:
        """列表查询"""
        total = await self.model.filter(tenant_id=tenant_id).count()
        data = await self.list_all(tenant_id, skip, limit)
        return {
            "data": data,
            "total": total,
            "success": True
        }

    async def delete(self, tenant_id: int, id: int) -> bool:
        """删除报表"""
        return await self.delete_with_validation(tenant_id, id, soft_delete=False)

    async def execute_report(self, tenant_id: int, report_id: int, filters: Dict[str, Any]) -> Dict[str, Any]:
        """
        根据报表定义的元数据执行动态查询
        """
        report = await self.model.get_or_none(tenant_id=tenant_id, id=report_id)
        if not report:
            raise NotFoundError("报表未找到")
        
        config = report.template_config
        if not config or "datasource" not in config:
            return {"data": [], "total": 0, "success": True}
            
        datasource = config["datasource"]
        if datasource["type"] == "sql":
            base_sql = datasource["query"]
            
            # 简单的过滤器解析逻辑 (后续可集成更强大的条件构造器)
            # 示例：SELECT * FROM table WHERE 1=1 {filters}
            where_clause = " AND tenant_id = :tenant_id"
            params = {"tenant_id": tenant_id}
            
            # 提取前端传来的过滤器
            for key, value in filters.items():
                if value is not None and value != "":
                    # 这里需要根据元数据定义的搜索类型来处理，目前简单处理
                    where_clause += f" AND {key} = :{key}"
                    params[key] = value
            
            # 执行查询
            from tortoise import Tortoise
            conn = Tortoise.get_connection("default")
            
            # 如果 SQL 中没有 WHERE 关键字，则添加
            if "WHERE" not in base_sql.upper():
                final_sql = f"{base_sql} WHERE 1=1 {where_clause}"
            else:
                final_sql = f"{base_sql} {where_clause}"
                
            # 执行分页 (如果需要)
            # ... 目前直接返回全部或由 SQL 自身控制
            
            data = await conn.execute_query_dict(final_sql, params)
            return {
                "data": data,
                "total": len(data),
                "success": True
            }
            
        return {"data": [], "total": 0, "success": True}

    async def preview_data_by_config(self, tenant_id: int, datasource: Dict[str, Any], filters: Dict[str, Any]) -> Dict[str, Any]:
        """
        根据传入的数据源配置预览数据
        """
        if "type" not in datasource:
            return {"data": [], "total": 0, "success": True}
            
        if datasource["type"] == "sql":
            base_sql = datasource.get("query", "")
            if not base_sql:
                return {"data": [], "total": 0, "success": True}
                
            where_clause = " AND tenant_id = :tenant_id"
            params = {"tenant_id": tenant_id}
            
            # 提取前端传来的过滤器
            for key, value in filters.items():
                if value is not None and value != "":
                    where_clause += f" AND {key} = :{key}"
                    params[key] = value
            
            from tortoise import Tortoise
            conn = Tortoise.get_connection("default")
            
            # 如果 SQL 中没有 WHERE 关键字，则添加
            if "WHERE" not in base_sql.upper():
                final_sql = f"{base_sql} WHERE 1=1 {where_clause}"
            else:
                final_sql = f"{base_sql} {where_clause}"
                
            # 限制预览数量
            final_sql += " LIMIT 20"
            
            try:
                data = await conn.execute_query_dict(final_sql, params)
                return {
                    "data": data,
                    "total": len(data),
                    "success": True
                }
            except Exception as e:
                return {
                    "data": [], 
                    "total": 0, 
                    "success": False, 
                    "message": str(e)
                }
                
        return {"data": [], "total": 0, "success": True}
