# HouseCodex-Agent
管理员用户名密码：admin/admin123
HouseCodex-Agent 是一个包含 `backend` 与 `frontend` 两个子项目的房产智能咨询系统仓库。本文档补充 GitHub 上传前的安全配置、环境变量模板使用方式，以及本地开发所需的最小配置步骤。



## GitHub 安全配
- 根目录 `.gitignore` 已统一忽略环境文件、私钥证书、本地配置、日志、虚拟环境、依赖目录、构建产物、缓存文件与 IDE 配置。
- `backend/.env`、`frontend/.env`、任意目录下的 `.env.local`、`.env.production` 等本地环境文件均不会进入版本控制。
- `.env.example` 文件会被保留在仓库中，作为安全模板供团队成员复制使用。
- 根目录 `.env.example` 只做变量总览清单，程序实际读取的是 `backend/.env` 与 `frontend/.env`。

## 环境配置

### 1. 复制模板文件

Windows PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

macOS / Linux / Git Bash:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 2. 填写本地配置

- 所有真实密钥、密码、令牌、数据库连接串只允许写入 `backend/.env`，不要写回 `.env.example`。
- 前端 `VITE_*` 变量会被打包到浏览器端，只能填写公开配置，不能填写任何私钥或服务端凭证。
- 若准备提交到 GitHub，提交前只保留模板文件，确认本地运行文件仍为未跟踪或被忽略状态。

### 3. 启动顺序

```bash
# 后端
cd backend
pip install -r requirements.txt

# 前端
cd ../frontend
npm install
npm run dev
```

完成 `backend/.env` 配置后，再按各子项目的 README 或启动脚本运行服务。

## 后端变量说明

运行时文件：`backend/.env`

| 变量名 | 是否必填 | 作用 | 获取方式 / 填写要求 |
|------|------|------|------|
| `API_HOST` | 否 | 后端监听地址 | 本地开发通常填 `0.0.0.0` |
| `API_PORT` | 否 | 后端监听端口 | 本地开发通常填 `8000` |
| `HOUSE_CODEX_ENV` | 建议填写 | 后端运行模式 | 填 `development` 或 `production`；生产环境建议显式填写 `production` |
| `APP_ENV` | 否 | 兼容旧逻辑的开发模式开关 | 本地可填 `dev`；生产可填 `prod` |
| `DATABASE_URL` | 是 | MySQL 连接串 | 按 `mysql+pymysql://USER:PASSWORD@HOST:3306/DB?charset=utf8mb4` 格式填写 |
| `REDIS_URL` | 否 | Redis 连接串 | 按 `redis://HOST:6379/DB_INDEX` 格式填写；未配置或连接失败时部分功能降级到内存 |
| `CHAT_CACHE_TTL` | 否 | 对话缓存 TTL | 填整数秒，默认可用 `3600` |
| `SECRET_KEY` | 生产必填 | JWT 签名密钥 | 使用长度不少于 32 位的随机字符串，不能使用示例值 |
| `ALGORITHM` | 否 | JWT 算法 | 默认 `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 否 | 登录令牌过期时间 | 填整数分钟，例如 `30` |
| `DEFAULT_MODEL` | 否 | 默认 LLM 模型路由 | 与后端支持的模型名称保持一致，例如 `deepseek-v3` |
| `SILICONFLOW_API_KEY` | 按所选模型必填 | SiliconFlow 模型服务凭证 | 从 SiliconFlow 控制台申请；使用 SiliconFlow 模型时必须填写 |
| `SILICONFLOW_BASE_URL` | 否 | SiliconFlow API 地址 | 默认 `https://api.siliconflow.com/v1` |
| `OPENAI_API_KEY` | 按所选模型必填 | OpenAI 兼容模型服务凭证 | 从对应 OpenAI/兼容服务商控制台申请；仅在切换到该服务时填写 |
| `OPENAI_BASE_URL` | 否 | OpenAI 兼容 API 地址 | 默认 `https://api.openai.com/v1`，若使用代理或兼容服务请改为对应地址 |
| `CHROMA_DB_PATH` | 否 | 向量库持久化目录 | 本地通常可保持 `./chroma_db` |
| `RONGLIAN_ACCOUNT_SID` | 可选 | 容联云短信账号 SID | 从容联云控制台获取；本地未配置时短信功能自动走 mock |
| `RONGLIAN_AUTH_TOKEN` | 可选 | 容联云短信鉴权令牌 | 从容联云控制台获取 |
| `RONGLIAN_APP_ID` | 可选 | 容联云应用 ID | 从容联云控制台获取 |
| `RONGLIAN_BASE_URL` | 否 | 容联云 API 地址 | 默认 `https://app.cloopen.com:8883` |
| `RONGLIAN_TEMPLATE_ID` | 否 | 短信模板 ID | 填写容联云模板编号，默认示例为 `1` |
| `ADMIN_SEED_PASSWORD` | 生产必填 | 默认管理员种子账号密码 | 设置为强密码，不要与其他账户共用 |
| `LANDLORD_SEED_PASSWORD` | 生产必填 | 默认房东种子账号密码 | 设置为强密码 |
| `USER_SEED_PASSWORD` | 生产必填 | 默认普通用户种子账号密码 | 设置为强密码 |
| `SIMILARITY_THRESHOLD` | 否 | 检索相似度阈值 | 填 `0` 到 `1` 之间的小数，数值越高过滤越严格 |
| `SMS_RATE_LIMIT_PER_HOUR` | 否 | 每手机号每小时短信上限 | 填正整数，例如 `5` |
| `VERIFICATION_CODE_TTL` | 否 | 短信验证码有效期 | 填整数秒，例如 `300` |

补充说明：

- 当 `HOUSE_CODEX_ENV` 不是 `development` 时，后端会强制校验关键配置是否存在；缺失时会直接拒绝启动。
- 若 `REDIS_URL` 未配置或 Redis 不可用，聊天缓存与短信限流会退回内存实现，适合本地开发，不适合生产高可用场景。
- 若未配置容联云凭证，短信发送会进入 mock 模式，只打印验证码，不发送真实短信。

