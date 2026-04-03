import { cosineSimilarity } from '../../src/ml/cosineSimilarity';
import type { SimilarityRow } from '../../src/bigquery/upsert';

const TOP_K = 50;
const CHUNK = 1000; // process this many "source" movies at a time

function buildSignalBreakdown(a: number[], b: number[]): string {
  // Genre similarity (dims 0-18), cast similarity (19-23), keyword similarity (25-34)
  const genreA = a.slice(0, 19);
  const genreB = b.slice(0, 19);
  const genreSim = cosineSimilarity(genreA, genreB);

  const castA = a.slice(19, 24);
  const castB = b.slice(19, 24);
  const castSim = cosineSimilarity(castA, castB);

  const kwA = a.slice(25, 35);
  const kwB = b.slice(25, 35);
  const kwSim = cosineSimilarity(kwA, kwB);

  return `genre:${genreSim.toFixed(2)},cast:${castSim.toFixed(2)},keyword:${kwSim.toFixed(2)}`;
}

export async function computeTopKSimilarity(
  allVectors: Map<number, number[]>,
  onFlush?: (rows: SimilarityRow[]) => Promise<void>
): Promise<SimilarityRow[]> {
  const ids  = Array.from(allVectors.keys());
  const vecs = ids.map(id => allVectors.get(id)!);
  const allResults: SimilarityRow[] = [];

  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunkIds  = ids.slice(i, i + CHUNK);
    const chunkVecs = vecs.slice(i, i + CHUNK);
    const chunkResults: SimilarityRow[] = [];

    for (let ci = 0; ci < chunkIds.length; ci++) {
      const srcId  = chunkIds[ci];
      const srcVec = chunkVecs[ci];

      const scored: { id: number; score: number }[] = [];
      for (let j = 0; j < ids.length; j++) {
        if (ids[j] === srcId) continue;
        scored.push({ id: ids[j], score: cosineSimilarity(srcVec, vecs[j]) });
      }

      scored.sort((a, b) => b.score - a.score);
      const top = scored.slice(0, TOP_K);

      for (let rank = 0; rank < top.length; rank++) {
        chunkResults.push({
          movieId:         srcId,
          similarMovieId:  top[rank].id,
          score:           top[rank].score,
          rank:            rank + 1,
          signalBreakdown: buildSignalBreakdown(srcVec, allVectors.get(top[rank].id)!),
        });
      }
    }

    if (onFlush) {
      await onFlush(chunkResults);
    } else {
      allResults.push(...chunkResults);
    }

    console.log(
      `Similarity: processed ${Math.min(i + CHUNK, ids.length)}/${ids.length} movies`
    );
  }

  return allResults;
}
