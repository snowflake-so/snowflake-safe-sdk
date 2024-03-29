import { instructions, rightNow, tomorrow } from './test-data';
import { MultisigJobBuilder } from '../src/builders';
import { SerializableAction, TriggerType } from '../src/models';

test('build once-off scheduled job', async function () {
  const job = new MultisigJobBuilder()
    .jobName('hello world')
    .jobInstructions(instructions)
    .scheduleOnce(tomorrow())
    .build();

  expect(job.recurring).toBe(false);
  expect(job.name).toBe('hello world');
  expect(job.nextExecutionTime).toBeGreaterThan(rightNow());
});

test('build recurring scheduled job', async function () {
  const job = new MultisigJobBuilder()
    .jobName('hello world')
    .jobInstructions(instructions)
    .scheduleCron('0 * * * *', 2)
    .build();

  expect(job.recurring).toBe(true);
  expect(job.remainingRuns).toBe(2);
  expect(job.name).toBe('hello world');
});

test('build cron weekday job', () => {
  const job = new MultisigJobBuilder()
    .jobName('hello world')
    .jobInstructions(instructions)
    .scheduleCron('0 * * * 2', 2)
    .build();

  console.log(job);

  expect(job.recurring).toBe(true);
  expect(job.name).toBe('hello world');
  expect(job.triggerType).toBe(TriggerType.Time);
});

test('build serializable action from instruction', () => {
  const actions = instructions.map(SerializableAction.fromInstruction);
  expect(actions.length).toBe(instructions.length);
  console.log(actions);
});
