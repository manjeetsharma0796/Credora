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

const appConfig = new AppConfig(['store_write', 'publish_data']);
export const userSession = new UserSession({ appConfig });

export const CONTRACT_ADDRESS = 'ST14RA6VWTZJF2ZNK3G83A40BC0CBK31MCAEGS1HX';
export const ADMIN_ADDRESS = CONTRACT_ADDRESS;
export const CONTRACT_NAME = 'credora-vault';
export const VAULT_CONTRACT_ID = `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`;

export const SBTC_CONTRACT_ADDRESS = 'ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT';
export const SBTC_CONTRACT_NAME = 'sbtc-token';
export const SBTC_CONTRACT_ID = `${SBTC_CONTRACT_ADDRESS}.${SBTC_CONTRACT_NAME}`;

const HIRO_API = 'https://api.testnet.hiro.so';

export function explorerTxUrl(txId: string) {
    return `https://explorer.hiro.so/txid/${txId}?chain=testnet`;
}

export const authenticate = () => {
    showConnect({
        appDetails: {
            name: 'BTCBoost',
            icon: `${typeof window !== 'undefined' ? window.location.origin : ''}/favicon.ico`,
        },
        redirectTo: '/vault',
        onFinish: () => {
            window.location.reload();
        },
        userSession,
    });
};

export const disconnect = () => {
    userSession.signUserOut('/vault');
};

export interface Balances {
    stx: string;
    sbtc: string;
}

export interface VaultInfo {
    sbtcDeposited: number;
    stxBorrowed: number;
    interestOwed: number;
    totalOwed: number;
    currentLtv: number;
    isOpen: boolean;
    isLiquidatable: boolean;
}

export interface ProtocolStats {
    totalSbtcLocked: number;
    totalStxBorrowed: number;
    totalStxLiquidity: number;
    protocolFees: number;
    sbtcPriceUstx: number;
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function stringifyForLog(value: unknown): string {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

export async function waitForTransaction(txId: string, opts?: { timeoutMs?: number; pollMs?: number }) {
    const timeoutMs = opts?.timeoutMs ?? 120_000;
    let pollMs = opts?.pollMs ?? 2_000;
    const startedAt = Date.now();

    while (true) {
        const res = await fetch(`${HIRO_API}/extended/v1/tx/${txId}`);
        if (res.ok) {
            const data = await res.json();
            const status = String(data?.tx_status ?? '');
            if (status === 'success') return data;

            if (
                status &&
                status !== 'pending' &&
                status !== 'processing' &&
                status !== 'unknown'
            ) {
                const repr = data?.tx_result?.repr ? String(data.tx_result.repr) : status;
                const details = {
                    txId,
                    status,
                    tx_result: data?.tx_result,
                    burn_block_time: data?.burn_block_time,
                    error: data?.error,
                };
                console.error(`waitForTransaction terminal failure\n${stringifyForLog(details)}`);
                throw new Error(`Transaction failed: ${repr} [txid=${txId}]`);
            }
        }

        if (Date.now() - startedAt > timeoutMs) {
            console.error(`waitForTransaction timeout\n${stringifyForLog({ txId, timeoutMs })}`);
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
        const ftData = await ftRes.json();

        const stxRaw = Number(stxData?.balance ?? '0');
        const stx = (stxRaw / 1_000_000).toFixed(4);

        const tokens: Record<string, { balance: string }> = ftData?.fungible_tokens ?? {};
        const sbtcKey = Object.keys(tokens).find((k) => k.startsWith(SBTC_CONTRACT_ID));
        const sbtc = (Number(sbtcKey ? tokens[sbtcKey].balance : '0') / 1e8).toFixed(8);

        return { stx, sbtc };
    } catch {
        return { stx: '0.0000', sbtc: '0.00000000' };
    }
}

export async function getVaultInfo(userAddress: string): Promise<VaultInfo> {
    try {
        const result = await fetchCallReadOnlyFunction({
            contractAddress: CONTRACT_ADDRESS,
            contractName: CONTRACT_NAME,
            functionName: 'get-vault',
            functionArgs: [principalCV(userAddress)],
            network: STACKS_TESTNET,
            senderAddress: userAddress,
        });

        const val = cvToValue(result) as any;

        return {
            sbtcDeposited: Number(val?.value?.['sbtc-deposited']?.value ?? 0),
            stxBorrowed: Number(val?.value?.['stx-borrowed']?.value ?? 0),
            interestOwed: Number(val?.value?.['interest-owed']?.value ?? 0),
            totalOwed: Number(val?.value?.['total-owed']?.value ?? 0),
            currentLtv: Number(val?.value?.['current-ltv']?.value ?? 0),
            isOpen: Boolean(val?.value?.['is-open']?.value ?? false),
            isLiquidatable: Boolean(val?.value?.['is-liquidatable']?.value ?? false),
        };
    } catch {
        return {
            sbtcDeposited: 0,
            stxBorrowed: 0,
            interestOwed: 0,
            totalOwed: 0,
            currentLtv: 0,
            isOpen: false,
            isLiquidatable: false,
        };
    }
}

export async function getCurrentBlockHeight(): Promise<number> {
    try {
        const res = await fetch(`${HIRO_API}/v2/info`);
        const data = await res.json();
        return data.stacks_tip_height || 0;
    } catch {
        return 0;
    }
}

export async function getContractStateRawDebug(senderAddress: string) {
    try {
        // Try to read the contract state directly
        const blockRes = await fetch(`${HIRO_API}/v2/info`);
        const blockData = await blockRes.json();
        console.log('[DEBUG] Current block height:', blockData.stacks_tip_height);

        const result = await fetchCallReadOnlyFunction({
            contractAddress: CONTRACT_ADDRESS,
            contractName: CONTRACT_NAME,
            functionName: 'get-protocol-stats',
            functionArgs: [],
            network: STACKS_TESTNET,
            senderAddress,
        });

        console.log('[DEBUG] Contract returned:', result);
        const parsed = cvToValue(result);
        console.log('[DEBUG] Parsed:', parsed);
        return { blockHeight: blockData.stacks_tip_height, contractData: parsed };
    } catch (err) {
        console.error('[DEBUG ERROR]', err);
        return null;
    }
}

export async function getProtocolStats(senderAddress: string): Promise<ProtocolStats> {
    try {
        // Add cache-busting parameter
        const cacheKey = `?_t=${Date.now()}`;

        const result = await fetchCallReadOnlyFunction({
            contractAddress: CONTRACT_ADDRESS,
            contractName: CONTRACT_NAME,
            functionName: 'get-protocol-stats',
            functionArgs: [],
            network: STACKS_TESTNET,
            senderAddress,
        });

        const val = cvToValue(result) as any;

        console.log('[PROTOCOL] Raw contract result:', result);
        console.log('[PROTOCOL] Parsed cvToValue:', val);
        console.log('[PROTOCOL] Value structure:', JSON.stringify(val, null, 2));

        const stats = {
            totalSbtcLocked: Number(val?.value?.['total-sbtc-locked']?.value ?? 0),
            totalStxBorrowed: Number(val?.value?.['total-stx-borrowed']?.value ?? 0),
            totalStxLiquidity: Number(val?.value?.['total-stx-liquidity']?.value ?? 0),
            protocolFees: Number(val?.value?.['protocol-fees']?.value ?? 0),
            sbtcPriceUstx: Number(val?.value?.['sbtc-price-ustx']?.value ?? 0),
        };

        console.log('[PROTOCOL] Final Stats:', stats);
        console.log('[PROTOCOL] Total STX Liquidity (microSTX):', stats.totalStxLiquidity);
        console.log('[PROTOCOL] Total STX Liquidity (STX):', stats.totalStxLiquidity / 1_000_000);
        return stats;
    } catch (err) {
        console.error('[PROTOCOL ERROR]', err);
        return {
            totalSbtcLocked: 0,
            totalStxBorrowed: 0,
            totalStxLiquidity: 0,
            protocolFees: 0,
            sbtcPriceUstx: 0,
        };
    }
}

export const depositSbtc = (amountSbtc: number): Promise<string> =>
    new Promise((resolve, reject) => {
        const amountSats = Math.round(amountSbtc * 100_000_000);
        console.log('[DEPOSIT] Starting sBTC deposit', {
            amountSbtc,
            amountSats,
            sbtcContractId: SBTC_CONTRACT_ID,
            vaultContractId: VAULT_CONTRACT_ID,
        });
        openContractCall({
            contractAddress: CONTRACT_ADDRESS,
            contractName: CONTRACT_NAME,
            functionName: 'deposit-sbtc',
            functionArgs: [uintCV(amountSats), principalCV(SBTC_CONTRACT_ID)],
            network: STACKS_TESTNET,
            postConditionMode: PostConditionMode.Allow,
            onFinish: (data) => {
                console.log('[DEPOSIT] TX submitted:', data.txId);
                resolve(data.txId);
            },
            onCancel: () => reject(new Error('User cancelled deposit')),
        });
    });

export const borrowStx = (amountStx: number): Promise<string> =>
    new Promise((resolve, reject) => {
        const amountUstx = Math.round(amountStx * 1_000_000);
        openContractCall({
            contractAddress: CONTRACT_ADDRESS,
            contractName: CONTRACT_NAME,
            functionName: 'borrow-stx',
            functionArgs: [uintCV(amountUstx)],
            network: STACKS_TESTNET,
            postConditionMode: PostConditionMode.Allow,
            onFinish: (data) => resolve(data.txId),
            onCancel: () => reject(new Error('User cancelled borrow')),
        });
    });

export const repayStx = (amountStx: number): Promise<string> =>
    new Promise((resolve, reject) => {
        const amountUstx = Math.round(amountStx * 1_000_000);
        openContractCall({
            contractAddress: CONTRACT_ADDRESS,
            contractName: CONTRACT_NAME,
            functionName: 'repay-stx',
            functionArgs: [uintCV(amountUstx)],
            network: STACKS_TESTNET,
            postConditionMode: PostConditionMode.Allow,
            onFinish: (data) => resolve(data.txId),
            onCancel: () => reject(new Error('User cancelled repay')),
        });
    });

export const withdrawSbtc = (amountSbtc: number): Promise<string> =>
    new Promise((resolve, reject) => {
        const amountSats = Math.round(amountSbtc * 100_000_000);
        openContractCall({
            contractAddress: CONTRACT_ADDRESS,
            contractName: CONTRACT_NAME,
            functionName: 'withdraw-sbtc',
            functionArgs: [uintCV(amountSats), principalCV(SBTC_CONTRACT_ID)],
            network: STACKS_TESTNET,
            postConditionMode: PostConditionMode.Allow,
            onFinish: (data) => resolve(data.txId),
            onCancel: () => reject(new Error('User cancelled withdrawal')),
        });
    });

export const depositStxLiquidity = (amountStx: number): Promise<string> =>
    new Promise((resolve, reject) => {
        const amountUstx = Math.round(amountStx * 1_000_000);
        openContractCall({
            contractAddress: CONTRACT_ADDRESS,
            contractName: CONTRACT_NAME,
            functionName: 'deposit-stx-liquidity',
            functionArgs: [uintCV(amountUstx)],
            network: STACKS_TESTNET,
            postConditionMode: PostConditionMode.Allow,
            onFinish: (data) => resolve(data.txId),
            onCancel: () => reject(new Error('User cancelled STX liquidity deposit')),
        });
    });

export interface TransactionHistory {
    txId: string;
    type: string;
    status: 'success' | 'pending' | 'failed';
    timestamp: number;
    amount?: string;
    blockHeight?: number;
}

export async function fetchTransactionHistory(address: string, limit: number = 20): Promise<TransactionHistory[]> {
    try {
        const res = await fetch(
            `${HIRO_API}/extended/v1/address/${address}/transactions?limit=${limit}`
        );
        if (!res.ok) return [];

        const data = await res.json();
        const txs = Array.isArray(data.results) ? data.results : [];

        return txs
            .map((tx: any) => {
                const contractCall = tx.contract_call;
                let txType = 'Unknown';
                if (contractCall && contractCall.contract_id === VAULT_CONTRACT_ID) {
                    txType = contractCall.function_name || 'vault-call';
                }

                return {
                    txId: tx.tx_id,
                    type: txType,
                    status: tx.tx_status === 'success' ? 'success' : tx.tx_status === 'pending' ? 'pending' : 'failed',
                    timestamp: tx.burn_block_time || Math.floor(Date.now() / 1000),
                    amount: tx.tx_type === 'contract_call' ? undefined : tx.token_transfer?.amount,
                    blockHeight: tx.block_height,
                };
            })
            .filter((tx: TransactionHistory) => tx.type !== 'Unknown')
            .slice(0, limit);
    } catch (err) {
        console.error('Failed to fetch transaction history:', err);
        return [];
    }
}
