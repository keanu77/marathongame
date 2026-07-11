# 馬拉松完賽訓練

[![CI](https://github.com/keanu77/marathongame/actions/workflows/ci.yml/badge.svg)](https://github.com/keanu77/marathongame/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[立即遊玩](https://marathongame.pages.dev/) · [GitHub 原始碼](https://github.com/keanu77/marathongame) · [衛教跑酷遊戲開發指南](./衛教跑酷遊戲開發指南.md)

「馬拉松完賽訓練」是一款繁體中文 2D 橫向跑酷衛教遊戲。玩家依序通過「基礎期 → 進階期 → 正式比賽」三關，在有限時間內管理體力、受傷風險與配速，並透過跳躍避開負向事件、收集正向道具。三關合計約 80 秒；撐到終點即完賽，體力降至 0 或受傷風險達 100 則中途停止。

> 本遊戲只供娛樂與一般衛教使用。遊戲中的速度、時間、傷害、恢復與配速效果均為虛構的平衡數值，不是醫療診斷、風險預測、個人化訓練處方或治療建議。如有明顯腫脹、劇痛、持續惡化、全身不適或其他疑慮，請停止運動並尋求合格醫療專業人員評估。

## 快速開始

需要 Node.js 22 與 pnpm 10。克隆後執行：

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

然後開啟 `http://localhost:5173`。這個模式可完整學習及修改遊戲畫面，但不會寫入 Cloudflare 網路排行榜。如要一起執行 Pages Functions 與隔離的本機 D1，請參考後文的「安裝與執行」。

## 遊戲流程

一局是固定長度的三關挑戰，暫停時間不計入關卡倒數：

| 關卡              |  時間 | 主題                               | 出現內容                             |
| ----------------- | ----: | ---------------------------------- | ------------------------------------ |
| 第 1 關：基礎期   | 25 秒 | 建立穩定節奏，先熟悉跳躍與體力管理 | 生病；睡眠、阻力、營養、Zone 2       |
| 第 2 關：進階期   | 30 秒 | 訓練刺激增加，同時保留恢復空間     | 生病、過度訓練；完整恢復與配速道具   |
| 第 3 關：正式比賽 | 25 秒 | 在較快速度下守住配速與安全         | 生病、運動傷害、過度訓練；完整道具池 |

開始後角色會自動前進。玩家要：

1. 點擊／觸碰遊戲畫面，或按右下角跳躍鍵、空白鍵、向上鍵來跳躍。
2. 避開負向事件並收集正向道具。
3. 觀察 HUD 的關卡、全程進度、配速狀態、體力及受傷風險。
4. 在約 80 秒內完成三關；完賽或中途停止後查看對應衛教訊息與安全、非個人化的行動提醒。

遊戲提供開始、暫停／繼續、聲音開關、重新開始、回到首頁、跨裝置前 10 名排行榜及分享成績。手機 HUD 會收合重複資訊，受傷與補給回饋則顯示在不遮住跑道的獨立提示列；三關進場卡片顯示時，重複 HUD 資訊會短暫淡出。三個階段分別搭配 130 BPM 有節奏、150 BPM 加速與 170 BPM 熱血的原創程式配樂，包含各關和聲、力度、音色、切關提示與音樂／音效動態混音；暫停或關閉聲音時也會停止。分享優先使用 Web Share API 附上程式產生的 1080×1080 方形 PNG 成績卡，並在成績送出驗證後顯示伺服器回傳的排行榜名次；方形安全版面可直接用於 Facebook 或 Instagram 貼文。不支援圖片分享時改用含名次的文字，並保留「儲存分享圖」按鈕，讓桌機也能下載 PNG 後自行發布。

每種障礙或道具第一次實際發生時，即時提示列會多顯示一則簡短知識點；結算頁的「本局知識回顧」再依遇到順序整理最多五則。結算也會先顯示依本局主要狀況選出的重點提醒，並提供可收合的「衛教補給站」。補給站每局輪替馬拉松訓練、運動傷害與跑步營養各一則，預設只顯示推薦摘要；展開後可切換主題、查看具體行動與權威資料來源。固定紅旗提醒說明何時應立即停止運動及尋求緊急醫療協助；所有內容均為一般衛教，不是個人化診斷、訓練處方或營養評估。

排行榜由 Cloudflare Pages Functions（Workers runtime）驗證後寫入 D1。歷史最高分仍保存在目前瀏覽器的 `localStorage`，因此不需要帳號；公開資料只包含玩家自行輸入的暱稱與遊戲成績，請勿使用真實姓名或敏感資訊。
伺服器會先排列完賽成績，再依分數與距離排序；同為完賽或中途停止、且分數與距離都相同時，顯示為同一名次。排行榜在健康完賽新制上線時進入 `2026-s2` 賽季並清空舊榜，所有新成績都用相同規則重新起跑。

## 正向道具

### 恢復與保護

- **睡眠**：恢復部分體力、降低受傷風險，並清除目前的恢復不足狀態。
- **阻力訓練**：啟用短時間防護，期間負向事件造成的數值影響減半。
- **營養補給**：立即恢復體力，但不會讓體力超過上限。

### 配速道具

- **Zone 2**：短時間降低速度與耗能，適合先守住體力。
- **LSD 長距離慢跑**：速度略降、耗能更低，並提供少量即時體力恢復。
- **間歇訓練**：短時間明顯加速且耗能增加，同時把下一次補給機會安全提前；生成間隔不會突破伺服器允許的理論下限。

後取得的配速道具會覆蓋目前模式。這些效果用來形成遊戲選擇，不代表真實世界的強度區間、建議配速或個人訓練安排。

## 負向事件

- **生病**：同時消耗體力、提高受傷風險，並造成短暫恢復不足。
- **運動傷害**：提高較多受傷風險，也會消耗部分體力。
- **過度訓練**：同時影響體力與受傷風險，並造成較長的恢復不足。

恢復不足期間，道具的數值恢復效果會降低，持續耗能則會增加。生成系統會限制同時存在的障礙數量、最小時間及距離間隔，避免製造明顯無法通過的排列。

## 配速取捨與完賽條件

遊戲刻意不把「越快」設計成永遠較好：

- 保守配速可節省體力，但推進速度較慢。
- 間歇模式會用較高耗能與較難閃避的速度，交換一次較早出現下一補給的機會；若成功再收集道具，伺服器仍會依有效時間與收集數重算分數。
- 後段關卡本身會提高速度與耗能，前段是否保留體力會影響正式比賽階段。
- 阻力訓練防護、睡眠與營養可以增加容錯，但不能取代避開事件與合理配速。

玩家只要完成 25 + 30 + 25 秒的三個階段即可抵達終點；體力為 0 或受傷風險為 100 時，立即判定中途停止。結算會區分「順利完賽」與「中途停止」，顯示抵達階段、距離、分數、最高分、主要原因及相對應的一般衛教訊息。

畫面中的「旅程里程」是將三關總進度遊戲化映射為 42.195 公里，不是真實跑速、訓練量或個人化課表建議。

## 計分與健康完賽加分

新制分數不只看是否撐到終點，也鼓勵玩家保留體力並控制受傷風險：

- **里程分**：每 25 公尺 1 分，無條件捨去；完整 42,195 公尺為 1,687 分。
- **道具分**：每個伺服器接受的恢復／訓練道具 50 分。
- **健康完賽加分**：只有完成三關才計入，公式為 `終點體力 × 2 + (100 − 終點受傷風險) × 2`，最高 400 分。
- **總分**：里程分 + 道具分 + 健康完賽加分；中途停止者的健康完賽加分為 0。

計分前會保守地將體力無條件捨去、受傷風險無條件進位。結算顯示的「疲勞程度」是 `100 − 終點體力`，讓狀態更直觀；它與體力是同一項資訊的反向呈現，不會再重複加分。這些數值都只是遊戲內指標，不是醫療評估、真實疲勞量測或傷害風險預測。

健康完賽新制使用 `2026-s2` 空白排行榜。舊成績沒有保存終點體力與受傷風險，無法公平回推新分數，因此 `migrations/0004_health_scoring.sql` 會新增檢查點與終點狀態欄位，並清除舊的排行榜成績與未完成跑局；套用後只收錄可由伺服器完整驗證的新制成績。

## 裝置與相容性

- 手機直式 9:16 為主要版面；桌機會將遊戲畫布置中。
- 遊戲維持 540×960 邏輯座標，依螢幕倍率、處理器核心、裝置記憶體與省流量偏好自動選擇 1×／1.5×／2× Canvas backing buffer；畫質調整不會改變碰撞、速度或平衡。
- 支援觸控、滑鼠、空白鍵與向上鍵；落地前約 0.12 秒的跳躍輸入會保留到落地瞬間，降低「明明有按卻沒跳」的挫折。
- 遊戲範圍停用瀏覽器捲動手勢，按鈕保留手機觸控尺寸與鍵盤焦點。
- 體力、受傷風險、關卡與配速均同時使用文字／數字呈現，不只依賴顏色。
- 目標為支援現代版 Chrome、Edge、Firefox 與 Safari。

## 技術堆疊

- Vite、TypeScript、Phaser 3 Arcade Physics
- HTML、CSS
- Cloudflare Pages Functions（Workers runtime）、D1、Wrangler
- Vitest、jsdom
- Playwright
- ESLint、Prettier
- pnpm

遊戲畫面是 Vite 靜態網站；`/api/*` 由 Pages Functions 處理，排行榜使用 D1。沒有帳號、傳統常駐伺服器或管理後台。Wrangler 4 需要 Node.js 22，建議使用 Node.js 22 與 pnpm 10。

## 安裝與執行

```bash
pnpm install
pnpm dev
```

開發伺服器預設位於 `http://localhost:5173`。

`pnpm dev` 適合開發純遊戲畫面；要連同本機 Functions 與隔離的本機 D1 一起測試，先建立 `.dev.vars`（不要提交）：

```dotenv
RATE_LIMIT_SECRET=請填入至少24字元的本機隨機字串
```

然後執行：

```bash
pnpm db:migrate:local
pnpm build
pnpm dev:cloudflare
```

完整本機站預設位於 `http://localhost:8788`。Wrangler 的本機 D1 與正式資料庫分離。

建立並預覽正式版：

```bash
pnpm build
pnpm preview
```

正式檔案會輸出到 `dist/`。

## 測試與品質檢查

執行 Vitest 單元測試：

```bash
pnpm test
```

單元測試涵蓋體力／受傷風險上下限、恢復與防護、配速耗能取捨、跳躍緩衝、暫停期間無敵時間不流失、三關進度與完賽結果、健康完賽加分、障礙生成安全、本局衛教回顧、網路 API client、伺服器計分與防作弊規則、檢查點補送與結算冪等重試、舊本機資料容錯，以及含排行榜名次與健康加分的方形成績卡產生。

第一次執行 Playwright 前，先安裝 Chromium：

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

E2E 會在桌機與手機尺寸的 Chromium 驗證首頁、製作者連結、開始、自適應高 DPI 遊戲畫布、三關 Canvas 色彩、進場卡片不被 HUD 遮住、手機 HUD 最低 12px 字級、48 格跑者圖集可用且會隨暫停凍結、健康完賽結算、檢查點與送分 payload 的終點狀態、排行榜 API 跨重載同步、載入失敗狀態、完賽檢查點失敗後自動補送、1080×1080 PNG 成績卡分享及結算後重新開始。Vite E2E 只 mock API；正式 Functions 另以 Wrangler 本機環境和部署後 smoke test 驗證。

其他常用指令：

```bash
pnpm test:watch    # Vitest 監看模式
pnpm typecheck     # TypeScript 型別檢查
pnpm lint          # ESLint
pnpm format        # 檢查 Prettier 格式
pnpm format:write  # 自動套用 Prettier
pnpm build         # 型別檢查並產生正式版
pnpm build:functions # 打包檢查 Pages Functions
pnpm db:migrate:local  # 套用本機 D1 migration
pnpm db:migrate:remote # 套用正式 D1 migration（會修改雲端資料庫）
pnpm dev:cloudflare # 啟動 dist + Functions + 本機 D1
pnpm check         # 型別、lint、格式、單元測試與建置
```

`pnpm check` 不包含 Playwright；完整驗證時請另外執行 `pnpm test:e2e`。

## 專案架構

```text
.
├── e2e/                         # Playwright 關鍵使用流程
├── functions/                   # Pages Functions 排行榜 API 與 D1 存取層
├── migrations/                  # 可版本化的 D1 schema migration
├── public/                      # 靜態檔與 /api/* Functions 路由設定
├── src/
│   ├── game/
│   │   ├── config/              # 三關流程、平衡數值、逐格動畫與 Phaser 設定
│   │   ├── data/                # 本局衛教、延伸提醒、來源與繁中標籤
│   │   ├── entities/            # 跑者、負向事件、正向道具與場景
│   │   ├── events/              # Phaser 與 DOM UI 的事件介面
│   │   ├── scenes/              # 遊戲生命週期與畫面整合
│   │   ├── systems/             # 狀態、配速、進度、生成、碰撞與結算邏輯
│   │   └── utils/               # 程式音效等共用工具
│   ├── services/                # 嚴格驗證回應的排行榜 API client
│   ├── shared/                  # 計分／驗證規則與跨層衛教資料型別
│   └── ui/                      # 首頁、三關 HUD、暫停與結算 DOM UI
├── playwright.config.ts
├── vite.config.ts
├── wrangler.toml                # Pages 與 D1 binding 設定
└── vitest.config.ts
```

可測試的規則與 Phaser 畫布分離：設定檔集中保存三關及遊戲數值；純函式處理生命狀態、配速、進度、生成安全、伺服器計分與結算；場景負責物理與視覺物件；DOM UI 負責首頁、HUD、暫停、排行榜、成績卡分享及完賽／中途停止畫面。

## 網路排行榜與防作弊

每一局開始時，伺服器會簽發一次性的高熵跑局 token；D1 只保存 token 的 SHA-256 雜湊。遊戲約每 10 秒提交單調遞增的檢查點，結算時由 Functions 驗證並重算距離與分數，前端不能指定最終分數。

目前包含：

- 跑局 15 分鐘期限與一次性寫入；相同結算內容可安全重試並取回既有名次，不會重複上榜。
- 伺服器時間不得短於遊戲有效時間；完賽必須完成約 80 秒。
- 完賽前必須已有 60～75 秒附近的有效檢查點，不能最後一刻才偽造整局。
- 檢查點時間與收集數只能遞增，收集數不得超過各階段生成規則的理論上限；體力與受傷風險的改善幅度也不能超過期間新增道具可提供的上限。
- `outcome`、關卡、時間與終點體力／受傷風險必須一致；距離、里程分、道具分與健康完賽加分都由共用純函式重算。
- 暱稱做 Unicode 正規化、控制字元移除、長度限制，UI 一律以 `textContent` 呈現。
- 以每日 HMAC 化的 IP 金鑰做建立頻率限制；D1 不保存原始 IP。
- 寫入 API 嚴格要求瀏覽器 `Origin` 與當前請求網址同源；Cloudflare production branch 的正式網址與 unique deployment 網址都可正常送分。

這些措施可阻擋直接改 `localStorage`、任意改分、立即假完賽、重播和大量建立跑局等常見作弊。由於遊戲程式仍在玩家瀏覽器執行，無帳號的休閒網頁遊戲無法保證絕對防作弊；若未來要舉辦有獎競賽，應再加入 Turnstile、帳號／裝置風險控制，以及伺服器可重播的固定種子事件紀錄。

## 建置與部署

```bash
pnpm build
```

### Cloudflare Pages

本 repo 已包含 `wrangler.toml` 與 D1 binding。第一次部署或在新帳號重建時：

1. 建立 D1，並把回傳的 UUID 填入 `wrangler.toml`。
2. 設定至少 24 字元的正式 secret，內容不要寫進 repo：

```bash
pnpm exec wrangler pages secret put RATE_LIMIT_SECRET --project-name marathongame
```

3. 在部署新版 Functions 前套用正式 migration：

```bash
pnpm db:migrate:remote
```

4. 推送 production branch；既有 Git integration 會自動建置靜態檔與 `functions/`。

目前 Pages 建置設定：

- Install command：`pnpm install --frozen-lockfile`
- Build command：`pnpm build`
- Build output directory：`dist`
- Node.js：22

Git 部署不會自動執行 D1 migration，schema 變更必須先明確執行 `pnpm db:migrate:remote`。`RATE_LIMIT_SECRET` 是必要設定；未設定時 API 會安全拒絕建立跑局。

> `migrations/0004_health_scoring.sql` 會為 `2026-s2` 新制清除舊排行榜與未完成跑局。這是一次性的預期重設；正式環境套用前應先確認要開啟新賽季，且不要在新制已有成績後重複手動執行該 SQL。

API 會比對瀏覽器 `Origin` 與實際請求網址，因此正式 `pages.dev`、production unique deployment 及未來自訂網域的同源請求都可使用。`wrangler.toml` 的 `LEADERBOARD_PRODUCTION_BRANCH` 目前為 `main`；Cloudflare 注入的 `CF_PAGES_BRANCH` 若不是正式 branch，則可讀取榜單但不能寫入正式榜。若預覽版本也需要寫入，應另外建立 preview D1，不要共用正式資料庫。

> **公開協作前的部署門檻：** `wrangler.toml` 目前的 `preview_database_id = "DB"` 只用於本機開發，不代表遠端 Preview 已與正式 D1 隔離。應先建立獨立 Preview D1，透過 `env.preview` 覆寫 D1 binding 與 vars，並在 Cloudflare 的 Preview 環境另外設定專用 secret，再開放不受信任的同 repo 分支部署；secret 不可寫入 `wrangler.toml` 或 Git。否則應在 Cloudflare 停用這類 Preview。現有 production-branch 檢查是縱深防禦，不能取代基礎設施層的資料庫隔離。

### Zeabur

可將遊戲畫面以靜態網站方式部署 Git 專案，使用：

- Build command：`pnpm build`
- Output directory：`dist`
- Node.js：20.19 以上

若 Zeabur／ZBPACK 沒有自動辨識輸出目錄，可設定環境變數 `ZBPACK_OUTPUT_DIR=dist`；也可在 ZBPACK 設定中將 `output_dir` 指向 `dist`。靜態部署不需要啟動指令，但 Zeabur 不會直接執行本專案的 Pages Functions／D1；若仍要使用跨裝置排行榜，需另外部署相容 API 並調整前端端點。

### Vercel 或其他靜態空間

安裝指令使用 `pnpm install --frozen-lockfile`、建置指令使用 `pnpm build`，並發布 `dist` 目錄。純靜態平台只能提供遊戲畫面；目前的網路排行榜後端專屬 Cloudflare Pages Functions／D1。

Vite 使用相對 base，因此也能部署到靜態網站子目錄。正式版預設不輸出 source map；若除錯平台需要，可使用：

```bash
VITE_SOURCEMAP=true pnpm build
```

Phaser 會獨立輸出為可長期快取的 vendor chunk。

## 開源、隱私與貢獻

- 本專案以 [MIT License](./LICENSE) 授權；第三方組件保留各自授權，詳見 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
- 公開排行榜會處理玩家主動送出的暱稱與遊戲成績；詳見 [PRIVACY.md](./PRIVACY.md)。
- 衛教內容的適用範圍、審閱與更正流程見 [MEDICAL_CONTENT.md](./MEDICAL_CONTENT.md)。
- 想修正 bug、新增關卡或改善衛教內容，請先閱讀 [CONTRIBUTING.md](./CONTRIBUTING.md) 與 [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)。
- 請勿在公開 Issue 張貼未修復的安全漏洞；回報方式見 [SECURITY.md](./SECURITY.md)。

MIT 授權允許學習、修改與再散布，但不代表原作者、專業人員或資料來源認可修改後的醫療、訓練或營養內容。重新發佈衛教版本時，請保留免責說明、核對引用來源，並由合適的專業人員重新審閱。

## 原創素材與可替換介面

本版不下載或內嵌第三方遊戲素材。遊戲主視覺已升級為自行設計、由 Phaser 在執行時繪製的 code-native vector art：

- 原創跑者使用青綠跑衣、橘色識別帶、深藍短褲與珊瑚跑鞋；48 格高解析向量圖集包含 idle 6 格、running 16 格、jumping 8 格、hurt 4 格、finished 8 格與 game over 6 格。跑步循環約 182 步／分鐘，手腳採對側擺動，跑鞋會依觸地、推蹬及擺盪改變角度；跳躍幀由實際垂直速度選擇，暫停時會精確凍結。
- 基礎期為早晨河濱、進階期從下午田徑訓練場逐步進入夜間燈光、正式比賽為賽事早晨大道；各關皆有獨立場景構圖及多層視差。
- 生病、運動傷害、過度訓練、恢復／配速道具、終點門與遊戲回饋特效均為原創 Phaser 向量圖形。
- 核心 DOM 操作與狀態圖示使用專案內嵌 SVG，文字使用裝置系統字型，不會向第三方字型服務傳送資料。
- 跳躍、拾取、碰撞、結算提示音，以及 130／150／170 BPM 三階段配樂，仍由 Web Audio API 即時合成；這是目前主要的可替換音訊素材。

角色圖集目前由同一套骨架、比例與色盤在啟動時一次烘焙，避免逐格身分或肢體比例漂移；若 Canvas 無法建立圖集，仍會回退為即時向量幀。`public/assets/` 目前只保留未來替換說明，沒有未授權的圖片、字型或音訊。若後續改用外部 sprite sheet、插畫字型或錄製音樂，請遵守既有 192×224、8×6、48 格圖集契約，並逐項記錄著作權、商用及再散布授權。

## 內容設計依據

下列資料只作為一般跑步訓練、恢復、負荷與配速主題的背景閱讀；本遊戲沒有複製其中的訓練計畫，也不應被解讀為這些組織認可的處方或建議：

- [B.A.A. Boston Marathon Training](https://www.baa.org/races/boston-marathon/info-for-athletes/boston-marathon-training/)
- [World Athletics：Performance 訓練專區](https://worldathletics.org/personal-best/performance)
- [World Athletics：耐力跑者速度訓練的效益與限制](https://worldathletics.org/personal-best/performance/speed-training-endurance-runners-benefits-limits)
- [IOC：運動負荷與傷害風險共識聲明](https://bjsm.bmj.com/content/50/17/1030)
- [ECSS／ACSM：過度訓練症候群聯合共識聲明](https://onlinelibrary.wiley.com/doi/10.1080/17461391.2012.730061)
