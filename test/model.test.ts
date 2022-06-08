import { BN } from "@project-serum/anchor";
import { MultisigJobBuilder } from "../src/builders";
import { TriggerType } from "../src/models";
import { instructions, tomorrow } from "./test-data";

test("job conversion test", async function () {
  const job = new MultisigJobBuilder()
    .jobName("hello world")
    .jobInstructions(instructions)
    .scheduleOnce(tomorrow())
    .build();

  const serJob = job.toSerializableJob();
  console.log("serJob = ", serJob);
  expect(serJob.name).toBe("hello world");
  expect(serJob.triggerType).toBe(TriggerType.Time);
  expect(serJob.recurring).toBe(false);
  const nextExecutionTime: BN = serJob.nextExecutionTime as BN;
  expect(nextExecutionTime.toNumber()).toBe(job.nextExecutionTime);
  expect(serJob.actions).toHaveLength(1);
});
