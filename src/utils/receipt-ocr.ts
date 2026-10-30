import { Platform } from 'react-native';
import { isSupported, recognizeText } from 'expo-mlkit-ocr';

import { buildReadingOrderText } from '@/utils/ocr-layout';

export type ReceiptOcrUnavailableReason = 'web' | 'unsupported-device';

export type ReceiptOcrUnavailable = {
  supported: false;
  reason: ReceiptOcrUnavailableReason;
};

export type ReceiptOcrResult = { supported: true; text: string } | ReceiptOcrUnavailable;

export type ReceiptOcrErrorCode =
  | 'invalid-uri'
  | 'image-load-failed'
  | 'recognition-failed'
  | 'empty-text';

/** Error with a stable code so the scan screen can show a useful message. */
export class ReceiptOcrError extends Error {
  readonly code: ReceiptOcrErrorCode;

  constructor(code: ReceiptOcrErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ReceiptOcrError';
    this.code = code;
  }
}

/** Whether on-device OCR can run on this platform and device. */
export function getReceiptOcrAvailability(): ReceiptOcrUnavailable | null {
  if (Platform.OS === 'web') {
    return { supported: false, reason: 'web' };
  }

  try {
    if (!isSupported()) {
      return { supported: false, reason: 'unsupported-device' };
    }
  } catch (error) {
    console.error('Failed to check OCR support', error);
    return { supported: false, reason: 'unsupported-device' };
  }

  return null;
}

/** Reads all visible text from an image. Runs entirely on the device. */
export async function readReceiptText(uri: string): Promise<ReceiptOcrResult> {
  const unavailable = getReceiptOcrAvailability();
  if (unavailable) {
    return unavailable;
  }

  if (!uri.trim()) {
    throw new ReceiptOcrError('invalid-uri', 'The selected image is not valid.');
  }

  try {
    const result = await recognizeText(uri);
    const lines = result.blocks?.flatMap((block) => block.lines ?? []) ?? [];
    // Prefer the visual reading order, which repairs column-first OCR output.
    const text = buildReadingOrderText(lines) ?? result.text?.trim() ?? '';

    if (!text) {
      throw new ReceiptOcrError(
        'empty-text',
        'No readable text was found in this image.'
      );
    }

    return { supported: true, text };
  } catch (error) {
    if (error instanceof ReceiptOcrError) {
      throw error;
    }

    console.error('Receipt OCR failed', error);
    throw new ReceiptOcrError(
      'recognition-failed',
      'The receipt could not be read. Try another photo.',
      { cause: error }
    );
  }
}

/** User-facing message for an OCR failure. */
export function receiptOcrErrorMessage(error: unknown): string {
  if (error instanceof ReceiptOcrError) {
    switch (error.code) {
      case 'empty-text':
        return 'No readable text was found. Try a clearer, well-lit photo.';
      case 'invalid-uri':
        return 'That image could not be opened. Choose another photo.';
      case 'image-load-failed':
        return 'That image could not be opened. Choose another photo.';
      case 'recognition-failed':
        return 'The receipt could not be read. Try another photo.';
    }
  }

  return 'The receipt could not be read. Try another photo.';
}
