"""
数据库性能分析工具模块

提供数据库查询性能分析、索引使用情况分析等功能。

Author: Auto (AI Assistant)
Date: 2026-01-27
"""

from typing import List, Dict, Any, Optional
from tortoise import connections
from loguru import logger


class DatabasePerformanceAnalyzer:
    """
    数据库性能分析器
    
    提供数据库性能分析工具，包括慢查询检测、索引使用情况分析等。
    """
    
    @staticmethod
    async def analyze_slow_queries(
        min_duration: float = 1.0,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        分析慢查询
        
        查询执行时间超过指定阈值的SQL语句。
        
        Args:
            min_duration: 最小执行时间（秒），默认1.0秒
            limit: 返回结果数量限制，默认100
            
        Returns:
            List[Dict[str, Any]]: 慢查询列表，包含查询语句、执行时间、调用次数等
        """
        conn = connections.get("default")
        
        # PostgreSQL 慢查询分析（需要启用 pg_stat_statements 扩展）
        query = """
            SELECT 
                query,
                calls,
                total_exec_time,
                mean_exec_time,
                max_exec_time,
                min_exec_time,
                stddev_exec_time
            FROM pg_stat_statements
            WHERE mean_exec_time >= %s
            ORDER BY mean_exec_time DESC
            LIMIT %s
        """
        
        try:
            # 注意：需要先启用 pg_stat_statements 扩展
            # CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
            results = await conn.execute_query_dict(query, [min_duration * 1000, limit])
            
            slow_queries = []
            for row in results:
                slow_queries.append({
                    "query": row.get("query", ""),
                    "calls": row.get("calls", 0),
                    "total_exec_time": row.get("total_exec_time", 0),
                    "mean_exec_time": row.get("mean_exec_time", 0),
                    "max_exec_time": row.get("max_exec_time", 0),
                    "min_exec_time": row.get("min_exec_time", 0),
                    "stddev_exec_time": row.get("stddev_exec_time", 0)
                })
            
            return slow_queries
            
        except Exception as e:
            logger.warning(f"慢查询分析失败，可能需要启用 pg_stat_statements 扩展: {str(e)}")
            return []
    
    @staticmethod
    async def analyze_index_usage(
        table_name: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        分析索引使用情况
        
        查询索引的使用统计信息，识别未使用的索引。
        
        Args:
            table_name: 表名（可选，如果指定则只分析该表的索引）
            
        Returns:
            List[Dict[str, Any]]: 索引使用情况列表
        """
        conn = connections.get("default")
        
        # PostgreSQL 索引使用情况分析
        if table_name:
            query = """
                SELECT 
                    schemaname,
                    tablename,
                    indexname,
                    idx_scan as index_scans,
                    idx_tup_read as tuples_read,
                    idx_tup_fetch as tuples_fetched
                FROM pg_stat_user_indexes
                WHERE tablename = %s
                ORDER BY idx_scan ASC
            """
            params = [table_name]
        else:
            query = """
                SELECT 
                    schemaname,
                    tablename,
                    indexname,
                    idx_scan as index_scans,
                    idx_tup_read as tuples_read,
                    idx_tup_fetch as tuples_fetched
                FROM pg_stat_user_indexes
                ORDER BY idx_scan ASC
            """
            params = []
        
        try:
            results = await conn.execute_query_dict(query, params)
            
            index_usage = []
            for row in results:
                index_usage.append({
                    "schema": row.get("schemaname", ""),
                    "table": row.get("tablename", ""),
                    "index": row.get("indexname", ""),
                    "scans": row.get("index_scans", 0),
                    "tuples_read": row.get("tuples_read", 0),
                    "tuples_fetched": row.get("tuples_fetched", 0)
                })
            
            return index_usage
            
        except Exception as e:
            logger.error(f"索引使用情况分析失败: {str(e)}")
            return []
    
    @staticmethod
    async def analyze_table_statistics(
        table_name: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        分析表统计信息
        
        查询表的统计信息，包括行数、大小、索引数量等。
        
        Args:
            table_name: 表名（可选，如果指定则只分析该表）
            
        Returns:
            List[Dict[str, Any]]: 表统计信息列表
        """
        conn = connections.get("default")
        
        # PostgreSQL 表统计信息
        if table_name:
            query = """
                SELECT 
                    schemaname,
                    tablename,
                    n_live_tup as live_tuples,
                    n_dead_tup as dead_tuples,
                    last_vacuum,
                    last_autovacuum,
                    last_analyze,
                    last_autoanalyze,
                    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
                    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
                    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as indexes_size
                FROM pg_stat_user_tables
                WHERE tablename = %s
                ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
            """
            params = [table_name]
        else:
            query = """
                SELECT 
                    schemaname,
                    tablename,
                    n_live_tup as live_tuples,
                    n_dead_tup as dead_tuples,
                    last_vacuum,
                    last_autovacuum,
                    last_analyze,
                    last_autoanalyze,
                    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
                    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
                    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as indexes_size
                FROM pg_stat_user_tables
                ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
            """
            params = []
        
        try:
            results = await conn.execute_query_dict(query, params)
            
            table_stats = []
            for row in results:
                table_stats.append({
                    "schema": row.get("schemaname", ""),
                    "table": row.get("tablename", ""),
                    "live_tuples": row.get("live_tuples", 0),
                    "dead_tuples": row.get("dead_tuples", 0),
                    "last_vacuum": row.get("last_vacuum"),
                    "last_autovacuum": row.get("last_autovacuum"),
                    "last_analyze": row.get("last_analyze"),
                    "last_autoanalyze": row.get("last_autoanalyze"),
                    "total_size": row.get("total_size", ""),
                    "table_size": row.get("table_size", ""),
                    "indexes_size": row.get("indexes_size", "")
                })
            
            return table_stats
            
        except Exception as e:
            logger.error(f"表统计信息分析失败: {str(e)}")
            return []
    
    @staticmethod
    async def find_unused_indexes(
        min_scans: int = 10
    ) -> List[Dict[str, Any]]:
        """
        查找未使用的索引
        
        查找扫描次数低于阈值的索引，这些索引可能是冗余的。
        
        Args:
            min_scans: 最小扫描次数阈值，默认10次
            
        Returns:
            List[Dict[str, Any]]: 未使用的索引列表
        """
        conn = connections.get("default")
        
        query = """
            SELECT 
                schemaname,
                tablename,
                indexname,
                idx_scan as index_scans,
                pg_size_pretty(pg_relation_size(indexrelid)) as index_size
            FROM pg_stat_user_indexes
            WHERE idx_scan < %s
            ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC
        """
        
        try:
            results = await conn.execute_query_dict(query, [min_scans])
            
            unused_indexes = []
            for row in results:
                unused_indexes.append({
                    "schema": row.get("schemaname", ""),
                    "table": row.get("tablename", ""),
                    "index": row.get("indexname", ""),
                    "scans": row.get("index_scans", 0),
                    "size": row.get("index_size", "")
                })
            
            return unused_indexes
            
        except Exception as e:
            logger.error(f"未使用索引查找失败: {str(e)}")
            return []
    
    @staticmethod
    async def analyze_query_plans(
        query: str
    ) -> Dict[str, Any]:
        """
        分析查询执行计划
        
        使用 EXPLAIN ANALYZE 分析查询的执行计划。
        
        Args:
            query: SQL 查询语句
            
        Returns:
            Dict[str, Any]: 执行计划信息
        """
        conn = connections.get("default")
        
        explain_query = f"EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) {query}"
        
        try:
            # 执行 EXPLAIN ANALYZE
            results = await conn.execute_query(explain_query)
            
            # 解析执行计划
            plan_info = {
                "query": query,
                "plan": results,
                "timestamp": None
            }
            
            return plan_info
            
        except Exception as e:
            logger.error(f"查询执行计划分析失败: {str(e)}")
            return {
                "query": query,
                "error": str(e),
                "plan": None
            }