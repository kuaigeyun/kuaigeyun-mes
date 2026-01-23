"""
编码规则组件服务模块

提供规则组件的解析、生成、转换等功能。
支持新旧格式的相互转换，实现向后兼容。

Author: Auto-generated
Date: 2026-01-20
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
import re
from loguru import logger


class CodeRuleComponentService:
    """
    编码规则组件服务类
    
    提供规则组件的解析、生成、转换等功能。
    """
    
    @staticmethod
    def components_to_expression(components: List[Dict[str, Any]]) -> str:
        """
        将规则组件列表转换为表达式（向后兼容）
        
        Args:
            components: 规则组件列表
            
        Returns:
            str: 生成的表达式
        """
        if not components:
            return ""
        
        # 按order排序
        sorted_components = sorted(components, key=lambda x: x.get("order", 0))
        
        parts = []
        for comp in sorted_components:
            comp_type = comp.get("type")
            
            if comp_type == "auto_counter":
                digits = comp.get("digits", 5)
                if digits > 0:
                    parts.append(f"{{SEQ:{digits}}}")
                else:
                    parts.append("{SEQ}")
            
            elif comp_type == "date":
                format_type = comp.get("format_type", "preset")
                if format_type == "preset":
                    preset_format = comp.get("preset_format", "YYYYMMDD")
                    # 将预定义格式转换为表达式
                    date_map = {
                        "YYYYMMDD": "{YYYY}{MM}{DD}",
                        "YYYYMM": "{YYYY}{MM}",
                        "YYYY": "{YYYY}",
                        "YYMMDD": "{YY}{MM}{DD}",
                        "YYMM": "{YY}{MM}",
                        "YY": "{YY}",
                    }
                    parts.append(date_map.get(preset_format, "{YYYY}{MM}{DD}"))
                else:
                    custom_format = comp.get("custom_format", "yMd")
                    # 将自定义格式转换为表达式
                    # y -> YYYY, yy -> YY, M -> MM, d -> DD
                    expr = custom_format.replace("yyyy", "{YYYY}").replace("yy", "{YY}").replace("y", "{YYYY}")
                    expr = expr.replace("MM", "{MM}").replace("M", "{MM}")
                    expr = expr.replace("dd", "{DD}").replace("d", "{DD}")
                    parts.append(expr)
            
            elif comp_type == "fixed_text":
                text = comp.get("text", "")
                parts.append(text)
            
            elif comp_type == "form_field":
                field_name = comp.get("field_name", "")
                parts.append(f"{{FIELD:{field_name}}}")
        
        return "".join(parts)
    
    @staticmethod
    def expression_to_components(expression: str) -> List[Dict[str, Any]]:
        """
        将表达式解析为规则组件列表（向后兼容）
        
        Args:
            expression: 规则表达式
            
        Returns:
            List[Dict[str, Any]]: 规则组件列表
        """
        if not expression:
            return []
        
        components = []
        order = 0
        
        # 解析字段引用 {FIELD:field_name}
        field_pattern = r'\{FIELD:([^}]+)\}'
        field_matches = list(re.finditer(field_pattern, expression))
        for match in field_matches:
            field_name = match.group(1)
            components.append({
                "type": "form_field",
                "field_name": field_name,
                "order": order
            })
            order += 1
        
        # 解析日期格式
        date_patterns = [
            (r'\{YYYY\}\{MM\}\{DD\}', "YYYYMMDD"),
            (r'\{YYYY\}\{MM\}', "YYYYMM"),
            (r'\{YYYY\}', "YYYY"),
            (r'\{YY\}\{MM\}\{DD\}', "YYMMDD"),
            (r'\{YY\}\{MM\}', "YYMM"),
            (r'\{YY\}', "YY"),
        ]
        
        date_found = False
        for pattern, preset_format in date_patterns:
            if re.search(pattern, expression):
                components.append({
                    "type": "date",
                    "format_type": "preset",
                    "preset_format": preset_format,
                    "order": order
                })
                date_found = True
                order += 1
                break
        
        # 解析序号格式
        seq_pattern = r'\{SEQ(?::(\d+))?\}'
        seq_match = re.search(seq_pattern, expression)
        if seq_match:
            digits = int(seq_match.group(1)) if seq_match.group(1) else 5
            components.append({
                "type": "auto_counter",
                "digits": digits,
                "fixed_width": True,
                "reset_cycle": "never",
                "initial_value": 1,
                "order": order
            })
            order += 1
        
        # 提取固定字符（表达式中的其他文本）
        # 移除所有变量占位符，剩下的就是固定字符
        temp_expr = expression
        temp_expr = re.sub(r'\{FIELD:[^}]+\}', '', temp_expr)
        temp_expr = re.sub(r'\{Y{2,4}\}\{M{2}\}\{D{2}\}|\{Y{2,4}\}\{M{2}\}|\{Y{2,4}\}', '', temp_expr)
        temp_expr = re.sub(r'\{SEQ(?::\d+)?\}', '', temp_expr)
        temp_expr = re.sub(r'\{[^}]+\}', '', temp_expr)  # 移除其他可能的变量
        
        # 如果还有剩余字符，作为固定字符
        if temp_expr.strip():
            # 尝试分割固定字符（可能在变量前后）
            parts = re.split(r'\{[^}]+\}', expression)
            for part in parts:
                if part.strip():
                    components.append({
                        "type": "fixed_text",
                        "text": part.strip(),
                        "order": order
                    })
                    order += 1
        
        # 如果没有自动计数组件，添加一个默认的（必选）
        has_counter = any(comp.get("type") == "auto_counter" for comp in components)
        if not has_counter:
            components.append({
                "type": "auto_counter",
                "digits": 5,
                "fixed_width": True,
                "reset_cycle": "never",
                "initial_value": 1,
                "order": order
            })
        
        # 按order排序
        components.sort(key=lambda x: x.get("order", 0))
        
        return components
    
    @staticmethod
    def render_components(
        components: List[Dict[str, Any]],
        current_seq: int,
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        根据规则组件生成编码
        
        Args:
            components: 规则组件列表
            current_seq: 当前序号
            context: 上下文变量（可选，用于字段引用）
            
        Returns:
            str: 生成的编码
        """
        if not components:
            return ""
        
        # 按order排序
        sorted_components = sorted(components, key=lambda x: x.get("order", 0))
        
        parts = []
        now = datetime.now()
        
        for comp in sorted_components:
            comp_type = comp.get("type")
            
            if comp_type == "auto_counter":
                digits = comp.get("digits", 5)
                fixed_width = comp.get("fixed_width", True)
                seq_str = str(current_seq)
                
                if fixed_width and digits > 0:
                    seq_str = seq_str.zfill(digits)
                
                parts.append(seq_str)
            
            elif comp_type == "date":
                format_type = comp.get("format_type", "preset")
                if format_type == "preset":
                    preset_format = comp.get("preset_format", "YYYYMMDD")
                    # 将预定义格式转换为strftime格式
                    format_map = {
                        "YYYYMMDD": "%Y%m%d",
                        "YYYYMM": "%Y%m",
                        "YYYY": "%Y",
                        "YYMMDD": "%y%m%d",
                        "YYMM": "%y%m",
                        "YY": "%y",
                    }
                    strftime_format = format_map.get(preset_format, "%Y%m%d")
                    parts.append(now.strftime(strftime_format))
                else:
                    custom_format = comp.get("custom_format", "yMd")
                    # 将自定义格式转换为strftime格式
                    # y -> %Y, yy -> %y, M -> %m, d -> %d
                    strftime_format = custom_format.replace("yyyy", "%Y").replace("yy", "%y").replace("y", "%Y")
                    strftime_format = strftime_format.replace("MM", "%m").replace("M", "%m")
                    strftime_format = strftime_format.replace("dd", "%d").replace("d", "%d")
                    parts.append(now.strftime(strftime_format))
            
            elif comp_type == "fixed_text":
                text = comp.get("text", "")
                parts.append(text)
            
            elif comp_type == "form_field":
                field_name = comp.get("field_name", "")
                if context and field_name in context:
                    parts.append(str(context[field_name]))
                else:
                    # 字段不存在，返回占位符
                    parts.append(f"[FIELD:{field_name}]")
        
        return "".join(parts)
    
    @staticmethod
    def get_counter_component_config(components: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        从组件列表中获取自动计数组件的配置
        
        Args:
            components: 规则组件列表
            
        Returns:
            Optional[Dict[str, Any]]: 自动计数组件配置，如果不存在返回None
        """
        for comp in components:
            if comp.get("type") == "auto_counter":
                return comp
        return None
