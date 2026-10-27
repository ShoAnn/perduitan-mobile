/** Whether a failed write hit a `UNIQUE` constraint, for example a duplicate name. */
export function isUniqueConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('UNIQUE constraint failed');
}
