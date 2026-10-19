# EP.01 place events

The release replaces ambiguous `guide_open` events with three separate events.

| Event | Trigger | Counting |
| --- | --- | --- |
| `toc_item_click` | Select a numbered place in the contents | Once per click, including selecting an already open place |
| `place_card_open` | Directly activate a closed card summary, including keyboard activation | Once per direct opening; closing, TOC and programmatic opening do not count |
| `place_content_view` | At least 50% of a text paragraph is visible in an expanded card for 1 continuous second in a foreground page | Once per place per page load; closing, hiding the page or moving away resets pending dwell |

A content view measures an opportunity to read, not proof that the person understood the text. Opening animations are excluded. The view may occur after either TOC selection or direct opening, so do not sum the three event types as unique people.

All three use `episode=EP.01`, `place_id=spot-1` through `spot-12`, numeric `position=1` through `12`, and the same canonical `place_name` captured from the original Traditional Chinese card heading before translation. Names remain stable after switching language or reloading with a saved language. Existing `item_id=huxiago_vol01` and `send_to=G-YZZEBJ9YBT` remain intact. Clarity continues using project `yukhiquv1a` and receives the same event names via the existing tracker.

Every tracked website event now carries `episode=EP.01`. Links inside a place card, including `map_click`, `reel_open`, `outbound_click` and `social_click`, also carry its canonical `place_id`, `place_name` and `position`. `reel_open` distinguishes `reel_action=original_link` from `inline_pip`; ordinary video PIP requests use `video_pip_open`. The issue-wide `share` event counts a share-button click, not proof that a share completed. The MuvMi card links to its app rather than Google Maps, so its app click is `outbound_click` rather than `map_click`.

| ID | Canonical name | Position |
| --- | --- | --- |
| spot-1 | Central Park Bangkok | 1 |
| spot-2 | Café Amazon Experience | 2 |
| spot-3 | Sala Lakorn | 3 |
| spot-4 | Liabduan Danneramit | 4 |
| spot-5 | 神級海南雞飯 | 5 |
| spot-6 | MuvMi | 6 |
| spot-7 | MK Restaurants | 7 |
| spot-8 | Som Tam Nua | 8 |
| spot-9 | Baan Ice | 9 |
| spot-10 | TrueCoffee | 10 |
| spot-11 | Swensen’s | 11 |
| spot-12 | FUFU Taiwanese Shabu | 12 |

## Reproduce verification

Install Playwright and Microsoft Edge, then run `node tests/ep01-tracking.cjs`. Set `PLAYWRIGHT_MODULE` to an existing Playwright installation if needed. `--live` runs the same browser tests against https://huxiago.com/. Set `TEST_OUTPUT` to choose an evidence directory.

Local tests serve repository files under an intercepted production origin to exercise the existing production-only analytics guard. Third-party scripts and requests are intercepted in both modes so test events do not reach real GA4/Clarity datasets. Reports record actual dataLayer events, not mocked tracker calls. Tests cover all 12 places at desktop 1440×1000 and mobile 390×844, repeated openings, repeated TOC selection, close-only actions, programmatic opens, brief glances, simulated hidden-document state, language persistence, desktop keyboard opening, map links, sharing and Reel launch actions.

GA4 receipt / report availability is separate from browser event verification. The event-scoped custom dimensions `place_name`, `place_id`, `episode` and `reel_title` are registered in GA4. `position` is sent for ordering and test verification but is not registered as a separate report dimension. New custom definitions do not backfill historical events. In the existing dashboard, pre-2026-10-20 place events are assigned to EP.01 by canonical place name because it was the only published issue; events from 2026-10-20 onward use episode and place ID directly.

`node tests/ga4-transport.cjs` loads the real production gtag library and verifies the serialized collection parameters of all three events for spot-1. Collection requests are intercepted and answered locally before transmission. This confirms the GA4 transport format without claiming server-side receipt or polluting production data. The saved evidence excludes client/session identifiers.
