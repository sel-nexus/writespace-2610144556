# WriteSpace — brownfield changelog

## Added and extended
- Added independent validated scalar `writespace_theme` preference via `frontend/src/utils/theme.js`; root App state/effect synchronizes HTML dark class. Missing/invalid/failed reads default light; failed writes preserve active mode and show nonblocking guidance.
- Added reusable accessible ThemeToggle to public/authenticated navigation, with native keyboard activation, pressed state, mobile visibility and focus indication. Tailwind uses class-based dark mode.
- Extended landing, login, registration, blog list/reader/editor, administrator dashboard/account management and BlogCard/StatCard/UserRow with paired dark surfaces/text/borders/control/error states. Preserved inherited paper/Georgia/Arial layout and brand accents.
- Extended the existing content-length display with live polite announcements; count remains derived UTF-16 string length, informational and non-limiting. Added dedicated counter regression and browser specs.
- Added theme/root/public/workspace/counter component and browser tests, large account-input utility coverage, and hero-preview reading entry coverage. Reformatted a shared Navbar tag without behavioral change.
- Updated README and supplied plan, test report, source manifest/metadata and final code graph. Added standalone preflight script/evidence and five human-review screenshots.

## Compatibility and migrations
No breaking changes, route changes, stack changes, backend, API, database or migrations. Existing posts/users/session schemas and role constants are unchanged. The only new persisted key is `writespace_theme`; logout leaves it intact. Character count is not persisted. Existing default Admin identity and pending duplicate dashboard metric are preserved.

## Verification and remaining warnings
Baseline 451 tests passed; final 570 tests passed in 13 files. Each feature committed after targeted verification (110, 79, 127 and 71 tests). Test critic PASS round 2, score 1.0, zero high failures; production build passed. Standalone Chromium preflight captured five representative states.

E2E journeys did NOT complete: Playwright runner hung without output on 600s full suite, 300s guest-local retry and 180s targeted retry. Human approved proceeding with the explicit infrastructure-blocked warning. Eight specs remain available for downstream execution. Existing 11 dependency advisories remain unresolved. Docker/AWS deployment was not executed by this stage. Shared application title remains unchanged; route-aware titles are a minor future improvement.
