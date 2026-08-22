/**
 * Merchant identity — the single source of truth for the business details a
 * payment aggregator has to be able to verify from the public site.
 *
 * BillDesk (and every RBI-regulated payment aggregator) rejects an application
 * when the operating entity's name, address, phone and contact email are not
 * publicly displayed and consistent with the KYC documents on file. Keeping
 * them in one module means /contact, /refunds, /pricing and the footer can
 * never drift apart — a mismatch between two pages reads to a reviewer as an
 * unverifiable merchant.
 *
 * Every value here MUST match the corresponding field on the merchant
 * application and on the bank account the payouts settle into.
 */

/**
 * Legal name of the entity that receives settlements. This must match the
 * bank account's beneficiary name and the name on the PAN exactly — a
 * mismatch here is the single most common cause of a rejected application.
 */
export const LEGAL_NAME = "Adarsh Yadav";

/** Consumer-facing brand. May differ from LEGAL_NAME; both are disclosed. */
export const TRADE_NAME = "GetInShape";

/**
 * Operating address, shown on /contact. An aggregator's reviewer checks this
 * against the address proof submitted with the application, so it must be the
 * full postal address including state and PIN code — not a city alone.
 *
 * Leave any line empty and the address block is omitted rather than rendered
 * half-filled: a partial address is worse than none, because it reads as
 * "incomplete/missing details" on the reviewer's checklist.
 */
export const ADDRESS: readonly string[] = [];

export const SUPPORT_EMAIL = "adarshyadavazm123@gmail.com";

/** E.164 for the tel: link; DISPLAY is the human-readable form. */
export const SUPPORT_PHONE_E164 = "+918470900910";
export const SUPPORT_PHONE_DISPLAY = "+91 84709 00910";

/** Indian Standard Time — stated explicitly so support hours are unambiguous. */
export const SUPPORT_HOURS = "Monday to Saturday, 10:00 AM to 7:00 PM IST";

/** Android package id of the Play listing — matches twa-manifest.json. */
export const ANDROID_PACKAGE_ID = "in.co.getinshape.app";

export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_ID}`;

/**
 * Whether the Play listing is publicly resolvable. While the app is still on
 * an internal or closed testing track the store URL 404s for anyone outside
 * the tester list, and a dead link on the site is worse than no link — it
 * confirms "application is not live" rather than refuting it. Flip to true
 * only once the production listing is live.
 */
export const PLAY_LISTING_IS_PUBLIC = false;

/** True when a complete postal address is available to render. */
export const hasAddress = ADDRESS.length > 0;
