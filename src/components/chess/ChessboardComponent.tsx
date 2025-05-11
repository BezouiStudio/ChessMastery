// src/components/chess/ChessboardComponent.tsx
'use client';

import type { Board, Piece as PieceType, Square } from '@/types/chess';
import { coordsToSquare, squareToCoords } from '@/lib/chess-logic';
import PieceComponent from './PieceComponent';
import { cn } from '@/lib/utils';

// Define a type for the color themes if not already globally available
interface SuggestionColorTheme {
  name: string;
  icon: string;
  bg: string;
  border: string;
  selectedBg: string;
  selectedBorder: string;
  ring: string;
  boardHighlightBg: string;
  boardHighlightRing: string;
}
interface ChessboardProps {
  board: Board;
  onSquareClick: (square: Square) => void;
  selectedSquare: Square | null;
  validMoves: Square[];
  lastMove: { from: Square; to: Square } | null;
  isPlayerTurn: boolean;
  playerColor: 'w' | 'b'; 
  kingInCheckSquare: Square | null;
  highlightedHintSquares?: Array<{ from: Square; to: Square, hintIndex?: number }> | { from: Square; to: Square, hintIndex?: number } | null;
  suggestionColorThemes?: SuggestionColorTheme[]; // Pass the color themes
  selectedHintCustomTheme?: { bgClass: string; ringClass: string } | null; // For single, specifically selected tutor hint
}

const ChessboardComponent: React.FC<ChessboardProps> = ({
  board,
  onSquareClick,
  selectedSquare,
  validMoves,
  lastMove,
  isPlayerTurn,
  playerColor,
  kingInCheckSquare,
  highlightedHintSquares,
  suggestionColorThemes = [], // Default to empty array
  selectedHintCustomTheme,
}) => {
  const renderSquares = () => {
    const squares = [];
    const displayBoard = playerColor === 'w' ? board : [...board].reverse().map(row => [...row].reverse());

    for (let r_idx = 0; r_idx < 8; r_idx++) {
      for (let c_idx = 0; c_idx < 8; c_idx++) {
        const actualRow = playerColor === 'w' ? r_idx : 7 - r_idx;
        const actualCol = playerColor === 'w' ? c_idx : 7 - c_idx;
        
        const square = coordsToSquare(actualRow, actualCol);
        const piece = displayBoard[r_idx][c_idx]; 
        
        const isLightSquare = (r_idx + c_idx) % 2 === 0;
        const isSelected = selectedSquare === square;
        const isPossibleMove = validMoves.includes(square);
        const isLastMoveOrigin = lastMove?.from === square;
        const isLastMoveTarget = lastMove?.to === square;
        const isKingInCheck = kingInCheckSquare === square;
        
        let currentHintStyle: { bgClass: string; ringClass: string } | null = null;
        let isPartOfHighlightedHint = false;

        if (Array.isArray(highlightedHintSquares)) {
          // Multiple hints, find if this square belongs to any and get its theme
          for (const hintSpec of highlightedHintSquares) {
            if (hintSpec.from === square || hintSpec.to === square) {
              isPartOfHighlightedHint = true;
              if (hintSpec.hintIndex !== undefined && hintSpec.hintIndex >= 0 && suggestionColorThemes.length > 0) {
                const theme = suggestionColorThemes[hintSpec.hintIndex % suggestionColorThemes.length];
                currentHintStyle = { bgClass: theme.boardHighlightBg, ringClass: theme.boardHighlightRing };
              } else { // Fallback if no specific theme (should ideally not happen for array)
                currentHintStyle = { bgClass: 'bg-highlight-hint/30', ringClass: 'ring-highlight-hint/70' };
              }
              break; 
            }
          }
        } else if (highlightedHintSquares) {
          // Single hint object
          if (highlightedHintSquares.from === square || highlightedHintSquares.to === square) {
            isPartOfHighlightedHint = true;
            if (selectedHintCustomTheme) { // A specific tutor suggestion was clicked and has a theme
              currentHintStyle = selectedHintCustomTheme;
            } else if (highlightedHintSquares.hintIndex !== undefined && highlightedHintSquares.hintIndex >= 0 && suggestionColorThemes.length > 0) {
              // This case might occur if a single suggestion is active from full tutoring but not "selected" via click
              const theme = suggestionColorThemes[highlightedHintSquares.hintIndex % suggestionColorThemes.length];
              currentHintStyle = { bgClass: theme.boardHighlightBg, ringClass: theme.boardHighlightRing };
            } else { // Default for "Get Specific Hint" button
              currentHintStyle = { bgClass: 'bg-highlight-hint/30', ringClass: 'ring-highlight-hint/70' };
            }
          }
        }
        
        squares.push(
          <div
            key={square}
            className={cn(
              "w-full aspect-square flex items-center justify-center relative transition-colors duration-150",
              isLightSquare ? "bg-board-light-square" : "bg-board-dark-square",
              (isPlayerTurn || selectedSquare) && "cursor-pointer hover:bg-opacity-80",
              isSelected && "ring-3 ring-highlight-selected ring-inset z-10 bg-highlight-selected/30",
              isPartOfHighlightedHint && !isSelected && currentHintStyle && cn(
                currentHintStyle.bgClass, 
                "ring-2", 
                currentHintStyle.ringClass, 
                "ring-inset"
              ),
            )}
            onClick={() => (isPlayerTurn || selectedSquare) && onSquareClick(square)}
            role="button"
            aria-label={`Square ${square}${piece ? `, contains ${piece.color === 'w' ? 'White' : 'Black'} ${piece.symbol}` : ''}`}
          >
            {piece && <PieceComponent piece={piece} />}
            {isPossibleMove && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className={cn(
                    "rounded-full",
                    piece 
                      ? "bg-highlight-move/40 w-3/4 h-3/4 opacity-90" 
                      : "bg-highlight-move/25 w-1/2 h-1/2 opacity-70"
                  )}
                />
              </div>
            )}
            {(isLastMoveOrigin || isLastMoveTarget) && !isPartOfHighlightedHint && !isSelected && ( 
              <div className="absolute inset-0 bg-highlight-move/20 pointer-events-none" />
            )}
             {isKingInCheck && (
              <div className="absolute inset-0 ring-4 ring-highlight-check ring-inset opacity-80 pointer-events-none" />
            )}
          </div>
        );
      }
    }
    return squares;
  };

  return (
    <div className={cn(
        "w-full aspect-square rounded-lg overflow-hidden shadow-2xl border-4 border-card mx-auto md:mx-0",
        "md:max-w-full" 
      )}>
        <div className="grid grid-cols-8 w-full h-full">
            {renderSquares()}
        </div>
    </div>
  );
};

export default ChessboardComponent;
