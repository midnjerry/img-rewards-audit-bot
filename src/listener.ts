import { getParsedTransaction, getTokenBalance, getTransactions } from './clients/solana.js';
import { SOLANA_DECIMALS, MAX_SIGNATURES, REWARDS_WALLET, IMG_TOKEN_MINT, DELAY_IN_MILLISECONDS } from './constants.js';
import { ParsedInstruction } from '@solana/web3.js';
import { sleep } from './utils/helpers.js';


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

function isWithdrawWithheldTokensFromAccountsInstruction(instr: ParsedInstruction): instr is ParsedInstruction & {
  parsed: {
    type: 'withdrawWithheldTokensFromAccounts';
    info: {
      mint: string;
      withdrawWithheldAuthority: string;
      feeRecipient: string;
      sourceAccounts: string[];
    };
  }
}{
  return instr.program === 'spl-token' &&
    typeof instr.parsed === 'object' &&
    instr.parsed.type === 'withdrawWithheldTokensFromAccounts';
}

async function pollTransactions(): Promise<void> {
  console.log('🔄 Gathering latest transactions...');
  const txs = await getTransactions(REWARDS_WALLET, MAX_SIGNATURES);
  console.log(`Retrieved ${txs?.length} transactions`);

  for (const { signature } of txs) {
    if (knownSignatures.has(signature)) continue;
    knownSignatures.add(signature);
    
    console.log(`📦 Processing Transaction: ${signature}`);
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

          console.log(`  SOL Transfer: ${amount_sol} SOL to ${destination}, IMG Balance: ${tokenBalance}`);
        } else if (isHarvestInstruction(instr)) {
          const { mint, sourceAccounts } = instr.parsed.info;
          console.log(`  SPL Fee Harvest → Mint: ${mint}, Sources: ${sourceAccounts.length}`);
        } else if (isWithdrawInstruction(instr)) {
          const { mint, feeRecipient, withdrawWithheldAuthority } = instr.parsed.info;
          console.log(`  SPL Fee Withdrawal → Mint: ${mint}, To: ${feeRecipient}, Authority: ${withdrawWithheldAuthority}`);
        } else if (isWithdrawWithheldTokensFromAccountsInstruction(instr)){
          const { mint, feeRecipient, sourceAccounts, withdrawWithheldAuthority } = instr.parsed.info;
          console.log(`  SPL Fee Withdrawal → Accounts: ${mint}, To: ${feeRecipient}, Authority: ${withdrawWithheldAuthority}, Sources: ${sourceAccounts.length}`);
          
        } else if (instr.programId.toBase58() === 'ComputeBudget111111111111111111111111111111') {
          console.log('  ⚙️ ComputeBudget instruction detected (ignored)');
        } 
        else {
          console.log(`  Unknown instruction: ${JSON.stringify(instr)}`);
        }
      } else {
        console.log(`  Unknown transaction: ${JSON.stringify(instr)}`);
      }
    }
  }
}

async function main() {
  while (true) {
    console.log('⏳ Monitoring SOL rewards and SPL fee harvests...');
    await pollTransactions();
    sleep(DELAY_IN_MILLISECONDS);
  }
}

main();