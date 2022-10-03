import {
  AccountMeta,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import { Program, AnchorProvider } from '@project-serum/anchor';
import { MultisigJob } from '../models/multisig-job';
import BN from 'bn.js';
import { SerializableAction } from '../models';

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
    safeSignerAddress: PublicKey,
    safeSignerNonce: number,
    safeOwners: PublicKey[],
    approvalsRequired: number
  ): TransactionInstruction {
    const ctx: any = {
      accounts: {
        payer: payerAddress,
        safe: safeAddress,
        safeSigner: safeSignerAddress,
        systemProgram: SystemProgram.programId,
      },
      signers: [],
    };
    const safe = {
      approvalsRequired: approvalsRequired,
      creator: payerAddress,
      createdAt: new BN(0),
      signerBump: safeSignerNonce,
      extra: '',
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
    const ctx = {
      accounts: {
        safe: safeAddress,
        caller: payerAddress,
      },
      signers: [],
    };
    const updateSafeIx = this.program.instruction.updateSafe(safeOwners, approvalsRequired, ctx);
    return updateSafeIx;
  }

  buildAddOwnerInstruction(
    safeSignerAddress: PublicKey,
    safeAddress: PublicKey,
    safeOwner: PublicKey
  ): TransactionInstruction {
    const ctx = {
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
    const ctx = {
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
    const ctx = {
      accounts: {
        safe: safeAddress,
        safeSigner: safeSignerAddress,
      },
      signers: [],
    };

    const changeThresholdIx = this.program.instruction.changeThreshold(threshold, ctx);
    const safeSigner = changeThresholdIx.keys.find((key: any) => {
      return key.pubkey.equals(safeSignerAddress);
    });
    if (safeSigner) {
      safeSigner.isSigner = false;
    }

    return changeThresholdIx;
  }

  buildCreateFlowInstruction(
    requestedByAddress: PublicKey,
    accountSize: number,
    multisigJob: MultisigJob,
    isDraft: boolean,
    safeAddress: PublicKey,
    newFlowKeypair: Keypair,
    systemProgram: PublicKey
  ): TransactionInstruction {
    const serializableJob = multisigJob.toSerializableJob();
    const ctx = {
      accounts: {
        flow: newFlowKeypair.publicKey,
        safe: safeAddress,
        requestedBy: requestedByAddress,
        systemProgram,
      },
      signers: [],
    };

    const createFlowIx = this.program.instruction.createFlow(
      accountSize,
      serializableJob,
      isDraft,
      ctx
    );
    multisigJob.safe = safeAddress;

    return createFlowIx;
  }

  buildDeleteFlowIx(ownerAddress: PublicKey, flowAddress: PublicKey): TransactionInstruction {
    const ctx = {
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
    const ctx = {
      accounts: {
        safe: safeAddress,
        flow: flowAddress,
        caller: payerAddress,
      },
      signers: [],
    };

    const approveProposalIx = this.program.instruction.approveProposal(true, ctx);
    return approveProposalIx;
  }

  buildRejectProposalInstruction(
    safeAddress: PublicKey,
    flowAddress: PublicKey,
    payerAddress: PublicKey
  ) {
    const ctx = {
      accounts: {
        safe: safeAddress,
        flow: flowAddress,
        caller: payerAddress,
      },
      signers: [],
    };

    const approveProposalIx = this.program.instruction.approveProposal(false, ctx);
    return approveProposalIx;
  }

  buildAbortFlowInstruction(
    flowAddress: PublicKey,
    safeAddress: PublicKey,
    callerAddress: PublicKey
  ): TransactionInstruction {
    const ctx = {
      accounts: {
        flow: flowAddress,
        safe: safeAddress,
        requestedBy: callerAddress,
      },
    };

    const abortFlowIx = this.program.instruction.abortFlow(ctx);
    return abortFlowIx;
  }

  buildAddFlowActionInstruction(
    flowAddress: PublicKey,
    flowAction: SerializableAction,
    finishDraft: boolean,
    requestedByAddress: PublicKey
  ): TransactionInstruction {
    console.log(flowAddress);
    const ctx = {
      accounts: {
        flow: flowAddress,
        requestedBy: requestedByAddress,
      },
      signers: [],
    };
    const addFlowActionIx = this.program.instruction.addAction(flowAction, finishDraft, ctx);
    return addFlowActionIx;
  }

  buildExecuteMultisigFlowInstruction(
    flowAddress: PublicKey,
    safeAddress: PublicKey,
    safeSignerAddress: PublicKey,
    ownerAddress: PublicKey,
    flowActions: any
  ): TransactionInstruction {
    const remainingAccountMetas: AccountMeta[] = flowActions.reduce((result: any, current: any) => {
      const currentAccounts = current.accounts.map((account: any) => {
        return { ...account, isSigner: false };
      });
      result = result.concat(currentAccounts, {
        pubkey: current.program,
        isSigner: false,
        isWritable: false,
      });

      return result;
    }, []);
    const ctx = {
      accounts: {
        flow: flowAddress,
        safe: safeAddress,
        safeSigner: safeSignerAddress,
        caller: ownerAddress,
        systemProgram: SystemProgram.programId,
      },
      remainingAccounts: remainingAccountMetas,
    };

    const executeMultisigFlowIx = this.program.instruction.executeMultisigFlow(ctx);
    return executeMultisigFlowIx;
  }

  buildNativeTokenTransferIx(
    fromAddress: PublicKey,
    toAddress: PublicKey,
    amount: number
  ): TransactionInstruction {
    const transferIx = SystemProgram.transfer({
      fromPubkey: fromAddress,
      toPubkey: toAddress,
      lamports: amount,
      programId: SystemProgram.programId,
    });

    return transferIx;
  }
}
