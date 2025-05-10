// src/components/chess/AiTutorPanel.tsx
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { AiTutorAnalysisOutput } from '@/ai/flows/ai-tutor-analysis';
import { Lightbulb, Target, ClipboardCheck, Sparkles, Info, Cpu, Bot, Loader, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Helper components for highlighting
const HighlightedMove: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span 
    className="bg-accent text-accent-foreground font-semibold px-1.5 py-0.5 mx-0.5 rounded align-baseline inline-block text-xs shadow-sm"
  >
    {children}
  </span>
);

const HighlightedKeyword: React.FC<{ children: React.ReactNode; type: 'positive' | 'negative' | 'neutral' }> = ({ children, type }) => {
  let className = "font-semibold";
  if (type === 'positive') {
    className = cn(className, "text-accent");
  } else if (type === 'negative') {
    className = cn(className, "text-destructive");
  } else { // neutral
    className = cn(className, "text-primary");
  }
  return <span className={className}>{children}</span>;
};

const positiveKeywordsList = ['strong', 'standard', 'well-regarded', 'excellent', 'good', 'advantage', 'control', 'develop', 'initiative', 'king safety', 'pin', 'fork', 'skewer', 'discovered attack', 'key', 'critical', 'opportunity', 'improving', 'better', 'solid', 'active'];
const negativeKeywordsList = ['inaccuracy', 'mistake', 'blunder', 'disadvantage', 'threat', 'weakness', 'poor', 'passive', 'exposed', 'unsafe'];
const neutralKeywordsList = ['center', 'queen', 'bishop', 'rook', 'knight', 'pawn', 'king', 'kingside', 'queenside', 'tempo', 'material', 'pawn structure', 'opening', 'middlegame', 'endgame', 'tactic', 'strategy', 'positional'];

const allKeywords = [...positiveKeywordsList, ...negativeKeywordsList, ...neutralKeywordsList];
const keywordRegex = new RegExp(`\\b(${allKeywords.join('|')})\\b`, 'gi');
const moveRegex = /\b([PNBRQK]?[a-h]?[1-8]?x?[a-h][1-8](?:=[PNBRQK])?[+#]?|O-O(?:-O)?)\b/g;
const boldRegex = /\*\*(.*?)\*\*/g;


const processKeywordsInSegment = (segment: string, keyPrefix: string): React.ReactNode[] => {
  const segmentElements: React.ReactNode[] = [];
  let segmentLastIndex = 0;
  let keywordMatch;
  keywordRegex.lastIndex = 0; 

  while ((keywordMatch = keywordRegex.exec(segment)) !== null) {
    if (keywordMatch.index > segmentLastIndex) {
      segmentElements.push(segment.substring(segmentLastIndex, keywordMatch.index));
    }
    
    const matchedWord = keywordMatch[0];
    const lowerCaseWord = matchedWord.toLowerCase();
    let type: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (positiveKeywordsList.includes(lowerCaseWord)) type = 'positive';
    else if (negativeKeywordsList.includes(lowerCaseWord)) type = 'negative';

    segmentElements.push(
      <HighlightedKeyword key={`${keyPrefix}-keyword-${keywordMatch.index}`} type={type}>
        {matchedWord}
      </HighlightedKeyword>
    );
    segmentLastIndex = keywordRegex.lastIndex;
  }
  if (segmentLastIndex < segment.length) {
    segmentElements.push(segment.substring(segmentLastIndex));
  }
  return segmentElements.map((el, i) => <React.Fragment key={`${keyPrefix}-frag-${i}`}>{el}</React.Fragment>);
};

const parseTextRecursively = (text: string, keyPrefix: string, depth = 0): React.ReactNode[] => {
  if (!text || depth > 10) return [text]; 

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  
  const combinedRegex = new RegExp(`(${boldRegex.source})|(${moveRegex.source})`, 'g');
  let match;
  
  // Reset lastIndex for global regex
  combinedRegex.lastIndex = 0;

  while ((match = combinedRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(...processKeywordsInSegment(text.substring(lastIndex, match.index), `${keyPrefix}-kwseg-${lastIndex}`));
    }

    const boldContent = match[2]; 
    const moveContent = match[3]; 

    if (boldContent) {
      elements.push(
        <strong key={`${keyPrefix}-bold-${match.index}`} className="font-bold">
          {parseTextRecursively(boldContent, `${keyPrefix}-boldcontent-${match.index}`, depth + 1)}
        </strong>
      );
    } else if (moveContent) {
      elements.push(
        <HighlightedMove key={`${keyPrefix}-move-${match.index}`}>
          {moveContent}
        </HighlightedMove>
      );
    }
    lastIndex = combinedRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    elements.push(...processKeywordsInSegment(text.substring(lastIndex), `${keyPrefix}-kwseg-${lastIndex}`));
  }
  
  return elements.map((el, i) => <React.Fragment key={`${keyPrefix}-subfrag-${i}`}>{el}</React.Fragment>);
};


const parseAndHighlightText = (text: string | undefined): React.ReactNode => {
  if (!text) return null;
  return <>{parseTextRecursively(text, "root")}</>;
};


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
}> = ({ icon: Icon, title, titleColorClass = "text-foreground", bgColorClass = "bg-background", borderColorClass = "border-border", children }) => (
  <div className={cn("p-3 sm:p-4 rounded-lg border space-y-2 sm:space-y-3 shadow-sm", bgColorClass, borderColorClass)}>
    <div className="flex items-start space-x-2 sm:space-x-3">
      <Icon className={cn("h-5 w-5 sm:h-6 sm:w-6 shrink-0 mt-0.5", titleColorClass)} />
      <h3 className={cn("font-semibold text-base sm:text-lg", titleColorClass)}>{title}</h3>
    </div>
    <div className="pl-[calc(theme(spacing.5)_+_theme(spacing.2))] sm:pl-[calc(theme(spacing.6)_+_theme(spacing.3))] text-sm leading-relaxed space-y-1.5 sm:space-y-2">
      {children}
    </div>
  </div>
);


const AiTutorPanel: React.FC<AiTutorPanelProps> = ({ hint, playerMoveAnalysis, aiMoveExplanation, isLoading }) => {
  
  return (
    <Card className="h-full shadow-md flex flex-col"> {/* Ensure Card is h-full and flex-col for Dialog usage */}
      <CardHeader className="py-3 px-3 sm:py-4 sm:px-4 shrink-0"> {/* shrink-0 for header */}
        <CardTitle className="text-lg sm:text-xl flex items-center">
          <Bot className="mr-2 h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          AI Tutor
        </CardTitle>
      </CardHeader>
      {/* CardContent takes remaining space and makes ScrollArea work correctly in Dialog */}
      <CardContent className="flex-grow overflow-hidden pb-2 px-1 sm:pb-3 sm:px-2"> 
        <ScrollArea className="h-full w-full rounded-md border p-2 sm:p-3">
          <div className="space-y-3 sm:space-y-4">
            {isLoading && (
              <div className="flex items-center justify-center space-x-2 text-sm sm:text-base text-muted-foreground py-8">
                <Loader className="h-5 w-5 sm:h-6 sm:w-6 animate-spin text-primary" />
                <span>AI is thinking...</span>
              </div>
            )}
            
            {!isLoading && hint && hint.type === 'vague' && (
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

            {!isLoading && hint && hint.type === 'specific' && hint.move && (
              <FeedbackBlock
                icon={Target}
                title="Suggested Move"
                titleColorClass="text-accent"
                bgColorClass="bg-accent/10"
                borderColorClass="border-accent/30"
              >
                <div className="flex items-center gap-2 mb-1">
                    <Badge variant="default" className="bg-accent text-accent-foreground text-sm sm:text-base px-2 sm:px-2.5 py-0.5 sm:py-1">{hint.move}</Badge>
                </div>
                <p className="whitespace-pre-wrap">{parseAndHighlightText(hint.explanation)}</p>
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

            {!isLoading && aiMoveExplanation && (
               <FeedbackBlock
                icon={Bot}
                title={`AI Played`}
                titleColorClass="text-accent"
                bgColorClass="bg-accent/10"
                borderColorClass="border-accent/30"
               >
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="default" className="bg-accent text-accent-foreground text-sm sm:text-base px-2 sm:px-2.5 py-0.5 sm:py-1">{aiMoveExplanation.move}</Badge>
                </div>
                <p className="whitespace-pre-wrap">{parseAndHighlightText(aiMoveExplanation.explanation)}</p>
              </FeedbackBlock>
            )}

            {!isLoading && !hint && !playerMoveAnalysis && !aiMoveExplanation && (
              <div className="flex flex-col items-center justify-center text-center py-8 sm:py-10 text-sm sm:text-base text-muted-foreground space-y-3 sm:space-y-4">
                <HelpCircle className="h-10 w-10 sm:h-12 sm:w-12 text-primary/70" />
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
