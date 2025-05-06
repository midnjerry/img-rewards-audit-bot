import { getParsedTransaction, getTokenBalance, getTransactions } from './clients/solana.js';
import { SOLANA_DECIMALS, MAX_SIGNATURES, REWARDS_WALLET, IMG_TOKEN_MINT } from './constants.js';
import { ParsedInstruction } from '@solana/web3.js';

const knownSignatures = new Set<string>();

function isSystemTransferInstruction(instr: ParsedInstruction): instr is ParsedInstruction & {
  parsed: {
    type: 'transfer';
    info: {
      source: string;
      destination: string;
      lamports: number;
    };
  };
} {
  return instr.program === 'system' &&
         typeof instr.parsed === 'object' &&
         instr.parsed.type === 'transfer';
}

function isHarvestInstruction(instr: ParsedInstruction): instr is ParsedInstruction & {
  parsed: {
    type: 'harvestWithheldTokensToMint';
    info: {
      mint: string;
      sourceAccounts: string[];
    };
  };
} {
  return instr.program === 'spl-token' &&
         typeof instr.parsed === 'object' &&
         instr.parsed.type === 'harvestWithheldTokensToMint';
}

function isWithdrawInstruction(instr: ParsedInstruction): instr is ParsedInstruction & {
  parsed: {
    type: 'withdrawWithheldTokensFromMint';
    info: {
      mint: string;
      withdrawWithheldAuthority: string;
      feeRecipient: string;
    };
  };
} {
  return instr.program === 'spl-token' &&
         typeof instr.parsed === 'object' &&
         instr.parsed.type === 'withdrawWithheldTokensFromMint';
}

async function pollTransactions(): Promise<void> {
  const txs = await getTransactions(REWARDS_WALLET, MAX_SIGNATURES);

  for (const { signature } of txs) {
    if (knownSignatures.has(signature)) continue;
    knownSignatures.add(signature);

    const tx = await getParsedTransaction(signature);
    if (!tx) continue;

    const tokenHarvestAmount = tx.meta?.postTokenBalances?.reduce((sum, postBal) => {
      const preBal = tx.meta?.preTokenBalances?.find(b => b.accountIndex === postBal.accountIndex);
      if (
        postBal.mint === preBal?.mint &&
        postBal.owner === preBal.owner &&
        postBal.uiTokenAmount.uiAmount !== null &&
        preBal.uiTokenAmount.uiAmount !== null
      ) {
        return sum + (postBal.uiTokenAmount.uiAmount - preBal.uiTokenAmount.uiAmount);
      }
      return sum;
    }, 0) || 0;

    for (const instr of tx.transaction.message.instructions) {
      if ('parsed' in instr) {
        if (isSystemTransferInstruction(instr)) {
          const { source, destination, lamports } = instr.parsed.info;
          if (source !== REWARDS_WALLET) continue;

          const amount_sol = lamports / SOLANA_DECIMALS;
          const tokenBalance = await getTokenBalance(destination, IMG_TOKEN_MINT);

          console.log(`SOL Transfer: ${amount_sol} SOL to ${destination}, IMG Balance: ${tokenBalance}`);
        } else if (isHarvestInstruction(instr)) {
          const { mint, sourceAccounts } = instr.parsed.info;
          console.log(`SPL Fee Harvest → Mint: ${mint}, Sources: ${sourceAccounts.length}, Amount: ${tokenHarvestAmount.toFixed(6)}`);
        } else if (isWithdrawInstruction(instr)) {
          const { mint, feeRecipient, withdrawWithheldAuthority } = instr.parsed.info;
          console.log(`SPL Fee Withdrawal → Mint: ${mint}, To: ${feeRecipient}, Authority: ${withdrawWithheldAuthority}, Amount: ${tokenHarvestAmount.toFixed(6)}`);
        } else {
        console.log(`Unknown instruction: ${JSON.stringify(instr)}`);
        }
      } else {
        console.log(`Unknown instruction: ${JSON.stringify(instr)}`);
      }
    }
  }
}

setInterval(() => {
  pollTransactions().catch(console.error);
}, 15000);

console.log('⏳ Monitoring SOL rewards and SPL fee harvests...');

/**
 * TODO
 * 
 * 1.) Add .env for helius api key
 * 2.) don't use setInterval, use infinite while loop to make all calls syncronous
 */