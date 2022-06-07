import { Program, ProgramAccount } from "@project-serum/anchor";
import { GetProgramAccountsFilter, PublicKey } from "@solana/web3.js";
import { JOB_ACCOUNT_LAYOUT } from "../constants/job-layout";
import { MultisigJobType } from "../models/multisig-job";
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
    const job: any = await this.program.account.flow.fetch(jobAddress);

    return job;
  }

  async findJobsOfSafe(
    safeAddress: PublicKey
  ): Promise<ProgramAccount<MultisigJobType>[]> {
    let ownerFilter = this.getSafeAddressFilter(safeAddress);
    let serJobs: any[] = await this.program.account.flow.all([ownerFilter]);

    return serJobs;
  }

  private getSafeAddressFilter(publicKey: PublicKey): GetProgramAccountsFilter {
    return {
      memcmp: {
        offset: JOB_ACCOUNT_LAYOUT.offsetOf("safe"),
        bytes: publicKey.toBase58(),
      },
    };
  }
}
