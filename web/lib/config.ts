/**
 * The deployment this app reads and writes. The default is the deployment of
 * record, whose bytes were verified against contracts/icarus.py; an
 * environment override points a checkout at another deployment (a disposable
 * one for testing), and the app says so on every sheet it renders.
 */
export const RECORD_ADDRESS = "0xE09F8E2440FF22D0586632Ec35a3Fd49ea0261b9";

const override = process.env.NEXT_PUBLIC_ICARUS_CONTRACT?.trim() ?? "";

export const CONTRACT_ADDRESS = (override || RECORD_ADDRESS) as `0x${string}`;
export const CONTRACT_CONFIGURED = /^0x[0-9a-fA-F]{40}$/.test(CONTRACT_ADDRESS);
export const IS_RECORD = CONTRACT_ADDRESS.toLowerCase() === RECORD_ADDRESS.toLowerCase();

/** The sha256 of the contract source these bytes were compiled from. */
export const SOURCE_SHA256 =
  "ed4526aaa8c032f8d8eb5783a3659ba27280eb7f40a12c5e52f1ef2b546711d9";

/** The repository whose contract file this deployment was built from. */
export const REPO_URL = "https://github.com/Hemmy1417/Icarus";
export const SOURCE_URL = `${REPO_URL}/blob/main/contracts/icarus.py`;
