import { getShareExtensionKey } from 'expo-share-intent';

import { logShareIntent } from '@/utils/share-intent-log';

/**
 * Expo Router hook for OS-originated deeplinks. On iOS a share arrives as a
 * link carrying expo-share-intent's key; route it to the handler screen that
 * reads the payload with `useShareIntentContext`. Android shares never arrive
 * as a deeplink — `ShareIntentRedirect` in `_layout.tsx` handles those.
 */
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: string | boolean;
}) {
  try {
    if (path.includes(`dataUrl=${getShareExtensionKey()}`)) {
      logShareIntent('native-intent matched share extension key, routing to /shared-receipt');
      return '/shared-receipt';
    }
    logShareIntent('native-intent no share key, keeping path', path);
    return path;
  } catch (error) {
    logShareIntent('native-intent failed, routing to /', error);
    return '/';
  }
}
