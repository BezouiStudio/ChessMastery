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
  for (let r_loop = 0; r_loop < 8; r_loop++) {
    let emptyCount = 0;
    for (let c_loop = 0; c_loop < 8; c_loop++) {
      const piece = board[r_loop][c_loop];
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
    if (r_loop < 7) {
      fen += '/';
    }
  }
  fen += ` ${turn} ${castling} ${enPassant || '-'} ${halfmove} ${fullmove}`;
  return fen;
}

export function getLegalMoves(board: Board, square: Square, turn: PieceColor): Square[] {
  const piece = getPieceAtSquare(board, square);
  if (!piece || piece.color !== turn) return [];

  const { row, col } = squareToCoords(square);
  const moves: Square[] = [];

  switch (piece.symbol) {
    case 'p': // Pawn
      const direction = piece.color === 'w' ? -1 : 1;
      // Move one square forward
      if (isValidSquare(row + direction, col) && !board[row + direction][col]) {
        moves.push(coordsToSquare(row + direction, col));
        // Move two squares forward (initial move)
        if (((piece.color === 'w' && row === 6) || (piece.color === 'b' && row === 1)) &&
            isValidSquare(row + 2 * direction, col) && 
            !board[row + 2 * direction][col] // Path to second square must be clear
           ) {
            moves.push(coordsToSquare(row + 2 * direction, col));
        }
      }
      // Captures
      [-1, 1].forEach(offset => {
        const captureRow = row + direction;
        const captureCol = col + offset;
        if (isValidSquare(captureRow, captureCol)) {
          const targetPiece = board[captureRow][captureCol];
          if (targetPiece && targetPiece.color !== piece.color) {
            moves.push(coordsToSquare(captureRow, captureCol));
          }
          // TODO: En passant check against enPassantTarget state
        }
      });
      break;

    case 'n': // Knight
      const knightMoves = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
      ];
      knightMoves.forEach(([dr, dc]) => {
        const nextRow = row + dr;
        const nextCol = col + dc;
        if (isValidSquare(nextRow, nextCol)) {
          const targetPiece = board[nextRow][nextCol];
          if (!targetPiece || targetPiece.color !== piece.color) {
            moves.push(coordsToSquare(nextRow, nextCol));
          }
        }
      });
      break;

    case 'r': // Rook
    case 'b': // Bishop
    case 'q': // Queen
      const pieceDirections: number[][] = [];
      if (piece.symbol === 'r' || piece.symbol === 'q') {
        pieceDirections.push([-1, 0], [1, 0], [0, -1], [0, 1]); // Up, Down, Left, Right
      }
      if (piece.symbol === 'b' || piece.symbol === 'q') {
        pieceDirections.push([-1, -1], [-1, 1], [1, -1], [1, 1]); // Diagonals
      }

      for (const [dr, dc] of pieceDirections) {
        for (let i = 1; i < 8; i++) {
          const nextRow = row + dr * i;
          const nextCol = col + dc * i;
          if (!isValidSquare(nextRow, nextCol)) break; // Off board

          const targetPiece = board[nextRow][nextCol];
          if (targetPiece) {
            if (targetPiece.color !== piece.color) {
              moves.push(coordsToSquare(nextRow, nextCol)); // Capture
            }
            break; // Blocked by own or opponent piece
          }
          moves.push(coordsToSquare(nextRow, nextCol)); // Empty square
        }
      }
      break;

    case 'k': // King
      const kingMoves = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1], [1, 0], [1, 1]
      ];
      kingMoves.forEach(([dr, dc]) => {
        const nextRow = row + dr;
        const nextCol = col + dc;
        if (isValidSquare(nextRow, nextCol)) {
          const targetPiece = board[nextRow][nextCol];
          if (!targetPiece || targetPiece.color !== piece.color) {
            // TODO: Add check to prevent moving into check
            moves.push(coordsToSquare(nextRow, nextCol));
          }
        }
      });
      // TODO: Implement castling based on castlingRights state
      break;
  }

  // TODO: Filter out moves that would leave the king in check.
  // This requires a robust isKingInCheck function and simulating the move.
  // For now, this basic validation is a step forward.
  return moves;
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
  const newBoard = board.map(r => [...r]); // Deep copy
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

  // TODO: Handle castling move (move rook as well)
  // TODO: Update en passant target square if pawn moves two squares
  // TODO: Clear en passant target square if not used on the next move
  // TODO: Update castling rights if king or rook moves

  return { newBoard, capturedPiece, isPromotion };
}

// Basic algebraic notation (incomplete)
export function moveToAlgebraic(move: { from: Square, to: Square, piece: PieceSymbol, captured?: boolean, promotion?: PieceSymbol }): string {
  let notation = "";
  if (move.piece !== 'p') {
    notation += move.piece.toUpperCase();
  }
  // Ambiguity resolution (e.g. Rae1) not handled
  // notation += move.from; // Simplified: For full algebraic, only use if ambiguous.
  if (move.captured) {
    if (move.piece === 'p') notation += move.from[0]; // e.g. exd5
    notation += 'x';
  }
  notation += move.to;
  if (move.promotion) {
    notation += '=' + move.promotion.toUpperCase();
  }
  // Check (+) and Checkmate (#) not handled here, needs full game state and check detection
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
  // Find the king's square
  let kingSquare: Square | null = null;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.symbol === 'k' && piece.color === kingColor) {
        kingSquare = coordsToSquare(r, c);
        break;
      }
    }
    if (kingSquare) break;
  }

  if (!kingSquare) return false; // Should not happen in a valid game

  // Check if any opponent piece can attack the king's square
  const opponentColor = kingColor === 'w' ? 'b' : 'w';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.color === opponentColor) {
        // Temporarily change turn for getLegalMoves to check opponent's moves
        const attackerSquare = coordsToSquare(r,c);
        // For pawn captures, they attack differently than they move.
        if (piece.symbol === 'p') {
            const {row: kingR, col: kingC} = squareToCoords(kingSquare);
            const {row: pawnR, col: pawnC} = squareToCoords(attackerSquare);
            const direction = piece.color === 'w' ? -1 : 1;
            if (pawnR + direction === kingR && (pawnC -1 === kingC || pawnC + 1 === kingC)) {
                return true;
            }
        } else {
            const legalMovesForAttacker = getLegalMoves(board, attackerSquare, opponentColor);
            if (legalMovesForAttacker.includes(kingSquare)) {
                return true;
            }
        }
      }
    }
  }
  return false;
}

export function isCheckmateOrStalemate(board: Board, turn: PieceColor): 'checkmate' | 'stalemate' | null {
    let hasLegalMove = false;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.color === turn) {
                // Simulate each move and check if king is still in check
                const legalMovesForPiece = getLegalMoves(board, coordsToSquare(r,c), turn);
                for (const toSq of legalMovesForPiece) {
                    const { newBoard } = makeMove(board, coordsToSquare(r,c), toSq); // Simplified, doesn't handle promotion choice
                    if (!isKingInCheck(newBoard, turn)) {
                        hasLegalMove = true;
                        break;
                    }
                }
            }
            if (hasLegalMove) break;
        }
        if (hasLegalMove) break;
    }

    if (!hasLegalMove) {
        return isKingInCheck(board, turn) ? 'checkmate' : 'stalemate';
    }
    return null; 
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
  const checkStatus = isKingInCheck(board, turn);
  
  const mateOrStale = isCheckmateOrStalemate(board, turn);
  const isCheckmate = mateOrStale === 'checkmate';
  const isStalemate = mateOrStale === 'stalemate';
  let winner: PieceColor | null = null;
  if (isCheckmate) {
    winner = turn === 'w' ? 'b' : 'w';
  }
  
  return {
    fen,
    board,
    turn,
    castling: { 
      w: { k: castling.includes('K'), q: castling.includes('Q') },
      b: { k: castling.includes('k'), q: castling.includes('q') },
    },
    enPassant,
    halfmoveClock: halfmove,
    fullmoveNumber: fullmove,
    isCheck: checkStatus,
    isCheckmate: isCheckmate,
    isStalemate: isStalemate,
    isDraw: isStalemate, // Add other draw conditions (50-move, repetition)
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
    // Basic validation: check if there is a piece of the correct color at 'from'
    const pieceAtFrom = getPieceAtSquare(board, from);
    if (!pieceAtFrom || pieceAtFrom.color !== turn) {
        console.warn(`Invalid move: No piece of color ${turn} at ${from} for move ${algebraic}`);
        return null;
    }
    // Basic validation: check if the move to 'to' is in the list of legal moves (simple check)
    // This is not a full validation, as getLegalMoves itself needs to be perfect.
    // And this doesn't find WHICH piece moved for short algebraic like "Nf3".
    // const legalMovesFromSquare = getLegalMoves(board, from, turn);
    // if (!legalMovesFromSquare.includes(to)) {
    //     console.warn(`Invalid move: ${from} to ${to} is not legal for the piece at ${from}.`);
    //     return null;
    // }

    return { from, to, promotion };
  }
  // A true parser is needed for standard algebraic notation (e.g. Ne5, exd5, O-O)
  console.warn("Simplified algebraic parser, only handles long algebraic notation like e2e4. Move received:", algebraic);
  return null;
}
