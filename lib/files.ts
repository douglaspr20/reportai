// Los tipos que acepta la visión del modelo (sin AVIF) más PDF.
export const ACCEPTED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const;

export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export function isAccepted(type: string) {
  return (ACCEPTED_MIME_TYPES as readonly string[]).includes(type);
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}
