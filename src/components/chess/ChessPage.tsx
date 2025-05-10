'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ChessboardComponent from './ChessboardComponent';
import GameControls from './GameControls';
import MoveHistory from './MoveHistory';
import AiTutorPanel from './AiTutorPanel';
import GameStatus from './GameStatus';
import PromotionDialog from './PromotionDialog';

import {
  createInitialBoard,
  getLegalMoves,
  makeMove as applyMoveLogic,
  squareToCoords,
  coordsToSquare,
  boardToFen,
  INITIAL_FEN,
  fenToBoard,
  getRandomAiMove,
  isKingInCheck as checkKingInCheck, // Renamed to avoid conflict
  isCheckmateOrStalemate,
  moveToAlgebraic, // Assuming this is robust enough
  getPieceAtSquare,
  parseAlgebraicMove
} from '@/lib/chess-logic';
import type { Board, Square, Piece, PieceColor, PieceSymbol, Difficulty, Move } from '@/types/chess';
import { explainMoveHint } from '@/ai/flows/move-hint-explanation';
import { aiTutorAnalysis } from '@/ai/flows/ai-tutor-analysis';
import { useToast } from '@/hooks/use-toast';

const ChessPage: React.FC = () => {
  const [board, setBoard] = useState<Board>(createInitialBoard());
  const [turn, setTurn] = useState<PieceColor>('w');
  const [castlingRights, setCastlingRights] = useState<string>("KQkq");
  const [enPassantTarget, setEnPassantTarget] = useState<string | null>(null);
  const [halfMoveClock, setHalfMoveClock] = useState<number>(0);
  const [fullMoveNumber, setFullMoveNumber] = useState<number>(1);
  
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [validMoves, setValidMoves] = useState<Square[]>([]);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [gameStatusText, setGameStatusText] = useState<string>("White's Turn");
  const [isCheck, setIsCheck] = useState<boolean>(false);
  const [isCheckmate, setIsCheckmate] = useState<boolean>(false);
  const [isStalemate, setIsStalemate] = useState<boolean>(false);
  const [winner, setWinner] = useState<PieceColor | null>(null);
  const [kingInCheckSquare, setKingInCheckSquare] = useState<Square | null>(null);


  const [difficulty, setDifficulty] = useState<Difficulty>('beginner');
  const [playerColor] = useState<PieceColor>('w'); // Player is always white for now
  const aiColor = playerColor === 'w' ? 'b' : 'w';

  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false);
  const [aiHint, setAiHint] = useState<{ move: string; explanation: string } | undefined>(undefined);
  const [aiAnalysis, setAiAnalysis] = useState<string | undefined>(undefined);

  const [isPromotionDialogOpen, setIsPromotionDialogOpen] = useState<boolean>(false);
  const [promotionSquare, setPromotionSquare] = useState<Square | null>(null);
  const [pendingMove, setPendingMove] = useState<{ from: Square, to: Square } | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);


  const { toast } = useToast();

  const resetGame = useCallback(() => {
    const initial = fenToBoard(INITIAL_FEN);
    setBoard(initial.board);
    setTurn(initial.turn);
    setCastlingRights(initial.castling);
    setEnPassantTarget(initial.enPassant);
    setHalfMoveClock(initial.halfmove);
    setFullMoveNumber(initial.fullmove);

    setSelectedSquare(null);
    setValidMoves([]);
    setMoveHistory([]);
    setIsCheck(false);
    setIsCheckmate(false);
    setIsStalemate(false);
    setWinner(null);
    setKingInCheckSquare(null);
    setGameStatusText("White's Turn");
    setAiHint(undefined);
    setAiAnalysis(undefined);
    setLastMove(null);
    toast({ title: "Game Reset", description: "A new game has started." });
  }, [toast]);

  useEffect(() => {
    resetGame();
  }, [resetGame]);
  
  const updateGameStatus = useCallback((currentBoard: Board, currentPlayer: PieceColor, currentCastling: string, currentEnPassant: string | null, currentHalfMove: number, currentFullMove: number) => {
    const kingSquare = findKing(currentBoard, currentPlayer);
    const inCheck = kingSquare ? checkKingInCheck(currentBoard, currentPlayer) : false; // Simplified checkKingInCheck
    setIsCheck(inCheck);
    if (inCheck && kingSquare) setKingInCheckSquare(kingSquare); else setKingInCheckSquare(null);

    const mateStatus = isCheckmateOrStalemate(currentBoard, currentPlayer); // This needs to be accurate
    if (mateStatus === 'checkmate') {
      setIsCheckmate(true);
      const gameWinner = currentPlayer === 'w' ? 'b' : 'w';
      setWinner(gameWinner);
      setGameStatusText(`Checkmate! ${gameWinner === 'w' ? 'White' : 'Black'} wins.`);
    } else if (mateStatus === 'stalemate') {
      setIsStalemate(true);
      setGameStatusText("Stalemate! It's a draw.");
    } else {
      setIsCheckmate(false);
      setIsStalemate(false);
      setWinner(null);
      setGameStatusText(`${currentPlayer === 'w' ? 'White' : 'Black'}'s Turn${inCheck ? ' (Check!)' : ''}`);
    }

    // AI Board Analysis (optional, can be resource intensive)
    // if (currentPlayer === playerColor && !isCheckmate && !isStalemate) {
    //   fetchAiAnalysis(currentBoard, currentPlayer, currentCastling, currentEnPassant, currentHalfMove, currentFullMove);
    // }
  }, [playerColor]);

  const findKing = (b: Board, color: PieceColor): Square | null => {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = b[r][c];
        if (piece && piece.symbol === 'k' && piece.color === color) {
          return coordsToSquare(r, c);
        }
      }
    }
    return null;
  };


  const processMove = useCallback((fromSq: Square, toSq: Square, promotionPieceSymbol?: PieceSymbol) => {
    if (isCheckmate || isStalemate) return;

    const piece = getPieceAtSquare(board, fromSq);
    if (!piece) return;

    const { newBoard, capturedPiece, isPromotion } = applyMoveLogic(board, fromSq, toSq, promotionPieceSymbol);
    
    const newTurn = turn === 'w' ? 'b' : 'w';
    const newFullMoveNumber = turn === 'b' ? fullMoveNumber + 1 : fullMoveNumber;
    const newHalfMoveClock = (piece.symbol === 'p' || capturedPiece) ? 0 : halfMoveClock + 1;
    
    // TODO: Update castling rights and en passant target properly
    // For now, simplifying:
    const newCastlingRights = castlingRights; // This needs logic based on rook/king moves
    const newEnPassantTarget = null; // This needs logic for pawn double moves

    setBoard(newBoard);
    setTurn(newTurn);
    setCastlingRights(newCastlingRights);
    setEnPassantTarget(newEnPassantTarget);
    setHalfMoveClock(newHalfMoveClock);
    setFullMoveNumber(newFullMoveNumber);
    
    const moveNotation = moveToAlgebraic({ from: fromSq, to: toSq, piece: piece.symbol, captured: !!capturedPiece, promotion: promotionPieceSymbol });
    setMoveHistory(prev => [...prev, moveNotation]);
    setLastMove({ from: fromSq, to: toSq });
    
    updateGameStatus(newBoard, newTurn, newCastlingRights, newEnPassantTarget, newHalfMoveClock, newFullMoveNumber);
    setSelectedSquare(null);
    setValidMoves([]);

  }, [board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber, isCheckmate, isStalemate, updateGameStatus]);


  const handleSquareClick = useCallback((square: Square) => {
    if (isCheckmate || isStalemate || turn !== playerColor) return;

    const piece = getPieceAtSquare(board, square);

    if (selectedSquare) {
      if (validMoves.includes(square)) {
        // Check for promotion
        const movingPiece = getPieceAtSquare(board, selectedSquare);
        if (movingPiece?.symbol === 'p') {
          const { row: toRow } = squareToCoords(square);
          if ((movingPiece.color === 'w' && toRow === 0) || (movingPiece.color === 'b' && toRow === 7)) {
            setPendingMove({ from: selectedSquare, to: square });
            setPromotionSquare(square);
            setIsPromotionDialogOpen(true);
            return;
          }
        }
        processMove(selectedSquare, square);
      } else {
        // Clicked on another piece of same color or invalid square
        if (piece && piece.color === turn) {
          setSelectedSquare(square);
          setValidMoves(getLegalMoves(board, square, turn));
        } else {
          setSelectedSquare(null);
          setValidMoves([]);
        }
      }
    } else if (piece && piece.color === turn) {
      setSelectedSquare(square);
      setValidMoves(getLegalMoves(board, square, turn));
    }
  }, [board, selectedSquare, validMoves, turn, playerColor, isCheckmate, isStalemate, processMove]);

  const handlePromotionSelect = (pieceSymbol: PieceSymbol) => {
    if (pendingMove) {
      processMove(pendingMove.from, pendingMove.to, pieceSymbol);
    }
    setIsPromotionDialogOpen(false);
    setPromotionSquare(null);
    setPendingMove(null);
  };

  // AI Opponent's turn
  useEffect(() => {
    if (turn === aiColor && !isCheckmate && !isStalemate) {
      setIsLoadingAi(true);
      setTimeout(() => { // Simulate AI thinking time
        const aiMove = getRandomAiMove(board, aiColor); // Using simplified AI
        if (aiMove) {
          // Check for AI promotion (simplified: auto-queen)
          const aiPiece = getPieceAtSquare(board, aiMove.from);
          let promotionSymbol: PieceSymbol | undefined = undefined;
          if (aiPiece?.symbol === 'p') {
            const {row: toRow} = squareToCoords(aiMove.to);
            if ((aiPiece.color === 'w' && toRow === 0) || (aiPiece.color === 'b' && toRow === 7)) {
              promotionSymbol = 'q';
            }
          }
          processMove(aiMove.from, aiMove.to, promotionSymbol);
        }
        setIsLoadingAi(false);
      }, 1000);
    }
  }, [turn, aiColor, board, processMove, isCheckmate, isStalemate]);

  const handleHint = async () => {
    if (isCheckmate || isStalemate) {
      toast({ title: "Game Over", description: "Cannot get a hint when the game is over.", variant: "destructive" });
      return;
    }
    setIsLoadingAi(true);
    setAiHint(undefined); // Clear previous hint
    try {
      // Simplified hint: get a random "good" move (could be first from AI logic)
      const hintMove = getRandomAiMove(board, turn); // Use AI's move logic for hint
      if (!hintMove) {
        toast({ title: "No Hint Available", description: "AI could not find a suitable hint.", variant: "destructive"});
        setIsLoadingAi(false);
        return;
      }
      
      const fen = boardToFen(board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber);
      const pieceBeingMoved = getPieceAtSquare(board, hintMove.from);
      const algebraicNotation = moveToAlgebraic({from: hintMove.from, to: hintMove.to, piece: pieceBeingMoved!.symbol});
      
      const result = await explainMoveHint({
        currentBoardState: fen,
        suggestedMove: algebraicNotation, // This needs proper algebraic notation
        difficultyLevel: difficulty,
      });
      setAiHint({ move: algebraicNotation, explanation: result.explanation });
      toast({ title: "AI Hint", description: `Suggested move: ${algebraicNotation}`});
    } catch (error) {
      console.error("Error getting AI hint:", error);
      toast({ title: "Error", description: "Could not fetch AI hint.", variant: "destructive" });
      setAiHint(undefined);
    }
    setIsLoadingAi(false);
  };
  
  const fetchAiAnalysis = async (currentBoard: Board, currentTurn: PieceColor, currentCastling: string, currentEnPassant: string | null, currentHalfMove: number, currentFullMove: number) => {
    setIsLoadingAi(true);
    setAiAnalysis(undefined);
    try {
      const fen = boardToFen(currentBoard, currentTurn, currentCastling, currentEnPassant, currentHalfMove, currentFullMove);
      const result = await aiTutorAnalysis({
        boardState: fen,
        currentTurn: currentTurn,
      });
      setAiAnalysis(result.analysis);
    } catch (error) {
      console.error("Error getting AI analysis:", error);
      setAiAnalysis("Failed to load analysis.");
    }
    setIsLoadingAi(false);
  };


  return (
    <div className="w-full max-w-6xl mx-auto p-2 md:p-4">
      <header className="mb-4 md:mb-6 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-primary">ChessMastery</h1>
        <p className="text-muted-foreground">Hone your chess skills with AI guidance.</p>
      </header>

      <GameStatus 
        statusText={gameStatusText} 
        isCheck={isCheck} 
        isCheckmate={isCheckmate} 
        isStalemate={isStalemate} 
        isDraw={isStalemate} // Assuming stalemate is main draw condition here
        winner={winner}
      />

      <div className="flex flex-col md:flex-row gap-4 md:gap-6 mt-4">
        <div className="w-full md:w-[calc(100%-24rem)] lg:w-[calc(100%-26rem)] flex justify-center">
          <ChessboardComponent
            board={board}
            onSquareClick={handleSquareClick}
            selectedSquare={selectedSquare}
            validMoves={validMoves}
            lastMove={lastMove}
            isPlayerTurn={turn === playerColor && !isLoadingAi && !isCheckmate && !isStalemate}
            playerColor={playerColor}
            kingInCheckSquare={kingInCheckSquare}
          />
        </div>

        <aside className="w-full md:w-96 lg:w-[24rem] flex flex-col gap-4">
          <GameControls
            onNewGame={resetGame}
            onHint={handleHint}
            isLoadingHint={isLoadingAi && !aiAnalysis} // Only show loading for hint if analysis isn't also loading
            difficulty={difficulty}
            onDifficultyChange={setDifficulty}
          />
          <div className="flex-grow min-h-[200px]">
            <AiTutorPanel hint={aiHint} analysis={aiAnalysis} isLoading={isLoadingAi} />
          </div>
          <div className="flex-grow min-h-[200px]">
            <MoveHistory moves={moveHistory} />
          </div>
        </aside>
      </div>

      <PromotionDialog
        isOpen={isPromotionDialogOpen}
        onSelectPiece={handlePromotionSelect}
        playerColor={playerColor}
      />
    </div>
  );
};

export default ChessPage;

