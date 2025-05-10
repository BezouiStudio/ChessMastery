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
}

const ChessboardComponent: React.FC<ChessboardProps> = ({
  board,
  onSquareClick,
  selectedSquare,
  validMoves,
  lastMove,
  isPlayerTurn,
  playerColor,
  kingInCheckSquare
}) => {
  const renderSquares = () => {
    const squares = [];
    // Standard orientation: white at bottom (row 7), black at top (row 0)
    const displayBoard = playerColor === 'w' ? board : [...board].reverse().map(row => [...row].reverse());


    for (let r_idx = 0; r_idx < 8; r_idx++) {
      for (let c_idx = 0; c_idx < 8; c_idx++) {
        // Determine actual row and col based on playerColor for consistent interaction logic
        // even if board visual is flipped (though it's not flipped here for simplicity).
        const actualRow = playerColor === 'w' ? r_idx : 7 - r_idx;
        const actualCol = playerColor === 'w' ? c_idx : 7 - c_idx;
        
        const square = coordsToSquare(actualRow, actualCol);
        // Use displayBoard for rendering piece at visual [r_idx][c_idx]
        const piece = displayBoard[r_idx][c_idx]; 
        
        const isLightSquare = (r_idx + c_idx) % 2 === 0;
        const isSelected = selectedSquare === square;
        const isPossibleMove = validMoves.includes(square);
        const isLastMoveOrigin = lastMove?.from === square;
        const isLastMoveTarget = lastMove?.to === square;
        const isKingInCheck = kingInCheckSquare === square;

        squares.push(
          <div
            key={square}
            className={cn(
              "w-full aspect-square flex items-center justify-center relative transition-colors duration-150",
              isLightSquare ? "bg-board-light-square" : "bg-board-dark-square",
              (isPlayerTurn || selectedSquare) && "cursor-pointer hover:bg-opacity-80",
              isSelected && "ring-3 ring-highlight-selected ring-inset z-10 bg-highlight-selected/30",
            )}
            onClick={() => (isPlayerTurn || selectedSquare) && onSquareClick(square)}
            role="button"
            aria-label={`Square ${square}${piece ? `, contains ${piece.color === 'w' ? 'White' : 'Black'} ${piece.symbol}` : ''}`}
          >
            {piece && <PieceComponent piece={piece} />}
            {isPossibleMove && (
              <div className={cn(
                "absolute inset-0 flex items-center justify-center pointer-events-none",
                piece ? "bg-highlight-move/40 rounded-full w-3/4 h-3/4 opacity-90" : "bg-highlight-move/25 rounded-full w-1/2 h-1/2 opacity-70"
              )} />
            )}
            {(isLastMoveOrigin || isLastMoveTarget) && (
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
    <div className="w-full max-w-[calc(100vh-200px)] sm:max-w-[calc(100vh-250px)] md:max-w-[600px] lg:max-w-[700px] aspect-square rounded-lg overflow-hidden shadow-2xl border-4 border-card">
        <div className="grid grid-cols-8 w-full h-full">
            {renderSquares()}
        </div>
    </div>
  );
};

export default ChessboardComponent;
