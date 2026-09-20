declare module 'xlsx' {
  export function read(
    data: ArrayBuffer | Uint8Array,
    opts?: { type?: string; cellDates?: boolean },
  ): { SheetNames: string[]; Sheets: Record<string, unknown> };
  export const utils: {
    sheet_to_json(sheet: unknown, opts?: { defval?: unknown; raw?: boolean }): unknown[];
  };
}
