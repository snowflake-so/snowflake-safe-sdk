import {
  AccountMeta,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import { CUSTOM_ACTION_CODE } from "../config/job-constants";

export class SerializableAction {
  program: PublicKey;
  instruction: Buffer;
  accounts: Array<AccountMeta> = [];
  actionCode: number;
  name: string;
  extra: string;

  static fromInstruction(
    instruction: TransactionInstruction
  ): SerializableAction {
    const serAction = new SerializableAction();
    serAction.program = instruction.programId;
    serAction.accounts = instruction.keys;
    serAction.instruction = instruction.data;
    const openInstruction = instruction as any;
    serAction.actionCode = openInstruction.code
      ? openInstruction.code
      : CUSTOM_ACTION_CODE;
    serAction.name = openInstruction.name ? openInstruction.name : "";
    serAction.extra = openInstruction.extra ? openInstruction.extra : "";
    return serAction;
  }

  static toInstruction(serAction: SerializableAction): TransactionInstruction {
    const instruction: TransactionInstruction = {
      data: serAction.instruction,
      keys: serAction.accounts,
      programId: serAction.program,
    };
    return instruction;
  }
}
