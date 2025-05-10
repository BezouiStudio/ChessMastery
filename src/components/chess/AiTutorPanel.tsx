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

const processBoldTextSegment = (text: string, keyPrefix: string): React.ReactNode[] => {
  const boldRegex = /\*\*(.*?)\*\*/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let boldMatch;
  boldRegex.lastIndex = 0; // Reset regex state

  while ((boldMatch = boldRegex.exec(text)) !== null) {
    if (boldMatch.index > lastIndex) {
      elements.push(text.substring(lastIndex, boldMatch.index));
    }
    elements.push(
      <strong key={`${keyPrefix}-bold-${boldMatch.index}`} className="font-bold">
        {boldMatch[1]}
      </strong>
    );
    lastIndex = boldRegex.lastIndex;
  }
  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }
  return elements.map((el, i) => <React.Fragment key={`${keyPrefix}-sfrag-${i}`}>{el}</React.Fragment>);
};

const positiveKeywordsList = ['strong', 'standard', 'well-regarded', 'excellent', 'good', 'advantage', 'control', 'develop', 'initiative', 'king safety', 'pin', 'fork', 'skewer', 'discovered attack', 'key', 'critical', 'opportunity', 'improving', 'better', 'solid', 'active'];
const negativeKeywordsList = ['inaccuracy', 'mistake', 'blunder', 'disadvantage', 'threat', 'weakness', 'poor', 'passive', 'exposed', 'unsafe'];
const neutralKeywordsList = ['center', 'queen', 'bishop', 'rook', 'knight', 'pawn', 'king', 'kingside', 'queenside', 'tempo', 'material', 'pawn structure', 'opening', 'middlegame', 'endgame', 'tactic', 'strategy', 'positional'];

const allKeywords = [...positiveKeywordsList, ...negativeKeywordsList, ...neutralKeywordsList];
const keywordRegex = new RegExp(`\\b(${allKeywords.join('|')})\\b`, 'gi');

const processSegment = (segment: string, segmentKeyPrefix: string): React.ReactNode[] => {
  const segmentElements: React.ReactNode[] = [];
  let segmentLastIndex = 0;
  let keywordMatch;
  keywordRegex.lastIndex = 0; // Reset regex state for each segment

  while ((keywordMatch = keywordRegex.exec(segment)) !== null) {
    if (keywordMatch.index > segmentLastIndex) {
      segmentElements.push(...processBoldTextSegment(segment.substring(segmentLastIndex, keywordMatch.index), `${segmentKeyPrefix}-prekw-${segmentLastIndex}`));
    }
    
    const matchedWord = keywordMatch[0];
    const lowerCaseWord = matchedWord.toLowerCase();
    let type: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (positiveKeywordsList.includes(lowerCaseWord)) type = 'positive';
    else if (negativeKeywordsList.includes(lowerCaseWord)) type = 'negative';

    segmentElements.push(
      <HighlightedKeyword key={`${segmentKeyPrefix}-keyword-${keywordMatch.index}`} type={type}>
        {matchedWord}
      </HighlightedKeyword>
    );
    segmentLastIndex = keywordRegex.lastIndex;
  }
  if (segmentLastIndex < segment.length) {
    segmentElements.push(...processBoldTextSegment(segment.substring(segmentLastIndex), `${segmentKeyPrefix}-postkw-${segmentLastIndex}`));
  }
  return segmentElements.map((el, i) => <React.Fragment key={`${segmentKeyPrefix}-frag-${i}`}>{el}</React.Fragment>);
};

const parseAndHighlightText = (text: string | undefined): React.ReactNode => {
  if (!text) return null;

  const moveRegex = /\b([PNBRQK]?[a-h]?[1-8]?x?[a-h][1-8](?:=[PNBRQK])?[+#]?|O-O(?:-O)?)\b/g;
  
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  moveRegex.lastIndex = 0; // Reset regex state

  while ((match = moveRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(...processSegment(text.substring(lastIndex, match.index), `text-${lastIndex}`));
    }
    elements.push(
      <HighlightedMove key={`move-${match.index}`}>
        {match[0]}
      </HighlightedMove>
    );
    lastIndex = moveRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    elements.push(...processSegment(text.substring(lastIndex), `text-${lastIndex}`));
  }
  
  return <>{elements.map((el, idx) => <React.Fragment key={`final-${idx}`}>{el}</React.Fragment>)}</>;
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
  <div className={cn("p-4 rounded-lg border space-y-3 shadow-sm", bgColorClass, borderColorClass)}>
    <div className="flex items-start space-x-3">
      <Icon className={cn("h-6 w-6 shrink-0 mt-0.5", titleColorClass)} />
      <h3 className={cn("font-semibold text-lg", titleColorClass)}>{title}</h3>
    </div>
    <div className="pl-[calc(1.5rem+0.75rem)] text-sm leading-relaxed space-y-2"> {/* 1.5rem for icon, 0.75rem for space-x-3 */}
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
              <div className="flex items-center justify-center space-x-2 text-base text-muted-foreground py-8">
                <Loader className="h-6 w-6 animate-spin text-primary" />
                <span>AI is thinking... Please wait.</span>
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
                    <Badge variant="default" className="bg-accent text-accent-foreground text-base px-2.5 py-1">{hint.move}</Badge>
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
                    <div className="space-y-3">
                      {playerMoveAnalysis.betterPlayerMoveSuggestions.map((s, i) => (
                        <div key={i} className="p-2.5 bg-accent/10 rounded-md border border-accent/20 shadow-sm">
                          <Badge variant="default" className="bg-accent text-accent-foreground mr-2 mb-1 text-sm px-2 py-0.5">{s.move}</Badge>
                          <div className="text-sm whitespace-pre-wrap leading-snug">{parseAndHighlightText(s.explanation)}</div>
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
                    <div className="space-y-3">
                    {playerMoveAnalysis.suggestedMovesForCurrentTurn.map((s, i) => (
                       <div key={i} className="p-2.5 bg-secondary/30 rounded-md border border-secondary/50 shadow-sm">
                         <Badge variant="secondary" className="mr-2 mb-1 text-sm px-2 py-0.5">{s.move}</Badge>
                         <div className="text-sm whitespace-pre-wrap leading-snug">{parseAndHighlightText(s.explanation)}</div>
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
                  <Badge variant="default" className="bg-accent text-accent-foreground text-base px-2.5 py-1">{aiMoveExplanation.move}</Badge>
                </div>
                <p className="whitespace-pre-wrap">{parseAndHighlightText(aiMoveExplanation.explanation)}</p>
              </FeedbackBlock>
            )}

            {!isLoading && !hint && !playerMoveAnalysis && !aiMoveExplanation && (
              <div className="flex flex-col items-center justify-center text-center py-10 text-base text-muted-foreground space-y-4">
                <HelpCircle className="h-12 w-12 text-primary/70" />
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
