import {
  Connection,
  Transaction,
  TransactionInstruction,
  TransactionSignature,
} from '@solana/web3.js';
import { AnchorProvider } from '@project-serum/anchor';
import { InstructionsAndSigners } from '../models';

const DEFAULT_TIMEOUT = 30000;
export async function sleep(ms: any) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
const now = () => {
  return new Date().getTime();
};
export class TransactionSender {
  provider: AnchorProvider;
  constructor(provider: AnchorProvider) {
    this.provider = provider;
  }

  async makeTxn(instructions: TransactionInstruction[]): Promise<Transaction> {
    const transaction = new Transaction();
    instructions.forEach(instruction => transaction.add(instruction));
    const latestBlockhash = await this.provider.connection.getLatestBlockhash(
      this.provider.connection.commitment
    );
    transaction.recentBlockhash = latestBlockhash.blockhash;
    transaction.lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;
    transaction.feePayer = this.provider.wallet.publicKey;

    return transaction;
  }

  async split(
    instructionsAndSigners: InstructionsAndSigners,
    txn: Transaction
  ): Promise<Transaction[]> {
    try {
      txn.serialize({
        verifySignatures: false,
      });

      const accountsToSign = (txn.instructions.map(ix => ix.keys) as any)
        .flat()
        .filter((account: any) => account.isSigner)
        .map((account: any) => account.pubkey.toString());

      const signers = instructionsAndSigners.signers.filter(
        signer => accountsToSign.indexOf(signer.publicKey.toString()) >= 0
      );

      if (signers.length > 0) {
        txn.partialSign(...signers);
      }
    } catch (e) {
      const ixs = txn.instructions;

      if (ixs.length == 1) {
        throw new Error('Transaction size exceeds limit, unable to split further ... ');
      }
      console.log('Attempt to split txn, verify that exception is due to large txn size ...', e);
      const middle = Math.ceil(ixs.length / 2);
      const left: TransactionInstruction[] = ixs.splice(0, middle);
      const right = ixs.splice(-middle);
      return [
        ...(await this.split(instructionsAndSigners, await this.makeTxn(left))),
        ...(await this.split(instructionsAndSigners, await this.makeTxn(right))),
      ];
    }
    return [txn];
  }

  getErrorForTransaction = async (connection: Connection, txid: string) => {
    // wait for all confirmation before geting transaction
    const commitment = 'finalized'; // https://stackoverflow.com/a/68751515/1064858
    const latestBlockhash = await connection.getLatestBlockhash(commitment);
    await connection.confirmTransaction({ signature: txid, ...latestBlockhash }, commitment);

    const tx = await connection.getParsedTransaction(txid, commitment);
    const errors: string[] = [];
    if (tx?.meta && tx.meta.logMessages) {
      tx.meta.logMessages.forEach((log: any) => {
        const regex = /Error: (.*)/gm;
        let m;
        while ((m = regex.exec(log)) !== null) {
          // This is necessary to avoid infinite loops with zero-width matches
          if (m.index === regex.lastIndex) {
            regex.lastIndex++;
          }

          if (m.length > 1) {
            errors.push(m[1]);
          }
        }
      });
    }

    return errors;
  };

  async sendOne(txn: Transaction): Promise<string> {
    console.log('--- smart txn - sending one ...', txn);
    const connection = this.provider.connection;
    const rawTxn = txn.serialize();

    const options = {
      skipPreflight: false,
      commitment: this.provider.connection.commitment,
    };

    const startTime = now();
    let done = false;
    const retryTimeout = DEFAULT_TIMEOUT;

    const txid = await connection.sendRawTransaction(rawTxn, options);
    (async () => {
      while (!done && now() - startTime < retryTimeout) {
        connection.sendRawTransaction(rawTxn, options);
        console.log('retry sending transaction continuously every 2 seconds ...', txid);
        await sleep(2000);
      }
    })();

    let status;

    try {
      const signatureResult = await connection.confirmTransaction(
        {
          signature: txid,
          blockhash: txn.recentBlockhash,
          lastValidBlockHeight: txn.lastValidBlockHeight,
        } as any,
        this.provider.connection.commitment
      );
      status = signatureResult.value;
    } catch (error) {
      status = {
        err: error,
      };
    } finally {
      done = true;
    }

    if (status?.err) {
      let errors: string[];
      if (
        (status.err as Error).message &&
        ((status.err as Error).message.includes('block height exceeded') ||
          (status.err as Error).message.includes('timeout exceeded'))
      ) {
        errors = [(status.err as Error).message];
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        errors = await this.getErrorForTransaction(connection, txid);
      }

      throw new Error(`Raw transaction ${txid} failed (${JSON.stringify(status)})`);
    } else {
      console.log(txid);
    }
    return txid;
  }

  async sendWithWallet(
    instructionsAndSigners: InstructionsAndSigners
  ): Promise<TransactionSignature> {
    const txn = await this.makeTxn(instructionsAndSigners.instructions);
    const txns = await this.split(instructionsAndSigners, txn);
    const signedTxns = await this.provider.wallet.signAllTransactions(txns);
    const txIds: string[] = [];
    for (const item of signedTxns) {
      txIds.push(await this.sendOne(item));
    }

    console.log(txIds);
    return txIds[0];
  }
}
