/**
 * The deployment this app reads and writes. The default is the deployment of
 * record, whose bytes were verified against contracts/icarus.py; an
 * environment override points a checkout at another deployment (a disposable
 * one for testing), and the app says so on every sheet it renders.
 */
export const RECORD_ADDRESS = "0xb476eeF34fe8800E546D140DA3412846DD0A1755";

const override = process.env.NEXT_PUBLIC_ICARUS_CONTRACT?.trim() ?? "";

export const CONTRACT_ADDRESS = (override || RECORD_ADDRESS) as `0x${string}`;
export const CONTRACT_CONFIGURED = /^0x[0-9a-fA-F]{40}$/.test(CONTRACT_ADDRESS);
export const IS_RECORD = CONTRACT_ADDRESS.toLowerCase() === RECORD_ADDRESS.toLowerCase();

/** The sha256 of the contract source these bytes were compiled from. */
export const SOURCE_SHA256 =
  "4801f35b9e4d1f1891eb9805025b47e7072cdce519c591c5a1ddc618ae9a5b3e";

/** The repository whose contract file this deployment was built from. */
export const REPO_URL = "https://github.com/Hemmy1417/Icarus";
export const SOURCE_URL = `${REPO_URL}/blob/main/contracts/icarus.py`;
