// ============================================================
// Nickel Querier — Save text files (native dialog / browser download)
// ============================================================
import { exportFile, isTauri } from "./commands";

export interface SaveOptions {
  fileName: string;
  contents: string;
  mime: string;
  filterName: string;
  extensions: string[];
}

/** `results-20261108-153012` */
export function timestampedName(prefix: string, ext: string, now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  return `${prefix}-${stamp}.${ext}`;
}

function browserDownload({ fileName, contents, mime }: SaveOptions): void {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Save a text file. In the desktop app a native "Save as" dialog is shown
 * (resolves to the path, or null if cancelled); in a browser the file is
 * downloaded (resolves to the file name).
 */
export async function saveTextFile(opts: SaveOptions): Promise<string | null> {
  if (isTauri) {
    return exportFile(opts.fileName, opts.contents, opts.filterName, opts.extensions);
  }
  browserDownload(opts);
  return opts.fileName;
}
