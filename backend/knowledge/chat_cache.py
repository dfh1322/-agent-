"""对话缓存模块：基于 Redis 的会话历史管理，支持内存降级。

提供 ChatCache 类，用于在聊天会话中持久化和检索用户与助手的对话历史。
当 Redis 不可用时，自动降级为进程内字典缓存（重启后丢失）。
"""

import os
import json
import redis
from typing import List, Dict, Optional
from dotenv import load_dotenv

load_dotenv()


class ChatCache:
    """对话缓存管理器。

    核心功能：
        - 以 session_id 为维度存储每轮对话的消息历史。
        - 优先使用 Redis 做持久化缓存，带 TTL 过期策略。
        - Redis 不可用时回退到内存 dict，保证服务不中断。
        - 每条会话最多保留最近 20 条消息，防止上下文膨胀。

    Attributes:
        redis_url: Redis 连接地址，从环境变量 REDIS_URL 读取，默认 localhost:6379/0。
        ttl: 缓存过期时间（秒），从环境变量 CHAT_CACHE_TTL 读取，默认 3600 秒。
        client: Redis 客户端实例；若连接失败则为 None。
        memory_cache: 内存兜底缓存，仅在 client 为 None 时生效。
    """

    def __init__(self):
        """初始化 Redis 连接及备选内存缓存。

        启动时尝试连接 Redis：
            - 成功 → 记录日志并设置 self.client。
            - 失败 → 打印警告，self.client 置为 None，
              同时初始化 self.memory_cache 字典作为降级方案。
        """
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self.ttl = int(os.getenv("CHAT_CACHE_TTL", 3600))  # 默认1小时过期
        self.client = None

        try:
            self.client = redis.from_url(
                self.redis_url,
                decode_responses=True,
                # 兼容不支持 HELLO AUTH 的 Redis 服务（如 miniredis / 老版本），
                # 跳过 RESP3 握手，强制使用 RESP2 协议。
                protocol=2,
            )
            # 测试连接（不强制 health check，避免对老版本触发不兼容命令）
            self.client.ping()
            print(f"[OK] Redis 缓存连接成功: {self.redis_url}")
        except Exception as e:
            print(f"[WARN] Redis 连接失败，将使用内存缓存: {e}")
            self.client = None
            # 使用内存缓存作为备选方案
            self.memory_cache = {}

    def _get_key(self, session_id: str) -> str:
        """生成 Redis 缓存键。

        Args:
            session_id: 唯一会话标识符。

        Returns:
            格式化后的缓存键，例如 ``chat:session:abc123``。
        """
        return f"chat:session:{session_id}"

    def get_history(self, session_id: str) -> List[Dict[str, str]]:
        """获取指定会话的完整对话历史。

        读取流程：
            1. 若 Redis 可用 → 从 Redis 读取 JSON 字符串并反序列化。
            2. 若 Redis 不可用 → 从内存字典中查找。
            3. 均无结果时返回空列表。

        Args:
            session_id: 要查询的会话 ID。

        Returns:
            消息列表，每个元素为 ``{"role": "user"/"assistant", "content": "..."}``。
        """
        try:
            if self.client:
                key = self._get_key(session_id)
                data = self.client.get(key)
                if data:
                    return json.loads(data)
            else:
                if session_id in self.memory_cache:
                    return self.memory_cache[session_id]
        except Exception as e:
            print(f"[WARN] 获取对话历史失败: {e}")

        return []

    def add_message(self, session_id: str, role: str, content: str) -> None:
        """向指定会话追加一条新消息。

        写入流程：
            1. 先读取当前历史（通过 ``get_history``）。
            2. 追加新消息 ``{"role": role, "content": content}``。
            3. 若超过 20 条则截断，只保留最后 20 条。
            4. 根据缓存模式分别写入 Redis（SETNX + TTL）或内存字典。

        Args:
            session_id: 目标会话 ID。
            role: 消息角色，通常为 ``"user"`` 或 ``"assistant"``。
            content: 消息文本内容。
        """
        try:
            history = self.get_history(session_id)
            history.append({"role": role, "content": content})

            # 只保留最近20条消息
            if len(history) > 20:
                history = history[-20:]

            if self.client:
                key = self._get_key(session_id)
                self.client.setex(key, self.ttl, json.dumps(history))
            else:
                self.memory_cache[session_id] = history
        except Exception as e:
            print(f"[WARN] 添加消息到缓存失败: {e}")

    def clear_history(self, session_id: str) -> None:
        """清除指定会话的全部对话历史。

        根据当前使用的缓存后端执行对应的删除操作：
            - Redis → ``DELETE`` 对应 key。
            - 内存 → 从字典中 ``del`` 对应条目。

        Args:
            session_id: 要清除的会话 ID。
        """
        try:
            if self.client:
                key = self._get_key(session_id)
                self.client.delete(key)
            else:
                if session_id in self.memory_cache:
                    del self.memory_cache[session_id]
        except Exception as e:
            print(f"[WARN] 清除对话历史失败: {e}")


# 全局单例：其他模块直接导入 chat_cache 即可使用
chat_cache = ChatCache()
