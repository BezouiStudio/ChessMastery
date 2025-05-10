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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Promote Pawn</DialogTitle>
          <DialogDescription>Select a piece to promote your pawn to.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-4 py-4">
          {promotionPieces.map((symbol) => (
            <Button
              key={symbol}
              variant="outline"
              className="h-20 w-20 text-4xl p-0 flex items-center justify-center"
              onClick={() => onSelectPiece(symbol)}
            >
              <PieceComponent piece={{ symbol, color: playerColor }} size="text-5xl" />
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PromotionDialog;
