import {
  AppConfig,
  UserSession,
  showConnect,
  openContractCall,
} from '@stacks/connect';
import { STACKS_TESTNET } from '@stacks/network';
import {
  uintCV,
  principalCV,
  PostConditionMode,
  fetchCallReadOnlyFunction,
  cvToValue,
} from '@stacks/transactions';

// ─── App Session ───────────────────────────────────────────────────────────
const appConfig = new AppConfig(['store_write', 'publish_data']);
export const userSession = new UserSession({ appConfig });

// ─── Contract Addresses ────────────────────────────────────────────────────
// NOTE: These should match the currently-deployed v2 contracts on testnet.
export const CONTRACT_ADDRESS = 'ST14RA6VWTZJF2ZNK3G83A40BC0CBK31MCAEGS1HX';
export const CONTRACT_NAME = 'sbtc-usdcx-vault-v2';
export const SBTC_CONTRACT_ID = `${CONTRACT_ADDRESS}.mock-sbtc-v2`;
export const USDCX_CONTRACT_ID = `${CONTRACT_ADDRESS}.mock-usdcx-v2`;
export const VAULT_CONTRACT_ID = `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`;

// ─── Explorer ──────────────────────────────────────────────────────────────
export function explorerTxUrl(txId: string) {
  return `https://explorer.hiro.so/txid/${txId}?chain=testnet`;
}

// ─── Wallet Auth ───────────────────────────────────────────────────────────
export const authenticate = () => {
  showConnect({
    appDetails: {
      name: 'BTCBoost',
      icon: `${typeof window !== 'undefined' ? window.location.origin : ''}/favicon.ico`,
    },
    redirectTo: '/vault',
    onFinish: () => { window.location.reload(); },
    userSession,
  });
};

export const disconnect = () => { userSession.signUserOut('/vault'); };

// ─── Balance Fetching ──────────────────────────────────────────────────────
export interface Balances {
  stx: string;
  sbtc: string;
  usdcx: string;
}

const HIRO_API = 'https://api.testnet.hiro.so';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForTransaction(txId: string, opts?: { timeoutMs?: number; pollMs?: number }) {
  const timeoutMs = opts?.timeoutMs ?? 120_000;
  let pollMs = opts?.pollMs ?? 2_000;
  const startedAt = Date.now();

  while (true) {
    // NOTE: endpoint returns tx_status and tx_result with VM abort reason on failure.
    const res = await fetch(`${HIRO_API}/extended/v1/tx/${txId}`);
    if (res.ok) {
      const data = await res.json();
      const status = String(data?.tx_status ?? '');
      if (status === 'success') return data;

      // Any non-success terminal status should throw with the contract's error code.
      if (
        status &&
        status !== 'pending' &&
        status !== 'processing' &&
        status !== 'unknown'
      ) {
        const repr = data?.tx_result?.repr ? String(data.tx_result.repr) : status;
        throw new Error(`Transaction failed: ${repr}`);
      }
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Timed out waiting for transaction confirmation');
    }

    await sleep(pollMs);
    pollMs = Math.min(Math.round(pollMs * 1.25), 8_000);
  }
}

export async function fetchBalances(addr: string): Promise<Balances> {
  try {
    const [stxRes, ftRes] = await Promise.all([
      fetch(`${HIRO_API}/v2/accounts/${addr}?proof=0`),
      fetch(`${HIRO_API}/v1/address/${addr}/balances`),
    ]);
    const stxData = await stxRes.json();
    const ftData  = await ftRes.json();

    const stxRaw = Number(stxData?.balance ?? '0');
    const stx = (stxRaw / 1_000_000).toFixed(4);

    const tokens: Record<string, { balance: string }> = ftData?.fungible_tokens ?? {};
    const sbtcKey  = Object.keys(tokens).find(k => k.startsWith(SBTC_CONTRACT_ID));
    const usdcxKey = Object.keys(tokens).find(k => k.startsWith(USDCX_CONTRACT_ID));

    const sbtc  = (Number(sbtcKey  ? tokens[sbtcKey!].balance  : '0') / 1e8).toFixed(8);
    const usdcx = (Number(usdcxKey ? tokens[usdcxKey!].balance : '0') / 1e6).toFixed(2);

    return { stx, sbtc, usdcx };
  } catch {
    return { stx: '0.0000', sbtc: '0.00000000', usdcx: '0.00' };
  }
}

// ─── On-chain Vault Info ───────────────────────────────────────────────────
export interface VaultInfo {
  depositedSbtc: number;
  borrowedUsdcx: number;
  accruedYield:  number;
  lastUpdate:    number;
}

export async function getVaultInfo(userAddress: string): Promise<VaultInfo> {
  try {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName:    CONTRACT_NAME,
      functionName:    'get-vault-info',
      functionArgs:    [principalCV(userAddress)],
      network:         STACKS_TESTNET,
      senderAddress:   userAddress,
    });

    // cvToValue returns a plain JS object when given a tuple CV
    const val = cvToValue(result) as Record<string, string | number>;

    return {
      depositedSbtc: Number(val['deposited-sbtc'] ?? 0),
      borrowedUsdcx: Number(val['borrowed-usdcx'] ?? 0),
      accruedYield:  Number(val['accrued-yield']  ?? 0),
      lastUpdate:    Number(val['last-update']    ?? 0),
    };
  } catch {
    return { depositedSbtc: 0, borrowedUsdcx: 0, accruedYield: 0, lastUpdate: 0 };
  }
}

// ─── Contract Calls ────────────────────────────────────────────────────────

/** Deposit sBTC — returns txId */
export const depositSbtc = (amount: number): Promise<string> =>
  new Promise((resolve, reject) => {
    const amountMicro = Math.round(amount * 100_000_000);
    openContractCall({
      contractAddress:   CONTRACT_ADDRESS,
      contractName:      CONTRACT_NAME,
      functionName:      'deposit-sbtc',
      functionArgs:      [uintCV(amountMicro), principalCV(SBTC_CONTRACT_ID)],
      network:           STACKS_TESTNET,
      postConditionMode: PostConditionMode.Allow,
      onFinish:  (data) => resolve(data.txId),
      onCancel:  ()     => reject(new Error('User cancelled deposit')),
    });
  });

/** Boost yield (activate leverage loop) — returns txId */
export const boostYield = (leverage: number): Promise<string> =>
  new Promise((resolve, reject) => {
    openContractCall({
      contractAddress:   CONTRACT_ADDRESS,
      contractName:      CONTRACT_NAME,
      functionName:      'boost-yield',
      functionArgs:      [uintCV(leverage)],
      network:           STACKS_TESTNET,
      postConditionMode: PostConditionMode.Allow,
      onFinish:  (data) => resolve(data.txId),
      onCancel:  ()     => reject(new Error('User cancelled boost')),
    });
  });

/** Claim accrued USDCx yield — returns txId */
export const claimYield = (): Promise<string> =>
  new Promise((resolve, reject) => {
    openContractCall({
      contractAddress:   CONTRACT_ADDRESS,
      contractName:      CONTRACT_NAME,
      functionName:      'claim-yield',
      functionArgs:      [principalCV(USDCX_CONTRACT_ID)],
      network:           STACKS_TESTNET,
      postConditionMode: PostConditionMode.Allow,
      onFinish:  (data) => resolve(data.txId),
      onCancel:  ()     => reject(new Error('User cancelled claim')),
    });
  });

/** Withdraw sBTC from the vault — returns txId */
export const withdrawSbtc = (amount: number): Promise<string> =>
  new Promise((resolve, reject) => {
    const amountMicro = Math.round(amount * 100_000_000);
    openContractCall({
      contractAddress:   CONTRACT_ADDRESS,
      contractName:      CONTRACT_NAME,
      functionName:      'withdraw-sbtc',
      functionArgs:      [uintCV(amountMicro), principalCV(SBTC_CONTRACT_ID)],
      network:           STACKS_TESTNET,
      postConditionMode: PostConditionMode.Allow,
      onFinish:  (data) => resolve(data.txId),
      onCancel:  ()     => reject(new Error('User cancelled withdrawal')),
    });
  });
