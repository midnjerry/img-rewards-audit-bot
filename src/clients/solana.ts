import { ConfirmedSignatureInfo, Connection, ParsedTransactionWithMeta, PublicKey } from '@solana/web3.js';
import { SOLANA_RPC } from '../constants';
import { sleep } from '../utils/helpers';

const connection = new Connection(SOLANA_RPC, 'confirmed');
const DELAY_IN_MILLISECONDS = 10000;

export async function getTransactions(walletAddress: string, limit = 10): Promise<Array<ConfirmedSignatureInfo>> {
  const pubkey = new PublicKey(walletAddress);
  const result = connection.getSignaturesForAddress(pubkey, { limit });
  await sleep(DELAY_IN_MILLISECONDS);
  return result;
}

export async function getParsedTransaction(signature: string): Promise<ParsedTransactionWithMeta | null> {
  await sleep(DELAY_IN_MILLISECONDS);
  return connection.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: 'confirmed'
  });
}

export async function getSolBalance(walletAddress: string): Promise<number> {
  await sleep(DELAY_IN_MILLISECONDS);
  const pubkey = new PublicKey(walletAddress);
  return await connection.getBalance(pubkey);
}

export async function getTokenBalance(walletAddress: string, mintAddress: string): Promise<number> {
  await sleep(DELAY_IN_MILLISECONDS);
  const pubkey = new PublicKey(walletAddress);
  const accounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
    mint: new PublicKey(mintAddress)
  });
  const balance = accounts.value[0]?.account?.data?.parsed?.info?.tokenAmount?.uiAmount;
  return balance || 0;
}
