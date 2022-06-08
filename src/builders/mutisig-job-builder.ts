import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { ErrorMessage } from "../config";
import { RECURRING_FOREVER } from "../config/job-constants";
import { FeeSource, MultisigJob, TriggerType, UnixTimeStamp } from "../models";

export class MultisigJobBuilder {
  private job: MultisigJob = new MultisigJob();

  constructor() {}

  fromExistingJob(job: MultisigJob): MultisigJobBuilder {
    this.job = job;
    return this;
  }

  jobName(name: string): MultisigJobBuilder {
    this.job.name = name;
    return this;
  }

  jobInstructions(instructions: TransactionInstruction[]): MultisigJobBuilder {
    this.job.instructions = instructions;
    return this;
  }

  scheduleOnce(executionTime: UnixTimeStamp): MultisigJobBuilder {
    this.job.triggerType = TriggerType.Time;
    this.job.recurring = false;
    this.job.nextExecutionTime = executionTime;
    return this;
  }

  scheduleCron(
    cron: string,
    numberOfExecutions?: number,
    userTimezoneOffset?: UnixTimeStamp
  ): MultisigJobBuilder {
    this.job.triggerType = TriggerType.Time;
    this.job.recurring = true;
    this.job.cron = cron;
    this.job.remainingRuns =
      numberOfExecutions === undefined ? RECURRING_FOREVER : numberOfExecutions;

    this.job.userUtcOffset =
      userTimezoneOffset === undefined
        ? new Date().getTimezoneOffset() * 60
        : userTimezoneOffset;
    return this;
  }

  scheduleConditional(numberOfExecutions: number): MultisigJobBuilder {
    this.job.triggerType = TriggerType.ProgramCondition;
    this.job.remainingRuns = numberOfExecutions;
    return this;
  }

  selfFunded(isSelfFunded: boolean): MultisigJobBuilder {
    this.job.payFeeFrom = isSelfFunded
      ? FeeSource.FromFlow
      : FeeSource.FromFeeAccount;
    return this;
  }

  initialFund(amount: number): MultisigJobBuilder {
    if (this.job.payFeeFrom !== FeeSource.FromFlow) {
      throw new Error(ErrorMessage.JobNotBuiltAsSelfFunded);
    }
    this.job.initialFund = amount;
    return this;
  }

  byAppId(appId: PublicKey): MultisigJobBuilder {
    this.job.appId = appId;
    return this;
  }

  build() {
    return this.job;
  }
}
