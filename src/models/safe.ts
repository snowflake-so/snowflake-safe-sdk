import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

export type SafeType = {
  safeAddress: PublicKey,
  approvalsRequired: number;
  creator: PublicKey;
  createdAt: BN;
  ownerSetSeqno: number;
  extra: string;
  owners: PublicKey[];
};
