import * as ImagePicker from 'expo-image-picker';

import {
  parseReceiptText,
  type ParsedReceipt,
  type ReceiptKind,
} from '@/utils/receipt-parser';
import {
  getReceiptOcrAvailability,
  readReceiptText,
  receiptOcrErrorMessage,
  type ReceiptOcrUnavailableReason,
} from '@/utils/receipt-ocr';

export type ReceiptScanResult =
  | { status: 'canceled' }
  | { status: 'success'; receipt: ParsedReceipt }
  | { status: 'unavailable'; reason: ReceiptOcrUnavailableReason }
  | { status: 'error'; message: string };

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
        message: permission.canAskAgain
          ? 'Gallery access is required to choose a receipt photo.'
          : 'Gallery access is blocked. Enable it in Settings to choose a receipt photo.',
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

    return { status: 'success', receipt: parseReceiptText(ocr.text, { kind }) };
  } catch (error) {
    console.error('Failed to scan a receipt image', error);
    return { status: 'error', message: receiptOcrErrorMessage(error) };
  }
}

/** User-facing message for an unsupported OCR environment. */
export function receiptScanUnavailableMessage(reason: ReceiptOcrUnavailableReason): string {
  return reason === 'web'
    ? 'Receipt scanning is not available on web. Enter the transaction manually.'
    : 'This device does not support on-device text recognition. Enter the transaction manually.';
}
