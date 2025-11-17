import { calculateCandidateScore } from '../resume-parser/utils';

interface CandidateScoreCardProps {
  sectionScores: Record<string, number>;
  scoringWeights: Record<string, number>;
  userScore: number | null; // Include user's score
}

export function CandidateScoreCard({ sectionScores, scoringWeights, userScore }: CandidateScoreCardProps) {
  // Calculate the weighted score
  const weightedScore = calculateCandidateScore(sectionScores, scoringWeights);

  // Incorporate user's score into the final result
  const finalScore = userScore !== null
    ? Math.round((weightedScore + userScore) / 2) // Average of weighted score and user's score
    : weightedScore; // Fallback to weighted score if userScore is not provided

  return (
    <div className="candidate-score-card rounded-lg border border-gray-200 p-4 bg-white shadow-sm">
      <h3 className="text-lg font-semibold mb-4">Automated Candidate Score</h3>
      <table className="w-full mb-4">
        <thead>
          <tr className="text-left">
            <th className="pb-2">Section</th>
            <th className="pb-2">Score</th>
            <th className="pb-2">Weight</th>
            <th className="pb-2">Weighted</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(scoringWeights).map((section) => (
            <tr key={section} className="border-t">
              <td className="py-2">{section.charAt(0).toUpperCase() + section.slice(1)}</td>
              <td className="py-2">{sectionScores[section]}</td>
              <td className="py-2">{scoringWeights[section]}</td>
              <td className="py-2">{Math.round(sectionScores[section] * scoringWeights[section])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-xl font-bold text-center">
        Final Candidate Score: <span className="text-blue-600">{finalScore} / 100</span>
      </div>
    </div>
  );
}