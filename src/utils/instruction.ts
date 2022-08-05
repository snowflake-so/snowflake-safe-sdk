import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID } from './ids';

interface SerializedInstruction {
  keys: {
    pubkey: string;
    isWritable: boolean;
    isSigner: boolean;
  }[];
  programId: string;
  data: {
    type: string;
    data: number[];
  };
}

export const isSetupInstruction = (ix: TransactionInstruction) =>
  ix.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID);

export const processDeserializedInstruction = (
  ixs: SerializedInstruction[]
): [TransactionInstruction[], TransactionInstruction[]] => {
  const instructions = ixs.map(deserializeInstruction);
  const setupInstruction = instructions.filter(ix => isSetupInstruction(ix));
  const executeInstruction = instructions.filter(ix => !isSetupInstruction(ix));
  return [setupInstruction, executeInstruction];
};

export const deserializeInstruction = (ix: SerializedInstruction) => ({
  ...ix,
  data: Buffer.from(ix.data as any),
  programId: new PublicKey(ix.programId as any),
  keys: (ix.keys as any).map((key: any) => ({
    ...key,
    pubkey: new PublicKey(key.pubkey),
  })) as any,
});

export const calculateTransactionByteData = (ixs: TransactionInstruction[]) => {
  return (
    ixs.map(ix => ix.keys.length * 32).reduce((a, b) => a + b) +
    ixs.map(ix => ix.data.length).reduce((a, b) => a + b)
  );
};
