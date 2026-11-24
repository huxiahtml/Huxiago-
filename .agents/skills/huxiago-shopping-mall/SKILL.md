---
name: huxiago-shopping-mall
description: 為 HUXIAGO 期刊編輯及校稿大型購物商場、樓層和店內看點的圖文編排。
---

# HUXIAGO 商場圖文

- 商場內有多個樓層、店家或餐飲看點時，按原稿動線編排，每張圖緊跟對應文字。用圖說點明樓層、店名、商品或餐點。對照原始照片與段落，找不到匹配段落時記為待確認。
- 商場圖文交錯以文章順序為準。封面縮圖可取商場外觀，照片在正文各段依序呈現。其他類型站點使用期刊的既有滑廊規則。
- EP.02 在 `docs/ep02-content.json` 的商場站指定 `gallery_layout: "inline"`。用 `docs/ep02-stories.json` 段落後的 `{"photo": "檔名.webp"}` 指向 `docs/ep02-galleries.json` 的已審圖說與素材。同步繁中、簡中、英文的插圖順序，保留可離線閱讀的圖片。
- Bang Sue Junction 是參考案例。古董照跟一、二樓段落，黑膠跟 Mono Loop，雞蛋仔及配料照跟五樓小吃，麥當勞跟餐飲段。核對手機與桌面上圖片和前段文字相鄰。
