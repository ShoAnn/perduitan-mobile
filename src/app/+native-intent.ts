import { getShareExtensionKey } from 'expo-share-intent';

/**
 * Expo Router hook for OS-originated deeplinks. A share from another app arrives
 * as a link carrying expo-share-intent's key; route it to the handler screen that
 * reads the payload with `useShareIntentContext`.
 */
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: string | boolean;
}) {
  try {
    if (path.includes(`dataUrl=${getShareExtensionKey()}`)) {
      return '/shared-receipt';
    }
    return path;
  } catch {
    return '/';
  }
}
