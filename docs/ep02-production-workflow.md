# EP.02 preparation and review

The review branch adds the EP.02 entry to the EP.01 edition picker. EP.02 contains six Drive-sourced articles for source stations 02–07 and a Kushiro editorial draft based on its booking link and selected Drive photographs. A separate original Kushiro article and final production slot IDs remain pending.

| Item | Evidence checked | Open item |
|---|---|---|
| Kushiro | The owner supplied the TableCheck reservation URL with `utm_source=huxiago`. The page responded HTTP 200 and identifies Kushiro. | Confirm offer dates, eligible package and redemption terms. The inspected response did not state 20% off. |
| Canal boat | The route and Pratunam interchange match the [Thai transport ministry report](https://www.otp.go.th/uploads/tiny_uploads/ProjectOTP/2556/Project01/8-PMS.pdf). The Google Doc’s embedded link resolves to the [independent route map](https://www.saensaebcanal.com/). Xiao Hu’s ride took 50 minutes. | Exact current fares and last departures. Published figures vary across dates and sources. Confirm at the pier or with the operator. |
| Venue CTAs | SILQ uses its official site. Gan Da and Chowchercof source links resolve to the named Google Maps places. Hani Spa and Bang Sue Junction use named Google Maps searches. | Confirm the final tracked destination for each place. |
| Images and video | The Drive check found 18 JPG and 1 MP4 in the Kushiro folder and 10 JPG directly in Hani Spa. All 29 have file size and dimensions. We reviewed 11 thumbnails and selected `L1000388.JPG` for Kushiro and `FullSizeRender(1).jpg` for Hani Spa. The two WebPs and translated captions appear in each edition. | Confirm usage rights and final selection. The video is outstanding. |

## Rebuild the issues

1. Read the EP.02 index and shared Obsidian log before checking Drive. Compare file IDs and source modification timestamps with the previous verified scan. Record any new article or asset against its source. Keep source station labels separate from permanent place and CTA IDs.
2. Edit `docs/ep02-content.json` in all three locales. Keep translated facts, destination URLs and the partner's exact UTM consistent. Maintain one row per source and use the same order across languages. The generator reuses the production EP.01 stylesheet, desktop rail and navigation script, and the matching locale’s EP.01 cover, mobile navigation, share controls, and About section. Use the online section order for the web edition and the corresponding offline order for the standalone guide. Keep the same breakpoints, component hierarchy, six rail destinations, scroll highlight and download behavior. Swap in the new issue’s number, count, stories, artwork and links.
3. Run `python .github/scripts/build_ep02.py` and then `python .github/scripts/build_ep02.py --check`. This generates three EP.02 web pages, refreshes the EP.01 web page and three offline versions for each issue, and recalculates their entries in `site-files.json`. Run this after regenerating any EP.01 offline editions.
4. Open EP.01’s episode picker in each language. Follow EP.02, use the language links, check the venue CTA and Kushiro booking URL, then download and reopen the matching offline file with the browser offline. Check phone, tablet and desktop widths. Record missing assets, unresolved terms and the tests in Obsidian.
5. Work from current `main` in an isolated review branch. Inspect `git diff --check` and the staged file list, then commit. Record the review branch, commit and read-back verification in the original Vault. Keep unpublished material in a local branch while the production repo is public. Confirm the approved release path and production deployment after Morris approves the applicable publish step.

The project’s existing ZIP workflow accepts the issue HTML files at the root. The CSS is embedded, so the downloaded offline files render without local dependencies. Map and reservation destinations require a connection.

## Hermes review before handoff

Use the live huxiago.com layout and the production repository as the reference. Compare the actual mobile and desktop pages, including the fixed desktop rail and all six destinations, the rail/mobile navigation switch at 980 px, the cover, share controls, ticket, directory, filters, station cards, language selection and matching offline downloads. Write the observed result with the review branch and commit to the shared Obsidian log. When a draft departs from the reference, record the exact component, evidence and correction, and return it to Codex for revision before handoff. Get Morris’s agreement for deliberate changes to the layout.

## Shared offers and editorial depth

Maintain `docs/shared-deals.json` as the shared offer catalog. Use the original eSIM orange ticket for every offer, with matching rounded icons: phone for eSIM, fork and knife for dining, taxi for transport. Keep pending categories visibly marked as coming soon. The same ticket information, booking URLs and partner tracking parameters are rendered in both issues and their six standalone offline guides. Check navigation in both directions and verify EP.01 retains its original twelve stories. Maintain sectioned first-person editorial copy in `docs/ep02-stories.json` and vetted photograph captions in `docs/ep02-galleries.json`. The canal ride follows the MuvMi article’s pattern: when to use it, the ride we took, how to board and pay, and when to plan another way back.

The latest recursive Drive scan found 58 items, including six original Google Docs. The Docs’ HTML exports contained no embedded photos. Selected galleries are four Kushiro photos and three Hani Spa photos. SILQ, Gan Da, Chowchercof, Bang Sue Junction and the canal boat still need correctly attributed photos. Kushiro’s offer terms and the canal’s current fare remain open. Check these items in Obsidian and mark the corresponding review status before publication.
