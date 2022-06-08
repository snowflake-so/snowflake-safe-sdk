import { Program, ProgramAccount } from "@project-serum/anchor";
import { GetProgramAccountsFilter, PublicKey } from "@solana/web3.js";
import { MultisigJob, MultisigJobType } from "../models/multisig-job";
import { SafeType } from "../models/safe";

export default class SafeFinder {
  program: Program;
  constructor(program: Program) {
    this.program = program;
  }

  async findSafe(safeAddress: PublicKey): Promise<SafeType> {
    const safe: any = await this.program.account.safe.fetch(safeAddress);
    return safe;
  }

  async findJob(jobAddress: PublicKey): Promise<MultisigJobType> {
    const serJob: any = await this.program.account.flow.fetch(jobAddress);

    return MultisigJob.fromSerializableJob(serJob, jobAddress) as any;
  }

  async findJobsOfSafe(safeAddress: PublicKey): Promise<MultisigJobType[]> {
    let ownerFilter = this.getSafeAddressFilter(safeAddress);
    let serJobs: any[] = await this.program.account.flow.all([ownerFilter]);

    return serJobs.map((v) =>
      MultisigJob.fromSerializableJob(v.account, v.publicKey)
    ) as any;
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
