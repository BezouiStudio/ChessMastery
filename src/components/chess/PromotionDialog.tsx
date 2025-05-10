'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { PieceSymbol, PieceColor } from '@/types/chess';
import { UNICODE_PIECES } from '@/lib/chess-logic';
import PieceComponent from './PieceComponent';

interface PromotionDialogProps {
  isOpen: boolean;
  onSelectPiece: (piece: PieceSymbol) => void;
  playerColor: PieceColor;
}

const PromotionDialog: React.FC<PromotionDialogProps> = ({ isOpen, onSelectPiece, playerColor }) => {
  const promotionPieces: PieceSymbol[] = ['q', 'r', 'b', 'n'];

  return (
    <Dialog open={isOpen} onOpenChange={() => { /* Controlled externally */ }}>
      <DialogContent className="sm:max-w-[380px] p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Promote Pawn</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">Select a piece to promote your pawn to.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-2 sm:gap-4 py-3 sm:py-4">
          {promotionPieces.map((symbol) => (
            <Button
              key={symbol}
              variant="outline"
              className="h-16 w-16 sm:h-20 sm:w-20 text-4xl p-0 flex items-center justify-center"
              onClick={() => onSelectPiece(symbol)}
            >
              <PieceComponent piece={{ symbol, color: playerColor }} size="text-4xl sm:text-5xl" />
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PromotionDialog;
