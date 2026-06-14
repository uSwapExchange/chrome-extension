export function extensionVersion(): string {
  return chrome.runtime.getManifest().version;
}
