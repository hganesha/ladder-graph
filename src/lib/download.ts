export function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  clickDownload(name, url);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadText(name: string, content: string, type: string) {
  downloadBlob(name, new Blob([content], { type }));
}

export function downloadUrl(name: string, url: string) {
  clickDownload(name, url);
}

function clickDownload(name: string, url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
}
