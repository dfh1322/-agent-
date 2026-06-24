"""LangGraph 五节点 Agent 实现。

节点角色（依据 CLAUDE.md 5.1）：
    * RequirementAnalyst — 提取需求槽位；不推荐楼盘
    * Supervisor — 决定意图与下游路由
    * PropertyMatcher — 真实调用 ``search_properties``
    * FinanceCalculator — 真实调用 ``calculate_mortgage``
    * PolicyExpert — 真实调用 ``search_policy`` / ``search_faq``
    * FactChecker — 校验输出与工具返回是否一致

每个节点都遵循：
    1. 注入 contextvars 中的 SQLAlchemy Session；
    2. 写入 ``tool_steps``，包含工具名/参数/返回值/时间戳；
    3. 不在节点里直接做数学计算；
    4. ``langchain.agents.tool_node`` 不存在时，使用 ``RunnableLambda`` 包
       装函数，以保持 LangGraph 兼容。

入口 ``build_graph()`` 返回 ``CompiledStateGraph``。
"""
