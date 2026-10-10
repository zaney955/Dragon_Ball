# 下一阶段技术方向：联机稳定性与渲染预算

研究日期：2026-10-10。范围：当前源码与官方/作者一手资料。未修改运行代码、未部署、未做公网容量或真实设备性能测试。下面的数字目标是**建议的验收门槛**，不是当前实测成绩；没有查账户套餐或剩余额度。

## 1. 当前实现决定了优化顺序

| 已由代码确认                                                  | 证据                                                                   | 对下一阶段的约束                                            |
| ------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------- |
| Three.js 固定为 0.160.0；120 Hz 战斗步进                      | `package.json`、`src/match/session.js:34`、`src/combat/fixed-step.js`  | 用 r160 源码核对 API，不把升级当优化成果                    |
| 房主模拟，客机重放实际输入；每批检查部分数值                  | `src/online/session.js:35-47,269-308`                                  | 战斗帧不是可以随便丢弃的画面快照                            |
| 一个可靠有序 DataChannel；只配置 STUN                         | `src/online/transport.js:90-103`                                       | 单流丢包可拖延后续消息；当前没有 TURN                       |
| 队列达到 65,536 字节或通道不可用，发送端该局固定走 WS         | `src/online/transport.js:132-148`                                      | 两条传输路径之间没有自动的全局顺序保证                      |
| 直连按浏览器帧发包，WS 战斗帧每 100 ms 一批；输入边沿立即发送 | `src/online/session.js:374-404`                                        | 100 ms 是批次等待，不是总延迟；降低间隔会增加 Worker 收包量 |
| 客机只预测显示位置、走路、普攻前摇；位置预测封顶 250 ms       | `src/online/presentation.js`、`src/online/session.js:183-220`          | 已有视觉预测；命中、伤害和资源确认仍需房主                  |
| 观战约 10 Hz；无观众不发；一个 DO 承担三个房间，总 64 连接    | `src/online/spectator.js:139-152`、`workers/index.js:49-50,93-109,193` | 观众数主要放大扇出工作和字节量                              |
| Worker 每连接每窗口最多 40 条消息，长度限制 49,152 个 JS 字符 | `workers/index.js:73-82`                                               | 帧、观战和控制共用额度；它不是 49,152 字节上限              |
| DPR 上限 1.65、软阴影；环境会把阴影图从初始 1024 改为 2048    | `src/render/scene.js:4-23`、`src/world/environment.js:31`              | 必须按进入场景后的实际设置测量                              |
| 本地分屏画两遍场景，第二遍暂时关闭阴影更新                    | `src/render/fight-camera.js:126-158`                                   | 默认单次 render 计数会漏掉第一遍与阴影                      |

本轮主任务另有桌面实际运行基线：M4、Chrome 155/Metal、1280×800、DPR 1，训练/CPU/本地分屏三个场景各采样 8 秒，帧间隔 P95 为 16.7–16.8 ms；15 次重开同场景 geometry 222、texture 22 没有持续增长。这只是该设备与短窗口的成绩，不能外推低端手机；手机 390×844/DPR 3 的模拟仍使用 M4 硬件。JS heap 约 126–200 MB 的周期波动也不能称为进程内存或显存泄漏。最终 draw-call 采样已经设置 `autoReset=false`，逐次 render 取差值、按动画帧间隔汇总，计入阴影与两次分屏绘制，P50 分别为 578、455、593；角色与地图不同，不能直接比较模式造成的增量。原始数据在本地 `performance/next-stage-audit/report.json`。

## 2. 第一优先级：给联机问题留下可以判断的证据

现有计数是连接/消息数；`ack.at` 与 `processing` 给出一次输入的应用往返估计，当前只用于视觉外推延迟，没有保存分布。按键静止时不持续发送，所以这个估计可能陈旧；它不能直接证明单向延迟或网络路径对称。代码来源：`transport.js` 的 `stats`、`presentation.js:20-27`。

建议先收集每局有限大小的诊断环形缓冲：传输模式与切换原因、包大小、收包间隔、帧 seq、DC/WS 排队字节、输入到预显示时间、输入到房主确认时间、预测位置与权威位置的校正距离。优先复用已有回执。开发诊断中每秒采样 `getStats()` 的候选对与 `currentRoundTripTime`，但该字段来自 ICE 连通性检查，不能当作战斗输入响应时间；不存在时记录缺失。标准来源：[W3C WebRTC Statistics](https://www.w3.org/TR/webrtc-stats/#rtcicecandidatepairstats-dict)。

**验收建议：**直连/中继各录 10 局，在固定动作脚本下覆盖正常网络、单向 75 ms 延迟、±30 ms 抖动、1% 丢包、短时带宽收缩；报告 P50/P95/P99 而不是一个平均值。先在隔离测试环境验证注入工具确实影响对应传输，现有通过延迟回调制造的 150 ms 测试只能证明该模拟条件下的视觉响应。连续 30 分钟无意外退局、动作重复或资源差异；显示响应 P95 ≤ 50 ms 是候选目标，权威确认另列、不要求突破网络传播时间。

## 3. DataChannel：保持可靠帧流，先补切换交接

标准允许有序/无序与可靠/部分可靠组合，可靠性和顺序是不同设置。当前只设 `ordered:true`，没有设置重传次数/生命周期限制，属于可靠有序。资料：[W3C DataChannel](https://www.w3.org/TR/webrtc/#rtcdatachannel)、[RFC 8831 §5、§6.6](https://www.rfc-editor.org/rfc/rfc8831.html#section-6.6)。

**当前取舍：**`session.js` 收到跳号立即结束对局，因此直接改 `ordered:false` 或 `maxRetransmits:0` 会破坏重放前提。有序消息的前一条尚未可交付时，后续不能交付；这类队头等待在本项目是否已成为主要延迟来源仍须丢包实测。分多个 SCTP 流也不等于独立带宽，RFC 明确同一 association 共享拥塞窗口；大消息在没有消息交错支持时还可能占住 association。

**更紧迫的源码风险，尚未复现：**房主已把 seq N 放进 DC 队列，随后 seq N+1 经 WS 到达更快，客机就可能判跳号退局。单侧 `forceRelay=true` 只保证后续从该发送端选一条路径，不能排空在途 DC 包；对端也不知道切换边界。当前输入没有独立 input/action 序号，后续若补重传，还必须避免普攻/技能执行两次。

下一项实施宜做传输 epoch + 双方切换确认 + 最后连续收到的帧序号 + 有界补发/重排队列；仍不恢复一致时明确结束对局。不要通过忽略跳号来掩盖缺帧。控制和动作保持可靠，只有在新增独立序号、旧包拒收、动作可靠确认之后，才试验把可覆盖的 held/yaw 单独送另一通道；松键丢失也必须能靠后续完整状态或确认恢复。

**验收建议：**故意让 seq N 的 DC 到达晚于 WS 的 N+1；连续触发 100 次切换，零错误顺序退局、零重复动作，连续状态校验一致；记录恢复所需时间。每条路径关闭、send 抛错、只一方掉线均能得到明确结果。

## 4. 抖动与背压：不丢战斗帧，限制等待时间

现有 64 KiB 阈值检查的是调用前排队字节，不是传输成功回执；下一条包本身仍可能越过阈值。WS 发送没有排队量判断；`pendingFrames` 到 30 的保护不等于浏览器网络队列有界，发送失败时帧已从数组取走。资料：[W3C bufferedAmount / bufferedamountlow / send](https://www.w3.org/TR/webrtc/#dom-rtcdatachannel-bufferedamount)、源码 `transport.js:67-74,132-148`、`session.js:375-387,490-508`。

建议记录队列高水位和超过阈值持续时间，使用低水位事件恢复发送，明确 send 成功前后的包所有权；战斗输入日志必须保留到确认，可合并 held 状态但不可丢动作。观战快照可以采用最新状态覆盖，因为观众不重放战斗。先实验按队列**时间预算**控制，而不是把 64 KiB 改成另一个常数；字节阈值不能跨带宽表达固定延迟。

对客机重放加大缓存会增加确认延迟；优先改善收包后的有界重放工作量与显示外推。远端显示/观战可实验随抖动调整的小插值窗口，本地玩家视觉预测继续立即响应。作者讨论了缓冲时延与追帧预算的取舍：[Glenn Fiedler, Deterministic Lockstep](https://gafferongames.com/post/deterministic_lockstep/)。

**验收建议：**带宽收缩 5 秒后恢复，内存与队列不能持续增长；恢复后 2 秒内回到基线队列，或明确结束对局；接收侧每次重放耗时单列 P95，不能因追帧造成持续长任务。批次调整前后同时比较确认 P95、校正 P95、Worker 收包量和退局率。

## 5. Full rollback：作为小原型，不列为立即改造

GGPO 的前提是确定性模拟、保存/恢复完整状态、按输入逐帧重跑，并隔离回滚期间的显示和声音副作用。[GGPO 作者文档](https://github.com/pond3r/ggpo/blob/master/doc/README.md)。

当前已有固定步长、种子和重放输入，适合开始研究；但 `checkpoint()` 只比较部分字段，没有完整可恢复状态。观战快照是展示格式，不是 rollback save state。投射物、技能冷却/形态、hitstop、输入缓冲、地图破坏与仙豆、随机数状态、胜负流程都需要列入完整边界。当前粒子/碎屑使用 `Math.random()`，多数属于显示；不能仅凭搜索到随机函数就断定战斗不确定，也不能让回滚重复生成音效与碎屑。固定步长通过测试也不足以证明各浏览器全部角色的完整状态确定性。

**原型门槛：**先选一个普通角色、单一无道具舞台，建立纯模拟 save/load 和完整状态 hash；固定输入运行 10,000 tick，每 30 tick 回滚 12 tick 再重跑，恢复后 hash 全部一致。再扩到 30 tick（120 Hz 下 250 ms）的窗口，量出 30 tick 重算 P95 与快照大小，在目标低端手机上不超过约定的渲染预算。跨 Chrome/Safari/Firefox 各自重放并核对完整状态；声音/命中特效同一事件只触发一次。未过这些门槛前沿用现有房主权威与视觉预测。

rollback 也不会自动增加防作弊能力；决定采用对等回滚还是房主保留最终裁决，是游戏规则与联网协议选择，不能从 GGPO API 直接推出。

## 6. 观战与 DO：费用看入站，容量看扇出

当前官方表列 DO Free 计算请求 100,000/日、时长 13,000 GB-s/日；WebSocket 入站消息按 20:1 计算请求计费，出站消息不计请求费，连接建立计请求。实际消息指标仍是原始数量；休眠/auto-response 可减少活跃时长。这些是公开规则，不代表本账户剩余额度。[DO 定价](https://developers.cloudflare.com/durable-objects/platform/pricing/)、[WebSocket 休眠](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)。

**针对当前源码的估算，不是账单：**一个有观众的房间 10 Hz 上传，一小时约 36,000 入站消息，对应约 1,800 请求计费单位，加连接与控制。增加观众主要增加出站次数、序列化与传输字节，不是把 1,800 按观众人数乘。中继战斗另外计入站；客机发送率随动作变化，不能只按 10 Hz 房主帧计算。若 DO 全天持续活跃，按官方分配 128 MB 粗算约 1.1 万 GB-s；三个房间共享一个 DO，不能乘三。账户其他对象、Worker/Pages 路由用量仍需另外核对。

当前 `send()` 每个观众都 `JSON.stringify` 一遍；适合先把同一快照编码一次再广播。若平均编码后快照 B 字节，某房间 S 个观众，出站量约 `10 × S × B` 字节/秒。例：B=20 KiB、S=20 时约 3.9 MiB/秒，只是模型输入，B 须实测。六个选手在线时总 64 连接只剩最多 58 个观众/大厅访客；不是每房间 64 个观众。

限流预算也要按连接相加：中继房主约 10 Hz 战斗帧 + 10 Hz 观战，再加控制；降低战斗批次到 33 ms 可能用掉约 30+10 条/秒，尚未计控制就触及现有 40/s 上限。当前上限是应用保护，不是平台并发极限。[DO 平台限制](https://developers.cloudflare.com/durable-objects/platform/limits/)。

**验收建议：**本地隔离 workerd 测 0/1/10/20/58 观众，记录 B 的 P50/P95、编码与广播耗时、选手确认延迟、错误/关闭码；覆盖最大形态、投射物、地图破坏。候选门槛：观战 10 Hz 时扇出处理 P95 ≤ 5 ms，加入观众后选手确认 P95 增量 ≤ 10 ms，正常输入无 1008/1009 断开；0 观众时确实零观战上传。这些本地结果不能替代 Cloudflare 真实 CPU、账单或跨地域延迟。现有三房间规模先量化，超过实测瓶颈再考虑按房间分 DO。

## 7. Three 性能：先准确数，再改重复对象

r160 的 `renderer.info` 提供 draw calls、三角形与 geometry/texture 数量，后两项不是 GPU 字节或整页内存。[r160 WebGLInfo](https://github.com/mrdoob/three.js/blob/r160/src/renderers/webgl/WebGLInfo.js)。该版本默认在 render 中阴影绘制后 reset，分屏第二次 render 又 reset：直接读末次结果会少算。诊断应 `info.autoReset=false`，浏览器帧开始 reset，一次/两次场景绘制结束后采样；用实际 CPU/GPU/帧间隔补足计数。[r160 WebGLRenderer](https://github.com/mrdoob/three.js/blob/r160/src/renderers/WebGLRenderer.js)。

当前已有合批：`batchDecoration` 按材质合并几何；`artBatchCharacter` 保留动画骨和武器插槽，把刚性视觉子物件共享材质后合批。证据：`src/art/original-refinement.js:616-660`、`src/art/resources.js:31-57`。下一阶段不能把「开始合批」写成新成果，也不宜无条件重做所有静态物件。

当前粒子最多约 180 项，碎屑最多受 160 项预算约束，但很多仍是独立 Mesh/Material；没有检索到项目使用 `InstancedMesh`。第一候选是合批范围外的同材质火花、同类碎屑：池化几何/材质、再试 instancing；重复静态物件只有实测仍为热点时再研究。每实例矩阵与颜色可由 r160 支持；它并不减少三角形或透明 overdraw。[r160 InstancedMesh](https://github.com/mrdoob/three.js/blob/r160/src/objects/InstancedMesh.js)。不同粒子寿命/透明度可能需要实例属性和 shader；透明排序、双面、阴影、多材质分组仍要实测，不能承诺整场景只剩一个 draw call。角色独立骨架/部件不适合为了指标贸然实例化。

还有一个协议约束：观战 `spectator.js:68-86` 按独立 Mesh 提取几何与 transform，没有读实例矩阵。把技能/粒子合成 InstancedMesh 会令观众漏画实例，必须保留展示快照格式或同步支持实例导出。静态共享舞台物件可先做最小试验。

**验收建议：**在同设备、分辨率、镜头、种子、动作下比较单画面/本地分屏/观战；包含静止、180 粒子、破坏、双方终极技，预热后连续测 60 秒。候选目标：特效峰值 draw calls 降低 ≥30%，目标手机帧间隔 P95 ≤20 ms；10 次进退舞台后 geometry/texture 数量回到预热基线附近且不单调增长。截图验证阴影、透明叠加与全部观战形态；若 calls 降了但 GPU 时长无改善，则回到 overdraw/像素成本分析。DPR、阴影分辨率调整须作为用户可选画质档，不能默认损失画质换成绩。

## 8. WebGL context loss：已有 renderer 恢复，补游戏语义

Three r160 已注册 lost/restored 监听，丢失时停止 render、恢复时重建 GL 内部状态；不能说当前完全没有恢复。项目层没有检索到恢复提示或联机生命周期处理，战斗 requestAnimationFrame 循环仍可能推进。[r160 WebGLRenderer](https://github.com/mrdoob/three.js/blob/r160/src/renderers/WebGLRenderer.js)、[Khronos WebGL context events](https://registry.khronos.org/webgl/specs/latest/1.0/#5.15.2)。

建议增加清楚的恢复提示和玩法策略：本地可暂停并恢复，联机先释放输入并通知/有界等待，不能单独冻结房主后让客机继续等，也不能让玩家黑屏继续挨打。恢复是否成功与多久恢复由浏览器决定，超时提供重新进入。用 `WEBGL_lose_context` 模拟 GPU 资源真正失效，等待 restored 事件，不能只人工派发 DOM 事件。[Khronos lose-context 扩展](https://registry.khronos.org/webgl/extensions/WEBGL_lose_context/)。

**验收建议：**菜单、本地战斗、房主、客机、观战分别注入失效/恢复 10 次；恢复后画面、阴影、HUD、控制一致，单一循环/连接，没有重复事件；无法恢复时能退出并清理房间。再用真实手机切后台/锁屏返回测 10 次，因为模拟扩展不证明真实设备恢复体验。

## 建议实施次序

1. 诊断采样与可复现网络/渲染基线；保存一局记录与对比图。
2. 跨 DC/WS 切换交接、send 错误与背压、限流共同预算；保持原战斗权威。
3. 确认热点后做一次编码观战广播、重复特效池化/instancing，补 context-loss 游戏流程。
4. 用单角色 rollback 原型检验完整状态与低端设备预算；根据实测收益决定扩大，和内容制作分别排期。

不建议仅因官方最新版可用就升级 Three 或重写联机。真正的阶段成果应是一组相同场景下的可复查改善，以及朋友能连续完成对局、观众能看完整特效的体验。
