import { AnchorProvider, Wallet } from '@project-serum/anchor';
import { ConfirmOptions, Connection, Keypair } from '@solana/web3.js';
import { SnowflakeSafe } from '../services';

export const initSnowflakeSafe = (keypair: Keypair, rpcUrl: string) => {
  const provider = initAnchorProvider(keypair, rpcUrl);
  const snowflake = new SnowflakeSafe(provider);
  return snowflake;
};

export const initAnchorProvider = (keypair: Keypair, rpcUrl: string, opts?: ConfirmOptions) => {
  opts = opts ?? AnchorProvider.defaultOptions();
  const connection = new Connection(rpcUrl ?? 'http://localhost:8899', opts.preflightCommitment);
  const wallet = new Wallet(keypair);

  return new AnchorProvider(connection, wallet, opts);
};
