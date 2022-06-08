import {
  Job,
  JobBuilder,
  SerializableAction,
  SerializableJob,
  TriggerType,
} from "@snowflake-so/snowflake-sdk";
import { PublicKey } from "@solana/web3.js";
import ApprovalRecord from "./approval-record";
import { RETRY_WINDOW } from "../config/job-config";

export enum ProposalStateType {
  Pending = 0,
  Approved = 1,
  Rejected = 2,
  ExecutionInProgress = 3,
  Complete = 4,
  Failed = 5,
  Aborted = 6,
  Deprecated = 7,
}

export interface MultisigJobType extends Job {
  safe: PublicKey;
  ownerSetSeq: number;
  approvals: ApprovalRecord[];
  proposalStage: ProposalStateType;
}

export class MultisigJob extends Job implements MultisigJobType {
  safe: PublicKey;
  ownerSetSeq: number;
  approvals: ApprovalRecord[];
  proposalStage: ProposalStateType;

  constructor() {
    super();
  }

  buildNewMultisigFlow(
    clientFlow: MultisigJobType,
    safeAddress: PublicKey
  ): SerializableJob {
    const jobBuilder = new JobBuilder().fromExistingJob(clientFlow);
    const isScheduledOnce =
      !this.recurring && this.triggerType === TriggerType.Time;
    const isScheduledCron =
      this.recurring && this.triggerType === TriggerType.Time;
    const isScheduledConditional =
      this.triggerType === TriggerType.ProgramCondition;
    if (isScheduledOnce) {
      jobBuilder.scheduleOnce(this.nextExecutionTime);
    }
    if (isScheduledCron) {
      jobBuilder.scheduleCron((this as any).cron, this.remainingRuns);
    }
    if (isScheduledConditional) {
      jobBuilder.scheduleConditional(this.remainingRuns);
    }
    const job = jobBuilder.build();
    job.triggerType = this.triggerType;

    if (this.nextExecutionTime) {
      job.nextExecutionTime = this.nextExecutionTime;
    }
    if (this.scheduleEndDate) {
      job.scheduleEndDate = this.scheduleEndDate;
    }
    if (this.extra) {
      job.extra = this.extra;
    }

    let actions = [];
    for (const instruction of job.instructions) {
      actions.push(SerializableAction.fromInstruction(instruction));
    }

    const serializableJob = job.toSerializableJob();
    serializableJob.actions = actions;
    serializableJob.ownerSetSeqno = this.ownerSetSeq;
    serializableJob.approvals = [];
    serializableJob.safe = safeAddress;
    serializableJob.retryWindow = RETRY_WINDOW;
    serializableJob.proposalState = 0;

    return serializableJob;
  }
}
