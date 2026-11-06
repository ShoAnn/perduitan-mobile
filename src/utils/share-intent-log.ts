/**
 * Set `EXPO_PUBLIC_DEBUG_RECEIPT_SCAN=1` to log the file-sharing intent flow
 * while testing. Same flag as the receipt scanner and the
 * `ShareIntentProvider` debug option, so one env var covers the whole flow.
 */
export const DEBUG_SHARE_INTENT = process.env.EXPO_PUBLIC_DEBUG_RECEIPT_SCAN === '1';

/** Logs only when `DEBUG_SHARE_INTENT` is on. Never log raw file bytes or base64. */
export function logShareIntent(tag: string, ...args: unknown[]): void {
  if (DEBUG_SHARE_INTENT) {
    console.log(`[share-intent] ${tag}`, ...args);
  }
}
