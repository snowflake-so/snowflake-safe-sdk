import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionSignature,
} from '@solana/web3.js';
import { MEMO_PROGRAM_ID, SNOWFLAKE_SAFE_PROGRAM_ID } from '../config/program-id';
import SafeFinder from './safe-finder';
import { AnchorProvider, Idl, Program, utils } from '@project-serum/anchor';
import { InstructionBuilder } from '../builders/instruction-builder';
import { SNOWFLAKE_SAFE_IDL } from '../idl';
import { ISnowflakeSafe } from '../interfaces/safe-interface';
import { TransactionSender } from './transaction-sender';
import { MultisigJob, SafeType, SerializableAction } from '../models';
import { DEFAULT_FLOW_SIZE, ErrorMessage } from '../config';
import { MultisigJobBuilder } from '../builders';
import { toLamportsByDecimal } from '../utils/lamports';

export class SnowflakeSafe implements ISnowflakeSafe {
  program: Program;
  instructionBuilder: InstructionBuilder;
  transactionSender: TransactionSender;
  wallet: PublicKey;
  finder: SafeFinder;
  constructor(provider: AnchorProvider) {
    this.program = new Program(SNOWFLAKE_SAFE_IDL as Idl, SNOWFLAKE_SAFE_PROGRAM_ID, provider);
    this.instructionBuilder = new InstructionBuilder(this.program, provider);
    this.wallet = provider.wallet.publicKey;
    this.transactionSender = new TransactionSender(provider);
    this.finder = new SafeFinder(this.program);
  }

  /** ## Create a new safe
   * 
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
   * @param owners An array of public keys for owners of the safe
   * @param approvalsRequired The number of owners required to approve a proposal
   * @returns Safe address and a transaction signature
   */
  async createSafe(
    owners: PublicKey[],
    approvalsRequired: number
  ): Promise<[PublicKey, TransactionSignature]> {
    const newSafeKeypair = Keypair.generate();
    this.validateCreateSafe(owners, approvalsRequired);

    const instructions = [];
    const [safeSignerAddress, safeSignerNonce] = await this.findSafeSignerAddress(
      newSafeKeypair.publicKey,
      this.program.programId
    );
    const ix = this.instructionBuilder.buildCreateSafeInstruction(
      this.wallet,
      newSafeKeypair.publicKey,
      safeSignerAddress,
      safeSignerNonce,
      owners,
      approvalsRequired
    );

    instructions.push(ix);

    const accountInitDepositIx = await this.instructionBuilder.buildNativeTokenTransferIx(
      this.wallet,
      safeSignerAddress,
      toLamportsByDecimal(0.001, 9)
    );

    instructions.push(accountInitDepositIx);

    const tx = await this.transactionSender.sendWithWallet({
      instructions,
      signers: [newSafeKeypair],
    });

    return [newSafeKeypair.publicKey, tx];
  }

  private buildProposal(
    proposalName: string,
    proposalInstructions: TransactionInstruction[]
  ): MultisigJob {
    const proposal = new MultisigJobBuilder()
      .jobInstructions(proposalInstructions)
      .jobName(proposalName)
      .build();
    return proposal;
  }

  /** ## Create a multi-signature proposal
   *
   * ### Description
   * Proposal requires approvals (minimum as a declared approvals_required of the safe). It can be `approve` or `reject` by using `approveProposal` or `rejectProposal`.
   * Note:
   * - Only the owner of the safe can create a proposal.
   * - Only the proposal creator can delete the proposal.
   * - Only safe owners can approve or reject a proposal.
   * - Only safe owners can execute a proposal.
   *
   * ### Parameters
   * @param safeAddress Publickey of the safe
   * @param proposalName Name of proposal
   * @param proposalInstructions  List of executed instructions
   * @param setupInstructions List of instructions to setup the proposal (createAssociatedTokenAccount...)
   * @param accountSize The size of the account (default: 1800)
   * @returns Proposal address and a transaction signature
   */
  async createProposal(
    safeAddress: PublicKey,
    proposalName: string,
    proposalInstructions: TransactionInstruction[],
    setupInstructions?: TransactionInstruction[],
    accountSize: number = DEFAULT_FLOW_SIZE,
    isApproved = true,
    separatedActions = false
  ): Promise<[PublicKey, TransactionSignature]> {
    const proposal = this.buildProposal(proposalName, proposalInstructions);
    return this.createRecurringProposal(
      safeAddress,
      proposal,
      setupInstructions,
      accountSize,
      separatedActions,
      isApproved,
      separatedActions
    );
  }

  /** ## Create recurring proposal instructions
   *
   * @param safeAddress Public key of the safe
   * @param proposalKeypair New keypair generated of a proposal
   * @param proposal Multisig proposal class object
   * @param setupInstructions Setup instructions
   * @param accountSize Proposal account size
   * @param isDraft Check if proposal is draft (for separated actions proposal only)
   * @param isApproved Auto approved by creator when proposal created
   * @param separatedActions Check if proposal has separated actions added
   * @returns
   */
  async createRecurringProposalInstructions(
    safeAddress: PublicKey,
    proposalKeypair: Keypair,
    proposal: MultisigJob,
    setupInstructions?: TransactionInstruction[],
    accountSize: number = DEFAULT_FLOW_SIZE,
    isDraft = false,
    isApproved = true,
    separatedActions = false
  ) {
    proposal.validateForCreate();

    const approveProposalIx = await this.instructionBuilder.buildApproveProposalInstruction(
      safeAddress,
      proposalKeypair.publicKey,
      this.wallet
    );

    let addActionIxs: TransactionInstruction[] = [];
    if (separatedActions) {
      addActionIxs = await this.createAddProposalActionInstructions(
        proposalKeypair.publicKey,
        proposal.instructions.map(SerializableAction.fromInstruction)
      );

      proposal.instructions = [];
    }

    const createFlowIx = await this.instructionBuilder.buildCreateFlowInstruction(
      this.wallet,
      accountSize,
      proposal,
      isDraft,
      safeAddress,
      proposalKeypair,
      SystemProgram.programId
    );
    const otherIxs: TransactionInstruction[] = [
      ...addActionIxs,
      ...(isApproved ? [approveProposalIx] : []),
    ];
    const instructions: TransactionInstruction[] = [
      ...(setupInstructions ? setupInstructions : []),
      createFlowIx,
      ...otherIxs,
    ];

    return instructions;
  }

  /** ## Create a recurring proposal
   * ### Description
   * A recurring proposal is a proposal that will be executed by Snowflake node operators.
   *
   * ### Parameters
   * @param safeAddress Public key of the safe
   * @param proposal Proposal
   * @param setupInstructions List of instructions to setup the proposal (createAssociatedTokenAccount...)
   * @param accountSize The size of the account (default: 1800)
   * @param isDraft Set the proposal as draft to allow adding more actions (default: false)
   * @param isApproved Allow auto approved by creator when proposal created (default: true)
   * @returns Proposal address and a transaction signature
   */
  async createRecurringProposal(
    safeAddress: PublicKey,
    proposal: MultisigJob,
    setupInstructions?: TransactionInstruction[],
    accountSize: number = DEFAULT_FLOW_SIZE,
    isDraft = false,
    isApproved = true,
    separatedActions = false
  ): Promise<[PublicKey, TransactionSignature]> {
    const newProposalKeypair = Keypair.generate();

    const instructions = await this.createRecurringProposalInstructions(
      safeAddress,
      newProposalKeypair,
      proposal,
      setupInstructions,
      accountSize,
      isDraft,
      isApproved,
      separatedActions
    );
    const tx = await this.transactionSender.sendWithWallet({
      instructions,
      signers: [newProposalKeypair],
    });

    return [newProposalKeypair.publicKey, tx];
  }

  /** ## Delete a proposal
   *
   * ### Description
   * Only a proposal creator can delete a proposal.
   *
   * ### Parameters
   * @param proposalAddress Public key of the proposal
   * @returns A transaction signature
   */
  async deleteProposal(proposalAddress: PublicKey): Promise<TransactionSignature> {
    const instructions = [];
    const ix = await this.instructionBuilder.buildDeleteFlowIx(this.wallet, proposalAddress);

    instructions.push(ix);

    const tx = await this.transactionSender.sendWithWallet({
      instructions,
      signers: [],
    });

    return tx;
  }

  /** ## Approve a proposal
   *
   * ### Description
   * Note: Only safe owners can approve a proposal.
   *
   * ### Parameters
   * @param flowAddress Public key of the flow
   * @returns A transaction signature
   */
  async approveProposal(proposalAddress: PublicKey): Promise<TransactionSignature> {
    const instructions = [];
    const safeAddress = await this.fetchDerivedSafeAddress(proposalAddress);
    const approveProposalInstruction =
      await this.instructionBuilder.buildApproveProposalInstruction(
        safeAddress,
        proposalAddress,
        this.wallet
      );

    instructions.push(approveProposalInstruction);

    const tx = await this.transactionSender.sendWithWallet({
      instructions,
      signers: [],
    });

    return tx;
  }

  /** ## Reject a proposal
   *
   * ### Description
   * Note: Only safe owners can reject a proposal.
   *
   * ### Parameters
   * @param proposalAddress Public key of the proposal
   * @returns A transaction signature
   */
  async rejectProposal(proposalAddress: PublicKey): Promise<TransactionSignature> {
    const instructions = [];
    const safeAddress = await this.fetchDerivedSafeAddress(proposalAddress);
    const approveProposalInstruction = await this.instructionBuilder.buildRejectProposalInstruction(
      safeAddress,
      proposalAddress,
      this.wallet
    );

    instructions.push(approveProposalInstruction);

    const tx = await this.transactionSender.sendWithWallet({
      instructions,
      signers: [],
    });

    return tx;
  }

  /** ## Abort a proposal
   *
   * ### Description
   * - Only works if the proposal is a recurring.
   * - Only safe owners can abort a proposal.
   *
   * ### Parameters
   * @param proposalAddress Public key of the proposal
   * @returns A transaction signature
   */
  async abortRecurringProposal(proposalAddress: PublicKey): Promise<TransactionSignature> {
    let instructions = [];
    const safeAddress = await this.fetchDerivedSafeAddress(proposalAddress);
    const abortFlowIx = await this.instructionBuilder.buildAbortFlowInstruction(
      proposalAddress,
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

  /** ## Execute a proposal
   *
   * ### Description
   * - Only safe owners can execute a proposal.
   *
   * ### Parameters
   * @param proposalAddress Public key of the proposal
   * @returns A transaction signature
   */
  async executeProposal(proposalAddress: PublicKey): Promise<TransactionSignature> {
    let instructions = [];
    const serJob = await this.fetchProposal(proposalAddress);
    const safeAddress = serJob.safe;
    const [safeSignerAddress] = await this.findSafeSignerAddress(
      safeAddress,
      this.program.programId
    );
    const memoIx = new TransactionInstruction({
      keys: [],
      data: Buffer.from('snf_exec_manual', 'utf-8'),
      programId: MEMO_PROGRAM_ID,
    });

    const proposalActions = SerializableAction.fromInstructions(serJob.instructions);

    const executeMultisigFlowIx = await this.instructionBuilder.buildExecuteMultisigFlowInstruction(
      proposalAddress,
      safeAddress,
      safeSignerAddress,
      this.wallet,
      proposalActions
    );

    instructions = [executeMultisigFlowIx, memoIx];

    const tx = await this.transactionSender.sendWithWallet({
      instructions,
      signers: [],
    });

    return tx;
  }

  /** ## Create add owner instruction
   *
   * Note: The method will create a new instruction to add new owner to the safe
   * ### Parameters
   * @param safeAddress Public key of the safe
   * @param safeOwner Public key of added owner
   * @returns A transaction signature
   */
  async createAddOwnerProposalInstruction(
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

  /** ## Create remove owner instruction
   *
   * Note: The method will create a new instruction to remove new owner to the safe
   * ### Parameters
   * @param safeAddress Public key of the safe
   * @param safeOwner Public key of added owner
   * @returns A transaction signature
   */
  async createRemoveOwnerProposalInstruction(
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

  /** ## Create change threshold instruction
   *
   * Note: The method will create a new instruction to change threshold of the safe
   * ### Parameters
   * @param safeAddress Public key of the safe
   * @param safeOwner Public key of added owner
   * @returns A transaction signature
   */
  async createChangeThresholdProposalInstruction(
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

  /** ## Create add proposal action instructions
   * Note: Add new actions to the proposal
   * @param proposalAddress Public key of the proposal
   * @param proposalActions List of proposal action
   * @returns
   */
  async createAddProposalActionInstructions(
    proposalAddress: PublicKey,
    proposalActions: SerializableAction[]
  ): Promise<TransactionInstruction[]> {
    const ixs: TransactionInstruction[] = [];
    let index = 0;
    for (const proposalAction of proposalActions) {
      const finishDraft = index === proposalActions.length - 1;
      const ix = await this.instructionBuilder.buildAddFlowActionInstruction(
        proposalAddress,
        proposalAction,
        finishDraft,
        this.wallet
      );
      ixs.push(ix);
      index++;
    }

    return ixs;
  }

  async fetchSafe(safeAddress: PublicKey): Promise<SafeType> {
    return this.finder.findSafe(safeAddress);
  }

  async fetchProposal(proposalAddress: PublicKey): Promise<MultisigJob> {
    return this.finder.findJob(proposalAddress);
  }

  async fetchDerivedSafeAddress(proposalAddress: PublicKey): Promise<PublicKey> {
    return this.finder.findSafeAddressDerivedFromJob(proposalAddress);
  }

  async fetchOwnedSafes(ownerAddress: PublicKey): Promise<SafeType[]> {
    return this.finder.findOwnedSafes(ownerAddress);
  }

  async fetchAllProposals(safeAddress: PublicKey): Promise<MultisigJob[]> {
    return this.finder.findJobsOfSafe(safeAddress);
  }

  async findSafeSignerAddress(
    safeAddress: PublicKey,
    safeProgramId: PublicKey
  ): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddress(
      [utils.bytes.utf8.encode('SafeSigner'), safeAddress.toBuffer()],
      safeProgramId
    );
  }

  private validateCreateSafe(owners: PublicKey[], threshold: number) {
    if (owners.length < threshold) {
      throw new Error(ErrorMessage.CreateSafeWithInvalidApprovalsRequired);
    }
  }
}
