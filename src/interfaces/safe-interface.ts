import {
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionSignature,
} from "@solana/web3.js";
import { MultisigJob, SerializableAction } from "src/models";

export interface ISnowflakeSafe {
  createSafe(
    owners: PublicKey[],
    approvalsRequired: number
  ): Promise<[PublicKey, TransactionSignature]>;

  createProposal(
    safeAddress: PublicKey,
    proposalName: string,
    proposalInstructions: TransactionInstruction[],
    setupInstructions?: TransactionInstruction[],
    accountSize?: number
  ): Promise<[PublicKey, TransactionSignature]>;

  createRecurringProposal(
    safeAddress: PublicKey,
    proposal: MultisigJob,
    setupInstructions?: TransactionInstruction[]
  ): Promise<[PublicKey, TransactionSignature]>;

  deleteProposal(proposalAddress: PublicKey): Promise<TransactionSignature>;

  approveProposal(proposalAddress: PublicKey): Promise<TransactionSignature>;

  rejectProposal(proposalAddress: PublicKey): Promise<TransactionSignature>;

  abortRecurringProposal(
    proposalAddress: PublicKey
  ): Promise<TransactionSignature>;

  executeProposal(
    proposalAddress: PublicKey,
    proposalActions: SerializableAction[]
  ): Promise<TransactionSignature>;

  createAddOwnerProposalInstruction(
    safeAddress: PublicKey,
    safeOwner: PublicKey
  ): Promise<TransactionInstruction>;

  createRemoveOwnerProposalInstruction(
    safeAddress: PublicKey,
    safeOwner: PublicKey
  ): Promise<TransactionInstruction>;

  createChangeThresholdProposalInstruction(
    safeAddress: PublicKey,
    threshold: number
  ): Promise<TransactionInstruction>;
}
