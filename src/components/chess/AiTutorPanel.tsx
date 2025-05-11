// src/components/chess/AiTutorPanel.tsx
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { AiTutorAnalysisOutput } from '@/ai/flows/ai-tutor-analysis';
import type { ExplainMoveHintOutput } from '@/ai/flows/move-hint-explanation';
import { Lightbulb, Target, ClipboardCheck, Sparkles, Info, Cpu, Bot, Loader, HelpCircle, Brain, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseAndHighlightText } from '@/lib/text-parser'; 
import type { Square } from '@/types/chess';


interface FeedbackBlockProps {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  onClick?: () => void;
  isSelected?: boolean;
  isClickable?: boolean;
  titleColorClass?: string;
  bgColorClass?: string;
  borderColorClass?: string;
  selectedTitleColorClass?: string;
  selectedBgClass?: string;
  selectedBorderClass?: string;
  selectedRingClass?: string;
}

const FeedbackBlock: React.FC<FeedbackBlockProps> = ({ 
  icon: Icon, 
  title, 
  children, 
  onClick, 
  isSelected, 
  isClickable,
  titleColorClass = "text-foreground",
  bgColorClass = "bg-background",
  borderColorClass = "border-border",
  selectedTitleColorClass,
  selectedBgClass,
  selectedBorderClass,
  selectedRingClass,
}) => {
  const currentTitleColor = isSelected && selectedTitleColorClass ? selectedTitleColorClass : titleColorClass;
  const currentBgColor = isSelected && selectedBgClass ? selectedBgClass : bgColorClass;
  const currentBorderColor = isSelected && selectedBorderClass ? selectedBorderClass : borderColorClass;

  return (
    <div 
      className={cn(
          "p-3 sm:p-4 rounded-lg border space-y-2 sm:space-y-3 shadow-sm transition-all", 
          currentBgColor, 
          currentBorderColor,
          isClickable && "cursor-pointer hover:shadow-md",
          isSelected && selectedRingClass && cn("ring-2 shadow-lg", selectedRingClass)
      )}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick?.() : undefined}
    >
      <div className="flex items-start space-x-2 sm:space-x-3">
        {isSelected && isClickable ? <CheckSquare className={cn("h-5 w-5 sm:h-6 sm:w-6 shrink-0 mt-0.5", currentTitleColor)} /> : <Icon className={cn("h-5 w-5 sm:h-6 sm:w-6 shrink-0 mt-0.5", currentTitleColor)} />}
        <h3 className={cn("font-semibold text-base sm:text-lg", currentTitleColor)}>{title}</h3>
      </div>
      <div className="pl-[calc(theme(spacing.5)_+_theme(spacing.2))] sm:pl-[calc(theme(spacing.6)_+_theme(spacing.3))] text-sm leading-relaxed space-y-1.5 sm:space-y-2">
        {children}
      </div>
    </div>
  );
};

const suggestionColorThemes = [
  { icon: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30", selectedBg: "bg-purple-500/20", selectedBorder: "border-purple-500", ring: "ring-purple-500" },
  { icon: "text-pink-600 dark:text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/30", selectedBg: "bg-pink-500/20", selectedBorder: "border-pink-500", ring: "ring-pink-500" },
  { icon: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/30", selectedBg: "bg-sky-500/20", selectedBorder: "border-sky-500", ring: "ring-sky-500" },
];


interface AiTutorPanelProps {
  hint?: { move?: string; explanation: string; type: 'vague' | 'specific', from?: Square, to?: Square };
  playerMoveAnalysis?: AiTutorAnalysisOutput | null;
  aiMoveExplanation?: { move: string; explanation: string } | null;
  isLoading: boolean; 
  fullTutorSuggestions?: ExplainMoveHintOutput[] | null; 
  isFullTutoringActive?: boolean; 
  isLoadingFullTutorSuggestion?: boolean;
  onSelectFullTutorSuggestion?: (suggestion: ExplainMoveHintOutput) => void;
  highlightedHintSquares?: Array<{ from: Square; to: Square }> | { from: Square; to: Square } | null;
}

const AiTutorPanel: React.FC<AiTutorPanelProps> = ({ 
  hint, 
  playerMoveAnalysis, 
  aiMoveExplanation, 
  isLoading,
  fullTutorSuggestions,
  isFullTutoringActive,
  isLoadingFullTutorSuggestion,
  onSelectFullTutorSuggestion,
  highlightedHintSquares
}) => {
  
  const generalLoading = isLoading || isLoadingFullTutorSuggestion;

  return (
    <Card className="h-full shadow-md flex flex-col">
      <CardHeader className="py-3 px-3 sm:py-4 sm:px-4 shrink-0">
        <CardTitle className="text-lg sm:text-xl flex items-center">
          <Bot className="mr-2 h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          AI Tutor
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden py-2 px-1 sm:py-3 sm:px-2"> 
        <ScrollArea className="h-full w-full rounded-md border p-2 sm:p-3">
          <div className="space-y-3 sm:space-y-4">
            {generalLoading && (
              <div className="flex items-center justify-center space-x-2 text-sm sm:text-base text-muted-foreground py-8">
                <Loader className="h-5 w-5 sm:h-6 sm:w-6 animate-spin text-primary" />
                <span>AI is thinking...</span>
              </div>
            )}
            
            {!generalLoading && isFullTutoringActive && fullTutorSuggestions && fullTutorSuggestions.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground px-1">Tutor's Suggestions:</h3>
                {fullTutorSuggestions.map((suggestion, index) => {
                    let isSuggestionSelected = false;
                    if (highlightedHintSquares) {
                        if (Array.isArray(highlightedHintSquares)) {
                            isSuggestionSelected = highlightedHintSquares.some(h => h.from === suggestion.suggestedMoveFromSquare && h.to === suggestion.suggestedMoveToSquare);
                        } else {
                            isSuggestionSelected = highlightedHintSquares.from === suggestion.suggestedMoveFromSquare && highlightedHintSquares.to === suggestion.suggestedMoveToSquare;
                        }
                    }
                    const theme = suggestionColorThemes[index % suggestionColorThemes.length];

                    return (
                        <FeedbackBlock
                            key={index}
                            icon={Brain}
                            title={`Suggestion ${index + 1}: ${suggestion.suggestedMoveNotation}`}
                            titleColorClass={theme.icon}
                            bgColorClass={theme.bg}
                            borderColorClass={theme.border}
                            selectedTitleColorClass={theme.icon} // Keep icon color same for selected
                            selectedBgClass={theme.selectedBg}
                            selectedBorderClass={theme.selectedBorder}
                            selectedRingClass={theme.ring}
                            onClick={() => onSelectFullTutorSuggestion?.(suggestion)}
                            isSelected={isSuggestionSelected}
                            isClickable={true}
                        >
                            <p className="whitespace-pre-wrap">{parseAndHighlightText(suggestion.explanation)}</p>
                        </FeedbackBlock>
                    );
                })}
              </div>
            )}
            {!generalLoading && isFullTutoringActive && (!fullTutorSuggestions || fullTutorSuggestions.length === 0) && !isLoadingFullTutorSuggestion && (
                 <FeedbackBlock
                    icon={Brain}
                    title="Tutor Mode Active"
                    titleColorClass="text-purple-600 dark:text-purple-400" // Default purple for this message
                    bgColorClass="bg-purple-500/10"
                    borderColorClass="border-purple-500/30"
                    selectedRingClass="ring-purple-500" // Fallback selected styling
                >
                    <p>AI is observing. Play a move or wait for AI's turn to see suggestions. Currently, no specific suggestions for this position.</p>
                </FeedbackBlock>
            )}


            {!generalLoading && hint && hint.type === 'vague' && (
              <FeedbackBlock
                icon={Lightbulb}
                title="General Tip"
                titleColorClass="text-secondary-foreground"
                bgColorClass="bg-secondary/30"
                borderColorClass="border-secondary/50"
              >
                <p className="whitespace-pre-wrap">{parseAndHighlightText(hint.explanation)}</p>
              </FeedbackBlock>
            )}

            {!generalLoading && hint && hint.type === 'specific' && hint.move && (
              <FeedbackBlock
                icon={Target}
                title="Suggested Move (Hint)"
                titleColorClass="text-accent" // Green accent for regular hints
                bgColorClass="bg-accent/10"
                borderColorClass="border-accent/30"
                selectedRingClass="ring-accent"
              >
                <div className="flex items-center gap-2 mb-1">
                    <Badge variant="default" className="bg-accent text-accent-foreground text-sm sm:text-base px-2 sm:px-2.5 py-0.5 sm:py-1">{hint.move}</Badge>
                </div>
                <p className="whitespace-pre-wrap">{parseAndHighlightText(hint.explanation)}</p>
              </FeedbackBlock>
            )}
            
            {!generalLoading && playerMoveAnalysis && (
              <>
                {playerMoveAnalysis.playerMoveEvaluation && (
                  <FeedbackBlock
                    icon={ClipboardCheck}
                    title="Evaluation of Your Last Move"
                    titleColorClass="text-primary"
                    bgColorClass="bg-primary/5"
                    borderColorClass="border-primary/20"
                    selectedRingClass="ring-primary"
                  >
                    <p className="whitespace-pre-wrap">{parseAndHighlightText(playerMoveAnalysis.playerMoveEvaluation)}</p>
                  </FeedbackBlock>
                )}
                {playerMoveAnalysis.betterPlayerMoveSuggestions && playerMoveAnalysis.betterPlayerMoveSuggestions.length > 0 && (
                  <FeedbackBlock
                    icon={Sparkles}
                    title="Better Alternatives for You"
                    titleColorClass="text-accent"
                    bgColorClass="bg-accent/5"
                    borderColorClass="border-accent/20"
                    selectedRingClass="ring-accent"
                  >
                    <div className="space-y-2.5 sm:space-y-3">
                      {playerMoveAnalysis.betterPlayerMoveSuggestions.map((s, i) => (
                        <div key={i} className="p-2 sm:p-2.5 bg-accent/10 rounded-md border border-accent/20 shadow-sm">
                          <Badge variant="default" className="bg-accent text-accent-foreground mr-2 mb-1 text-xs sm:text-sm px-1.5 sm:px-2 py-0.5">{s.move}</Badge>
                          <div className="text-xs sm:text-sm whitespace-pre-wrap leading-snug">{parseAndHighlightText(s.explanation)}</div>
                        </div>
                      ))}
                    </div>
                  </FeedbackBlock>
                )}
                {playerMoveAnalysis.generalBoardAnalysis && (
                  <FeedbackBlock
                    icon={Info}
                    title="Current Board Assessment (for AI)"
                    titleColorClass="text-muted-foreground"
                    bgColorClass="bg-muted/50"
                    borderColorClass="border-muted"
                    selectedRingClass="ring-muted-foreground"
                  >
                      <p className="whitespace-pre-wrap">{parseAndHighlightText(playerMoveAnalysis.generalBoardAnalysis)}</p>
                   </FeedbackBlock>
                )}
                {playerMoveAnalysis.suggestedMovesForCurrentTurn && playerMoveAnalysis.suggestedMovesForCurrentTurn.length > 0 && (
                  <FeedbackBlock
                    icon={Cpu}
                    title="AI's Potential Plans"
                    titleColorClass="text-secondary-foreground"
                    bgColorClass="bg-secondary/20"
                    borderColorClass="border-secondary/40"
                    selectedRingClass="ring-secondary-foreground"
                  >
                    <div className="space-y-2.5 sm:space-y-3">
                    {playerMoveAnalysis.suggestedMovesForCurrentTurn.map((s, i) => (
                       <div key={i} className="p-2 sm:p-2.5 bg-secondary/30 rounded-md border border-secondary/50 shadow-sm">
                         <Badge variant="secondary" className="mr-2 mb-1 text-xs sm:text-sm px-1.5 sm:px-2 py-0.5">{s.move}</Badge>
                         <div className="text-xs sm:text-sm whitespace-pre-wrap leading-snug">{parseAndHighlightText(s.explanation)}</div>
                       </div>
                    ))}
                    </div>
                  </FeedbackBlock>
                )}
              </>
            )}

            {!generalLoading && aiMoveExplanation && (
               <FeedbackBlock
                icon={Bot}
                title={`AI Played`}
                titleColorClass="text-accent"
                bgColorClass="bg-accent/10"
                borderColorClass="border-accent/30"
                selectedRingClass="ring-accent"
               >
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="default" className="bg-accent text-accent-foreground text-sm sm:text-base px-2 sm:px-2.5 py-0.5 sm:py-1">{aiMoveExplanation.move}</Badge>
                </div>
                <p className="whitespace-pre-wrap">{parseAndHighlightText(aiMoveExplanation.explanation)}</p>
              </FeedbackBlock>
            )}

            {!generalLoading && !hint && !playerMoveAnalysis && !aiMoveExplanation && (!isFullTutoringActive || !fullTutorSuggestions || fullTutorSuggestions.length === 0) && (
              <div className="flex flex-col items-center justify-center text-center py-8 sm:py-10 text-sm sm:text-base text-muted-foreground space-y-3 sm:space-y-4">
                <HelpCircle className="h-10 w-10 sm:h-12 sm:w-12 text-primary/70" />
                <p className="max-w-xs">Play a move, request a hint, or enable Full Tutoring Mode to get feedback.</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default AiTutorPanel;
