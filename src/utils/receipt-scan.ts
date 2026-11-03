import * as ImagePicker from 'expo-image-picker';

import {
  parseReceiptText,
  type ParsedReceipt,
  type ReceiptKind,
} from '@/utils/receipt-parser';
import {
  getReceiptOcrAvailability,
  readReceiptText,
  receiptOcrErrorKey,
  type ReceiptOcrUnavailableReason,
} from '@/utils/receipt-ocr';

/** Set `EXPO_PUBLIC_DEBUG_RECEIPT_SCAN=1` to log the parsed receipt while testing. */
const DEBUG_RECEIPT_SCAN = process.env.EXPO_PUBLIC_DEBUG_RECEIPT_SCAN === '1';

export type ReceiptScanResult =
  | { status: 'canceled' }
  | { status: 'success'; receipt: ParsedReceipt }
  | { status: 'unavailable'; reason: ReceiptOcrUnavailableReason }
  | { status: 'error'; messageKey: string };

/**
 * Lets the user pick a receipt photo from the gallery, reads its text on the
 * device, and parses it into the fields the transaction forms need.
 */
export async function scanReceiptFromGallery(kind: ReceiptKind): Promise<ReceiptScanResult> {
  const unavailable = getReceiptOcrAvailability();
  if (unavailable) {
    return { status: 'unavailable', reason: unavailable.reason };
  }

  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return {
        status: 'error',
        messageKey: permission.canAskAgain
          ? 'receipt.errors.permissionRequired'
          : 'receipt.errors.permissionBlocked',
      };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });

    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) {
      return { status: 'canceled' };
    }

    const ocr = await readReceiptText(asset.uri);
    if (!ocr.supported) {
      return { status: 'unavailable', reason: ocr.reason };
    }

    const receipt = parseReceiptText(ocr.text, { kind });
    if (DEBUG_RECEIPT_SCAN) {
      console.log('[receipt-scan] raw OCR text:\n' + ocr.text);
      console.log('[receipt-scan] parsed receipt', receipt);
    }

    return { status: 'success', receipt };
  } catch (error) {
    console.error('Failed to scan a receipt image', error);
    return { status: 'error', messageKey: receiptOcrErrorKey(error) };
  }
}

/** i18n key for the user-facing message of an unsupported OCR environment. */
export function receiptScanUnavailableKey(reason: ReceiptOcrUnavailableReason): string {
  return reason === 'web' ? 'receipt.unavailableWeb' : 'receipt.unavailableDevice';
}
