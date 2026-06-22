import httpx
from typing import List, Dict, Optional
import asyncio
import sys

from config.config import get_env, ENV_FILE

# ============================================================================
# 模块说明
# ============================================================================
# 本模块提供大语言模型（LLM）服务的统一封装。
# 核心功能：
#   1. 通过环境变量配置 API Key 和 Base URL，支持多个模型（DeepSeek、Qwen、Kimi、OpenAI）
#   2. LLMService 类封装了完整的 LLM API 调用流程，包括凭证校验、重试机制、错误处理
#   3. 内置两种系统提示词模板：通用助手模式和房产顾问模式
#   4. build_prompt 方法自动组装包含系统提示、对话历史和数据库上下文的完整消息列表
# ============================================================================


class LLMConfigurationError(Exception):
    """当 LLM 凭证（API Key）或模型配置无效时抛出。

    例如：API Key 为空、使用了占位符值、格式不正确（不以 sk- 开头）、
    或请求返回 HTTP 401/403 错误时，均会触发此异常。
    """

    pass


class LLMServiceError(Exception):
    """当 LLM 提供商在所有重试后仍返回错误时抛出。

    通常在连续多次调用 API 失败（网络异常、服务端错误等）后触发。
    """

    pass


def _safe_print(msg: str) -> None:
    """安全打印：过滤 GBK 终端无法编码的字符（如 emoji），避免 UnicodeEncodeError。"""
    try:
        print(msg)
    except UnicodeEncodeError:
        # 过滤不可打印字符后用 UTF-8 写 stderr
        cleaned = "".join(c for c in msg if ord(c) < 65536)
        sys.stderr.buffer.write((cleaned + "\n").encode("utf-8"))

# 支持的模型配置
# 每个模型包含：内部 model_id（传给 API 的实际模型名）、
# API Key 所在的环境变量名、Base URL 环境变量名、默认 URL、描述信息
MODEL_CONFIGS = {
    "deepseek-v3": {
        "model_id": "deepseek-ai/DeepSeek-V3",
        "api_key_env": "SILICONFLOW_API_KEY",
        "base_url_env": "SILICONFLOW_BASE_URL",
        "default_base_url": "https://api.siliconflow.com/v1",
        "description": "DeepSeek V3 (SiliconFlow)"
    },
    "deepseek-v3.1": {
        "model_id": "deepseek-ai/DeepSeek-V3.1",
        "api_key_env": "SILICONFLOW_API_KEY",
        "base_url_env": "SILICONFLOW_BASE_URL",
        "default_base_url": "https://api.siliconflow.com/v1",
        "description": "DeepSeek V3.1 (SiliconFlow)"
    },
    "deepseek-v3.2": {
        "model_id": "deepseek-ai/DeepSeek-V3.2",
        "api_key_env": "SILICONFLOW_API_KEY",
        "base_url_env": "SILICONFLOW_BASE_URL",
        "default_base_url": "https://api.siliconflow.com/v1",
        "description": "DeepSeek V3.2 (SiliconFlow)"
    },
    "deepseek-r1": {
        "model_id": "deepseek-ai/DeepSeek-R1",
        "api_key_env": "SILICONFLOW_API_KEY",
        "base_url_env": "SILICONFLOW_BASE_URL",
        "default_base_url": "https://api.siliconflow.com/v1",
        "description": "DeepSeek R1 (SiliconFlow)"
    },
    "deepseek-v4-flash": {
        "model_id": "deepseek-ai/DeepSeek-V4-Flash",
        "api_key_env": "SILICONFLOW_API_KEY",
        "base_url_env": "SILICONFLOW_BASE_URL",
        "default_base_url": "https://api.siliconflow.com/v1",
        "description": "DeepSeek V4 Flash (SiliconFlow)"
    },
    "deepseek-v4-pro": {
        "model_id": "deepseek-ai/DeepSeek-V4-Pro",
        "api_key_env": "SILICONFLOW_API_KEY",
        "base_url_env": "SILICONFLOW_BASE_URL",
        "default_base_url": "https://api.siliconflow.com/v1",
        "description": "DeepSeek V4 Pro (SiliconFlow)"
    },
    "qwen2.5-7b": {
        "model_id": "Qwen/Qwen2.5-7B-Instruct",
        "api_key_env": "SILICONFLOW_API_KEY",
        "base_url_env": "SILICONFLOW_BASE_URL",
        "default_base_url": "https://api.siliconflow.com/v1",
        "description": "Qwen 2.5 7B (SiliconFlow)"
    },
    "qwen2.5-14b": {
        "model_id": "Qwen/Qwen2.5-14B-Instruct",
        "api_key_env": "SILICONFLOW_API_KEY",
        "base_url_env": "SILICONFLOW_BASE_URL",
        "default_base_url": "https://api.siliconflow.com/v1",
        "description": "Qwen 2.5 14B (SiliconFlow)"
    },
    "qwen2.5-32b": {
        "model_id": "Qwen/Qwen2.5-32B-Instruct",
        "api_key_env": "SILICONFLOW_API_KEY",
        "base_url_env": "SILICONFLOW_BASE_URL",
        "default_base_url": "https://api.siliconflow.com/v1",
        "description": "Qwen 2.5 32B (SiliconFlow)"
    },
    "qwen2.5-72b": {
        "model_id": "Qwen/Qwen2.5-72B-Instruct",
        "api_key_env": "SILICONFLOW_API_KEY",
        "base_url_env": "SILICONFLOW_BASE_URL",
        "default_base_url": "https://api.siliconflow.com/v1",
        "description": "Qwen 2.5 72B (SiliconFlow)"
    },
    "qwen3-8b": {
        "model_id": "Qwen/Qwen3-8B",
        "api_key_env": "SILICONFLOW_API_KEY",
        "base_url_env": "SILICONFLOW_BASE_URL",
        "default_base_url": "https://api.siliconflow.com/v1",
        "description": "Qwen 3 8B (SiliconFlow)"
    },
    "qwen3-32b": {
        "model_id": "Qwen/Qwen3-32B",
        "api_key_env": "SILICONFLOW_API_KEY",
        "base_url_env": "SILICONFLOW_BASE_URL",
        "default_base_url": "https://api.siliconflow.com/v1",
        "description": "Qwen 3 32B (SiliconFlow)"
    },
    "kimi-k2.5": {
        "model_id": "moonshotai/Kimi-K2.5",
        "api_key_env": "SILICONFLOW_API_KEY",
        "base_url_env": "SILICONFLOW_BASE_URL",
        "default_base_url": "https://api.siliconflow.com/v1",
        "description": "Kimi K2.5 (SiliconFlow)"
    },
    "openai": {
        "model_id": "gpt-4",
        "api_key_env": "OPENAI_API_KEY",
        "base_url_env": "OPENAI_BASE_URL",
        "default_base_url": "https://api.openai.com/v1",
        "description": "OpenAI GPT-4"
    }
}


class LLMService:
    """大语言模型服务类 - 支持多模型切换与统一调用。

    该类封装了与 LLM API 交互的完整流程：
      - 从环境变量读取 API Key 和 Base URL
      - 校验凭证有效性（非空、非占位符、正确格式）
      - 通过 httpx 异步发送 POST 请求到 /chat/completions 端点
      - 内置最多 3 次重试机制，每次间隔 2 秒
      - 区分配置错误（401/403）和服务端错误，分别抛出不同异常

    支持的模型类别：
      - DeepSeek 系列（v3, v3.1, v3.2, r1, v4-flash, v4-pro）
      - Qwen 系列（2.5-7B/14B/32B/72B, 3-8B/32B）
      - Kimi K2.5
      - OpenAI GPT-4
    """

    def __init__(self, model_name: Optional[str] = None):
        """初始化 LLM 服务实例。

        根据传入的模型名称（或环境变量 DEFAULT_MODEL，默认 deepseek-v3）
        加载对应的 API 凭证并存储为实例属性。

        Args:
            model_name: 模型标识名，如 "deepseek-v3"、"qwen2.5-72b"、"openai" 等。
                        如果为 None，则从环境变量 DEFAULT_MODEL 读取，默认为 "deepseek-v3"。
        """
        # 优先使用显式传入的模型名，否则读环境变量，再否则 fallback 到 deepseek-v3
        self.model_name = model_name or get_env("DEFAULT_MODEL", "deepseek-v3")
        # 加载该模型对应的 API 凭证和配置
        self._load_model_config()

    @staticmethod
    def _resolve_model_credentials(model_name: str) -> Dict[str, str]:
        """根据模型名称解析出对应的 API 凭证信息。

        这是一个纯函数，不修改任何实例状态。它从 MODEL_CONFIGS 字典中查找
        指定模型的配置，然后从环境变量中读取 API Key 和 Base URL。

        Args:
            model_name: 模型标识名，必须在 MODEL_CONFIGS 的键中存在。

        Returns:
            包含以下字段的字典：
              - model_id: 实际传给 API 的模型 ID（如 "deepseek-ai/DeepSeek-V3"）
              - api_key: 从环境变量读取的 API Key 字符串
              - api_key_env: API Key 所在的环境变量名
              - base_url: 从环境变量或默认值解析出的 API 基础 URL
              - description: 人类可读的模型描述

        Raises:
            ValueError: 当 model_name 不在 MODEL_CONFIGS 中时抛出。
        """
        # 第一步：校验模型名称是否在支持的列表中
        if model_name not in MODEL_CONFIGS:
            raise ValueError(f"不支持的模型: {model_name}，可选模型: {list(MODEL_CONFIGS.keys())}")

        config = MODEL_CONFIGS[model_name]
        # 从配置中提取环境变量名，然后通过 get_env 读取实际值
        api_key_env = config["api_key_env"]
        api_key = get_env(api_key_env)
        # Base URL：优先使用环境变量覆盖，不存在则使用默认值
        base_url = get_env(config["base_url_env"], config["default_base_url"])

        return {
            "model_id": config["model_id"],
            "api_key": api_key,
            "api_key_env": api_key_env,
            "base_url": base_url,
            "description": config["description"],
        }

    @staticmethod
    def _validate_api_key(api_key: Optional[str], api_key_env: str) -> str:
        """验证 API Key 是否有效且不为占位符。

        检查逻辑：
          1. Key 不能为空
          2. Key 不能是代码中预设的常见占位符值
          3. Key 必须以 "sk-" 开头（SiliconFlow 的规范格式）

        Args:
            api_key: 从环境变量读取到的 API Key 字符串。
            api_key_env: 对应的环境变量名（用于错误提示）。

        Returns:
            验证通过后的 api_key 原值。

        Raises:
            LLMConfigurationError: 当 Key 为空、是占位符或格式不正确时抛出。
        """
        # 常见的占位符值，用户可能忘记替换.env 文件中的示例值
        placeholder_values = {
            "",
            "your-siliconflow-api-key-here",
            "your-openai-api-key-here",
            "sk-your-api-key-here",
        }

        # 检查 Key 是否为空或是占位符
        if not api_key or api_key in placeholder_values:
            raise LLMConfigurationError(
                f"未配置有效的 {api_key_env}。"
                f"请在 {ENV_FILE} 中设置从 SiliconFlow 控制台获取的 API Key："
                "https://cloud.siliconflow.cn/account/ak"
            )

        # SiliconFlow 的 API Key 标准格式以 "sk-" 开头
        if not api_key.startswith("sk-"):
            raise LLMConfigurationError(
                f"{api_key_env} 格式不正确，SiliconFlow API Key 通常以 sk- 开头。"
            )

        return api_key

    def _load_model_config(self):
        """加载当前模型的完整配置并缓存到实例属性上。

        调用流程：
          1. 通过 _resolve_model_credentials 获取凭证字典
          2. 将 model_id、api_key、base_url 等解包为实例属性
          3. 打印确认信息

        这些实例属性会在 chat() 方法中被复用，避免每次调用都重复解析。
        """
        credentials = self._resolve_model_credentials(self.model_name)
        self.model_id = credentials["model_id"]
        self.api_key = credentials["api_key"]
        self.api_key_env = credentials["api_key_env"]
        self.base_url = credentials["base_url"]
        self.description = credentials["description"]

        print(f"[OK] 使用模型: {self.description}")

    def set_model(self, model_name: str):
        """动态切换到另一个模型。

        更新 self.model_name 并重新调用 _load_model_config() 来刷新
        所有相关的凭证属性（model_id、api_key、base_url 等）。

        Args:
            model_name: 目标模型的标识名。
        """
        self.model_name = model_name
        self._load_model_config()

    @staticmethod
    def get_available_models() -> List[Dict[str, str]]:
        """获取所有可用模型的简要信息列表。

        Returns:
            字典列表，每个字典包含 name、description、model_id 三个字段，
            对应 MODEL_CONFIGS 中每个模型的核心信息。
        """
        return [
            {
                "name": name,
                "description": config["description"],
                "model_id": config["model_id"]
            }
            for name, config in MODEL_CONFIGS.items()
        ]

    async def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2000,
        model_name: Optional[str] = None
    ) -> str:
        """异步调用 LLM API 进行对话并返回模型回复。

        这是核心方法，实现了完整的 API 调用流程：
          1. 确定要使用的模型（优先使用传入的 model_name，否则用实例默认模型）
          2. 解析并验证 API 凭证
          3. 构造请求 URL、Headers 和 JSON Body
          4. 使用 httpx.AsyncClient 发送 POST 请求
          5. 处理响应：成功时提取 content，失败时根据状态码分类处理
          6. 内置重试机制：最多重试 3 次，每次间隔 2 秒

        Args:
            messages: 对话消息列表，格式遵循 OpenAI Chat Completions API 规范：
                      [{"role": "system"/"user"/"assistant", "content": "..."}, ...]
            temperature: 采样温度，范围 0~2。越高越随机，越低越确定。默认 0.7。
            max_tokens: 模型单次回复的最大 token 数。默认 2000。
            model_name: 可选参数，临时指定本次调用使用的模型。
                        如果指定了不存在的模型名，会回退到 self.model_name。

        Returns:
            模型回复的内容字符串（即 choices[0].message.content）。

        Raises:
            LLMConfigurationError: API Key 无效或无权限访问模型时抛出。
            LLMServiceError: 所有重试次数耗尽后仍未成功时抛出。
        """
        # 确定本次请求实际使用的模型名
        active_model = model_name if model_name and model_name in MODEL_CONFIGS else self.model_name
        # 解析该模型的 API 凭证
        credentials = self._resolve_model_credentials(active_model)
        # 校验 API Key 的有效性（非空、非占位符、格式正确）
        api_key = self._validate_api_key(credentials["api_key"], credentials["api_key_env"])
        # 拼接完整的 API 端点 URL（去掉末尾斜杠避免重复）
        base_url = credentials["base_url"].rstrip("/")
        model_id = credentials["model_id"]
        description = credentials["description"]

        url = f"{base_url}/chat/completions"

        # 构造请求头：Bearer Token 认证 + JSON 内容类型
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        # 构造请求体：遵循 OpenAI Chat Completions API 格式
        data = {
            "model": model_id,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        # 重试机制：最多尝试 3 次，记录最后一次错误以便抛出详细异常
        max_retries = 3
        last_error: Optional[str] = None

        for attempt in range(max_retries):
            try:
                _safe_print(f"[LLM] 调用 {description} (尝试 {attempt + 1}/{max_retries})")
                _safe_print(f"[LLM] API URL: {url}")

                # 使用 httpx 异步客户端发起 POST 请求，超时 60 秒
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(url, json=data, headers=headers)
                    _safe_print(f"[LLM] 响应状态码: {response.status_code}")

                    # --- 错误码分类处理 ---

                    # HTTP 401：API Key 无效、已过期或被撤销
                    if response.status_code == 401:
                        raise LLMConfigurationError(
                            f"{credentials['api_key_env']} 无效或已过期。"
                            "请在 SiliconFlow 控制台重新生成 API Key 并更新 .env："
                            "https://cloud.siliconflow.cn/account/ak"
                        )

                    # HTTP 403：API Key 无权访问该模型（可能是余额不足或未开通）
                    if response.status_code == 403:
                        raise LLMConfigurationError(
                            f"当前 API Key 无权访问模型 {model_id}，请检查 SiliconFlow 账户余额与模型权限。"
                        )

                    # HTTP 非 200：其他服务端错误或客户端错误
                    if response.status_code != 200:
                        error_text = response.text.strip() or response.reason_phrase
                        _safe_print(f"[LLM] 错误响应: {error_text}")
                        last_error = f"HTTP {response.status_code}: {error_text}"
                        response.raise_for_status()

                    # --- 成功响应处理 ---
                    result = response.json()
                    _safe_print("[LLM] 调用成功!")
                    # 按 OpenAI API 响应格式提取第一条 choice 的 assistant 回复内容
                    return result["choices"][0]["message"]["content"]

            # 配置错误和服务错误直接向上抛出，不需要重试
            except (LLMConfigurationError, LLMServiceError):
                raise
            # 网络连接错误（DNS 解析失败、连接被拒绝等），这类错误可以重试
            except httpx.ConnectError as e:
                last_error = f"无法连接到 SiliconFlow API ({url}): {e}"
                _safe_print(f"[LLM] 连接错误 (尝试 {attempt + 1}): {last_error}")
            # HTTP 级别错误（非 200/401/403 的响应），这类错误也可以重试
            except httpx.HTTPStatusError as e:
                last_error = f"HTTP {e.response.status_code}: {e.response.text.strip()}"
                _safe_print(f"[LLM] HTTP错误 (尝试 {attempt + 1}): {last_error}")
            # 其他未知异常，记录错误信息后继续重试
            except Exception as e:
                last_error = f"{type(e).__name__}: {e}"
                _safe_print(f"[LLM] 未知错误 (尝试 {attempt + 1}): {last_error}")

            # 如果不是最后一次尝试，等待 2 秒后重试
            if attempt < max_retries - 1:
                await asyncio.sleep(2)

        # 所有重试均失败，抛出携带最后一次错误信息的异常
        raise LLMServiceError(
            last_error or "大模型服务暂时不可用，请稍后重试。"
        )

    # ==========================================================================
    # 系统提示词模板
    # ==========================================================================

    GENERAL_SYSTEM_PROMPT = """你是一个友好、博学的 AI 助手。

你可以自然地回答用户的各类问题，包括但不限于生活、学习、工作、科技、文化等话题。
如果用户主动咨询房产、购房、贷款、政策等相关问题，你可以提供专业、客观的建议。
回答应简洁清晰、准确友好；不确定时请如实说明，不要编造事实。
闲聊时保持自然，不要强行推销或引导话题。

请用中文回复，语气自然。"""

    # 房产顾问模式的系统提示词，定义了"房产小智"的角色和行为边界：
    #   - 核心职责：解答购房/贷款/政策/税费/选房问题，基于数据库推荐楼盘
    #   - 关键约束：未获取到城市/预算等关键信息时不推荐楼盘；不编造数据
    #   - 闲聊处理：与房产无关的话题正常交流，不强推买房
    PROPERTY_SYSTEM_PROMPT = """你是专业、友好的房产顾问，名叫"房产小智"。

你的职责：
1. 解答购房、贷款、政策、税费、选房等房产相关问题
2. 在用户条件明确时，基于数据库信息推荐合适楼盘
3. 回答简洁、专业、友好，保持对话连贯

重要规则（必须遵守）：
1. 用户未明确说出城市、区域、预算等关键信息时，不要推荐具体楼盘
2. 没有数据库楼盘数据时，不要编造楼盘名称、价格或地址
3. 用户闲聊或与房产无关时，正常聊天即可，不要强行推销或引导到买房话题，不要在每句话后加"需要了解房产吗"之类的后缀
4. 政策、FAQ 类问题优先依据提供的数据库内容回答；无相关内容时如实告知

请用中文回复，语气自然简洁。"""
    
    def build_prompt(
        self,
        user_query: str,
        db_context: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        mode: str = "general",
        extra_instruction: Optional[str] = None,
    ) -> List[Dict[str, str]]:
        """
        构建提示词
        
        Args:
            user_query: 用户问题
            db_context: 数据库上下文信息
            conversation_history: 对话历史
            mode: 聊天模式 general（自由聊天）或 property（房产顾问）
            extra_instruction: 额外指令（如意图提示）
        
        Returns:
            构建好的消息列表
        """
        if mode == "property":
            system_prompt = self.PROPERTY_SYSTEM_PROMPT
        else:
            system_prompt = self.GENERAL_SYSTEM_PROMPT

        if extra_instruction:
            system_prompt = f"{system_prompt}\n\n【当前对话提示】\n{extra_instruction}"
        
        messages = [{"role": "system", "content": system_prompt}]
        
        if conversation_history:
            messages.extend(conversation_history)
        
        user_content = user_query
        if db_context:
            user_content = f"""以下是数据库中的相关信息：

{db_context}

用户问题：{user_query}

请根据以上信息回答用户问题。若数据库中没有相关信息，请如实告知用户，不要编造。"""
        elif mode == "property":
            user_content = f"""用户问题：{user_query}

请注意：若用户想买房或找房但未提供城市/区域等关键信息，请先追问，不要直接推荐楼盘。
若提供了【实时环境信息】，可结合当前时间、天气给出更贴心的选房建议。"""
        
        messages.append({"role": "user", "content": user_content})
        
        return messages


# 全局实例 - 使用环境变量中指定的默认模型
llm_service = LLMService()
