export type PieceSymbol = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PieceColor = 'w' | 'b'; // white | black

export interface Piece {
  symbol: PieceSymbol;
  color: PieceColor;
}

export type Square = string; // e.g., "e4", "h8"
export type Board = (Piece | null)[][]; // 8x8 board

export interface Move {
  from: Square;
  to: Square;
  promotion?: PieceSymbol; // For pawn promotion
  piece: PieceSymbol;
  captured?: PieceSymbol;
  isCheck?: boolean;
  isCheckmate?: boolean;
  isStalemate?: boolean;
  isCastling?: 'kingside' | 'queenside';
}

export interface ChessGameSummary {
  fen: string;
  board: Board;
  turn: PieceColor;
  castling: {
    w: { k: boolean; q: boolean };
    b: { k: boolean; q: boolean };
  };
  enPassant: Square | null;
  halfmoveClock: number;
  fullmoveNumber: number;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean; // Covers stalemate, threefold repetition, 50-move rule
  winner: PieceColor | null;
  moves: Move[]; // History of moves
}

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
