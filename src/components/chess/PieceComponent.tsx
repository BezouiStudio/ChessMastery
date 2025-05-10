import type { Piece as PieceType } from '@/types/chess';
import { UNICODE_PIECES } from '@/lib/chess-logic';
import { cn } from '@/lib/utils';

interface PieceProps {
  piece: PieceType;
  size?: string; 
}

const PieceComponent: React.FC<PieceProps> = ({ piece, size }) => {
  if (!piece) return null;
  
  const pieceChar = UNICODE_PIECES[piece.color][piece.symbol];
  const colorClass = piece.color === 'w' ? 'text-piece-light-color' : 'text-piece-dark-color';
  
  // Default responsive size. Can be overridden by `size` prop.
  const defaultSize = "text-[5.5vmin] sm:text-[5vmin] md:text-[4.5vmin] lg:text-[4vmin] xl:text-[3.5rem] leading-none";


  return (
    <span className={cn(
        "select-none drop-shadow-sm",
        size || defaultSize, 
        colorClass,
        'flex items-center justify-center h-full w-full' // Ensure it fills the square for centering
        )}
        aria-label={`${piece.color === 'w' ? 'White' : 'Black'} ${piece.symbol}`}>
      {pieceChar}
    </span>
  );
};

export default PieceComponent;
