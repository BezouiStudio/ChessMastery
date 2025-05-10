// src/components/chess/ChessPage.tsx
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
  isKingInCheck as checkKingInCheck,
  isCheckmateOrStalemate,
  moveToAlgebraic,
  getPieceAtSquare,
} from '@/lib/chess-logic';
import type { Board, Square, PieceColor, PieceSymbol, Difficulty } from '@/types/chess';
import { explainMoveHint, ExplainMoveHintOutput } from '@/ai/flows/move-hint-explanation';
import { aiTutorAnalysis, AiTutorAnalysisOutput } from '@/ai/flows/ai-tutor-analysis';
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
  const [playerColor] = useState<PieceColor>('w');
  const aiColor = playerColor === 'w' ? 'b' : 'w';

  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false);
  const [aiHint, setAiHint] = useState<{ move: string; explanation: string } | undefined>(undefined);
  
  const [playerMoveAnalysisOutput, setPlayerMoveAnalysisOutput] = useState<AiTutorAnalysisOutput | null>(null);
  const [aiMoveExplanationOutput, setAiMoveExplanationOutput] = useState<{ move: string; explanation: string } | null>(null);
  const [boardFenBeforeAiMove, setBoardFenBeforeAiMove] = useState<string>(INITIAL_FEN);


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
    setPlayerMoveAnalysisOutput(null);
    setAiMoveExplanationOutput(null);
    setLastMove(null);
    setBoardFenBeforeAiMove(INITIAL_FEN);
    toast({ title: "Game Reset", description: "A new game has started." });
  }, [toast]);

  useEffect(() => {
    resetGame();
  }, [resetGame]);
  
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

  const updateGameStatus = useCallback((currentBoard: Board, currentPlayer: PieceColor) => {
    const kingSquare = findKing(currentBoard, currentPlayer);
    const inCheck = kingSquare ? checkKingInCheck(currentBoard, currentPlayer) : false;
    setIsCheck(inCheck);
    if (inCheck && kingSquare) setKingInCheckSquare(kingSquare); else setKingInCheckSquare(null);

    const mateStatus = isCheckmateOrStalemate(currentBoard, currentPlayer);
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
  }, []);


  const fetchPlayerMoveAnalysis = async (fen: string, currentTurnForFen: PieceColor, playerLastMove: string) => {
    setIsLoadingAi(true);
    setPlayerMoveAnalysisOutput(null);
    setAiMoveExplanationOutput(null);
    setAiHint(undefined);
    try {
      // currentTurnForFen is the AI's turn (the turn *after* the player's move).
      // So, the player who made the last move is the opposite color.
      const playerWhoMadeLastMoveColor = currentTurnForFen === 'w' ? 'b' : 'w';
      
      const result = await aiTutorAnalysis({
        boardState: fen,
        currentTurn: currentTurnForFen, 
        lastPlayerMove: playerLastMove,
        lastMoveMadeByWhite: playerLastMove ? playerWhoMadeLastMoveColor === 'w' : undefined,
        lastMoveMadeByBlack: playerLastMove ? playerWhoMadeLastMoveColor === 'b' : undefined,
      });
      setPlayerMoveAnalysisOutput(result);
    } catch (error) {
      console.error("Error getting player move analysis:", error);
      toast({ title: "Error", description: "Could not fetch player move analysis.", variant: "destructive" });
    }
    // isLoadingAi will be set to false by the AI's turn useEffect or if AI doesn't move.
    // If AI is not supposed to move (e.g. game over), then set it false here.
    if (isCheckmate || isStalemate || currentTurnForFen !== aiColor) {
        setIsLoadingAi(false);
    }
  };

  const processMove = useCallback((fromSq: Square, toSq: Square, promotionPieceSymbol?: PieceSymbol) => {
    if (isCheckmate || isStalemate) return;

    const piece = getPieceAtSquare(board, fromSq);
    if (!piece) return;

    const { newBoard, capturedPiece } = applyMoveLogic(board, fromSq, toSq, promotionPieceSymbol);
    
    const prevTurn = turn;
    const newTurn = turn === 'w' ? 'b' : 'w';
    const newFullMoveNumber = turn === 'b' ? fullMoveNumber + 1 : fullMoveNumber;
    const newHalfMoveClock = (piece.symbol === 'p' || capturedPiece) ? 0 : halfMoveClock + 1;
    
    // TODO: Update castling rights and en passant target properly
    const newCastlingRights = castlingRights; 
    const newEnPassantTarget = null;

    setBoard(newBoard);
    setTurn(newTurn);
    setCastlingRights(newCastlingRights);
    setEnPassantTarget(newEnPassantTarget);
    setHalfMoveClock(newHalfMoveClock);
    setFullMoveNumber(newFullMoveNumber);
    
    const moveNotation = moveToAlgebraic({ from: fromSq, to: toSq, piece: piece.symbol, captured: !!capturedPiece, promotion: promotionPieceSymbol });
    setMoveHistory(prev => [...prev, moveNotation]);
    setLastMove({ from: fromSq, to: toSq });
    
    updateGameStatus(newBoard, newTurn); // Pass newTurn
    setSelectedSquare(null);
    setValidMoves([]);

    const currentFenForAnalysis = boardToFen(newBoard, newTurn, newCastlingRights, newEnPassantTarget, newHalfMoveClock, newFullMoveNumber);

    if (prevTurn === playerColor && newTurn === aiColor && !isCheckmate && !isStalemate) {
      fetchPlayerMoveAnalysis(currentFenForAnalysis, newTurn, moveNotation);
    }

  }, [board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber, isCheckmate, isStalemate, updateGameStatus, playerColor, aiColor, toast]);


  const handleSquareClick = useCallback((square: Square) => {
    if (isCheckmate || isStalemate || turn !== playerColor) return;

    const piece = getPieceAtSquare(board, square);

    if (selectedSquare) {
      if (validMoves.includes(square)) {
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
  
  const fetchAiMoveExplanation = async (fenBeforeCurrentAiMove: string, aiMoveNotationValue: string, currentDifficulty: Difficulty) => {
    // setIsLoadingAi(true); // This is handled by the caller (AI's turn useEffect)
    try {
      const result = await explainMoveHint({
        currentBoardState: fenBeforeCurrentAiMove,
        suggestedMove: aiMoveNotationValue,
        difficultyLevel: currentDifficulty,
      });
      setAiMoveExplanationOutput({ move: aiMoveNotationValue, explanation: result.explanation });
      toast({ title: "AI Move Explained", description: `AI played ${aiMoveNotationValue}`});
    } catch (error) {
      console.error("Error getting AI move explanation:", error);
      toast({ title: "Error", description: "Could not fetch AI move explanation.", variant: "destructive" });
    }
    // setIsLoadingAi(false); // This is handled by the caller
  };


  // AI Opponent's turn
  useEffect(() => {
    if (turn === aiColor && !isCheckmate && !isStalemate) {
      const fenBeforeMove = boardToFen(board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber);
      setBoardFenBeforeAiMove(fenBeforeMove);

      setIsLoadingAi(true);
      // Clear previous AI-specific outputs if player analysis wasn't already doing it
      if (!playerMoveAnalysisOutput) { // if player move analysis is already running, it would have cleared these.
          setAiMoveExplanationOutput(null);
          setAiHint(undefined);
      }


      setTimeout(async () => {
        const aiMove = getRandomAiMove(board, aiColor);
        if (aiMove) {
          const aiPiece = getPieceAtSquare(board, aiMove.from);
          let promotionSymbol: PieceSymbol | undefined = undefined;
          if (aiPiece?.symbol === 'p') {
            const {row: toRow} = squareToCoords(aiMove.to);
            if ((aiPiece.color === 'w' && toRow === 0) || (aiPiece.color === 'b' && toRow === 7)) {
              promotionSymbol = 'q';
            }
          }
          
          const pieceOnTargetSquareBeforeAiMove = getPieceAtSquare(board, aiMove.to);
          const aiMoveNotation = moveToAlgebraic({from: aiMove.from, to: aiMove.to, piece: aiPiece!.symbol, captured: !!pieceOnTargetSquareBeforeAiMove, promotion: promotionSymbol});

          processMove(aiMove.from, aiMove.to, promotionSymbol);
          
          // Fetch explanation for the AI move, using the FEN stored *before* this AI move
          await fetchAiMoveExplanation(fenBeforeMove, aiMoveNotation, difficulty);

        } else {
           // No legal moves for AI. Game might be over. updateGameStatus should have caught this.
           // If not, consider calling updateGameStatus again.
        }
        setIsLoadingAi(false);
      }, 1000);
    } else {
      // If it's not AI's turn or game is over, ensure loading is false if no other AI task is running
      if (turn !== aiColor || isCheckmate || isStalemate) {
        // If player analysis just finished, it might have set isLoadingAi = true.
        // This branch ensures it's false if AI is not supposed to move.
        // However, fetchPlayerMoveAnalysis itself has isLoadingAi = true and might be followed by AI turn.
        // This path is more for when game ends or switches back to player without AI processing.
      }
    }
  }, [turn, aiColor, board, processMove, isCheckmate, isStalemate, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber, difficulty, playerMoveAnalysisOutput, toast]);


  const handleHint = async () => {
    if (isCheckmate || isStalemate) {
      toast({ title: "Game Over", description: "Cannot get a hint when the game is over.", variant: "destructive" });
      return;
    }
    setIsLoadingAi(true);
    setAiHint(undefined); 
    setPlayerMoveAnalysisOutput(null);
    setAiMoveExplanationOutput(null);
    try {
      const hintMove = getRandomAiMove(board, turn); 
      if (!hintMove) {
        toast({ title: "No Hint Available", description: "AI could not find a suitable hint.", variant: "destructive"});
        setIsLoadingAi(false);
        return;
      }
      
      const fen = boardToFen(board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber);
      const pieceBeingMoved = getPieceAtSquare(board, hintMove.from);
      const algebraicNotation = moveToAlgebraic({from: hintMove.from, to: hintMove.to, piece: pieceBeingMoved!.symbol, captured: !!getPieceAtSquare(board, hintMove.to)});
      
      const result = await explainMoveHint({
        currentBoardState: fen,
        suggestedMove: algebraicNotation,
        difficultyLevel: difficulty,
      });
      setAiHint({ move: algebraicNotation, explanation: result.explanation });
      toast({ title: "AI Hint", description: `Suggested move: ${algebraicNotation}`});
    } catch (error) {
      console.error("Error getting AI hint:", error);
      toast({ title: "Error", description: "Could not fetch AI hint.", variant: "destructive" });
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
        isDraw={isStalemate} // isDraw should encompass more than just stalemate in a full game
        winner={winner}
      />

      <div className="flex flex-col md:flex-row gap-4 md:gap-10 mt-4">
        <div className="w-full md:flex-1 flex justify-center items-start p-0 md:p-4">
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
            isLoadingHint={isLoadingAi && !!aiHint} 
            difficulty={difficulty}
            onDifficultyChange={setDifficulty}
          />
          <div className="flex-grow min-h-[200px]">
            <AiTutorPanel 
              hint={aiHint} 
              playerMoveAnalysis={playerMoveAnalysisOutput}
              aiMoveExplanation={aiMoveExplanationOutput}
              isLoading={isLoadingAi} 
            />
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