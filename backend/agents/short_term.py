"""
短期记忆模块 (ShortTermMemory)。

记录最近几轮对话, 维持 Agent 的上下文连贯性。
同时提取用户需求关键词, 供工具路由使用。
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional


class ShortTermMemory:
    """
    短期记忆管理器。

    功能:
        1. 记录最近 N 轮对话 (默认 5 轮)
        2. 提取用户需求关键词
        3. 生成提示文本供 Agent 使用
    """

    def __init__(self, max_turns: int = 5):
        """
        初始化短期记忆。

        Args:
            max_turns: 保留的最大对话轮次数。
        """
        self.max_turns = max_turns
        self._history: List[Dict[str, str]] = []
        self._requirements: Dict[str, Any] = {}

    def update(self, user_query: str) -> None:
        """
        记录一轮用户输入。

        Args:
            user_query: 用户输入文本。
        """
        self._history.append({
            "role": "user",
            "content": user_query,
        })
        # 限制历史记录长度
        if len(self._history) > self.max_turns * 2:
            self._history = self._history[-self.max_turns * 2:]

    def add_assistant_response(self, response: str) -> None:
        """
        记录一轮助手回复。

        Args:
            response: 助手回复文本。
        """
        self._history.append({
            "role": "assistant",
            "content": response,
        })
        if len(self._history) > self.max_turns * 2:
            self._history = self._history[-self.max_turns * 2:]

    def to_prompt(self) -> str:
        """
        将短期记忆转换为提示文本。

        Returns:
            格式化的对话历史文本。
        """
        if not self._history:
            return ""

        lines = ["【近期对话记录】"]
        for entry in self._history[-self.max_turns:]:
            role_label = "用户" if entry["role"] == "user" else "助手"
            lines.append(f"{role_label}: {entry['content']}")

        return "\n".join(lines)

    def get_requirements(self) -> Dict[str, Any]:
        """
        获取提取的用户需求。

        Returns:
            需求字典, 包含城市、区域、预算、户型等字段。
        """
        return self._requirements.copy()

    def set_requirement(self, key: str, value: Any) -> None:
        """
        设置一个需求字段。

        Args:
            key: 字段名 (如 "district", "city", "budget")。
            value: 字段值。
        """
        self._requirements[key] = value

    def clear(self) -> None:
        """清空所有记忆。"""
        self._history = []
        self._requirements = {}


# 全局单例
short_term_memory = ShortTermMemory()
