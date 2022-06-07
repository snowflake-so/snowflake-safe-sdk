import {
  AccountMeta,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { Program, AnchorProvider } from "@project-serum/anchor";
import BN from "bn.js";
import { MultisigJobType, MultisigJob } from "../models/multisig-job";

export class InstructionBuilder {
  program: Program;
  provider: AnchorProvider;
  constructor(program: Program, provider: AnchorProvider) {
    this.program = program;
    this.provider = provider;
  }

  buildCreateSafeInstruction(
    payerAddress: PublicKey,
    safeAddress: PublicKey,
    safeSignerNonce: number,
    safeOwners: PublicKey[],
    approvalsRequired: number
  ): TransactionInstruction {
    let ctx: any = {
      accounts: {
        payer: payerAddress,
        safe: safeAddress,
        systemProgram: SystemProgram.programId,
      },
      signers: [],
    };
    let safe = {
      approvalsRequired: approvalsRequired,
      creator: payerAddress,
      createdAt: new BN(0),
      signerNonce: safeSignerNonce,
      extra: "",
      owners: safeOwners,
    };

    const createSafeIx = this.program.instruction.createSafe(safe, ctx);
    return createSafeIx;
  }

  buildUpdateSafeInstruction(
    payerAddress: PublicKey,
    safeAddress: PublicKey,
    safeOwners: PublicKey[],
    approvalsRequired: number
  ): TransactionInstruction {
    let ctx = {
      accounts: {
        safe: safeAddress,
        caller: payerAddress,
      },
      signers: [],
    };
    const updateSafeIx = this.program.instruction.updateSafe(
      safeOwners,
      approvalsRequired,
      ctx
    );
    return updateSafeIx;
  }

  buildAddOwnerInstruction(
    safeSignerAddress: PublicKey,
    safeAddress: PublicKey,
    safeOwner: PublicKey
  ): TransactionInstruction {
    let ctx = {
      accounts: {
        safe: safeAddress,
        safeSigner: safeSignerAddress,
      },
      signers: [],
    };

    const setOwnersIx = this.program.instruction.addOwner(safeOwner, ctx);

    return setOwnersIx;
  }

  buildRemoveOwnerInstruction(
    safeSignerAddress: PublicKey,
    safeAddress: PublicKey,
    safeOwner: PublicKey
  ): TransactionInstruction {
    let ctx = {
      accounts: {
        safe: safeAddress,
        safeSigner: safeSignerAddress,
      },
      signers: [],
    };

    const setOwnersIx = this.program.instruction.removeOwner(safeOwner, ctx);

    return setOwnersIx;
  }

  buildChangeThresholdInstruction(
    safeSignerAddress: PublicKey,
    safeAddress: PublicKey,
    threshold: number
  ): TransactionInstruction {
    let ctx = {
      accounts: {
        safe: safeAddress,
        safeSigner: safeSignerAddress,
      },
      signers: [],
    };

    const changeThresholdIx = this.program.instruction.changeThreshold(
      threshold,
      ctx
    );
    let safeSigner = changeThresholdIx.keys.find((key: any) => {
      return key.pubkey.equals(safeSignerAddress);
    });
    if (safeSigner) {
      safeSigner.isSigner = false;
    }

    return changeThresholdIx;
  }

  buildCreateFlowInstruction(
    requestedByAddress: PublicKey,
    account_size: number,
    clientFlow: MultisigJobType,
    safeAddress: PublicKey,
    newFlowKeypair: Keypair,
    systemProgram: PublicKey
  ): TransactionInstruction {
    let ctx = {
      accounts: {
        flow: newFlowKeypair.publicKey,
        safe: safeAddress,
        requestedBy: requestedByAddress,
        systemProgram,
      },
      signers: [],
    };

    const serializableJob = new MultisigJob(clientFlow).buildNewFlowJob(
      safeAddress
    );
    const createFlowIx = this.program.instruction.createFlow(
      account_size,
      serializableJob,
      ctx
    );
    return createFlowIx;
  }

  buildDeleteFlowIx(
    ownerAddress: PublicKey,
    flowAddress: PublicKey
  ): TransactionInstruction {
    let ctx = {
      accounts: {
        flow: flowAddress,
        requestedBy: ownerAddress,
      },
      signers: [],
    };

    const createFlowIx = this.program.instruction.deleteFlow(ctx);
    return createFlowIx;
  }

  buildApproveProposalInstruction(
    safeAddress: PublicKey,
    flowAddress: PublicKey,
    payerAddress: PublicKey
  ) {
    let ctx = {
      accounts: {
        safe: safeAddress,
        flow: flowAddress,
        caller: payerAddress,
      },
      signers: [],
    };

    const approveProposalIx = this.program.instruction.approveProposal(
      true,
      ctx
    );
    return approveProposalIx;
  }

  buildRejectProposalInstruction(
    safeAddress: PublicKey,
    flowAddress: PublicKey,
    payerAddress: PublicKey
  ) {
    let ctx = {
      accounts: {
        safe: safeAddress,
        flow: flowAddress,
        caller: payerAddress,
      },
      signers: [],
    };

    const approveProposalIx = this.program.instruction.approveProposal(
      false,
      ctx
    );
    return approveProposalIx;
  }

  buildAbortFlowInstruction(
    flowAddress: PublicKey,
    safeAddress: PublicKey,
    callerAddress: PublicKey
  ): TransactionInstruction {
    let ctx = {
      accounts: {
        flow: flowAddress,
        safe: safeAddress,
        requestedBy: callerAddress,
      },
    };

    const abortFlowIx = this.program.instruction.abortFlow(ctx);
    return abortFlowIx;
  }

  buildExecuteMultisigFlowInstruction(
    flowAddress: PublicKey,
    safeAddress: PublicKey,
    safeSignerAddress: PublicKey,
    ownerAddress: PublicKey,
    flowActions: any
  ): TransactionInstruction {
    let remainingAccountMetas: AccountMeta[] = flowActions.reduce(
      (result: any, current: any) => {
        const currentAccounts = current.accounts.map((account: any) => {
          return { ...account, isSigner: false };
        });
        result = result.concat(currentAccounts, {
          pubkey: current.program,
          isSigner: false,
          isWritable: false,
        });

        return result;
      },
      []
    );
    let ctx = {
      accounts: {
        flow: flowAddress,
        safe: safeAddress,
        safeSigner: safeSignerAddress,
        caller: ownerAddress,
        systemProgram: SystemProgram.programId,
      },
      remainingAccounts: remainingAccountMetas,
    };

    const executeMultisigFlowIx =
      this.program.instruction.executeMultisigFlow(ctx);
    return executeMultisigFlowIx;
  }
}
