/**
 * Saves text as a file through the browser's download. The link joins the page
 * and is released a tick later: some browsers ignore a click on a detached link
 * or cancel a download whose URL is revoked straight away.
 */
export function downloadTextFile(filename: string, text: string, type = "text/csv;charset=utf-8"): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
