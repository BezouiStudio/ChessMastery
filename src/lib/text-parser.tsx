// src/lib/text-parser.tsx
'use client';

import React from 'react';
import { cn } from '@/lib/utils';

const HighlightedMove: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span 
    className="bg-accent text-accent-foreground font-semibold px-1 py-0.5 mx-0.5 rounded align-baseline inline-block text-xs shadow-sm"
  >
    {children}
  </span>
);

const positiveKeywordsList = ['strong', 'standard', 'well-regarded', 'excellent', 'good', 'advantage', 'control', 'develop', 'initiative', 'king safety', 'pin', 'fork', 'skewer', 'discovered attack', 'key', 'critical', 'opportunity', 'improving', 'better', 'solid', 'active'];
const negativeKeywordsList = ['inaccuracy', 'mistake', 'blunder', 'disadvantage', 'threat', 'weakness', 'poor', 'passive', 'exposed', 'unsafe'];
const neutralKeywordsList = ['center', 'queen', 'bishop', 'rook', 'knight', 'pawn', 'king', 'kingside', 'queenside', 'tempo', 'material', 'pawn structure', 'opening', 'middlegame', 'endgame', 'tactic', 'strategy', 'positional'];

const allKeywords = [...positiveKeywordsList, ...negativeKeywordsList, ...neutralKeywordsList];
const keywordRegex = new RegExp(`\\b(${allKeywords.join('|')})\\b`, 'gi');


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

const boldRegex = /\*\*(.*?)\*\*/g; // Non-greedy match for content inside **
const moveRegex = /\b([PNBRQK]?[a-h]?[1-8]?x?[a-h][1-8](?:=[PNBRQK])?[+#]?|O-O(?:-O)?)\b/g; // Chess move regex

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
  if (!text || depth > 15) return [text]; // Max depth increased slightly

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  
  const combinedRegex = new RegExp(`(${boldRegex.source})|(${moveRegex.source})`, 'g');
  let match;
  
  combinedRegex.lastIndex = 0; 

  while ((match = combinedRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(...processKeywordsInSegment(text.substring(lastIndex, match.index), `${keyPrefix}-kwseg-${lastIndex}`));
    }

    const matchedBoldFull = match[1]; 
    const boldContent = match[2]; 
    const moveContent = match[3]; 

    if (matchedBoldFull && boldContent !== undefined) {
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


export const parseAndHighlightText = (text: string | undefined): React.ReactNode => {
  if (!text) return null;
  // It's good practice to reset global regexes if they are used elsewhere,
  // but combinedRegex is local and keywordRegex is reset in its function.
  // boldRegex and moveRegex are used within combinedRegex source, so their state is implicitly managed by combinedRegex.
  return <>{parseTextRecursively(text, "root")}</>;
};
