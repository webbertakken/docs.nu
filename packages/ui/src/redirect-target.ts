// Where a client redirect sends the reader (docs/specs/018-help/help-app.md "Renamed articles"). `location.replace`
// drops the address's hash, so an old deep link's #section is carried onto the new address, unless the new address
// names its own section.
export function redirectTarget(href: string, hash: string): string {
  if (href.includes('#') || hash === '' || hash === '#') return href;
  return `${href}${hash}`;
}
