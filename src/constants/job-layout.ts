import BufferLayout from "buffer-layout";

export const JOB_ACCOUNT_LAYOUT = BufferLayout.struct([
  BufferLayout.blob(8, "discriminator"),
  BufferLayout.blob(32, "requested_by"),
  BufferLayout.blob(32, "safe"),
]);
