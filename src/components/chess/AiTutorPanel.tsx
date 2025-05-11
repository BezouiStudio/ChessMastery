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
  { 
    name: "Indigo",
    icon: "text-indigo-600 dark:text-indigo-400", 
    bg: "bg-indigo-500/10 dark:bg-indigo-500/20",
    border: "border-indigo-500/30 dark:border-indigo-500/40", 
    selectedBg: "bg-indigo-500/20 dark:bg-indigo-500/30", 
    selectedBorder: "border-indigo-500 dark:border-indigo-400", 
    ring: "ring-indigo-500 dark:ring-indigo-400" 
  },
  { 
    name: "Teal",
    icon: "text-teal-600 dark:text-teal-400", 
    bg: "bg-teal-500/10 dark:bg-teal-500/20", 
    border: "border-teal-500/30 dark:border-teal-500/40", 
    selectedBg: "bg-teal-500/20 dark:bg-teal-500/30", 
    selectedBorder: "border-teal-500 dark:border-teal-400", 
    ring: "ring-teal-500 dark:ring-teal-400" 
  },
  { 
    name: "Amber",
    icon: "text-amber-600 dark:text-amber-400", 
    bg: "bg-amber-500/10 dark:bg-amber-500/20", 
    border: "border-amber-500/30 dark:border-amber-500/40", 
    selectedBg: "bg-amber-500/20 dark:bg-amber-500/30", 
    selectedBorder: "border-amber-500 dark:border-amber-400", 
    ring: "ring-amber-500 dark:ring-amber-400" 
  },
];


interface AiTutorPanelProps {
  hint?: { move?: string; explanation: string; type: 'vague' | 'specific', from?: Square, to?: Square };
  playerMoveAnalysis?: AiTutorAnalysisOutput | null;
  aiMoveExplanation?: { move: string; explanation: string } | null;
  isLoading: boolean; 
  fullTutorGeneralTip?: string | null;
  fullTutorSuggestions?: ExplainMoveHintOutput[] | null; 
  isFullTutoringActive?: boolean; 
  isLoadingFullTutorContent?: boolean;
  onSelectFullTutorSuggestion?: (suggestion: ExplainMoveHintOutput) => void;
  highlightedHintSquares?: Array<{ from: Square; to: Square }> | { from: Square; to: Square } | null;
}

const AiTutorPanel: React.FC<AiTutorPanelProps> = ({ 
  hint, 
  playerMoveAnalysis, 
  aiMoveExplanation, 
  isLoading,
  fullTutorGeneralTip,
  fullTutorSuggestions,
  isFullTutoringActive,
  isLoadingFullTutorContent,
  onSelectFullTutorSuggestion,
  highlightedHintSquares
}) => {
  
  const generalLoading = isLoading || isLoadingFullTutorContent;
  const showFallback = !generalLoading && !hint && !playerMoveAnalysis && !aiMoveExplanation &&
                       !(isFullTutoringActive && (fullTutorGeneralTip || (fullTutorSuggestions && fullTutorSuggestions.length > 0)));


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
            
            {!generalLoading && (
              <>
                {/* Regular Hint (takes precedence if active) */}
                {hint && hint.type === 'vague' && (
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

                {hint && hint.type === 'specific' && hint.move && (
                  <FeedbackBlock
                    icon={Target}
                    title="Suggested Move (Hint)"
                    titleColorClass="text-accent" 
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

                {/* Full Tutoring Mode Content (if no regular hint is active) */}
                {!hint && isFullTutoringActive && (
                  <>
                    {fullTutorGeneralTip && (
                      <FeedbackBlock 
                        icon={Lightbulb} 
                        title="Tutor's General Guidance"
                        titleColorClass="text-purple-600 dark:text-purple-400" 
                        bgColorClass="bg-purple-500/10 dark:bg-purple-500/20"
                        borderColorClass="border-purple-500/30 dark:border-purple-500/40"
                      >
                        <p className="whitespace-pre-wrap">{parseAndHighlightText(fullTutorGeneralTip)}</p>
                      </FeedbackBlock>
                    )}

                    {fullTutorSuggestions && fullTutorSuggestions.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-medium text-muted-foreground px-1 pt-2">Specific Move Ideas:</h3>
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
                                    selectedTitleColorClass={theme.icon} 
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
                    
                    {/* Message if in full tutor mode but no content yet */}
                    {!fullTutorGeneralTip && (!fullTutorSuggestions || fullTutorSuggestions.length === 0) && (
                       <FeedbackBlock 
                          icon={Brain} 
                          title="Full Tutoring Active"
                          titleColorClass={suggestionColorThemes[0].icon} 
                          bgColorClass={suggestionColorThemes[0].bg}
                          borderColorClass={suggestionColorThemes[0].border}
                        >
                           <p>AI is observing. General guidance and move ideas for your turn will appear here. After your move, you'll get an analysis.</p>
                       </FeedbackBlock>
                    )}
                  </>
                )}

                {/* Player Move Analysis */}
                {playerMoveAnalysis && (
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

                {/* AI Move Explanation */}
                {aiMoveExplanation && (
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

                {/* Fallback message */}
                {showFallback && (
                  <div className="flex flex-col items-center justify-center text-center py-8 sm:py-10 text-sm sm:text-base text-muted-foreground space-y-3 sm:space-y-4">
                    <HelpCircle className="h-10 w-10 sm:h-12 sm:w-12 text-primary/70" />
                    <p className="max-w-xs">Play a move, request a hint, or enable Full Tutoring Mode to get feedback.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default AiTutorPanel;

