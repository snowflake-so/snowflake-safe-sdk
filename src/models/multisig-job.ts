import { PublicKey, Signer, TransactionInstruction } from '@solana/web3.js';
import ApprovalRecord from './approval-record';
import { RETRY_WINDOW } from '../config/job-config';
import { DEFAULT_DEVELOPER_APP_ID } from '../config/job-constants';
import { ErrorMessage } from '../config/error';
import { SerializableAction } from './action';
import _ from 'lodash';
import BN from 'bn.js';

export type UnixTimeStamp = number;
export type UTCOffset = number;

export enum TriggerType {
  None = 1,
  Time = 2,
  ProgramCondition = 3,
}

export enum FeeSource {
  FromFeeAccount = 0,
  FromFlow = 1,
}

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

const NON_BN_FIELDS = [
  'remainingRuns',
  'triggerType',
  'retryWindow',
  'clientAppId',
  'userUtcOffset',
  'payFeeFrom',
  'ownerSetSeq',
  'proposalStage',
];

export class MultisigJob {
  pubKey: PublicKey;
  owner: PublicKey;
  nextExecutionTime: UnixTimeStamp = 0;
  recurring = false;
  retryWindow: number = RETRY_WINDOW;
  remainingRuns = 0;
  dedicatedOperator: PublicKey;
  clientAppId = 0;
  expiryDate: UnixTimeStamp = 0;
  expireOnComplete = false;
  scheduleEndDate: UnixTimeStamp = 0;
  userUtcOffset: UTCOffset = new Date().getTimezoneOffset() * 60;
  lastScheduledExecution: UnixTimeStamp = 0;
  createdDate: UnixTimeStamp = 0;
  lastRentCharged: UnixTimeStamp = 0;
  lastUpdatedDate: UnixTimeStamp = 0;
  externalId = '';
  cron = '';
  name: string = 'job - ' + new Date().toLocaleDateString();
  extra = '';
  triggerType: TriggerType = TriggerType.None;
  payFeeFrom: FeeSource = FeeSource.FromFeeAccount;
  initialFund = 0;
  appId: PublicKey = DEFAULT_DEVELOPER_APP_ID;
  instructions: TransactionInstruction[] = [];
  safe: PublicKey;
  ownerSetSeq: number;
  approvals: ApprovalRecord[] = [];
  proposalStage: ProposalStateType = ProposalStateType.Pending;

  isBNType(property: string): boolean {
    return typeof (this as any)[property] === 'number' && NON_BN_FIELDS.indexOf(property) < 0;
  }

  toSerializableJob(): SerializableJob {
    const serJob = _.cloneDeepWith(this, function customizer(value, key: any, obj: any): any {
      if (!key) return;
      if (obj.isBNType(key)) return new BN(obj[key]);
      if (obj[key] instanceof PublicKey) return obj[key];
      if (key === 'instructions') return [];
    });
    serJob.actions = [];
    for (const instruction of this.instructions) {
      const serAction = SerializableAction.fromInstruction(instruction);
      serJob.actions.push(serAction);
    }
    delete serJob.instructions;
    delete serJob.jobId;
    return serJob;
  }

  validateForCreate() {
    if (this.pubKey) throw new Error(ErrorMessage.CreateJobWithExistingPubkey);
  }

  validateForUpdate() {
    if (!this.pubKey) throw new Error(ErrorMessage.UpdateJobWithoutExistingPubkey);
  }

  static fromJobJson(jobJson: any): MultisigJob {
    const job: MultisigJob = new MultisigJob();
    Object.assign(job, jobJson);
    return job;
  }

  static fromSerializableJob(serJob: SerializableJob, jobPubKey: PublicKey): MultisigJob {
    const template = new MultisigJob();
    const job: MultisigJob = _.cloneDeepWith(
      serJob,
      function customizer(value, key: any, obj: any): any {
        if (!key) return;
        if (template.isBNType(key)) {
          return (obj[key] as BN).toNumber();
        }
        if (obj[key] instanceof PublicKey) return obj[key];
        if (key === 'actions') return [];
      }
    );
    job.instructions = [];
    for (const action of serJob.actions) {
      const instruction = SerializableAction.toInstruction(action);
      job.instructions.push(instruction);
    }
    delete (job as any).actions;
    job.pubKey = jobPubKey;

    return MultisigJob.fromJobJson(job);
  }
}

export type SerializableJob = any;

export type InstructionsAndSigners = {
  instructions: TransactionInstruction[];
  signers: Signer[];
};
