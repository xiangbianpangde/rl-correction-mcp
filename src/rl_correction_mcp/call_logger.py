"""MCP 调用记录器 - 记录工具调用日志

用于追踪 AI 对 MCP 的调用情况，便于验证和审计。
"""

from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from contextlib import contextmanager

import logging

logger = logging.getLogger(__name__)


class CallLogger:
    """MCP 调用记录器"""

    def __init__(self, db_path: Optional[str] = None):
        """初始化调用记录器

        Args:
            db_path: SQLite 数据库路径，默认 data/calls.db
        """
        if db_path is None:
            db_path = str(Path(__file__).parent.parent.parent / "data" / "calls.db")

        self.db_path = db_path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _init_db(self):
        """初始化数据库表结构"""
        with self._get_conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS mcp_calls (
                    id TEXT PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    tool_name TEXT NOT NULL,
                    parameters TEXT,  -- JSON 格式
                    result_status TEXT,  -- success / error
                    result_data TEXT,  -- JSON 格式（截断）
                    error_message TEXT,
                    related_correction_id TEXT,  -- 关联的修正对 ID
                    caller_info TEXT,  -- 调用者信息（如 session_id）
                    duration_ms INTEGER  -- 执行耗时（毫秒）
                )
            """)

            # 创建索引便于查询
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_calls_timestamp
                ON mcp_calls(timestamp)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_calls_tool
                ON mcp_calls(tool_name)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_calls_correction
                ON mcp_calls(related_correction_id)
            """)
            conn.commit()

    @contextmanager
    def _get_conn(self):
        """获取数据库连接（上下文管理器）"""
        conn = sqlite3.connect(self.db_path)
        try:
            yield conn
        finally:
            conn.close()

    def log_call(
        self,
        tool_name: str,
        parameters: dict,
        result_status: str,
        result_data: Optional[dict] = None,
        error_message: Optional[str] = None,
        related_correction_id: Optional[str] = None,
        caller_info: Optional[str] = None,
        duration_ms: Optional[int] = None,
    ) -> str:
        """记录一次 MCP 工具调用

        Args:
            tool_name: 工具名称
            parameters: 调用参数
            result_status: 结果状态 (success/error)
            result_data: 返回结果数据（会被截断存储）
            error_message: 错误信息
            related_correction_id: 关联的修正对 ID
            caller_info: 调用者信息
            duration_ms: 执行耗时（毫秒）

        Returns:
            调用记录 ID
        """
        call_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()

        # 截断结果数据（避免存储过大）
        result_str = None
        if result_data:
            result_str = json.dumps(result_data, ensure_ascii=False)
            if len(result_str) > 2000:
                result_str = result_str[:1997] + "..."

        with self._get_conn() as conn:
            conn.execute(
                """
                INSERT INTO mcp_calls
                (id, timestamp, tool_name, parameters, result_status, result_data,
                 error_message, related_correction_id, caller_info, duration_ms)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    call_id,
                    timestamp,
                    tool_name,
                    json.dumps(parameters, ensure_ascii=False),
                    result_status,
                    result_str,
                    error_message,
                    related_correction_id,
                    caller_info,
                    duration_ms,
                ),
            )
            conn.commit()

        logger.info(f"记录调用: {tool_name} ({result_status}) - {call_id[:8]}")
        return call_id

    def get_calls(
        self,
        limit: int = 50,
        offset: int = 0,
        tool_name: Optional[str] = None,
        result_status: Optional[str] = None,
        related_correction_id: Optional[str] = None,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
    ) -> dict:
        """查询调用记录

        Returns:
            {
                "total": 总记录数,
                "calls": [调用记录列表]
            }
        """
        where_clauses = []
        params = []

        if tool_name:
            where_clauses.append("tool_name = ?")
            params.append(tool_name)
        if result_status:
            where_clauses.append("result_status = ?")
            params.append(result_status)
        if related_correction_id:
            where_clauses.append("related_correction_id = ?")
            params.append(related_correction_id)
        if start_time:
            where_clauses.append("timestamp >= ?")
            params.append(start_time)
        if end_time:
            where_clauses.append("timestamp <= ?")
            params.append(end_time)

        where_sql = ""
        if where_clauses:
            where_sql = "WHERE " + " AND ".join(where_clauses)

        with self._get_conn() as conn:
            # 查询总数
            count_sql = f"SELECT COUNT(*) FROM mcp_calls {where_sql}"
            total = conn.execute(count_sql, params).fetchone()[0]

            # 查询记录
            query_sql = f"""
                SELECT * FROM mcp_calls
                {where_sql}
                ORDER BY timestamp DESC
                LIMIT ? OFFSET ?
            """
            cursor = conn.execute(query_sql, params + [limit, offset])

            calls = []
            for row in cursor.fetchall():
                calls.append({
                    "id": row[0],
                    "timestamp": row[1],
                    "tool_name": row[2],
                    "parameters": json.loads(row[3]) if row[3] else None,
                    "result_status": row[4],
                    "result_data": json.loads(row[5]) if row[5] else None,
                    "error_message": row[6],
                    "related_correction_id": row[7],
                    "caller_info": row[8],
                    "duration_ms": row[9],
                })

        return {"total": total, "calls": calls}

    def get_stats(self) -> dict:
        """获取调用统计信息"""
        with self._get_conn() as conn:
            # 总调用次数
            total = conn.execute("SELECT COUNT(*) FROM mcp_calls").fetchone()[0]

            # 成功/失败次数
            success = conn.execute(
                "SELECT COUNT(*) FROM mcp_calls WHERE result_status = 'success'"
            ).fetchone()[0]
            error = conn.execute(
                "SELECT COUNT(*) FROM mcp_calls WHERE result_status = 'error'"
            ).fetchone()[0]

            # 各工具调用次数
            tool_stats = {}
            cursor = conn.execute(
                """
                SELECT tool_name, COUNT(*) as cnt
                FROM mcp_calls
                GROUP BY tool_name
                ORDER BY cnt DESC
                """
            )
            for row in cursor.fetchall():
                tool_stats[row[0]] = row[1]

            # 今日调用次数
            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            today_calls = conn.execute(
                "SELECT COUNT(*) FROM mcp_calls WHERE timestamp LIKE ?",
                (f"{today}%",),
            ).fetchone()[0]

        return {
            "total": total,
            "success": success,
            "error": error,
            "today": today_calls,
            "by_tool": tool_stats,
        }

    def delete_old_calls(self, days: int = 30) -> int:
        """删除指定天数之前的调用记录

        Returns:
            删除的记录数
        """
        from datetime import timedelta

        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

        with self._get_conn() as conn:
            cursor = conn.execute(
                "DELETE FROM mcp_calls WHERE timestamp < ?",
                (cutoff,),
            )
            conn.commit()
            deleted = cursor.rowcount

        logger.info(f"删除 {deleted} 条 {days} 天前的调用记录")
        return deleted


# 全局调用记录器实例
_call_logger: Optional[CallLogger] = None


def get_call_logger() -> CallLogger:
    """获取全局调用记录器实例"""
    global _call_logger
    if _call_logger is None:
        _call_logger = CallLogger()
    return _call_logger
