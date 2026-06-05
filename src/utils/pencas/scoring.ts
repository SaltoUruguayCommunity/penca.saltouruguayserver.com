export function calcPoints(
  homePred: number,
  awayPred: number,
  homeReal: number,
  awayReal: number,
): number {
  const exact = homePred === homeReal && awayPred === awayReal;
  if (exact) return 5;

  const predResult = Math.sign(homePred - awayPred);
  const realResult = Math.sign(homeReal - awayReal);
  if (predResult === realResult) return 2;

  return 0;
}
