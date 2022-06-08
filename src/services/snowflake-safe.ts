import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionSignature,
} from "@solana/web3.js";
import {
  MEMO_PROGRAM_ID,
  SNOWFLAKE_SAFE_PROGRAM_ID,
} from "../config/program-id";
import SafeFinder from "./safe-finder";
import { AnchorProvider, Idl, Program, utils } from "@project-serum/anchor";
import { InstructionBuilder } from "../builders/instruction-builder";
import { SNOWFLAKE_SAFE_IDL } from "../idl";
import { ISnowflakeSafe } from "../interfaces/safe-interface";
import { TransactionSender } from "./transaction-sender";
import { MultisigJob, SafeType } from "../models";
import { DEFAULT_FLOW_SIZE, ErrorMessage } from "../config";

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

  /**
   * ## Create a new safe
   * Note: Approvals required must be lower than or equal to the total number of safe owners.
   * ### Example
   * ```
   * const safeKeypair = Keypair.generate();
   * 
   * const input = {
      approvalsRequired: 1,
      owners: [owner],
    };
   * const txId = await snowflakeSafe.createSafe(
      safeKeypair,
      input.owners,
      input.approvalsRequired
    );
   * ```
   * ### Parameters
   * @param safeKeypair A generated keypair for the safe
   * @param owners An array of public keys for owners of the safe
   * @param approvalsRequired The number of owners required to approve a proposal
   * @returns A transaction signature
   */
  async createSafe(
    safeKeypair: Keypair,
    owners: PublicKey[],
    approvalsRequired: number
  ): Promise<TransactionSignature> {
    this.validateCreateSafe(owners, approvalsRequired);

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

  /**
   * ## Create a multi-signature flow
   * ### Description
   * Flow requires approvals (minimum as a declared approvals_required of the safe). It can be `approve` or `reject` by using `approveProposal` or `rejectProposal`. The create flow can be executed manually or automatically by Snowflake node operators.
   * Note:
   * - Only the owner of the safe can create a flow.
   * - Only the flow creator can delete the flow.
   * - Only safe owners can approve, abort or reject a flow.
   * - Only safe owners can execute a flow.
   *
   * ### Example
   * ```
   * const newFlowKeypair = Keypair.generate();
     const job = new MultisigJobBuilder()
      .jobInstructions(instructions)
      .jobName("hello world")
      .build();

     const txId = await snowflakeSafe.createFlow(
      safeAddress,
      DEFAULT_FLOW_SIZE,
      job,
      newFlowKeypair,
      []
     );
   * ```
   *
   * ### Parameters
   * @param safeAddress Publickey of the safe
   * @param accountSize The size of the account (default: 1800)
   * @param multisigJob The multisig job to be executed
   * @param newFlowKeypair The keypair of the new flow
   * @param ixs List of executed instructions
   * @returns A transaction signature
   */
  async createFlow(
    safeAddress: PublicKey,
    accountSize: number = DEFAULT_FLOW_SIZE,
    multisigJob: MultisigJob,
    newFlowKeypair: Keypair,
    ixs: TransactionInstruction[]
  ): Promise<TransactionSignature> {
    multisigJob.validateForCreate();

    const approveProposalIx =
      await this.instructionBuilder.buildApproveProposalInstruction(
        safeAddress,
        newFlowKeypair.publicKey,
        this.wallet
      );

    const ix = await this.instructionBuilder.buildCreateFlowInstruction(
      this.wallet,
      accountSize,
      multisigJob,
      safeAddress,
      newFlowKeypair,
      SystemProgram.programId
    );
    const instructions = [...ixs, ix, approveProposalIx];
    const tx = await this.transactionSender.sendWithWallet({
      instructions,
      signers: [newFlowKeypair],
    });

    return tx;
  }

  /**
   * ## Delete a flow
   * ### Description
   * Only a flow creator can delete a flow.
   *
   * ### Parameters
   * @param flowAddress Public key of the flow
   * @returns A transaction signature
   */
  async deleteFlow(flowAddress: PublicKey): Promise<TransactionSignature> {
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

  /**
   * ## Approve a proposal
   * ### Description
   * Note: Only safe owners can approve a proposal.
   *
   * ### Parameters
   * @param safeAddress Public key of the safe
   * @param flowAddress Public key of the flow
   * @returns A transaction signature
   */
  async approveProposal(
    safeAddress: PublicKey,
    flowAddress: PublicKey
  ): Promise<TransactionSignature> {
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

  /**
   * ## Reject a proposal
   * ### Description
   * Note: Only safe owners can reject a proposal.
   *
   * ### Parameters
   * @param safeAddress Public key of the safe
   * @param flowAddress Public key of the flow
   * @returns A transaction signature
   */
  async rejectProposal(
    safeAddress: PublicKey,
    flowAddress: PublicKey
  ): Promise<TransactionSignature> {
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

  /**
   * ## Abort a proposal
   * ### Description
   * - Only works if the flow is a recurring flow.
   * - Only safe owners can abort a proposal.
   *
   * ### Parameters
   * @param safeAddress Public key of the safe
   * @param flowAddress Public key of the flow
   * @returns A transaction signature
   */
  async abortFlow(
    flowAddress: PublicKey,
    safeAddress: PublicKey
  ): Promise<TransactionSignature> {
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

  /**
   * ## Execute a flow
   * ### Description
   * - Only safe owners can execute a flow.
   *
   * ### Parameters
   * @param flowAddress Public key of the flow
   * @param flowActions List of flow actions
   * @param safeAddress Public key of the safe
   * @returns A transaction signature
   */
  async executeMultisigFlow(
    flowAddress: PublicKey,
    flowActions: any[],
    safeAddress: PublicKey
  ): Promise<TransactionSignature> {
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

  /**
   * ## Create add owner instruction
   * Note: The method will create a new instruction to add new owner to the safe
   * ### Parameters
   * @param safeAddress Public key of the safe
   * @param safeOwner Public key of added owner
   * @returns A transaction signature
   */
  async createAddOwnerInstruction(
    safeAddress: PublicKey,
    safeOwner: PublicKey
  ): Promise<TransactionInstruction> {
    const [safeSignerAddress] = await this.findSafeSignerAddress(
      safeAddress,
      this.program.programId
    );

    const ix = await this.instructionBuilder.buildAddOwnerInstruction(
      safeSignerAddress,
      safeAddress,
      safeOwner
    );

    return ix;
  }

  /**
   * ## Create remove owner instruction
   * Note: The method will create a new instruction to remove new owner to the safe
   * ### Parameters
   * @param safeAddress Public key of the safe
   * @param safeOwner Public key of added owner
   * @returns A transaction signature
   */
  async createRemoveOwnerInstruction(
    safeAddress: PublicKey,
    safeOwner: PublicKey
  ): Promise<TransactionInstruction> {
    const [safeSignerAddress] = await this.findSafeSignerAddress(
      safeAddress,
      this.program.programId
    );

    const ix = await this.instructionBuilder.buildRemoveOwnerInstruction(
      safeSignerAddress,
      safeAddress,
      safeOwner
    );

    return ix;
  }

  /**
   * ## Create change threshold instruction
   * Note: The method will create a new instruction to change threshold of the safe
   * ### Parameters
   * @param safeAddress Public key of the safe
   * @param safeOwner Public key of added owner
   * @returns A transaction signature
   */
  async createChangeThresholdInstruction(
    safeAddress: PublicKey,
    threshold: number
  ): Promise<TransactionInstruction> {
    const [safeSignerAddress] = await this.findSafeSignerAddress(
      safeAddress,
      this.program.programId
    );

    const ix = await this.instructionBuilder.buildChangeThresholdInstruction(
      safeSignerAddress,
      safeAddress,
      threshold
    );

    return ix;
  }

  async fetchSafe(safeAddress: PublicKey): Promise<SafeType> {
    return this.finder.findSafe(safeAddress);
  }

  async fetchJob(jobAddress: PublicKey): Promise<MultisigJob> {
    return this.finder.findJob(jobAddress);
  }

  async fetchAllJobs(safeAddress: PublicKey): Promise<MultisigJob[]> {
    return this.finder.findJobsOfSafe(safeAddress);
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

  private validateCreateSafe(owners: PublicKey[], threshold: number) {
    if (owners.length > threshold) {
      throw new Error(ErrorMessage.CreateSafeWithInvalidApprovalsRequired);
    }
  }
}
