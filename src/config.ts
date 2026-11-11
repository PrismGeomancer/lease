export const CONFIG = {
  PROJECT_NAME: 'LEASE',
  TICKER: '$LEASE',
  TOKEN_CA: '', // empty => pre-launch state everywhere
  OFFICE_ADDRESS: '', // Lease Office pubkey; empty => "Record on-chain" hidden, register reads samples only
  X_URL: '',
  TELEGRAM_URL: '',
  GITHUB_URL: '',
  BUY_URL: '', // label is "View market", a different label on purpose
  RPC_URL: '', // Helius RPC with a DOMAIN-RESTRICTED key
  HELIUS_API_BASE: '', // e.g. https://api.helius.xyz
  PUBLIC_RPC_FALLBACK: 'https://api.mainnet-beta.solana.com',
  DEXSCREENER_BASE: 'https://api.dexscreener.com',
  EXPLORER_TX: 'https://solscan.io/tx/',
  EXPLORER_ACCOUNT: 'https://solscan.io/account/',
  DATA_BASE: './data/',
  ROUND_INTERVAL_MIN: 30,
} as const;

export type Config = typeof CONFIG;
