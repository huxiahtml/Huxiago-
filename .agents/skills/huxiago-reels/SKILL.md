---
name: huxiago-reels
description: 在 HUXIAGO 期刊新增、更新或校稿 Instagram Reel、封面、播放按鈕與浮動小窗時，沿用 EP.01 的互動和三語離線流程。
---

# HUXIAGO Reel

- 以同一套期刊的 EP.01 為樣式基準。先顯示來源封面、明顯的黃色播放鍵和片名。圖庫中的 Reel 保留在編輯選定的位置；內文的 Reel 使用同一播放元件。
- EP.02 有對應的原片時，點播放立即呼叫站內原生播放器，不插入 Instagram iframe。浮動視窗維持同一影片及進度。沒有可用原片時，明確標示「在 Instagram 觀看」，直接開原片網址。
- 三語使用相同的原片來源、封面及 Instagram 永久網址，翻譯相關標題與控制文字。有原片的離線 HTML 嵌入保留完整長度的壓縮版。
- 從原始 Obsidian 的 EP 工作索引確認審稿 repo。EP.02 用 `docs/ep02-galleries.json` 的第五欄指定有封面 Reel URL，或在 `docs/ep02-stories.json` 的內文區塊使用 `{"reel": "https://www.instagram.com/reel/<id>/", "title": "片名"}`。重用 `build_ep02.py` 的 `reel_card` 與 `ep02/reels.js`，沿用 EP.01 的 Reel CSS。 以 `docs/ep02-content.json` 的 `reel_sources` 按 Instagram 永久網址對應網頁與離線 MP4。
- 執行建置與 `--check`，用 `tests/ep-cross-issue-browser.cjs` 核對三語、離線、首張與縮圖、點播、浮動和原片網址。實際影片是否可播須連網單獨查驗，測試 iframe URL 和小窗只能證明元件運作。把驗證結果寫回 Obsidian 工作索引與共用紀錄。
- 同一橫向滑廊的照片與 Reel 沿用同一媒體高度，圖說也對齊底邊。寬度可依媒體比例不同。檢查播放前、播放後及手機／桌機。直式 Reel 使用 9:16，內文置中，封面、播放與浮動視窗維持直式比例。內嵌原片依原始方向保留畫面；手機確認無多餘黑邊，並檢查播放控制與原片入口。
- 有明確用途的站點原片可用直式 MP4，保持來源方向和全段時長。EP.02 滑廊的第五欄用 `{"video":"ep02-片名.mp4"}`，影片在 `media/`，首欄是 `ep02/` 下的 WebP 封面。網頁點播載入 MP4，離線版包含同一支壓縮影片。檢查影片和照片等高、影片直式比例、浮動時不中斷播放，並實際播放離線版。
- 交通等站點需要把數支現場原片放在內文下方時，沿用 EP.01 Café Amazon 的獨立短片區。卡片橫排、手機可橫滑，支援自適應直式比例。三個圓形按鈕為播放／暫停、聲音開／關、浮動視窗，播放前亦可操作。切換浮動時保留當前時間和聲音。EP.02 的第七站用 `video_layout: "story"` 啟用。
- 跨期 Bonus Reels 讀取 EP.01 的現有區塊、原片、點位和浮窗；沿用 EP.01 文字版式與線條 SVG，保留各站既有原生播放。
