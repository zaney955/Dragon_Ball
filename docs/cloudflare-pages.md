# Cloudflare Pages 配置

生产地址：<https://dragon-ball-budokai.pages.dev/>。

项目通过 Cloudflare 原生 Git 集成构建。`main` 的推送触发生产部署，其他分支推送触发预览部署。Cloudflare 从 GitHub 拉取源码、安装依赖并执行 `npm run build`，发布 `dist/`；根目录为仓库根目录。生产与预览环境都设置 `NODE_VERSION=24.13.0`。

仓库为 `zaney955/Dragon_Ball`，Cloudflare Pages 项目为 `dragon-ball-budokai`。`wrangler.jsonc` 保留纯静态输出配置，`npm run deploy:pages` 是本地手工发布入口。

## cf 管理命令

本次配置使用 `cf@1.0.0-beta.13`。`cf` 使用独立登录，不复用 Wrangler 登录。安装、登录和查询：

```sh
npm install --global cf@1.0.0-beta.13
cf auth login
cf auth whoami
cf pages get dragon-ball-budokai
```

需要手工触发一次 Git 源构建时：

```sh
cf pages deployments create dragon-ball-budokai --branch main
```

查询部署和日志时，用返回的部署 UUID 替换 `<DEPLOYMENT_ID>`：

```sh
cf pages deployments get <DEPLOYMENT_ID> --project-name dragon-ball-budokai
cf pages deployments history logs get <DEPLOYMENT_ID> --project-name dragon-ball-budokai
```

本次使用 `cf pages edit` 设置构建命令、输出目录、生产分支和两个环境的 Node.js 版本，使用 `cf pages source connect` 接入已有项目的 Git 源。后者的请求体采用 `{"type":"github","config":{...}}`，包含仓库 owner、repo_name、owner_id、repo_id 和分支控制。

当前项目未迁移为 `cloudflare.config.ts`。管理 Pages 资源使用 `cf pages ...`，网站构建使用 Vite。不要在这个 Wrangler 配置项目中运行 `cf dev`、`cf build` 或 `cf deploy`。

登录凭据只保存在 CLI 的用户配置中，不进入 Git 仓库或 Pages 构建环境。原生 Git 集成无需在 GitHub Actions 中保存 Cloudflare API Token。
