// Simplified chess logic for demonstration. A full chess engine is complex.
// This version will handle basic FEN, piece representation, and very basic move validation.
// It will not implement all rules like check/checkmate detection or special moves perfectly.

import type { Piece, PieceColor, PieceSymbol, Square, Board, Move, ChessGameSummary } from '@/types/chess';

const PIECE_SYMBOLS: { [key in PieceSymbol]: string } = {
  p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔',
};

export const UNICODE_PIECES: { [color in PieceColor]: { [symbol in PieceSymbol]: string } } = {
  w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
  b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' },
};

export const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function squareToCoords(square: Square): { row: number; col: number } {
  const col = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const row = 8 - parseInt(square[1], 10);
  return { row, col };
}

export function coordsToSquare(row: number, col: number): Square {
  return String.fromCharCode('a'.charCodeAt(0) + col) + (8 - row).toString();
}

export function createInitialBoard(): Board {
  return fenToBoard(INITIAL_FEN).board;
}

export function fenToBoard(fen: string): { board: Board; turn: PieceColor; castling: string; enPassant: string | null; halfmove: number; fullmove: number; } {
  const parts = fen.split(" ");
  const boardFen = parts[0];
  const board: Board = Array(8).fill(null).map(() => Array(8).fill(null));
  let row = 0;
  let col = 0;

  for (const char of boardFen) {
    if (char === '/') {
      row++;
      col = 0;
    } else if (/\d/.test(char)) {
      col += parseInt(char, 10);
    } else {
      const color = char === char.toUpperCase() ? 'w' : 'b';
      const symbol = char.toLowerCase() as PieceSymbol;
      board[row][col] = { symbol, color };
      col++;
    }
  }
  return { 
    board, 
    turn: parts[1] as PieceColor,
    castling: parts[2],
    enPassant: parts[3] === '-' ? null : parts[3],
    halfmove: parseInt(parts[4], 10),
    fullmove: parseInt(parts[5], 10)
  };
}

export function boardToFen(board: Board, turn: PieceColor, castling: string, enPassant: string | null, halfmove: number, fullmove: number): string {
  let fen = "";
  for (let r = 0; r < 8; r++) {
    let emptyCount = 0;
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        if (emptyCount > 0) {
          fen += emptyCount;
          emptyCount = 0;
        }
        fen += piece.color === 'w' ? piece.symbol.toUpperCase() : piece.symbol.toLowerCase();
      } else {
        emptyCount++;
      }
    }
    if (emptyCount > 0) {
      fen += emptyCount;
    }
    if (r < 7) {
      fen += '/';
    }
  }
  fen += ` ${turn} ${castling} ${enPassant || '-'} ${halfmove} ${fullmove}`;
  return fen;
}

// Basic move validation (very simplified)
export function getLegalMoves(board: Board, square: Square, turn: PieceColor): Square[] {
  const piece = getPieceAtSquare(board, square);
  if (!piece || piece.color !== turn) return [];

  const { row, col } = squareToCoords(square);
  const moves: Square[] = [];

  // This is extremely simplified and doesn't account for checks, pins, or other pieces blocking.
  // A real implementation would be much more complex.
  switch (piece.symbol) {
    case 'p': // Pawn
      const direction = piece.color === 'w' ? -1 : 1;
      // Move one square forward
      if (isValidSquare(row + direction, col) && !board[row + direction][col]) {
        moves.push(coordsToSquare(row + direction, col));
         // Move two squares forward (initial move)
        if ((piece.color === 'w' && row === 6) || (piece.color === 'b' && row === 1)) {
             if (isValidSquare(row + 2 * direction, col) && !board[row + 2 * direction][col] && !board[row + direction][col]) {
                moves.push(coordsToSquare(row + 2 * direction, col));
            }
        }
      }
      // Captures
      [-1, 1].forEach(offset => {
        if (isValidSquare(row + direction, col + offset)) {
          const targetPiece = board[row + direction][col + offset];
          if (targetPiece && targetPiece.color !== piece.color) {
            moves.push(coordsToSquare(row + direction, col + offset));
          }
        }
      });
      break;
    case 'n': // Knight
      const knightMoves = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
      ];
      knightMoves.forEach(([dr, dc]) => {
        if (isValidSquare(row + dr, col + dc)) {
          const targetPiece = board[row + dr][col + dc];
          if (!targetPiece || targetPiece.color !== piece.color) {
            moves.push(coordsToSquare(row + dr, col + dc));
          }
        }
      });
      break;
    // Implement Rook, Bishop, Queen, King similarly (simplified)
    // For this example, we'll keep it short
    default: // Rook, Bishop, Queen, King (very basic: can move to any empty or opponent square)
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (r === row && c === col) continue;
          const targetPiece = board[r][c];
          if (!targetPiece || targetPiece.color !== piece.color) {
             // Very simplified: allow movement to any valid square for these pieces if not self.
             // This needs to be properly restricted by piece type (rook, bishop, etc.)
             if (piece.symbol === 'r' && (r === row || c === col)) moves.push(coordsToSquare(r,c));
             if (piece.symbol === 'b' && (Math.abs(r-row) === Math.abs(c-col))) moves.push(coordsToSquare(r,c));
             if (piece.symbol === 'q' && (r === row || c === col || Math.abs(r-row) === Math.abs(c-col))) moves.push(coordsToSquare(r,c));
             if (piece.symbol === 'k' && (Math.abs(r-row) <=1 && Math.abs(c-col) <=1)) moves.push(coordsToSquare(r,c));
          }
        }
      }
      break;
  }
  // Filter out moves that land on same-colored pieces (already partially handled)
  return moves.filter(sq => {
    const {row: tr, col: tc} = squareToCoords(sq);
    const target = board[tr][tc];
    return !target || target.color !== piece.color;
  });
}

export function getPieceAtSquare(board: Board, square: Square): Piece | null {
  if (!square || square.length !== 2) return null;
  const { row, col } = squareToCoords(square);
  if (isValidSquare(row, col)) {
    return board[row][col];
  }
  return null;
}

function isValidSquare(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

export function makeMove(
  board: Board, 
  fromSquare: Square, 
  toSquare: Square, 
  promotionPiece?: PieceSymbol
): { newBoard: Board, capturedPiece: Piece | null, isPromotion: boolean } {
  const newBoard = board.map(row => [...row]); // Deep copy
  const fromCoords = squareToCoords(fromSquare);
  const toCoords = squareToCoords(toSquare);

  const pieceToMove = newBoard[fromCoords.row][fromCoords.col];
  const capturedPiece = newBoard[toCoords.row][toCoords.col];

  if (!pieceToMove) throw new Error("No piece at from square");

  let isPromotion = false;
  if (pieceToMove.symbol === 'p' && ( (pieceToMove.color === 'w' && toCoords.row === 0) || (pieceToMove.color === 'b' && toCoords.row === 7) )) {
    newBoard[toCoords.row][toCoords.col] = { symbol: promotionPiece || 'q', color: pieceToMove.color };
    isPromotion = true;
  } else {
    newBoard[toCoords.row][toCoords.col] = pieceToMove;
  }
  
  newBoard[fromCoords.row][fromCoords.col] = null;

  return { newBoard, capturedPiece, isPromotion };
}

// Basic algebraic notation (incomplete)
export function moveToAlgebraic(move: { from: Square, to: Square, piece: PieceSymbol, captured?: boolean, promotion?: PieceSymbol }): string {
  let notation = "";
  if (move.piece !== 'p') {
    notation += move.piece.toUpperCase();
  }
  // Ambiguity resolution (e.g. Rae1) not handled
  notation += move.from; // Simplified, usually just disambiguation part
  if (move.captured) {
    if (move.piece === 'p') notation += move.from[0]; // e.g. exd5
    notation += 'x';
  }
  notation += move.to;
  if (move.promotion) {
    notation += '=' + move.promotion.toUpperCase();
  }
  // Check (+) and Checkmate (#) not handled here, needs full game state
  return notation;
}

// Simplified AI move (random legal move)
export function getRandomAiMove(board: Board, color: PieceColor): { from: Square, to: Square } | null {
  const possibleMoves: { from: Square, to: Square }[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.color === color) {
        const fromSq = coordsToSquare(r, c);
        const legalMoves = getLegalMoves(board, fromSq, color);
        legalMoves.forEach(toSq => possibleMoves.push({ from: fromSq, to: toSq }));
      }
    }
  }
  if (possibleMoves.length === 0) return null; // No legal moves (stalemate/checkmate)
  return possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
}

export function isKingInCheck(board: Board, kingColor: PieceColor): boolean {
  // Simplified: This function would iterate through all opponent pieces
  // and see if any of them can attack the king's square.
  // For now, always return false.
  return false;
}

export function isCheckmateOrStalemate(board: Board, turn: PieceColor): 'checkmate' | 'stalemate' | null {
    // Simplified: Check if any legal moves exist.
    // A full implementation needs to check for check status as well.
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.color === turn) {
                if (getLegalMoves(board, coordsToSquare(r, c), turn).length > 0) {
                    return null; // Legal move found
                }
            }
        }
    }
    // No legal moves. Determine if checkmate or stalemate.
    // This requires a robust isKingInCheck function.
    // if (isKingInCheck(board, turn)) return 'checkmate';
    return 'stalemate'; // Simplified, assuming stalemate if no moves and not in check by current logic
}

export function getGameSummary(
  board: Board,
  turn: PieceColor,
  castling: string,
  enPassant: string | null,
  halfmove: number,
  fullmove: number,
  moves: Move[]
): ChessGameSummary {
  const fen = boardToFen(board, turn, castling, enPassant, halfmove, fullmove);
  const checkStatus = isKingInCheck(board, turn); // Simplified
  
  let mateStatus: 'checkmate' | 'stalemate' | null = null;
  let winner: PieceColor | null = null;

  // A more robust check for checkmate/stalemate would be:
  const legalMovesForCurrentPlayer = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.color === turn) {
        const fromSq = coordsToSquare(r, c);
        getLegalMoves(board, fromSq, turn).forEach(toSq => legalMovesForCurrentPlayer.push({from: fromSq, to: toSq}));
      }
    }
  }

  if (legalMovesForCurrentPlayer.length === 0) {
    if (checkStatus) {
      mateStatus = 'checkmate';
      winner = turn === 'w' ? 'b' : 'w';
    } else {
      mateStatus = 'stalemate';
    }
  }
  
  return {
    fen,
    board,
    turn,
    castling: { // Simplified parsing
      w: { k: castling.includes('K'), q: castling.includes('Q') },
      b: { k: castling.includes('k'), q: castling.includes('q') },
    },
    enPassant,
    halfmoveClock: halfmove,
    fullmoveNumber: fullmove,
    isCheck: checkStatus,
    isCheckmate: mateStatus === 'checkmate',
    isStalemate: mateStatus === 'stalemate',
    isDraw: mateStatus === 'stalemate', // Add other draw conditions (50-move, repetition)
    winner,
    moves,
  };
}

export function parseAlgebraicMove(board: Board, turn: PieceColor, algebraic: string): { from: Square, to: Square, promotion?: PieceSymbol } | null {
  // This is a placeholder for a complex algebraic notation parser.
  // For "e4", "Nf3", etc.
  // Example: If algebraic is "e2e4" (long algebraic notation)
  if (/^[a-h][1-8][a-h][1-8]/.test(algebraic)) {
    const from = algebraic.substring(0, 2) as Square;
    const to = algebraic.substring(2, 4) as Square;
    let promotion: PieceSymbol | undefined = undefined;
    if (algebraic.length === 5) {
      promotion = algebraic[4].toLowerCase() as PieceSymbol;
    }
    return { from, to, promotion };
  }
  // A true parser is needed for standard algebraic notation (e.g. Ne5, exd5, O-O)
  console.warn("Simplified algebraic parser, only handles long algebraic notation like e2e4");
  return null;
}
