import { Buffer } from "buffer";
import { Keypair, PublicKey } from "@solana/web3.js";
import { UnixTimeStamp } from "src/models";

export const testWallet = Keypair.fromSecretKey(
  new Uint8Array([
    63, 231, 113, 72, 156, 227, 201, 211, 118, 236, 133, 156, 39, 245, 184, 242,
    30, 208, 133, 197, 169, 203, 29, 155, 243, 93, 12, 61, 42, 0, 116, 168, 219,
    81, 127, 74, 74, 245, 57, 177, 185, 9, 113, 42, 160, 227, 48, 156, 42, 207,
    225, 149, 26, 238, 195, 47, 100, 52, 243, 4, 26, 194, 173, 199,
  ])
);

export const instructions = [
  {
    programId: new PublicKey("ETwBdF9X2eABzmKmpT3ZFYyUtmve7UWWgzbERAyd4gAC"),
    data: Buffer.from("74b89fceb3e0b22a", "hex"),
    keys: [
      {
        pubkey: new PublicKey("5jo4Lh2Z9FGQ87sDhUBwZjNZdL15MwdeT5WUXKfwFSZY"),
        isSigner: false,
        isWritable: false,
      },
    ],
  },
];

export function tomorrow(): UnixTimeStamp {
  let tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return Math.floor(+tomorrow / 1000);
}

export function rightNow(): UnixTimeStamp {
  return +new Date() / 1000;
}
