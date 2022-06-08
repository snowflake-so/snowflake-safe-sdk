import {
  RECURRING_FOREVER,
  TriggerType,
  UnixTimeStamp,
} from "@snowflake-so/snowflake-sdk";
import { TransactionInstruction } from "@solana/web3.js";
import { MultisigJob } from "../models";

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

  build() {
    return this.job;
  }
}
