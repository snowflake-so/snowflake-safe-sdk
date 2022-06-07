import { AnchorProvider, Idl, Program, utils } from "@project-serum/anchor";
import { InstructionBuilder } from "../builders/instruction-builder";
import SafeFinder from "./safe-finder";
import { SNOWFLAKE_SAFE_IDL } from "../idl";
import {
  MEMO_PROGRAM_ID,
  SNOWFLAKE_SAFE_PROGRAM_ID,
} from "../config/program-id";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionSignature,
} from "@solana/web3.js";
import { MultisigJobType } from "../models/multisig-job";
import { ISnowflakeSafe } from "../interfaces/safe-interface";
import { TransactionSender } from "./transaction-sender";

export class SnowflakeSafe implements ISnowflakeSafe {
  program: Program;
  instructionBuilder: InstructionBuilder;
  transactionSender: TransactionSender;
  wallet: PublicKey;
  finder: SafeFinder;
  constructor(provider: AnchorProvider) {
    this.program = new Program(
      SNOWFLAKE_SAFE_IDL as Idl,
      SNOWFLAKE_SAFE_PROGRAM_ID,
      provider
    );
    this.instructionBuilder = new InstructionBuilder(this.program, provider);
    this.wallet = provider.wallet.publicKey;
    this.transactionSender = new TransactionSender(provider);
    this.finder = new SafeFinder(this.program);
  }

  async createSafe(
    safeKeypair: Keypair,
    owners: PublicKey[],
    approvalsRequired: number
  ): Promise<TransactionSignature> {
    const instructions = [];
    const [, safeSignerNonce] = await this.findSafeSignerAddress(
      safeKeypair.publicKey,
      this.program.programId
    );
    const ix = this.instructionBuilder.buildCreateSafeInstruction(
      this.wallet,
      safeKeypair.publicKey,
      safeSignerNonce,
      owners,
      approvalsRequired
    );

    instructions.push(ix);

    const tx = await this.transactionSender.sendWithWallet({
      instructions,
      signers: [safeKeypair],
    });

    return tx;
  }

  async createFlow(
    safeAddress: PublicKey,
    accountSize: number,
    clientFlow: MultisigJobType,
    newFlowKeypair: Keypair,
    ixs: TransactionInstruction[]
  ): Promise<TransactionSignature> {
    const approveProposalIx =
      await this.instructionBuilder.buildApproveProposalInstruction(
        safeAddress,
        newFlowKeypair.publicKey,
        this.wallet
      );
    const ix = await this.instructionBuilder.buildCreateFlowInstruction(
      this.wallet,
      accountSize,
      clientFlow,
      safeAddress,
      newFlowKeypair,
      SystemProgram.programId
    );
    const instructions = [...ixs, ix, approveProposalIx];
    const tx = await this.transactionSender.sendWithWallet({
      instructions,
      signers: [],
    });

    return tx;
  }

  async deleteFlow(flowAddress: PublicKey): Promise<string> {
    const instructions = [];
    const ix = await this.instructionBuilder.buildDeleteFlowIx(
      this.wallet,
      flowAddress
    );

    instructions.push(ix);

    const tx = await this.transactionSender.sendWithWallet({
      instructions,
      signers: [],
    });

    return tx;
  }

  async approveProposal(
    safeAddress: PublicKey,
    flowAddress: PublicKey
  ): Promise<string> {
    const instructions = [];
    const approveProposalInstruction =
      await this.instructionBuilder.buildApproveProposalInstruction(
        safeAddress,
        flowAddress,
        this.wallet
      );

    instructions.push(approveProposalInstruction);

    const tx = await this.transactionSender.sendWithWallet({
      instructions,
      signers: [],
    });

    return tx;
  }

  async rejectProposal(
    safeAddress: PublicKey,
    flowAddress: PublicKey
  ): Promise<string> {
    const instructions = [];
    const approveProposalInstruction =
      await this.instructionBuilder.buildRejectProposalInstruction(
        safeAddress,
        flowAddress,
        this.wallet
      );

    instructions.push(approveProposalInstruction);

    const tx = await this.transactionSender.sendWithWallet({
      instructions,
      signers: [],
    });

    return tx;
  }

  async abortFlow(
    flowAddress: PublicKey,
    safeAddress: PublicKey
  ): Promise<string> {
    let instructions = [];
    const abortFlowIx = await this.instructionBuilder.buildAbortFlowInstruction(
      flowAddress,
      safeAddress,
      this.wallet
    );

    instructions = [abortFlowIx];

    const tx = await this.transactionSender.sendWithWallet({
      instructions,
      signers: [],
    });

    return tx;
  }

  async executeMultisigFlow(
    flowAddress: PublicKey,
    flowActions: any[],
    safeAddress: PublicKey
  ): Promise<string> {
    let instructions = [];

    const [safeSignerAddress] = await this.findSafeSignerAddress(
      safeAddress,
      this.program.programId
    );
    const memoIx = new TransactionInstruction({
      keys: [],
      data: Buffer.from("snf_exec_manual", "utf-8"),
      programId: MEMO_PROGRAM_ID,
    });

    const executeMultisigFlowIx =
      await this.instructionBuilder.buildExecuteMultisigFlowInstruction(
        flowAddress,
        safeAddress,
        safeSignerAddress,
        this.wallet,
        flowActions
      );

    instructions = [executeMultisigFlowIx, memoIx];

    const tx = await this.transactionSender.sendWithWallet({
      instructions,
      signers: [],
    });

    return tx;
  }

  async createAddOwnerInstruction(
    safeAddress: PublicKey,
    safeOwner: PublicKey
  ): Promise<TransactionInstruction[]> {
    const [safeSignerAddress] = await this.findSafeSignerAddress(
      safeAddress,
      this.program.programId
    );

    const ix = await this.instructionBuilder.buildAddOwnerInstruction(
      safeSignerAddress,
      safeAddress,
      safeOwner
    );

    return [ix];
  }

  async createRemoveOwnerInstruction(
    safeAddress: PublicKey,
    safeOwner: PublicKey
  ): Promise<TransactionInstruction[]> {
    const [safeSignerAddress] = await this.findSafeSignerAddress(
      safeAddress,
      this.program.programId
    );

    const ix = await this.instructionBuilder.buildRemoveOwnerInstruction(
      safeSignerAddress,
      safeAddress,
      safeOwner
    );

    return [ix];
  }

  async createChangeThresholdInstruction(
    safeAddress: PublicKey,
    threshold: number
  ): Promise<TransactionInstruction[]> {
    const [safeSignerAddress] = await this.findSafeSignerAddress(
      safeAddress,
      this.program.programId
    );

    const ix = await this.instructionBuilder.buildChangeThresholdInstruction(
      safeSignerAddress,
      safeAddress,
      threshold
    );

    return [ix];
  }

  async findSafeSignerAddress(
    safeAddress: PublicKey,
    safeProgramId: PublicKey
  ): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddress(
      [utils.bytes.utf8.encode("SafeSigner"), safeAddress.toBuffer()],
      safeProgramId
    );
  }
}
