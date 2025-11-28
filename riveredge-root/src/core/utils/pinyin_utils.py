"""
拼音工具模块

提供中文拼音首字母转换和匹配功能，支持拼音首字母模糊搜索
"""

from typing import List, Optional
import re

# 拼音首字母转换（可选依赖）
try:
    from pypinyin import pinyin, Style, lazy_pinyin
    
    def get_pinyin_initials(text: str) -> str:
        """
        获取中文文本的拼音首字母
        
        Args:
            text: 中文文本
            
        Returns:
            str: 拼音首字母字符串（如："张三" -> "ZS"）
            
        Example:
            >>> get_pinyin_initials("张三")
            'ZS'
            >>> get_pinyin_initials("测试组织")
            'CSZZ'
        """
        if not text:
            return ""
        # 提取拼音首字母，统一转换为大写
        initials = pinyin(text, style=Style.FIRST_LETTER, heteronym=False)
        return ''.join([item[0].upper() for item in initials if item])
    
    def get_pinyin_full(text: str) -> str:
        """
        获取中文文本的完整拼音
        
        Args:
            text: 中文文本
            
        Returns:
            str: 完整拼音字符串（如："张三" -> "ZHANGSAN"）
            
        Example:
            >>> get_pinyin_full("张三")
            'ZHANGSAN'
        """
        if not text:
            return ""
        # 提取完整拼音，统一转换为大写
        pinyin_list = lazy_pinyin(text)
        return ''.join([p.upper() for p in pinyin_list if p])
    
    def match_pinyin_initials(text: str, keyword: str) -> bool:
        """
        检查文本的拼音首字母是否匹配关键词
        
        Args:
            text: 要匹配的文本
            keyword: 搜索关键词（拼音首字母）
            
        Returns:
            bool: 是否匹配
            
        Example:
            >>> match_pinyin_initials("张三", "ZS")
            True
            >>> match_pinyin_initials("张三", "ZS")
            True
            >>> match_pinyin_initials("李四", "LS")
            True
        """
        if not text or not keyword:
            return False
        
        # 获取文本的拼音首字母
        text_initials = get_pinyin_initials(text)
        keyword_upper = keyword.upper()
        
        # 检查拼音首字母是否包含关键词
        return keyword_upper in text_initials
    
    def filter_by_pinyin_initials(
        items: List[any],
        keyword: str,
        field_name: str
    ) -> List[any]:
        """
        根据拼音首字母过滤列表
        
        Args:
            items: 要过滤的列表
            keyword: 搜索关键词（拼音首字母）
            field_name: 要匹配的字段名
            
        Returns:
            List[any]: 过滤后的列表
            
        Example:
            >>> items = [{"name": "张三"}, {"name": "李四"}]
            >>> filter_by_pinyin_initials(items, "ZS", "name")
            [{"name": "张三"}]
        """
        if not keyword or not items:
            return items
        
        keyword_upper = keyword.upper()
        filtered = []
        
        for item in items:
            # 获取字段值
            field_value = getattr(item, field_name, None)
            if field_value is None:
                continue
            
            # 转换为字符串
            text = str(field_value)
            
            # 检查是否匹配
            if match_pinyin_initials(text, keyword_upper):
                filtered.append(item)
        
        return filtered
    
    PYINYIN_AVAILABLE = True
    
except ImportError:
    # 如果没有安装 pypinyin，使用简单的实现（仅支持 ASCII）
    def get_pinyin_initials(text: str) -> str:
        """获取文本的首字母（降级实现，不支持中文）"""
        if not text:
            return ""
        # 简单实现：提取每个单词的首字母
        words = re.findall(r'\b\w', text)
        return ''.join([w.upper() for w in words if w])
    
    def get_pinyin_full(text: str) -> str:
        """获取文本（降级实现，不支持中文）"""
        return text.upper()
    
    def match_pinyin_initials(text: str, keyword: str) -> bool:
        """检查文本是否匹配关键词（降级实现）"""
        if not text or not keyword:
            return False
        return keyword.upper() in text.upper()
    
    def filter_by_pinyin_initials(
        items: List[any],
        keyword: str,
        field_name: str
    ) -> List[any]:
        """根据关键词过滤列表（降级实现）"""
        if not keyword or not items:
            return items
        
        keyword_upper = keyword.upper()
        filtered = []
        
        for item in items:
            field_value = getattr(item, field_name, None)
            if field_value is None:
                continue
            
            text = str(field_value)
            if keyword_upper in text.upper():
                filtered.append(item)
        
        return filtered
    
    PYINYIN_AVAILABLE = False


def is_pinyin_keyword(keyword: str) -> bool:
    """
    判断关键词是否可能是拼音首字母
    
    Args:
        keyword: 搜索关键词
        
    Returns:
        bool: 是否可能是拼音首字母
        
    Example:
        >>> is_pinyin_keyword("ZS")
        True
        >>> is_pinyin_keyword("张三")
        False
        >>> is_pinyin_keyword("test123")
        False
    """
    if not keyword:
        return False
    
    # 判断是否为全字母且长度合理（1-10 个字符）
    return keyword.isalpha() and 1 <= len(keyword) <= 10

