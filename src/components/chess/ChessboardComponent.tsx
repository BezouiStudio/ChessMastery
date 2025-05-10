'use client';

import type { Board, Piece as PieceType, Square } from '@/types/chess';
import { coordsToSquare, squareToCoords } from '@/lib/chess-logic';
import PieceComponent from './PieceComponent';
import { cn } from '@/lib/utils';

interface ChessboardProps {
  board: Board;
  onSquareClick: (square: Square) => void;
  selectedSquare: Square | null;
  validMoves: Square[];
  lastMove: { from: Square; to: Square } | null;
  isPlayerTurn: boolean;
  playerColor: 'w' | 'b'; 
  kingInCheckSquare: Square | null;
  highlightedHintSquares?: { from: Square; to: Square } | null;
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
        const isHintedFrom = highlightedHintSquares?.from === square;
        const isHintedTo = highlightedHintSquares?.to === square;

        squares.push(
          <div
            key={square}
            className={cn(
              "w-full aspect-square flex items-center justify-center relative transition-colors duration-150",
              isLightSquare ? "bg-board-light-square" : "bg-board-dark-square",
              (isPlayerTurn || selectedSquare) && "cursor-pointer hover:bg-opacity-80",
              isSelected && "ring-3 ring-highlight-selected ring-inset z-10 bg-highlight-selected/30",
              (isHintedFrom || isHintedTo) && "bg-highlight-hint/30 ring-2 ring-highlight-hint/70 ring-inset",
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
            {(isLastMoveOrigin || isLastMoveTarget) && !isHintedFrom && !isHintedTo && ( // Don't show last move if it's also a hint square to avoid color clash
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
    <div className="w-full max-w-xs sm:max-w-sm md:max-w-full aspect-square rounded-lg overflow-hidden shadow-2xl border-4 border-card mx-auto md:mx-0">
        <div className="grid grid-cols-8 w-full h-full">
            {renderSquares()}
        </div>
    </div>
  );
};

export default ChessboardComponent;
