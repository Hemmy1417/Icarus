/**
 * The deployment this app reads and writes. The default is the deployment of
 * record, whose bytes were verified against contracts/icarus.py; an
 * environment override points a checkout at another deployment (a disposable
 * one for testing), and the app says so on every sheet it renders.
 */
export const RECORD_ADDRESS = "0x5Ea657820B3355E310BAf2f71282D518cD398cfc";

const override = process.env.NEXT_PUBLIC_ICARUS_CONTRACT?.trim() ?? "";

export const CONTRACT_ADDRESS = (override || RECORD_ADDRESS) as `0x${string}`;
export const CONTRACT_CONFIGURED = /^0x[0-9a-fA-F]{40}$/.test(CONTRACT_ADDRESS);
export const IS_RECORD = CONTRACT_ADDRESS.toLowerCase() === RECORD_ADDRESS.toLowerCase();

/** The sha256 of the contract source these bytes were compiled from. */
export const SOURCE_SHA256 =
  "ccfc1c1e8c00bd75d38f75a435517e3c8b05fb35d65f2be1706b234e96d396db";

/** The repository whose contract file this deployment was built from. */
export const REPO_URL = "https://github.com/Hemmy1417/Icarus";
export const SOURCE_URL = `${REPO_URL}/blob/main/contracts/icarus.py`;
