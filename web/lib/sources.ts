/**
 * The sites two parties name as sources for a product.
 *
 * Terms may list sites both parties accept. Where they do, the contract
 * refuses a substitute's product page that sits anywhere else on a line
 * signed "or equivalent", and nobody is asked who published the page. These
 * helpers say the same thing at the form, so a person is told there and not
 * by a refused transaction.
 */

const HOSTNAME = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
const NOT_PUBLIC = [
  ".local", ".internal", ".test", ".localhost", ".invalid", ".example",
  ".lan", ".home", ".corp", ".arpa", ".onion", ".nip.io", ".sslip.io",
];

/** What a person typed, one site to a line or separated by commas, as names. */
export function sitesTyped(text: string): string[] {
  const out: string[] = [];
  for (const part of text.split(/[\s,]+/)) {
    const site = part.trim().toLowerCase();
    if (site && !out.includes(site)) out.push(site);
  }
  return out;
}

/** What is wrong with a list of sites before it is signed, or "" when it can go. */
export function sitesProblem(sites: string[], most = 8): string {
  if (sites.length > most) return `Name at most ${most} sites.`;
  for (const site of sites) {
    if (site.length > 253 || !HOSTNAME.test(site) || NOT_PUBLIC.some((end) => site.endsWith(end))) {
      return `Write each site as its name alone, such as maker.com. This one is not: ${site}`;
    }
  }
  return "";
}

/**
 * Whether a link sits on one of the named sites: that host exactly, or its
 * www. Nothing else under a name passes for it; a subdomain is named itself.
 */
export function onNamedSite(url: string, sites: string[]): boolean {
  const host = (/^[^/?#]*/.exec(url.slice(8))?.[0] ?? "").toLowerCase();
  return sites.some((site) => host === site || host === `www.${site}`);
}

/** The sites as one phrase: "a.com", "a.com and b.com", "a.com, b.com and c.com". */
export function sitesList(sites: string[]): string {
  if (sites.length < 2) return sites.join("");
  return `${sites.slice(0, -1).join(", ")} and ${sites[sites.length - 1]}`;
}
