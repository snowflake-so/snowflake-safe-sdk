import {
  JobBuilder,
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

export interface MultisigJobType extends SerializableJob {
  safe: PublicKey;
  ownerSetSeq: number;
  approvals: ApprovalRecord[];
  proposalState: ProposalStateType;
}

export class MultisigJob {
  flow: MultisigJobType;
  constructor(flow: MultisigJobType) {
    this.flow = flow;
  }
  buildNewFlowJob(safeAddress: PublicKey): SerializableJob {
    const jobBuilder = new JobBuilder().jobName(this.flow.name);
    const isScheduledOnce =
      !this.flow.recurring && this.flow.triggerType === TriggerType.Time;
    const isScheduledCron =
      this.flow.recurring && this.flow.triggerType === TriggerType.Time;
    const isScheduledConditional =
      this.flow.triggerType === TriggerType.ProgramCondition;
    if (isScheduledOnce) {
      jobBuilder.scheduleOnce(this.flow.nextExecutionTime.toNumber());
    }
    if (isScheduledCron) {
      jobBuilder.scheduleCron((this.flow as any).cron, this.flow.remainingRuns);
    }
    if (isScheduledConditional) {
      jobBuilder.scheduleConditional(this.flow.remainingRuns);
    }
    const job = jobBuilder.build();
    job.triggerType = this.flow.triggerType;

    if (this.flow.nextExecutionTime) {
      job.nextExecutionTime = this.flow.nextExecutionTime.toNumber();
    }
    if (this.flow.scheduleEndDate) {
      job.scheduleEndDate = this.flow.scheduleEndDate.toNumber();
    }
    if (this.flow.extra) {
      job.extra = this.flow.extra;
    }

    const serializableJob = job.toSerializableJob();
    serializableJob.actions = this.flow.actions;
    serializableJob.ownerSetSeqno = this.flow.ownerSetSeq;
    serializableJob.approvals = [];
    serializableJob.safe = safeAddress;
    serializableJob.retryWindow = RETRY_WINDOW;
    serializableJob.proposalState = 0;

    return serializableJob;
  }
}
