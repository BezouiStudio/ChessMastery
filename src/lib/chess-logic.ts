// Simplified chess logic for demonstration. A full chess engine is complex.

import type { Piece, PieceColor, PieceSymbol, Square, Board, Move } from '@/types/chess';

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
  fen += ` ${turn} ${castling || '-'} ${enPassant || '-'} ${halfmove} ${fullmove}`;
  return fen;
}

function isValidSquare(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

export function getPieceAtSquare(board: Board, square: Square): Piece | null {
  if (!square || square.length !== 2) return null;
  const { row, col } = squareToCoords(square);
  if (isValidSquare(row, col)) {
    return board[row][col];
  }
  return null;
}

function findKingSquare(board: Board, color: PieceColor): Square | null {
    for (let r_idx = 0; r_idx < 8; r_idx++) {
        for (let c_idx = 0; c_idx < 8; c_idx++) {
            const piece = board[r_idx][c_idx];
            if (piece && piece.symbol === 'k' && piece.color === color) {
                return coordsToSquare(r_idx, c_idx);
            }
        }
    }
    return null;
}

// Checks if a piece at `attackerSquare` can attack `targetSquare` (raw attack, ignores pins or self-check)
function canPieceAttackSquare(board: Board, attackerSq: Square, targetSq: Square, attackerPiece: Piece): boolean {
  const { row: attackerR, col: attackerC } = squareToCoords(attackerSq);
  const { row: targetR, col: targetC } = squareToCoords(targetSq);

  if (attackerSq === targetSq) return false; // Cannot attack its own square

  switch (attackerPiece.symbol) {
    case 'p':
      const direction = attackerPiece.color === 'w' ? -1 : 1;
      return attackerR + direction === targetR && (attackerC - 1 === targetC || attackerC + 1 === targetC);
    case 'n':
      const knightMoves = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
      ];
      for (const [dr, dc] of knightMoves) {
        if (attackerR + dr === targetR && attackerC + dc === targetC) return true;
      }
      return false;
    case 'b':
    case 'r':
    case 'q':
      const pieceDirections: number[][] = [];
      if (attackerPiece.symbol === 'r' || attackerPiece.symbol === 'q') {
        pieceDirections.push([-1, 0], [1, 0], [0, -1], [0, 1]);
      }
      if (attackerPiece.symbol === 'b' || attackerPiece.symbol === 'q') {
        pieceDirections.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
      }

      for (const [dr, dc] of pieceDirections) {
        for (let i = 1; i < 8; i++) {
          const r = attackerR + dr * i;
          const c = attackerC + dc * i;
          if (r === targetR && c === targetC) return true; // Found target
          if (!isValidSquare(r, c) || board[r][c]) break; // Off board or blocked by ANY piece
        }
      }
      return false;
    case 'k':
      const kingMoves = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1], [1, 0], [1, 1]
      ];
      for (const [dr, dc] of kingMoves) {
        if (attackerR + dr === targetR && attackerC + dc === targetC) return true;
      }
      return false;
  }
  return false;
}

// Checks if a square is attacked by the opponentColor
function isSquareAttacked(board: Board, targetSq: Square, attackerPlayerColor: PieceColor): boolean {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.color === attackerPlayerColor) {
                if (canPieceAttackSquare(board, coordsToSquare(r, c), targetSq, piece)) {
                    return true;
                }
            }
        }
    }
    return false;
}


export function isKingInCheck(board: Board, kingColor: PieceColor): boolean {
  const kingSquare = findKingSquare(board, kingColor);
  if (!kingSquare) return false; 

  const opponentColor = kingColor === 'w' ? 'b' : 'w';
  return isSquareAttacked(board, kingSquare, opponentColor);
}

function generatePseudoLegalMoves(board: Board, square: Square, piece: Piece, currentTurnCastlingRights: string, currentEnPassantTarget: string | null): Square[] {
  const { row, col } = squareToCoords(square);
  const moves: Square[] = [];
  const turn = piece.color;

  switch (piece.symbol) {
    case 'p':
      const direction = piece.color === 'w' ? -1 : 1;
      // Move one square forward
      if (isValidSquare(row + direction, col) && !board[row + direction][col]) {
        moves.push(coordsToSquare(row + direction, col));
        // Move two squares forward (initial move)
        if (
          ((piece.color === 'w' && row === 6) || (piece.color === 'b' && row === 1)) &&
          isValidSquare(row + 2 * direction, col) &&
          !board[row + 2 * direction][col]
         ) {
          moves.push(coordsToSquare(row + 2 * direction, col));
        }
      }
      // Captures
      [-1, 1].forEach(offset => {
        const captureRow = row + direction;
        const captureCol = col + offset;
        if (isValidSquare(captureRow, captureCol)) {
          const targetPieceOnSquare = board[captureRow][captureCol];
          if (targetPieceOnSquare && targetPieceOnSquare.color !== piece.color) {
            moves.push(coordsToSquare(captureRow, captureCol));
          }
          // En passant
          if (currentEnPassantTarget) {
            const enPassantCoords = squareToCoords(currentEnPassantTarget);
            if (enPassantCoords.row === captureRow && enPassantCoords.col === captureCol) {
              moves.push(coordsToSquare(captureRow, captureCol));
            }
          }
        }
      });
      break;

    case 'n':
      const knightMoves = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
      ];
      knightMoves.forEach(([dr, dc]) => {
        const nextRow = row + dr;
        const nextCol = col + dc;
        if (isValidSquare(nextRow, nextCol)) {
          const targetPieceOnSquare = board[nextRow][nextCol];
          if (!targetPieceOnSquare || targetPieceOnSquare.color !== piece.color) {
            moves.push(coordsToSquare(nextRow, nextCol));
          }
        }
      });
      break;

    case 'r':
    case 'b':
    case 'q':
      const pieceDirections: number[][] = [];
      if (piece.symbol === 'r' || piece.symbol === 'q') {
        pieceDirections.push([-1, 0], [1, 0], [0, -1], [0, 1]);
      }
      if (piece.symbol === 'b' || piece.symbol === 'q') {
        pieceDirections.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
      }

      for (const [dr, dc] of pieceDirections) {
        for (let i = 1; i < 8; i++) {
          const nextRow = row + dr * i;
          const nextCol = col + dc * i;
          if (!isValidSquare(nextRow, nextCol)) break;

          const targetPieceOnSquare = board[nextRow][nextCol];
          if (targetPieceOnSquare) {
            if (targetPieceOnSquare.color !== piece.color) {
              moves.push(coordsToSquare(nextRow, nextCol)); // Capture
            }
            break; // Blocked by own or opponent piece
          }
          moves.push(coordsToSquare(nextRow, nextCol)); // Empty square
        }
      }
      break;

    case 'k':
      const kingMoves = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1], [1, 0], [1, 1]
      ];
      kingMoves.forEach(([dr, dc]) => {
        const nextRow = row + dr;
        const nextCol = col + dc;
        if (isValidSquare(nextRow, nextCol)) {
          const targetPieceOnSquare = board[nextRow][nextCol];
          if (!targetPieceOnSquare || targetPieceOnSquare.color !== piece.color) {
            moves.push(coordsToSquare(nextRow, nextCol));
          }
        }
      });
      // Castling
      const opponentColor = turn === 'w' ? 'b' : 'w';
      if (!isKingInCheck(board, turn)) { // Can't castle if currently in check
        if (turn === 'w') {
          if (currentTurnCastlingRights.includes('K') && square === 'e1' && !board[7][5] && !board[7][6]) {
            if (!isSquareAttacked(board, 'e1', opponentColor) && !isSquareAttacked(board, 'f1', opponentColor) && !isSquareAttacked(board, 'g1', opponentColor)) {
              moves.push('g1');
            }
          }
          if (currentTurnCastlingRights.includes('Q') && square === 'e1' && !board[7][1] && !board[7][2] && !board[7][3]) {
            if (!isSquareAttacked(board, 'e1', opponentColor) && !isSquareAttacked(board, 'd1', opponentColor) && !isSquareAttacked(board, 'c1', opponentColor)) {
              moves.push('c1');
            }
          }
        } else { // Black's turn
          if (currentTurnCastlingRights.includes('k') && square === 'e8' && !board[0][5] && !board[0][6]) {
            if (!isSquareAttacked(board, 'e8', opponentColor) && !isSquareAttacked(board, 'f8', opponentColor) && !isSquareAttacked(board, 'g8', opponentColor)) {
              moves.push('g8');
            }
          }
          if (currentTurnCastlingRights.includes('q') && square === 'e8' && !board[0][1] && !board[0][2] && !board[0][3]) {
             if (!isSquareAttacked(board, 'e8', opponentColor) && !isSquareAttacked(board, 'd8', opponentColor) && !isSquareAttacked(board, 'c8', opponentColor)) {
              moves.push('c8');
            }
          }
        }
      }
      break;
  }
  return moves;
}

export function getLegalMoves(board: Board, square: Square, turn: PieceColor, currentCastlingRights: string, currentEnPassantTarget: string | null): Square[] {
  const piece = getPieceAtSquare(board, square);
  if (!piece || piece.color !== turn) return [];

  const pseudoLegalMoves = generatePseudoLegalMoves(board, square, piece, currentCastlingRights, currentEnPassantTarget);
  const legalMoves: Square[] = [];

  for (const toSq of pseudoLegalMoves) {
    const { newBoard } = makeMove(
        board, 
        square, 
        toSq, 
        currentCastlingRights, // Pass current state, makeMove doesn't need it for simulation's check safety
        currentEnPassantTarget, // Pass current state
        piece.symbol === 'p' && (squareToCoords(toSq).row === 0 || squareToCoords(toSq).row === 7) ? 'q' : undefined // Default promotion for simulation
    );
    if (!isKingInCheck(newBoard, turn)) {
      legalMoves.push(toSq);
    }
  }
  return legalMoves;
}


export function makeMove(
  board: Board, 
  fromSquare: Square, 
  toSquare: Square, 
  currentCastlingRights: string,
  currentEnPassantTarget: string | null,
  promotionPieceSymbol?: PieceSymbol
): { 
  newBoard: Board, 
  capturedPiece: Piece | null, 
  isPromotion: boolean,
  updatedCastlingRights: string,
  updatedEnPassantTarget: string | null,
  isCastlingKingside: boolean,
  isCastlingQueenside: boolean
} {
  const newBoard = board.map(r => [...r]); 
  const fromCoords = squareToCoords(fromSquare);
  const toCoords = squareToCoords(toSquare);

  const pieceToMove = newBoard[fromCoords.row][fromCoords.col];
  let capturedPiece = newBoard[toCoords.row][toCoords.col]; // Piece on target square

  if (!pieceToMove) throw new Error("No piece at from square: " + fromSquare);

  let isPromotion = false;
  let isCastlingKingside = false;
  let isCastlingQueenside = false;

  // En passant capture: pawn moves to an empty square, but captures pawn on adjacent square
  if (pieceToMove.symbol === 'p' && currentEnPassantTarget && toSquare === currentEnPassantTarget) {
    const epCapturedPawnRow = pieceToMove.color === 'w' ? toCoords.row + 1 : toCoords.row - 1;
    capturedPiece = newBoard[epCapturedPawnRow][toCoords.col]; // The pawn being captured via en passant
    newBoard[epCapturedPawnRow][toCoords.col] = null;
  }
  
  newBoard[toCoords.row][toCoords.col] = pieceToMove;
  newBoard[fromCoords.row][fromCoords.col] = null;


  if (pieceToMove.symbol === 'p' && ( (pieceToMove.color === 'w' && toCoords.row === 0) || (pieceToMove.color === 'b' && toCoords.row === 7) )) {
    newBoard[toCoords.row][toCoords.col] = { symbol: promotionPieceSymbol || 'q', color: pieceToMove.color };
    isPromotion = true;
  }

  // Handle castling rook move
  if (pieceToMove.symbol === 'k') {
    if (Math.abs(fromCoords.col - toCoords.col) === 2) { // King moved two squares
      const rookRow = fromCoords.row;
      if (toCoords.col > fromCoords.col) { // Kingside
        isCastlingKingside = true;
        newBoard[rookRow][5] = newBoard[rookRow][7]; // Move H-file rook
        newBoard[rookRow][7] = null;
      } else { // Queenside
        isCastlingQueenside = true;
        newBoard[rookRow][3] = newBoard[rookRow][0]; // Move A-file rook
        newBoard[rookRow][0] = null;
      }
    }
  }
  
  // Update castling rights
  let newCastlingRights = currentCastlingRights;
  if (pieceToMove.symbol === 'k') {
    if (pieceToMove.color === 'w') newCastlingRights = newCastlingRights.replace('K', '').replace('Q', '');
    else newCastlingRights = newCastlingRights.replace('k', '').replace('q', '');
  }
  if (fromSquare === 'a1' || toSquare === 'a1') newCastlingRights = newCastlingRights.replace('Q', '');
  if (fromSquare === 'h1' || toSquare === 'h1') newCastlingRights = newCastlingRights.replace('K', '');
  if (fromSquare === 'a8' || toSquare === 'a8') newCastlingRights = newCastlingRights.replace('q', '');
  if (fromSquare === 'h8' || toSquare === 'h8') newCastlingRights = newCastlingRights.replace('k', '');
  
  // If a rook is captured on its starting square
   if (capturedPiece && capturedPiece.symbol === 'r') {
      if (toSquare === 'a1' && capturedPiece.color === 'w') newCastlingRights = newCastlingRights.replace('Q', '');
      if (toSquare === 'h1' && capturedPiece.color === 'w') newCastlingRights = newCastlingRights.replace('K', '');
      if (toSquare === 'a8' && capturedPiece.color === 'b') newCastlingRights = newCastlingRights.replace('q', '');
      if (toSquare === 'h8' && capturedPiece.color === 'b') newCastlingRights = newCastlingRights.replace('k', '');
  }


  if (newCastlingRights === "") newCastlingRights = "-";

  // Update en passant target
  let newEnPassantTarget: string | null = null;
  if (pieceToMove.symbol === 'p' && Math.abs(fromCoords.row - toCoords.row) === 2) {
    newEnPassantTarget = coordsToSquare(pieceToMove.color === 'w' ? fromCoords.row - 1 : fromCoords.row + 1, fromCoords.col);
  } else {
    newEnPassantTarget = null; // En passant is only possible for one turn
  }

  return { 
    newBoard, 
    capturedPiece, 
    isPromotion, 
    updatedCastlingRights: newCastlingRights, 
    updatedEnPassantTarget: newEnPassantTarget,
    isCastlingKingside,
    isCastlingQueenside
  };
}

export function isCheckmateOrStalemate(board: Board, turn: PieceColor, castlingRights: string, enPassantTarget: string | null): 'checkmate' | 'stalemate' | null {
    let hasLegalMove = false;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.color === turn) {
                const fromSq = coordsToSquare(r,c);
                const legalMovesForPiece = getLegalMoves(board, fromSq, turn, castlingRights, enPassantTarget);
                if (legalMovesForPiece.length > 0) {
                    hasLegalMove = true;
                    break;
                }
            }
        }
        if (hasLegalMove) break;
    }

    if (!hasLegalMove) {
        return isKingInCheck(board, turn) ? 'checkmate' : 'stalemate';
    }
    return null; 
}


export function moveToAlgebraic(
    moveParams: { 
        from: Square, 
        to: Square, 
        piece: PieceSymbol, 
        captured?: boolean, 
        promotion?: PieceSymbol,
        boardBeforeMove: Board, // For disambiguation or context if needed
        boardAfterMove: Board, // To check for check/checkmate
        turn: PieceColor, // Player who made the move
        isCastlingKingside?: boolean,
        isCastlingQueenside?: boolean,
        enPassantTargetOccurred?: boolean 
    }
): string {
  const { 
    from, to, piece, captured, promotion, 
    boardAfterMove, turn, 
    isCastlingKingside, isCastlingQueenside,
    enPassantTargetOccurred
  } = moveParams;

  if (isCastlingKingside) return 'O-O';
  if (isCastlingQueenside) return 'O-O-O';

  let notation = "";
  if (piece !== 'p') {
    notation += piece.toUpperCase();
    // TODO: Add disambiguation if multiple pieces of the same type can move to 'toSq'
    // e.g., Rae1 or Nfd2. This requires checking other pieces.
    // For simplicity, this is omitted for now.
  }

  if (captured) {
    if (piece === 'p' && !enPassantTargetOccurred) { // For pawn captures, add file of origin
      notation += from[0];
    }
    notation += 'x';
  }

  notation += to;

  if (promotion) {
    notation += '=' + promotion.toUpperCase();
  }
  
  const opponentColor = turn === 'w' ? 'b' : 'w';
  // Check/checkmate status is determined based on the state *after* the move, for the *opponent*.
  // isCheckmateOrStalemate requires current FEN parts. We assume they are not needed for this display-only check.
  // A simplified check is enough for notation. If a full FEN were available for boardAfterMove, that would be more robust.
  // For now, we'll pass null for castling/EP for this check, as they are less relevant for '+' or '#'.
  if (isCheckmateOrStalemate(boardAfterMove, opponentColor, "-", null) === 'checkmate') {
    notation += '#';
  } else if (isKingInCheck(boardAfterMove, opponentColor)) {
    notation += '+';
  }
  
  // if (enPassantTargetOccurred && captured) { // Usually "e.p." is omitted if context is clear
  //   notation += " e.p.";
  // }

  return notation;
}


// Simplified AI move (random legal move)
export function getRandomAiMove(board: Board, color: PieceColor, castlingRights: string, enPassantTarget: string | null): { from: Square, to: Square } | null {
  const possibleMoves: { from: Square, to: Square }[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.color === color) {
        const fromSq = coordsToSquare(r, c);
        const legalMovesForPiece = getLegalMoves(board, fromSq, color, castlingRights, enPassantTarget);
        legalMovesForPiece.forEach(toSq => possibleMoves.push({ from: fromSq, to: toSq }));
      }
    }
  }
  if (possibleMoves.length === 0) return null;
  return possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
}
