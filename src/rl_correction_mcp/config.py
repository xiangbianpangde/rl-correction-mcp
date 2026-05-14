"""配置管理 - 从环境变量读取配置"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# 加载 .env 文件（从项目根目录或当前工作目录）
for env_path in [
    Path(__file__).resolve().parent.parent.parent / ".env",  # 项目根目录
    Path.cwd() / ".env",  # 当前工作目录
]:
    if env_path.exists():
        load_dotenv(env_path)
        break


class Config:
    """全局配置"""

    # Embedding API（兼容 OpenAI 格式的服务）
    EMBEDDING_API_KEY: str = os.getenv("EMBEDDING_API_KEY", "")
    EMBEDDING_API_BASE: str = os.getenv("EMBEDDING_API_BASE", "https://api.siliconflow.cn/v1")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "Qwen/Qwen3-Embedding-8B")

    # ChromaDB
    CHROMA_PERSIST_PATH: str = os.getenv("CHROMA_PERSIST_PATH", "./data/chroma_db")

    # MCP
    MCP_SERVER_NAME: str = os.getenv("MCP_SERVER_NAME", "rl-correction-mcp")

    # ChromaDB Collection 名称
    COLLECTION_NAME: str = "rl_corrections"

    @classmethod
    def validate(cls) -> list[str]:
        """验证配置，返回错误列表"""
        errors = []
        if not cls.EMBEDDING_API_KEY:
            errors.append("EMBEDDING_API_KEY 未设置，请在 .env 文件中配置")
        return errors
