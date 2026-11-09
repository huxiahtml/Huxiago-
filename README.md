# HUXIAGO 曼谷口袋名單 Ep.01

網站入口為根目錄的 `index.html`。`media/` 存放頁面使用的圖片與影片。根目錄的三份離線攻略 HTML 會依首頁選用語言提供下載。

修改繁中離線攻略、翻譯或封面後，執行 `python .github/scripts/localize_offline_guides.py` 重建簡中與英文版，並同步更新檔案清單。

## 後續以 ZIP 更新

1. 將新版完整網站的 `index.html`、三份離線攻略 HTML 和 `media/` 放在同一資料夾，壓縮**資料夾內的內容**為 `site.zip`。開啟 ZIP 後第一層應直接看到 `index.html`。
2. 在 GitHub 的 `main` 分支，把 `site.zip` 上傳到 `updates/`，路徑必須是 `updates/site.zip`，然後提交變更。
3. 到 **Actions → Publish HUXIAGO site ZIP** 查看結果。驗證通過後，Action 會將檔案展開至根目錄、提交網站內容，並移除暫存 ZIP；驗證失敗則不會改動網站檔案。

GitHub 網頁單檔上傳上限是 **25 MiB**。ZIP 超過上限時，請改用 Git 指令上傳。不要將網站輸出再包一層父資料夾，也不要把 GitHub Action 或金鑰放入網站 ZIP。

此倉庫保存部署檔案；若要使用 Cloudflare Pages，請將該服務連到此倉庫的 `main` 分支，網站輸出目錄設為 `/`，不需要建置命令。正式網域接入後，記得把 `index.html` 的 canonical、Open Graph 網址與分享網址更新到正式網域。
