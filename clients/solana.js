import { Connection, PublicKey } from '@solana/web3.js';
import { SOLANA_RPC } from '../constants.js';

const connection = new Connection(SOLANA_RPC, 'confirmed');

export async function getTransactions(pubkeyStr, limit = 10) {
  const pubkey = new PublicKey(pubkeyStr);
  return connection.getSignaturesForAddress(pubkey, { limit });
}

export async function getParsedTransaction(signature) {
  return connection.getParsedTransaction(signature, 'confirmed');
}

export async function getSolBalance(pubkeyStr) {
  const pubkey = new PublicKey(pubkeyStr);
  return await connection.getBalance(pubkey);  
}

export async function getTokenBalance(pubkeyStr, mintAddress) {
  const pubkey = new PublicKey(pubkeyStr);
  const accounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
    mint: new PublicKey(mintAddress)
  });

  const balance = accounts.value[0]?.account?.data?.parsed?.info?.tokenAmount?.uiAmount;
  return balance || 0;
}
