# 龙珠 · 少年武道会

基于 Three.js 的十四角色格斗游戏。源码按角色、战斗、AI、舞台、渲染、输入和界面拆分，使用 Vite 开发和构建。

## 开始开发

需要 Node.js 22.13 或更高版本，推荐 Node.js 24。

```sh
npm ci
npm run dev
```

打开终端显示的本地地址，默认是 `http://127.0.0.1:5173`。开发源码入口是 `index.html` 和 `src/main.js`。

```sh
npm run build        # 生成 dist/ 静态网站
npm run preview      # 预览生产构建，默认端口 4173
npm run build:offline # 生成 dist/offline/龙珠_少年武道会.html
npm run clean        # 删除构建产物、测试报告与构建缓存
```

离线文件可以双击打开，无需服务器或网络。它由模块化源码构建生成，修改游戏时编辑 `src/`，不要修改导出文件。根目录的旧中文文件名保留为网站入口跳转页，开发时通过本地服务打开。

## Cloudflare Pages

线上地址：<https://dragon-ball-budokai.pages.dev/>。

网站以静态文件部署到 Cloudflare Pages，使用免费 `.pages.dev` 域名。联机大厅另用免费 Workers + Durable Objects 协调三个房间，战斗优先由浏览器直连。

已连接 GitHub 仓库 `zaney955/Dragon_Ball`。推送到 `main` 会自动构建并发布到正式地址，其他分支会生成预览部署。Cloudflare 的构建设置如下：

| 设置     | 值                            |
| -------- | ----------------------------- |
| 生产分支 | `main`                        |
| 根目录   | 仓库根目录                    |
| 构建命令 | `npm run build`               |
| 输出目录 | `dist`                        |
| Node.js  | `24.13.0`，生产与预览环境一致 |

日常更新提交并推送源码即可：

```sh
git push origin main
```

项目的 Git 源和构建设置通过 `cf` CLI 配置，管理命令见 [Pages 配置记录](docs/cloudflare-pages.md)。本地直接上传仍可用于手工发布：

```sh
npx wrangler login # 首次部署或登录过期时执行
npm run deploy:pages
```

部署命令先运行 Vite 构建，再将 `dist/` 上传到 `dragon-ball-budokai` 项目的 `main` 生产环境。Wrangler 版本已固定在开发依赖中；项目与输出目录见 `wrangler.jsonc`，登录凭据不存放在仓库中。有多个 Cloudflare 账号时，可用 `CLOUDFLARE_ACCOUNT_ID` 环境变量指定目标账号。

不要把源码目录或包含离线导出的旧构建目录手动上传；`npm run deploy:pages` 会先重新生成网站产物。

## 联机对战

首页进入「联机对战」，创建或加入三个房间之一。每房最多两名选手，双方准备后自动开战；最后一人离开后房间关闭。键盘和触屏控制自己的角色，对局结束后可返回房间重新准备。对战中的房间显示「观战」，其他玩家可随时加入、退出；镜头自动跟随双方并适应桌面和手机屏幕，观众不占选手席位。

大厅通过正式站点同域名 `/api/online` 建立一条 WebSocket，无轮询；战斗优先走 WebRTC 直连。直连不可用时沿用该连接低频中继；观战通过 WebSocket 接收房主当前画面。中继和观战会占用免费额度。具体同步、开发、测试和后端部署见 [联机说明](docs/online.md)。离线单文件保留本地玩法，联机需使用网页版。

## 目录

```text
index.html                  页面结构
src/main.js                 启动入口，按需加载验收工具
src/app/                    应用组合、运行上下文、初始化计划
src/characters/             角色定义、招式参数、骨架与模型
src/combat/                 Fighter、固定步长模拟、碰撞、气与特殊能力
src/animation/              动作关键帧、姿态插值、接触动作
src/ai/                     延迟观察、记忆与角色战术
src/world/                  舞台、光照、破坏与仙豆规则
src/render/                 场景、镜头、分屏与特效
src/audio/                  音效、全局背景音乐、独立开关与音量
src/input/                  键盘、触屏、双人输入
src/match/                  对局状态、回合与界面切换
src/ui/                     HUD、选角、招式指南、美术图鉴
src/training/               陪练、专项练习与训练工具
src/online/                 联机大厅、连接和战斗同步
src/styles/                 按原级联顺序组织的 CSS
src/assets/                 图片与保留的八首原创 MP3
src/testing/                原有游戏验收与测试接口
scripts/                    构建辅助工具
workers/                    免费联机 Worker 与房间协调对象
functions/                  同域名 WebSocket 接入
public/                     全局背景音乐及 Pages Function 路由配置
tests/                     单元测试与浏览器回归
docs/                      架构、模块接口与当前验收记录
```

详细职责、依赖、初始化约束和扩展流程见 [架构设计](docs/architecture.md)，实测结果见 [工程化验收记录](docs/refactoring-validation.md)。

## 检查与测试

```sh
npm run lint
npm run format:check
npm run architecture:check
npm run test:unit
npx playwright install chromium
npm run validate
npm run test:full
npm run test:offline
```

`validate` 执行静态检查、格式检查、源码接口文档一致性检查、单元测试、生产构建、浏览器测试及离线导出测试。`test:full` 额外跑十四角色的 196 对有序组合，覆盖 1,568 项真实碰撞与能力检查。浏览器回归包含核心 91 项、少年时期规则与全部连招段检查 66 项、旧四角色 16 项、系统 57 项和七新增角色 90 项；后续时期技能的旧断言已按新设计更新。

已经安装 Chrome 时，可使用 `PLAYWRIGHT_CHANNEL=chrome npm test`。浏览器测试针对 `dist/` 的生产构建，修改源码后先执行 `npm run build`，或直接执行 `npm run validate`。GitHub Actions 自动运行完整矩阵。

需要手工调试时通过 `?test=1` 打开游戏，在控制台使用 `window.__db`。正常启动不会注册这个测试接口，也不会下载验收脚本。

## 维护说明

Three.js 固定为原版 `0.160.0`。角色生命、速度、力量沿用现值；本轮更换独立动作、技能、形态及胜利演出。完整规则见 [14 人设计记录](docs/youth-design.md)。依赖版本及锁文件已固定，安装使用 `npm ci`。

背景音乐在首次交互后启动，首页、选角、战斗及结果页持续循环同一首全局曲目。右下角音乐开关只控制背景音乐，音效保持独立；开关和音量设置保存在本地。暂停或页面隐藏时暂停音频，恢复后继续原播放位置。原有八首原创曲目保留供手动播放与解码验收，不再随地图、危机或胜负自动切换。网页版使用本地 MP3 资源，离线导出将全部九首曲目内嵌。

角色、招式与帧数据以 `src/characters/` 的运行时定义为准，可在游戏内查看招式指南。已删除过时报告、重复 JSON/CSV 导出和被覆盖的旧实现，历史资料可从 Git 基线 `f3a1a69` 找回；范围与验证见 [项目清理记录](docs/cleanup-validation.md)。

跨模块接口变更后运行 `npm run architecture:update`，检查 `docs/module-contracts.json` 的差异，再执行验证。ESLint 会阻止新增未使用的局部变量和函数。
