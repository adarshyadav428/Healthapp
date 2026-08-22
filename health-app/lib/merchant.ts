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
 * Legal name of the entity that receives settlements: the sole
 * proprietorship registered on Udyam as UDYAM-UP-07-0114396. A
 * proprietorship has no PAN of its own — it operates under the proprietor's
 * personal PAN by law — so "Adarsh Yadav" correctly appears as the PAN and
 * bank names while this is the registered business name. What must match
 * across every source is the *bank account*: BillDesk requires a current
 * account in this business name, not the proprietor's personal savings
 * account, once a business entity is the applicant.
 */
export const LEGAL_NAME = "Adarsh Medicals";

/** Consumer-facing brand. May differ from LEGAL_NAME; both are disclosed. */
export const TRADE_NAME = "GetInShape";

/**
 * Operating address, shown on /contact. Sourced verbatim from the Udyam
 * registration certificate (UDYAM-UP-07-0114396) and confirmed against the
 * D-U-N-S record Google holds — the two agree, so this is the address an
 * aggregator's reviewer will find on both documents.
 *
 * Leave any line empty and the address block is omitted rather than rendered
 * half-filled: a partial address is worse than none, because it reads as
 * "incomplete/missing details" on the reviewer's checklist.
 */
export const ADDRESS: readonly string[] = [
  "Khasra No. 157 Kha, First Floor",
  "Near Thekma Bus Stop, Village Thekma, PS Barda",
  "Martinganj, Azamgarh, Uttar Pradesh 276303",
  "India",
];

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
