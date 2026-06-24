"""
摘要记忆模块 (SummaryMemory)。

对长对话历史进行压缩摘要, 控制 token 用量, 防止超出 LLM 上下文窗口。
"""
from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional

from agents.llm import llm_service


class SummaryMemory:
    """
    摘要记忆管理器。

    功能:
        1. 维护对话历史 (原始消息 + 摘要)
        2. 当历史超过阈值时, 调用 LLM 生成摘要
        3. 用摘要替换早期对话, 保留最近的对话
    """

    def __init__(self, max_messages: int = 10, summary_threshold: int = 6):
        """
        初始化摘要记忆。

        Args:
            max_messages: 保留的最大消息数 (摘要 + 最近消息)。
            summary_threshold: 超过此消息数时触发摘要。
        """
        self.max_messages = max_messages
        self.summary_threshold = summary_threshold
        self._summary: str = ""
        self._recent_messages: List[Dict[str, str]] = []

    async def maybe_summarize(
        self,
        history: List[Dict[str, str]],
    ) -> List[Dict[str, str]]:
        """
        如果历史过长, 触发摘要压缩。

        Args:
            history: 完整对话历史。

        Returns:
            压缩后的消息列表 (摘要 + 最近消息)。
        """
        if len(history) <= self.summary_threshold:
            # 未达到阈值, 直接返回最近的消息
            return history[-self.max_messages:]

        # 触发摘要
        if not self._summary:
            self._summary = await self._generate_summary(history)

        # 返回摘要 + 最近的非摘要消息
        recent = history[-self.max_messages:]
        # 用摘要占位
        return [
            {"role": "system", "content": f"[对话摘要] {self._summary}"}
        ] + recent

    async def _generate_summary(
        self,
        history: List[Dict[str, str]],
    ) -> str:
        """
        调用 LLM 生成对话摘要。

        Args:
            history: 对话历史列表。

        Returns:
            对话摘要文本。
        """
        # 构建摘要提示
        user_content = "请对以下对话进行简要总结, 保留关键信息和用户需求:\n\n"
        for msg in history:
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            if role == "user":
                user_content += f"用户: {content}\n"
            elif role == "assistant":
                user_content += f"助手: {content}\n"

        messages = [
            {"role": "system", "content": "你是一个对话摘要助手。请用简洁的中文总结对话要点, 包括用户的需求、已提供的信息等。不超过200字。"},
            {"role": "user", "content": user_content},
        ]

        try:
            summary = await llm_service.chat(messages, temperature=0.3)
            return summary
        except Exception as e:
            # 摘要失败时返回空字符串, 不影响正常流程
            print(f"[WARN] 对话摘要生成失败: {e}")
            return ""

    def clear(self) -> None:
        """清空摘要和最近消息。"""
        self._summary = ""
        self._recent_messages = []
