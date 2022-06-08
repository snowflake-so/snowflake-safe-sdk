import {
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionSignature,
} from "@solana/web3.js";
import { MultisigJobType } from "../models/multisig-job";

export interface ISnowflakeSafe {
  createSafe(
    safeKeypair: Keypair,
    owners: PublicKey[],
    approvalsRequired: number
  ): Promise<TransactionSignature>;

  createFlow(
    safeAddress: PublicKey,
    accountSize: number,
    clientFlow: MultisigJobType,
    newFlowKeypair: Keypair,
    instructions: TransactionInstruction[]
  ): Promise<TransactionSignature>;

  deleteFlow(flowAddress: PublicKey): Promise<TransactionSignature>;

  approveProposal(
    safeAddress: PublicKey,
    flowAddress: PublicKey
  ): Promise<TransactionSignature>;

  rejectProposal(
    safeAddress: PublicKey,
    flowAddress: PublicKey
  ): Promise<TransactionSignature>;

  abortFlow(
    flowAddress: PublicKey,
    safeAddress: PublicKey
  ): Promise<TransactionSignature>;

  executeMultisigFlow(
    flowAddress: PublicKey,
    flowActions: any[],
    safeAddress: PublicKey
  ): Promise<TransactionSignature>;

  createAddOwnerInstruction(
    safeAddress: PublicKey,
    safeOwner: PublicKey
  ): Promise<TransactionInstruction>;

  createRemoveOwnerInstruction(
    safeAddress: PublicKey,
    safeOwner: PublicKey
  ): Promise<TransactionInstruction>;

  createChangeThresholdInstruction(
    safeAddress: PublicKey,
    threshold: number
  ): Promise<TransactionInstruction>;
}
