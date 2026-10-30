/**
 * OCR engines commonly emit receipt text column by column, for example every
 * label first and then every amount. That order is useless for line-based
 * parsing, so this module rebuilds the visual rows from the bounding boxes the
 * OCR engine already returns.
 */

export type OcrBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OcrLayoutLine = {
  text: string;
  boundingBox?: Partial<OcrBoundingBox>;
};

type PositionedLine = {
  text: string;
  box: OcrBoundingBox;
};

type Row = {
  lines: PositionedLine[];
  top: number;
  bottom: number;
};

function hasBox(box: Partial<OcrBoundingBox> | undefined): box is OcrBoundingBox {
  return (
    box != null &&
    Number.isFinite(box.x) &&
    Number.isFinite(box.y) &&
    Number.isFinite(box.width) &&
    Number.isFinite(box.height)
  );
}

/**
 * Groups lines whose vertical extents overlap into rows, then joins each row
 * left to right. Returns `null` when no line has usable geometry.
 */
export function buildReadingOrderText(lines: OcrLayoutLine[]): string | null {
  const positioned: PositionedLine[] = [];
  for (const line of lines) {
    if (line.text.trim().length > 0 && hasBox(line.boundingBox)) {
      positioned.push({ text: line.text.trim(), box: line.boundingBox });
    }
  }

  if (positioned.length === 0) {
    return null;
  }

  positioned.sort((a, b) => {
    const aCenter = a.box.y + a.box.height / 2;
    const bCenter = b.box.y + b.box.height / 2;
    if (aCenter !== bCenter) {
      return aCenter - bCenter;
    }
    return a.box.x - b.box.x;
  });

  const rows: Row[] = [];

  for (const line of positioned) {
    const top = line.box.y;
    const bottom = line.box.y + line.box.height;
    const height = Math.max(line.box.height, 1);

    const row = rows.find((candidate) => {
      const overlap = Math.min(bottom, candidate.bottom) - Math.max(top, candidate.top);
      const minHeight = Math.min(height, candidate.bottom - candidate.top);
      return overlap >= minHeight * 0.5;
    });

    if (row) {
      row.lines.push(line);
      row.top = Math.min(row.top, top);
      row.bottom = Math.max(row.bottom, bottom);
    } else {
      rows.push({ lines: [line], top, bottom });
    }
  }

  const text = rows
    .map((row) =>
      row.lines
        .sort((a, b) => a.box.x - b.box.x)
        .map((line) => line.text)
        .join(' ')
        .trim()
    )
    .filter((line) => line.length > 0)
    .join('\n');

  return text || null;
}
