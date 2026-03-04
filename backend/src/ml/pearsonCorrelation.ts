export function pearsonCorrelation(
  ratingsA: Record<number, number>,
  ratingsB: Record<number, number>
): number {
  const coRated = Object.keys(ratingsA)
    .filter(id => ratingsB[Number(id)] !== undefined)
    .map(Number);

  if (coRated.length < 2) return 0;

  const as = coRated.map(id => ratingsA[id]);
  const bs = coRated.map(id => ratingsB[id]);
  const meanA = as.reduce((s, v) => s + v, 0) / as.length;
  const meanB = bs.reduce((s, v) => s + v, 0) / bs.length;

  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < coRated.length; i++) {
    const da = as[i] - meanA, db = bs[i] - meanB;
    num  += da * db;
    denA += da * da;
    denB += db * db;
  }
  if (denA === 0 || denB === 0) return 0;
  return num / Math.sqrt(denA * denB);
}
