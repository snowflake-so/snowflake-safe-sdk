export function toLamportsByDecimal(account?: any | number, decimals?: number): number {
  if (!account) {
    return 0;
  }

  const amount = typeof account === 'number' ? account : account.info.amount?.toNumber();

  const precision = Math.pow(10, decimals ? decimals : 0);
  return Math.floor(amount * precision);
}
