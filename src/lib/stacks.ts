import { AppConfig, UserSession, showConnect, openContractCall } from '@stacks/connect';
import { uintCV, principalCV, PostConditionMode } from '@stacks/transactions';

const appConfig = new AppConfig(['store_write', 'publish_data']);
export const userSession = new UserSession({ appConfig });

export const authenticate = () => {
  showConnect({
    appDetails: {
      name: 'BTCBoost',
      icon: '/favicon.ico',
    },
    redirectTo: '/vault',
    onFinish: () => { window.location.reload(); },
    userSession,
  });
};

export const disconnect = () => { userSession.signUserOut('/vault'); };

export const getNetwork = () => 'testnet' as const;

export const CONTRACT_ADDRESS = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
export const CONTRACT_NAME = 'sbtc-usdcx-vault';

// ─── Balance fetching via Hiro API ───────────────────────────────
export interface Balances {
  stx: string;     // in STX (human readable)
  sbtc: string;    // in sBTC (human readable)
  usdcx: string;   // in USDCx (human readable)
}

const HIRO_API = 'https://api.testnet.hiro.so';

// Token contract IDs on Stacks Testnet (standard mock addresses)
const SBTC_CONTRACT  = `${CONTRACT_ADDRESS}.mock-sbtc`;
const USDCX_CONTRACT = `${CONTRACT_ADDRESS}.mock-usdcx`;

export async function fetchBalances(addr: string): Promise<Balances> {
  try {
    // STX balance
    const stxRes = await fetch(`${HIRO_API}/v2/accounts/${addr}?proof=0`);
    const stxData = await stxRes.json();
    const stxRaw = Number(stxData?.balance ?? '0');
    const stx = (stxRaw / 1_000_000).toFixed(4);

    // Fungible token balances
    const ftRes = await fetch(`${HIRO_API}/v1/address/${addr}/balances`);
    const ftData = await ftRes.json();
    const tokens: Record<string, { balance: string }> = ftData?.fungible_tokens ?? {};

    // sBTC (8 decimals)
    const sbtcKey = Object.keys(tokens).find(k => k.startsWith(SBTC_CONTRACT));
    const sbtcRaw = Number(sbtcKey ? tokens[sbtcKey].balance : '0');
    const sbtc = (sbtcRaw / 1e8).toFixed(8);

    // USDCx (6 decimals)
    const usdcxKey = Object.keys(tokens).find(k => k.startsWith(USDCX_CONTRACT));
    const usdcxRaw = Number(usdcxKey ? tokens[usdcxKey].balance : '0');
    const usdcx = (usdcxRaw / 1e6).toFixed(2);

    return { stx, sbtc, usdcx };
  } catch {
    return { stx: '0.0000', sbtc: '0.00000000', usdcx: '0.00' };
  }
}

// ─── Contract calls ───────────────────────────────────────────────
export const depositSbtc = async (amount: number) => {
  const amountMicro = Math.round(amount * 100_000_000);
  await openContractCall({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'deposit-sbtc',
    functionArgs: [uintCV(amountMicro), principalCV(`${CONTRACT_ADDRESS}.mock-sbtc`)],
    network: getNetwork(),
    postConditionMode: PostConditionMode.Allow,
    onFinish: (data: { txId: string }) => { console.log('Deposit tx:', data.txId); },
  });
};

export const boostYield = async (leverage: number) => {
  await openContractCall({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'boost-yield',
    functionArgs: [uintCV(leverage)],
    network: getNetwork(),
    postConditionMode: PostConditionMode.Allow,
    onFinish: (data: { txId: string }) => { console.log('Boost tx:', data.txId); },
  });
};
