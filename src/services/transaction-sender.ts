import { Transaction, TransactionSignature } from "@solana/web3.js";
import { AnchorProvider } from "@project-serum/anchor";
import { InstructionsAndSigners } from "@snowflake-so/snowflake-sdk";

export class TransactionSender {
  provider: AnchorProvider;
  constructor(provider: AnchorProvider) {
    this.provider = provider;
  }

  async sendWithWallet(
    instructionsAndSigners: InstructionsAndSigners
  ): Promise<TransactionSignature> {
    const transaction = new Transaction();
    transaction.add(...instructionsAndSigners.instructions);
    return await this.provider.sendAndConfirm(
      transaction,
      instructionsAndSigners.signers
    );
  }
}
