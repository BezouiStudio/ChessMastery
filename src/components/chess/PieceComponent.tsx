import type { Piece as PieceType } from '@/types/chess';
import { UNICODE_PIECES } from '@/lib/chess-logic';
import { cn } from '@/lib/utils';

interface PieceProps {
  piece: PieceType;
  size?: string; // Tailwind text size class e.g. text-4xl
}

const PieceComponent: React.FC<PieceProps> = ({ piece, size = "text-3xl" }) => {
  if (!piece) return null;
  
  const pieceChar = UNICODE_PIECES[piece.color][piece.symbol];
  const colorClass = piece.color === 'w' ? 'text-piece-light-color' : 'text-piece-dark-color';

  return (
    <span className={cn(
        "select-none",
        size, 
        colorClass,
        'flex items-center justify-center h-full w-full'
        )}
        aria-label={`${piece.color === 'w' ? 'White' : 'Black'} ${piece.symbol}`}>
      {pieceChar}
    </span>
  );
};

export default PieceComponent;
