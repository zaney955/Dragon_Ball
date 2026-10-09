# 联机对战

正式站点：https://dragon-ball-budokai.pages.dev/ 。首页进入「联机对战」，选择三个房间之一创建或加入；每房最多两人。房间内复用本地选角、选图、图鉴和招式界面；两位玩家各自选角色，双方都能选择舞台、光照、对局规则及出界判负。更换角色或共享设置会取消双方准备，服务端校验设置版本，拒绝按旧设置准备。声音和震屏属于各玩家的本地偏好。双方准备后自动连接并开战。对战为单回合，结算后返回房间重新准备。

## 房间一致性

`workers/index.js` 的一个 SQLite-backed Durable Object 协调固定的三个房间。加入、离开、准备都是无 `await` 的原子状态变化，第四个房间及第三名玩家由服务端拒绝。房主离开时，另一人接任房主并取消准备；最后一人离开时房间关闭。关闭标签页、返回首页、WebSocket 关闭均清理成员。

成员状态存于休眠 WebSocket 的 attachment，唤醒后从连接重建；不写数据库、不为房间建立定时轮询。异常断网需等服务端识别连接关闭，不能保证在设备掉线的同一瞬间清理。数据库类型用于满足免费 Durable Objects 的部署要求，当前没有 SQL 或存储读写费用来源。

## 请求与同步

- 进入大厅才建立一条 WebSocket。房间状态变化后服务端推送；等待期间无 HTTP 轮询。
- 每 45 秒一个 ping，由 WebSocket auto-response 回复，不唤醒对象。
- 两人加入后协商 WebRTC DataChannel。SDP 和 ICE 候选只在建立连接时交换，STUN 使用 Cloudflare 免费端点；未配置收费 TURN。
- 直连成功后战斗包由浏览器互传，不经过 Worker。房主每约 50 毫秒批量发送模拟帧；另一位玩家只在按住状态改变或产生动作时发送输入。
- 五秒未建立直连时，沿用已有 WebSocket 中继；模拟帧降为约 100 毫秒一批。中继消息会消耗免费额度，不能承诺无限免费使用。
- 对局由房主推进原有 120 Hz 战斗引擎，客机按相同种子、帧时间和紧凑输入重放；每批检查生命、气、坐标、状态时间及随机种子。出现丢序或偏差则退出对局，避免双方持续显示不同结果。

这是朋友间的房主权威对战，房主浏览器负责模拟，没有服务器防作弊裁判。公网延迟影响输入响应，代理、严格 NAT 或不支持 WebRTC 的浏览器会使用中继。没有创建账号、排行榜或观战系统。

## 本地开发和测试

```sh
npm run dev:online   # 联机服务，127.0.0.1:8787
npm run dev          # 网站，127.0.0.1:5173
npm run build
npm run test:online  # 真实 workerd + 两浏览器直连/中继/容量/手机入口
```

离线单文件保留本地玩法，联机需打开网页版。生产网页默认连接同域名 `wss://dragon-ball-budokai.pages.dev/api/online`，由 Pages Function 通过 Durable Object binding 直接连接现有三个房间的协调对象，浏览器不再访问 `workers.dev`。`public/_routes.json` 只将这一个路径交给 Function，其余网页资源仍走静态服务。每次进入大厅仍只建立一条 WebSocket；连接 10 秒未收到房间状态会停止等待，提供手动重试，不增加自动轮询。`VITE_ONLINE_URL` 可覆盖地址；本地由 Vite 将同域入口转发到 8787。

## 部署

前端继续由 GitHub `main` 推送触发 Pages 构建。联机 Worker 独立配置在 `workers/wrangler.jsonc`；修改后端后先执行测试，再发布：

```sh
npm run deploy:online
```

使用有 Workers Scripts 写权限的现有 Cloudflare 登录；只用于 Pages 的凭据权限不足。`cf` 用于资源与 Pages 设置，Wrangler 用于这个已配置的独立 Worker，不在未迁移的根目录调用 `cf build/deploy`。

后端只接受正式 Pages 和本项目分支预览页面的 Origin，限制消息大小与每连接发送频率。测试容量压力仅针对隔离的本地服务；设置 `ONLINE_BASE_URL` 可验证线上两人对战及手机入口。

参考：[WebSocket 休眠](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)、[Durable Objects 定价](https://developers.cloudflare.com/durable-objects/platform/pricing/)、[Cloudflare STUN](https://developers.cloudflare.com/realtime/turn/)。
