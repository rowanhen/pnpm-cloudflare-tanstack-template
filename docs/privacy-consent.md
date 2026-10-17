# Privacy and consent

This is a working example for projects serving the UK, EU and US. It uses prior opt-in for optional browser tracking everywhere, without geolocation. The banner controls the included PostHog integration. It is not a certification that a cloned project meets every privacy law, nor a consent gate for scripts added elsewhere.

Reviewed against regulator guidance on 17 October 2026. Recheck the rules and your processing at launch.

## What the template does

- **Reject all**, **Accept all** and **Manage** are available on the first layer. Accept and reject use the same button style. Ignoring the banner does not opt in.
- Analytics (page visits, typed events and sanitized browser errors) and masked session replay have separate, initially unchecked choices. Either can run independently. Replay-only sessions are not identified using the account ID and do not send analytics events.
- The browser SDK is imported and initialized only after a relevant opt-in. The event boundary also checks the current purpose, expiry and browser signal. Inputs, text, attributes, URLs and exceptions retain the existing privacy filtering.
- **Privacy preferences** remains available on both apps. Withdrawal stops capture/recording and disables/clears SDK tracking persistence; the preference record and SDK opt-out marker may remain to remember the rejection. This does not erase data already held by PostHog.
- A valid preference contains purpose choices, policy version, decision time, expiry and source (`user` or `gpc`). Invalid, unsupported, legacy or expired records do not authorize tracking. Storage failures keep choices in memory for the current page; a fresh load may ask again.
- The default lifetime is **180 days**, for acceptances and rejections alike. It is a configurable product default, not a universal statutory limit. Expiry checks run during a long-lived page, on focus, on page restoration and before capture. Material purpose/vendor changes require updating the policy version and the notice.
- Same-origin tabs synchronize changes. Marketing and dashboard origins keep independent choices; this example does not silently share consent or link identities across subdomains.
- A browser's `navigator.globalPrivacyControl` signal overrides existing acceptance, disables both optional purposes, records the rejection and displays its status when preferences are opened. Suppressing all optional tracking is a conservative template choice; GPC does not legally mean “reject every kind of analytics.” Removing the signal does not restore an old acceptance.
- Without PostHog configuration, there is no optional PostHog tracking and no banner. A site using only exempt essential storage does not need to ask visitors to consent to that storage.

The controls are shared by marketing, dashboard and recovery pages. Keep the UI short; explain purposes and providers rather than adding generic “we value your privacy” text.

## Regulatory baseline

### UK

PECR covers storing or accessing information on a device, including localStorage, cookies and similar technologies; it is not limited to personal data. Consent is needed before non-exempt use. UK GDPR obligations also apply to personal-data processing.

Essential sign-in and remembering a privacy decision can be exempt, where genuinely necessary. The current statistical-purpose exception is narrower than “analytics”: it requires aggregate results for service improvement, appropriate handling of underlying individual data, clear information and a simple free objection mechanism. It does not justify identified user analytics or recordings merely because the tool calls itself analytics. This template does not rely on that exception.

Use clear purposes/providers, affirmative and granular choices, no preselection or acceptance by scrolling, and easy withdrawal. Keep evidence of what was agreed. Six months is the ICO's general guideline for requesting fresh consent, not a statutory expiry applicable to all cases. Do not repeatedly ask people because they rejected tracking.

Sources: [ICO exceptions](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/), [ICO consent in practice](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/how-do-we-manage-consent-in-practice/).

### EU / EEA

National implementations of ePrivacy govern device storage/access, alongside GDPR where personal data is processed. Exemptions and enforcement details vary nationally. Use prior opt-in for the optional purposes in this example, with a first-layer rejection, clear information, no prechecked controls or misleading design, and accessible withdrawal. A cookie banner does not itself establish a lawful basis for all later uses of the data.

Source: [EDPB Cookie Banner Taskforce report](https://www.edpb.europa.eu/system/files/2023-01/edpb_20230118_report_cookie_banner_taskforce_en.pdf).

### US

There is no single nationwide cookie-banner rule equivalent to the UK/EU model. State coverage, thresholds, exemptions and rights differ. Covered businesses may need notice at collection and ways to opt out of sale/sharing or targeted advertising, including recognized universal opt-out signals. California's “sharing” includes cross-context behavioural advertising; it is not a synonym for every disclosure to a contracted processor. Assess the actual vendor terms and uses.

California requires covered businesses to honour GPC and has rules on re-soliciting sale/sharing permission after opt-out. Connecticut also requires opt-out preference signals for covered targeted-advertising/sale processing. This example has no ad pixels, sale/sharing switch or targeted-advertising integration. Adding these requires actual downstream opt-out enforcement and the applicable “Do Not Sell or Share”/privacy choices mechanisms, not simply reusing a 180-day analytics consent expiry.

Browser GPC handling here only gates the browser integration. Any future server-side sale/sharing or advertising path must also consume `Sec-GPC: 1`, persist/propagate the applicable opt-out and expose the required rights mechanisms. Ordinary server operational telemetry is separate from this banner and needs its own lawful purpose and minimization assessment.

Sources: [California Attorney General CCPA guidance](https://oag.ca.gov/privacy/ccpa), [Connecticut Attorney General guidance](https://portal.ct.gov/ag/sections/privacy/the-connecticut-data-privacy-act).

## Storage inventory

| Storage / technology                                            | Purpose                                                 | Gate / duration in this example                                                                                                |
| --------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Better Auth session/security cookies                            | Sign-in and session security                            | Essential where necessary; actual lifetime follows auth configuration                                                          |
| `starter.privacy-consent.v2` localStorage                       | Remember purpose choices and their dates/version/source | Essential preference record; logically expires after 180 days; replaced by the next choice                                     |
| PostHog `ph_*_posthog` local/session storage and recorder state | Optional SDK identity/session state                     | Only after a relevant choice; SDK persistence disabled/cleared on full withdrawal                                              |
| PostHog opt-in/out marker                                       | Remember the SDK's capture decision                     | May remain as a preference marker after withdrawal; is not permission to capture without the app record                        |
| Google OAuth / Stripe checkout                                  | Requested sign-in/payment features                      | Load in their requested flow; audit actual provider cookies, additional purposes and notice requirements in the deployed setup |
| Self-hosted Inter                                               | Typography                                              | Served locally; no remote font-provider integration                                                                            |

Provider-side retention is configured separately. A 180-day preference does not mean recordings or events are deleted after 180 days. Verify real keys/cookies/network requests in each deployed app, including provider changes.

## Before using this in production

1. **Inventory and classify processing.** Audit third-party scripts, pixels, embedded media, SDK storage and server events. Route every optional integration through its purpose gate. Do not assume a tag manager or “cookieless” mode avoids these rules.
2. **Provide the actual notice.** Set the controller/contact, purposes, providers, storage lifetimes, retention, rights and international-transfer information. Keep waitlist/email marketing permission separate from analytics consent and from accepting terms.
3. **Retain proportionate evidence.** The browser preference is a functional choice record, not a durable server-side consent history. Decide how to retain and protect evidence of the notice/version/purposes/action/time and later withdrawals. Do not send consent evidence to the analytics provider as the only audit trail, or collect an IP/fingerprint just to create that trail.
4. **Complete withdrawal/erasure operations.** Browser opt-out only stops future collection and local identifiers. Implement an authenticated/proportionate workflow for erasing previously collected consent-based data and notifying relevant recipients. The ICO specifically expects withdrawal to be treated as an erasure request for data collected under that consent. Preserve the minimum information needed to fulfil this before discarding identifiers. This example does not provision a PostHog deletion endpoint or promise provider erasure.
5. **Configure vendors and retention.** Review processor/service-provider terms, transfers, hosting regions, access controls and deletion schedules. Masking and opaque account IDs reduce exposure; they do not automatically anonymize the data. Assess replay risks, sensitive pages, children, sector/state rules and whether a DPIA or other assessment is needed.
6. **Test the deployed result.** Confirm zero optional SDK activity before choice/after rejection; analytics-only and replay-only behaviour; reloads, expiry/version changes, disabled storage, cross-tab withdrawal, GPC, error pages, mobile controls and keyboard access. Recheck after changing vendors or features.

## Implementation and tests

- `packages/observability/src/consent.ts`: record format, policy version, expiry and validation.
- `packages/observability/src/browser.ts`: permission checks, GPC, SDK initialization and shutdown.
- `packages/shared/src/components/analytics.tsx`: shared banner and preferences.
- `apps/marketing/src/routes/privacy.tsx`: public example notice; replace its business-specific details.
- `tests/unit/consent.test.ts`: invalid/expired/changed-policy records.
- `tests/browser/observability.spec.ts`: intercepted real-SDK checks, granular purposes, GPC, blocked storage, withdrawal, masking and phone layout.

Run `pnpm test:unit`, `pnpm test:browser observability.spec.ts` and `pnpm test:browser --dev observability.spec.ts`. Fixture events never go to your live PostHog project. Test live ingestion, storage and deletion separately using authorized test data.
