---
name: huxiago-reels
description: 在 HUXIAGO 期刊新增、更新或校稿 Instagram Reel、封面、播放按鈕與浮動小窗時，沿用 EP.01 的互動和三語離線流程。
---

# HUXIAGO Reel

- 以同一套期刊的 EP.01 為樣式基準。先顯示來源封面、明顯的黃色播放鍵和片名。圖庫中的 Reel 保留在編輯選定的位置；內文的 Reel 使用同一播放元件。
- 點播放後才向 Instagram 請求嵌入。在站內提供可拖曳和關閉的浮動播放器，維持單一作用中的 iframe；原片連結需可直接開啟。關閉小窗後回原位置，鍵盤可操作及用 Escape 關閉。
- 三語使用同一則 Instagram 永久網址和來源封面，翻譯標題、按鈕和輔助文字。離線 HTML 保留封面與原片入口，播放需要連線且依 Instagram 的嵌入權限。
- 從原始 Obsidian 的 EP 工作索引確認審稿 repo。EP.02 用 `docs/ep02-galleries.json` 的第五欄指定有封面 Reel URL，或在 `docs/ep02-stories.json` 的內文區塊使用 `{"reel": "https://www.instagram.com/reel/<id>/", "title": "片名"}`。重用 `build_ep02.py` 的 `reel_card` 與 `ep02/reels.js`，沿用 EP.01 的 Reel CSS。
- 執行建置與 `--check`，用 `tests/ep-cross-issue-browser.cjs` 核對三語、離線、首張與縮圖、點播、浮動和原片網址。實際影片是否可播須連網單獨查驗，測試 iframe URL 和小窗只能證明元件運作。把驗證結果寫回 Obsidian 工作索引與共用紀錄。
- 同一橫向滑廊的照片與 Reel 沿用同一媒體高度，圖說也對齊底邊。寬度可依媒體比例不同。檢查播放前、播放後及手機／桌機。內文 Reel 置中，採橫長方形 16:9，播放後維持外框比例，浮動視窗保持直式。
