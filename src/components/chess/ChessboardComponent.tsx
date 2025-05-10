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
  playerColor: 'w' | 'b'; // To orient the board if needed, though standard orientation is used here.
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
    // If playerColor is 'b', we could flip the board, but for simplicity, we keep white at bottom.
    const displayBoard = playerColor === 'w' ? board : [...board].reverse().map(row => [...row].reverse());


    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const actualRow = playerColor === 'w' ? r : 7 - r;
        const actualCol = playerColor === 'w' ? c : 7 - c;

        const square = coordsToSquare(actualRow, actualCol);
        const piece = displayBoard[r][c]; // Use displayBoard for rendering
        
        const isLightSquare = (r + c) % 2 === 0;
        const isSelected = selectedSquare === square;
        const isPossibleMove = validMoves.includes(square);
        const isLastMoveOrigin = lastMove?.from === square;
        const isLastMoveTarget = lastMove?.to === square;
        const isKingInCheck = kingInCheckSquare === square;

        squares.push(
          <div
            key={square}
            className={cn(
              "w-full aspect-square flex items-center justify-center relative",
              isLightSquare ? "bg-board-light-square" : "bg-board-dark-square",
              (isPlayerTurn || selectedSquare) && "cursor-pointer",
              isSelected && "bg-highlight-selected/50 ring-2 ring-highlight-selected inset-0 z-10",
            )}
            onClick={() => (isPlayerTurn || selectedSquare) && onSquareClick(square)}
            role="button"
            aria-label={`Square ${square}${piece ? `, contains ${piece.color === 'w' ? 'White' : 'Black'} ${piece.symbol}` : ''}`}
          >
            {piece && <PieceComponent piece={piece} size="text-[2.5vmin] sm:text-[3vmin] md:text-[3.5vmin] lg:text-[4vmin] xl:text-[2.5rem]" />}
            {isPossibleMove && (
              <div className={cn(
                "absolute inset-0 flex items-center justify-center",
                piece ? "bg-highlight-move/50 rounded-full w-3/4 h-3/4 opacity-70" : "bg-highlight-move/30 rounded-full w-1/3 h-1/3 opacity-50"
              )} />
            )}
            {(isLastMoveOrigin || isLastMoveTarget) && (
              <div className="absolute inset-0 bg-highlight-move/20" />
            )}
             {isKingInCheck && (
              <div className="absolute inset-0 ring-4 ring-highlight-check ring-inset opacity-70" />
            )}
          </div>
        );
      }
    }
    return squares;
  };

  return (
    <div className="grid grid-cols-8 w-full max-w-[80vh] sm:max-w-[70vh] md:max-w-[600px] aspect-square border-2 border-card shadow-2xl rounded-md overflow-hidden">
      {renderSquares()}
    </div>
  );
};

export default ChessboardComponent;
