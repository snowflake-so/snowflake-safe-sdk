import { Program } from '@project-serum/anchor';
import { GetProgramAccountsFilter, PublicKey } from '@solana/web3.js';
import { MultisigJob } from '../models/multisig-job';
import { SafeType } from '../models/safe';

export default class SafeFinder {
  program: Program;
  constructor(program: Program) {
    this.program = program;
  }

  async findSafe(safeAddress: PublicKey): Promise<SafeType> {
    const safe: any = await this.program.account.safe.fetch(safeAddress);
    return Object.assign(safe, {
      safeAddress,
    });
  }

  async findOwnedSafes(ownerAddress: PublicKey): Promise<SafeType[]> {
    const safes = await this.program.account.safe.all();
    const ownedSafes = this.getOwnedSafesFilter(safes, ownerAddress);
    return ownedSafes.map<SafeType>(safe => ({
      safeAddress: safe.publicKey,
      ...safe.account,
    }));
  }

  async findJob(jobAddress: PublicKey): Promise<MultisigJob> {
    const serJob: any = await this.program.account.flow.fetch(jobAddress);

    return MultisigJob.fromSerializableJob(serJob, jobAddress) as any;
  }

  async findJobsOfSafe(safeAddress: PublicKey): Promise<MultisigJob[]> {
    const ownerFilter = this.getSafeAddressFilter(safeAddress);
    const serJobs: any[] = await this.program.account.flow.all([ownerFilter]);

    return serJobs.map(v => MultisigJob.fromSerializableJob(v.account, v.publicKey)) as any;
  }

  async findSafeAddressDerivedFromJob(jobAddress: PublicKey): Promise<PublicKey> {
    const serJob: any = await this.findJob(jobAddress);
    return serJob.safe;
  }

  private getOwnedSafesFilter(safes: any[], ownerAddress: PublicKey) {
    return safes.filter(safe =>
      safe.account.owners.some((owner: PublicKey) => owner?.toString() === ownerAddress.toString())
    );
  }

  private getSafeAddressFilter(publicKey: PublicKey): GetProgramAccountsFilter {
    return {
      memcmp: {
        offset: 8 + 32,
        bytes: publicKey.toBase58(),
      },
    };
  }
}
