"""
日志工具模块

配置 loguru 日志系统
"""

import sys
from pathlib import Path

from loguru import logger

from soil.config.platform_config import platform_settings as settings


def setup_logger() -> None:
    """
    配置 loguru 日志系统

    设置日志格式、日志级别、日志文件等
    """
    # 移除默认处理器
    logger.remove()

    # 控制台输出（开发环境）
    logger.add(
        sys.stdout,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        level=settings.LOG_LEVEL,
        colorize=True,
    )

    # 文件输出（生产环境）
    log_file = Path(settings.LOG_FILE)
    log_file.parent.mkdir(parents=True, exist_ok=True)

    logger.add(
        log_file,
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
        level=settings.LOG_LEVEL,
        rotation="10 MB",  # 日志文件大小达到 10MB 时轮转
        retention="30 days",  # 保留 30 天的日志
        compression="zip",  # 压缩旧日志
        encoding="utf-8",
    )

    logger.info("日志系统初始化完成")


# 初始化日志系统
setup_logger()
