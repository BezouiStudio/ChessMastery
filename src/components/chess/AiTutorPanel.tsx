// src/components/chess/AiTutorPanel.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { AiTutorAnalysisOutput } from '@/ai/flows/ai-tutor-analysis';
import { Lightbulb, Target, ClipboardCheck, Sparkles, Info, Cpu, Bot, Loader, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AiTutorPanelProps {
  hint?: { move?: string; explanation: string; type: 'vague' | 'specific' };
  playerMoveAnalysis?: AiTutorAnalysisOutput;
  aiMoveExplanation?: { move: string; explanation: string };
  isLoading: boolean;
}

const FeedbackBlock: React.FC<{
  icon: React.ElementType;
  title: string;
  titleColorClass?: string;
  bgColorClass?: string;
  borderColorClass?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ icon: Icon, title, titleColorClass = "text-foreground", bgColorClass = "bg-background", borderColorClass = "border-border", children, className }) => (
  <div className={cn("p-3 rounded-lg border space-y-2", bgColorClass, borderColorClass, className)}>
    <div className="flex items-center space-x-2">
      <Icon className={cn("h-5 w-5 shrink-0", titleColorClass)} />
      <h3 className={cn("font-semibold text-md", titleColorClass)}>{title}</h3>
    </div>
    <div className="pl-7 text-sm leading-relaxed space-y-2">
      {children}
    </div>
  </div>
);


const AiTutorPanel: React.FC<AiTutorPanelProps> = ({ hint, playerMoveAnalysis, aiMoveExplanation, isLoading }) => {
  
  return (
    <Card className="h-full shadow-md">
      <CardHeader className="py-4 px-4">
        <CardTitle className="text-xl flex items-center">
          <Bot className="mr-2 h-6 w-6 text-primary" />
          AI Tutor
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[calc(100%-4.5rem)] pb-3 px-2">
        <ScrollArea className="h-full w-full rounded-md border p-3">
          <div className="space-y-4">
            {isLoading && (
              <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground py-6">
                <Loader className="h-6 w-6 animate-spin text-primary" />
                <span>AI is thinking... Please wait.</span>
              </div>
            )}
            
            {!isLoading && hint && hint.type === 'vague' && (
              <FeedbackBlock
                icon={Lightbulb}
                title="General Tip"
                titleColorClass="text-blue-600 dark:text-blue-400"
                bgColorClass="bg-blue-500/10 dark:bg-blue-400/10"
                borderColorClass="border-blue-500/30 dark:border-blue-400/30"
              >
                <p className="whitespace-pre-wrap">{hint.explanation}</p>
              </FeedbackBlock>
            )}

            {!isLoading && hint && hint.type === 'specific' && hint.move && (
              <FeedbackBlock
                icon={Target}
                title="Suggested Move"
                titleColorClass="text-accent"
                bgColorClass="bg-accent/10"
                borderColorClass="border-accent/30"
              >
                <div className="flex items-center gap-2">
                    <Badge variant="default" className="bg-accent text-accent-foreground text-base px-2 py-1">{hint.move}</Badge>
                </div>
                <p className="whitespace-pre-wrap">{hint.explanation}</p>
              </FeedbackBlock>
            )}
            
            {!isLoading && playerMoveAnalysis && (
              <>
                {playerMoveAnalysis.playerMoveEvaluation && (
                  <FeedbackBlock
                    icon={ClipboardCheck}
                    title="Evaluation of Your Last Move"
                    titleColorClass="text-primary"
                    bgColorClass="bg-primary/5"
                    borderColorClass="border-primary/20"
                  >
                    <p className="whitespace-pre-wrap">{playerMoveAnalysis.playerMoveEvaluation}</p>
                  </FeedbackBlock>
                )}
                {playerMoveAnalysis.betterPlayerMoveSuggestions && playerMoveAnalysis.betterPlayerMoveSuggestions.length > 0 && (
                  <FeedbackBlock
                    icon={Sparkles}
                    title="Better Alternatives for You"
                    titleColorClass="text-accent"
                    bgColorClass="bg-accent/5"
                    borderColorClass="border-accent/20"
                  >
                    <div className="space-y-2">
                      {playerMoveAnalysis.betterPlayerMoveSuggestions.map((s, i) => (
                        <div key={i} className="p-2 bg-accent/10 rounded-md border border-accent/20">
                          <Badge variant="default" className="bg-accent text-accent-foreground mr-2 mb-1 sm:mb-0 text-sm">{s.move}</Badge>
                          <p className="text-xs whitespace-pre-wrap inline leading-snug">{s.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </FeedbackBlock>
                )}
                {playerMoveAnalysis.generalBoardAnalysis && (
                  <FeedbackBlock
                    icon={Info}
                    title="Current Board Assessment (for AI)"
                    titleColorClass="text-secondary-foreground/80"
                    bgColorClass="bg-secondary/10"
                    borderColorClass="border-secondary/30"
                  >
                      <p className="whitespace-pre-wrap">{playerMoveAnalysis.generalBoardAnalysis}</p>
                   </FeedbackBlock>
                )}
                {playerMoveAnalysis.suggestedMovesForCurrentTurn && playerMoveAnalysis.suggestedMovesForCurrentTurn.length > 0 && (
                  <FeedbackBlock
                    icon={Cpu}
                    title="AI's Potential Plans"
                    titleColorClass="text-secondary-foreground/80"
                    bgColorClass="bg-secondary/5"
                    borderColorClass="border-secondary/20"
                  >
                    <div className="space-y-2">
                    {playerMoveAnalysis.suggestedMovesForCurrentTurn.map((s, i) => (
                       <div key={i} className="p-2 bg-secondary/10 rounded-md border border-secondary/30">
                         <Badge variant="outline" className="mr-2 mb-1 sm:mb-0 text-sm">{s.move}</Badge>
                         <p className="text-xs whitespace-pre-wrap inline leading-snug">{s.explanation}</p>
                       </div>
                    ))}
                    </div>
                  </FeedbackBlock>
                )}
              </>
            )}

            {!isLoading && aiMoveExplanation && (
               <FeedbackBlock
                icon={Bot}
                title={`AI Played: ${aiMoveExplanation.move}`}
                titleColorClass="text-green-600 dark:text-green-400"
                bgColorClass="bg-green-500/10 dark:bg-green-400/10"
                borderColorClass="border-green-500/30 dark:border-green-400/30"
               >
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-green-600 dark:bg-green-500 text-white text-base px-2 py-1">{aiMoveExplanation.move}</Badge>
                </div>
                <p className="whitespace-pre-wrap">{aiMoveExplanation.explanation}</p>
              </FeedbackBlock>
            )}

            {!isLoading && !hint && !playerMoveAnalysis && !aiMoveExplanation && (
              <div className="flex flex-col items-center justify-center text-center py-10 text-sm text-muted-foreground space-y-3">
                <HelpCircle className="h-10 w-10 text-primary/70" />
                <p className="max-w-xs">Play a move or request a hint to get personalized feedback from the AI Tutor.</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default AiTutorPanel;
