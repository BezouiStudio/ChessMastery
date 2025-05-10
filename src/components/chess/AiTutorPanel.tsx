'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { AiTutorAnalysisOutput } from '@/ai/flows/ai-tutor-analysis';

interface AiTutorPanelProps {
  hint?: { move?: string; explanation: string; type: 'vague' | 'specific' };
  playerMoveAnalysis?: AiTutorAnalysisOutput;
  aiMoveExplanation?: { move: string; explanation: string };
  isLoading: boolean;
}

const AiTutorPanel: React.FC<AiTutorPanelProps> = ({ hint, playerMoveAnalysis, aiMoveExplanation, isLoading }) => {
  
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg">AI Tutor</CardTitle>
      </CardHeader>
      <CardContent className="h-[calc(100%-4rem)] pb-2">
        <ScrollArea className="h-full w-full rounded-md border p-3">
          {isLoading && <p className="text-sm text-muted-foreground">AI is thinking...</p>}
          
          {!isLoading && hint && hint.type === 'vague' && (
            <div className="mb-4 p-3 bg-blue-600/10 dark:bg-blue-400/10 rounded-lg border border-blue-600/30 dark:border-blue-400/30">
              <h3 className="font-semibold text-md mb-1 text-blue-700 dark:text-blue-300">General Tip:</h3>
              <p className="text-sm whitespace-pre-wrap">{hint.explanation}</p>
            </div>
          )}

          {!isLoading && hint && hint.type === 'specific' && hint.move && (
            <div className="mb-4 p-3 bg-accent/10 rounded-lg border border-accent/30">
              <h3 className="font-semibold text-md mb-1">Suggested Move: <Badge variant="default" className="bg-accent text-accent-foreground">{hint.move}</Badge></h3>
              <p className="text-sm whitespace-pre-wrap">{hint.explanation}</p>
            </div>
          )}
          
          {!isLoading && playerMoveAnalysis && (
            <div className="mb-4 space-y-3">
              {playerMoveAnalysis.playerMoveEvaluation && (
                <div>
                  <h3 className="font-semibold text-md mb-1">Evaluation of Your Last Move:</h3>
                  <div className="p-3 bg-primary/10 rounded-lg border border-primary/30">
                    <p className="text-sm whitespace-pre-wrap">{playerMoveAnalysis.playerMoveEvaluation}</p>
                  </div>
                </div>
              )}
              {playerMoveAnalysis.betterPlayerMoveSuggestions && playerMoveAnalysis.betterPlayerMoveSuggestions.length > 0 && (
                <div>
                  <h4 className="font-semibold text-md mb-1 text-accent">Better Alternatives for You:</h4>
                  {playerMoveAnalysis.betterPlayerMoveSuggestions.map((s, i) => (
                    <div key={i} className="mb-2 p-2 bg-accent/10 rounded-md border border-accent/20">
                      <Badge variant="default" className="bg-accent text-accent-foreground mr-2 mb-1 sm:mb-0">{s.move}</Badge>
                      <p className="text-xs whitespace-pre-wrap inline">{s.explanation}</p>
                    </div>
                  ))}
                </div>
              )}
              {playerMoveAnalysis.generalBoardAnalysis && (
                 <div>
                    <h3 className="font-semibold text-md mb-1">Current Board Assessment (for AI):</h3>
                     <div className="p-3 bg-secondary/20 rounded-lg border border-secondary/40">
                        <p className="text-sm whitespace-pre-wrap">{playerMoveAnalysis.generalBoardAnalysis}</p>
                     </div>
                 </div>
              )}
              {playerMoveAnalysis.suggestedMovesForCurrentTurn && playerMoveAnalysis.suggestedMovesForCurrentTurn.length > 0 && (
                <div>
                  <h4 className="font-semibold text-md mb-1">AI's Potential Plans:</h4>
                  {playerMoveAnalysis.suggestedMovesForCurrentTurn.map((s, i) => (
                     <div key={i} className="mb-2 p-2 bg-secondary/10 rounded-md border border-secondary/30">
                       <Badge variant="outline" className="mr-2 mb-1 sm:mb-0">{s.move}</Badge>
                       <p className="text-xs whitespace-pre-wrap inline">{s.explanation}</p>
                     </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!isLoading && aiMoveExplanation && (
             <div className="mb-4 p-3 bg-green-600/10 dark:bg-green-400/10 rounded-lg border border-green-600/30 dark:border-green-400/30">
              <h3 className="font-semibold text-md mb-1 text-green-700 dark:text-green-300">AI Played <Badge variant="default" className="bg-green-600 text-white">{aiMoveExplanation.move}</Badge>:</h3>
              <p className="text-sm whitespace-pre-wrap">{aiMoveExplanation.explanation}</p>
            </div>
          )}

          {!isLoading && !hint && !playerMoveAnalysis && !aiMoveExplanation && (
            <p className="text-sm text-muted-foreground text-center py-4">Play a move or request a hint for AI feedback.</p>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default AiTutorPanel;
