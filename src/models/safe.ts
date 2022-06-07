import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

export type SafeType = {
  approvalsRequired: number;
  creator: PublicKey;
  createdAt: BN;
  signerNonce: number;
  ownerSetSeqno: number;
  extra: string;
  owners: PublicKey[];
};
