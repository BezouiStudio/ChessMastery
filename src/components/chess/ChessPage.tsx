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
import { explainMoveHint } from '@/ai/flows/move-hint-explanation';
import { getVagueChessHint } from '@/ai/flows/vague-chess-hint';
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
  const [playerColor] = useState<PieceColor>('w'); // Player is always White for now
  const aiColor = playerColor === 'w' ? 'b' : 'w';

  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false);
  const [aiHint, setAiHint] = useState<{ move?: string; explanation: string; type: 'vague' | 'specific' } | undefined>(undefined);
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2>(0); // 0: none, 1: vague requested, 2: specific requested/shown
  const [highlightedHintSquares, setHighlightedHintSquares] = useState<{ from: Square; to: Square } | null>(null);
  const [isFetchingVagueHint, setIsFetchingVagueHint] = useState<boolean>(false);
  const [isFetchingSpecificHint, setIsFetchingSpecificHint] = useState<boolean>(false);
  
  const [playerMoveAnalysisOutput, setPlayerMoveAnalysisOutput] = useState<AiTutorAnalysisOutput | null>(null);
  const [aiMoveExplanationOutput, setAiMoveExplanationOutput] = useState<{ move: string; explanation: string } | null>(null);
  
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
    setHintLevel(0);
    setHighlightedHintSquares(null);
    setIsFetchingVagueHint(false);
    setIsFetchingSpecificHint(false);

    setPlayerMoveAnalysisOutput(null);
    setAiMoveExplanationOutput(null);
    setLastMove(null);
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

  const updateGameStatus = useCallback((currentBoard: Board, currentPlayer: PieceColor, currentCastlingRights: string, currentEnPassantTarget: string | null) => {
    const kingSquare = findKing(currentBoard, currentPlayer);
    const inCheck = kingSquare ? checkKingInCheck(currentBoard, currentPlayer) : false;
    setIsCheck(inCheck);

    if (inCheck && kingSquare) {
        setKingInCheckSquare(kingSquare);
    } else {
        setKingInCheckSquare(null);
    }
    
    const mateStatus = isCheckmateOrStalemate(currentBoard, currentPlayer, currentCastlingRights, currentEnPassantTarget);

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
    
    setAiHint(undefined); // Clear hints when analysis starts
    setHighlightedHintSquares(null);
    setHintLevel(0);
    setIsFetchingVagueHint(false);
    setIsFetchingSpecificHint(false);

    try {
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
    if (isCheckmate || isStalemate || currentTurnForFen !== aiColor) {
        setIsLoadingAi(false);
    }
  };

  const processMove = useCallback((fromSq: Square, toSq: Square, promotionPieceSymbol?: PieceSymbol) => {
    if (isCheckmate || isStalemate) return;

    const piece = getPieceAtSquare(board, fromSq);
    if (!piece) return;

    const isEnPassantCapture = piece.symbol === 'p' && toSq === enPassantTarget && fromSq !== toSq;

    const { 
        newBoard, 
        capturedPiece: directCapturedPiece, 
        isPromotion, 
        updatedCastlingRights, 
        updatedEnPassantTarget,
        isCastlingKingside,
        isCastlingQueenside 
    } = applyMoveLogic(
        board, 
        fromSq, 
        toSq, 
        castlingRights,
        enPassantTarget,
        promotionPieceSymbol
    );
    
    const prevTurn = turn;
    const newTurn = turn === 'w' ? 'b' : 'w';
    const newFullMoveNumber = turn === 'b' ? fullMoveNumber + 1 : fullMoveNumber;
    const newHalfMoveClock = (piece.symbol === 'p' || !!directCapturedPiece || isEnPassantCapture) ? 0 : halfMoveClock + 1;
    
    setBoard(newBoard);
    setTurn(newTurn);
    setCastlingRights(updatedCastlingRights);
    setEnPassantTarget(updatedEnPassantTarget);
    setHalfMoveClock(newHalfMoveClock);
    setFullMoveNumber(newFullMoveNumber);
    
    const actualCaptured = !!directCapturedPiece || isEnPassantCapture;
    const moveNotation = moveToAlgebraic({ 
        from: fromSq, 
        to: toSq, 
        piece: piece.symbol, 
        captured: actualCaptured, 
        promotion: promotionPieceSymbol,
        boardBeforeMove: board,
        boardAfterMove: newBoard,
        turn: prevTurn,
        isCastlingKingside,
        isCastlingQueenside,
        enPassantTargetOccurred: isEnPassantCapture
    });
    setMoveHistory(prev => [...prev, moveNotation]);
    setLastMove({ from: fromSq, to: toSq });
    
    // Reset hints after player move
    setAiHint(undefined);
    setHintLevel(0);
    setHighlightedHintSquares(null);
    setIsFetchingVagueHint(false);
    setIsFetchingSpecificHint(false);

    updateGameStatus(newBoard, newTurn, updatedCastlingRights, updatedEnPassantTarget);
    setSelectedSquare(null);
    setValidMoves([]);

    const currentFenForAnalysis = boardToFen(newBoard, newTurn, updatedCastlingRights, updatedEnPassantTarget, newHalfMoveClock, newFullMoveNumber);

    if (prevTurn === playerColor && newTurn === aiColor && !isCheckmate && !isStalemate) {
      fetchPlayerMoveAnalysis(currentFenForAnalysis, newTurn, moveNotation);
    } else if (isCheckmate || isStalemate) {
      setIsLoadingAi(false); 
    }

  }, [board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber, isCheckmate, isStalemate, updateGameStatus, playerColor, aiColor, toast]);


  const handleSquareClick = useCallback((square: Square) => {
    if (isCheckmate || isStalemate || turn !== playerColor || isLoadingAi) return;

    const pieceOnClickedSquare = getPieceAtSquare(board, square);

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
        if (pieceOnClickedSquare && pieceOnClickedSquare.color === turn) { 
          setSelectedSquare(square);
          setValidMoves(getLegalMoves(board, square, turn, castlingRights, enPassantTarget));
        } else { 
          setSelectedSquare(null);
          setValidMoves([]);
        }
      }
    } else if (pieceOnClickedSquare && pieceOnClickedSquare.color === turn) { 
      setSelectedSquare(square);
      setValidMoves(getLegalMoves(board, square, turn, castlingRights, enPassantTarget));
    }
  }, [board, selectedSquare, validMoves, turn, playerColor, isCheckmate, isStalemate, processMove, castlingRights, enPassantTarget, isLoadingAi]);

  const handlePromotionSelect = (pieceSymbol: PieceSymbol) => {
    if (pendingMove) {
      processMove(pendingMove.from, pendingMove.to, pieceSymbol);
    }
    setIsPromotionDialogOpen(false);
    setPromotionSquare(null);
    setPendingMove(null);
  };
  
  const fetchAiMoveExplanation = async (fenBeforeCurrentAiMove: string, aiMoveNotationValue: string, currentDifficulty: Difficulty) => {
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
  };


  // AI Opponent's turn
  useEffect(() => {
    if (turn === aiColor && !isCheckmate && !isStalemate) {
      const fenBeforeMove = boardToFen(board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber);
      
      setIsLoadingAi(true);
      // Clear hints and related states if no player analysis is active from previous turn
      if (!playerMoveAnalysisOutput) { 
          setAiMoveExplanationOutput(null); // Clear specific AI move explanation too
          setAiHint(undefined);
          setHighlightedHintSquares(null);
          setHintLevel(0);
          setIsFetchingVagueHint(false);
          setIsFetchingSpecificHint(false);
      } else {
        // Player analysis is active, so AI is responding. Don't clear hints yet,
        // but ensure specific AI move explanation is cleared before fetching new one.
        setAiMoveExplanationOutput(null); 
      }


      setTimeout(async () => {
        const aiMove = getRandomAiMove(board, aiColor, castlingRights, enPassantTarget);
        if (aiMove) {
          const aiPiece = getPieceAtSquare(board, aiMove.from);
          let promotionSymbol: PieceSymbol | undefined = undefined;
          if (aiPiece?.symbol === 'p') {
            const {row: toRow} = squareToCoords(aiMove.to);
            if ((aiPiece.color === 'w' && toRow === 0) || (aiPiece.color === 'b' && toRow === 7)) {
              promotionSymbol = 'q'; 
            }
          }
          
          const isEnPassantCaptureForAi = aiPiece?.symbol === 'p' && aiMove.to === enPassantTarget && aiMove.from !== aiMove.to;
          const directCapturedPieceForAi = getPieceAtSquare(board, aiMove.to);
          const actualCapturedForAi = !!directCapturedPieceForAi || isEnPassantCaptureForAi;

          const {isCastlingKingside, isCastlingQueenside} = applyMoveLogic(board, aiMove.from, aiMove.to, castlingRights, enPassantTarget, promotionSymbol);

          const aiMoveNotation = moveToAlgebraic({
            from: aiMove.from, 
            to: aiMove.to, 
            piece: aiPiece!.symbol, 
            captured: actualCapturedForAi, 
            promotion: promotionSymbol,
            boardBeforeMove: board, 
            boardAfterMove: applyMoveLogic(board, aiMove.from, aiMove.to, castlingRights, enPassantTarget, promotionSymbol).newBoard, 
            turn: aiColor, 
            isCastlingKingside,
            isCastlingQueenside,
            enPassantTargetOccurred: isEnPassantCaptureForAi
          });

          processMove(aiMove.from, aiMove.to, promotionSymbol);
          await fetchAiMoveExplanation(fenBeforeMove, aiMoveNotation, difficulty);
        }
        setIsLoadingAi(false);
      }, 1000);
    }
  }, [turn, aiColor, board, processMove, isCheckmate, isStalemate, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber, difficulty, playerMoveAnalysisOutput, toast]);


  const handleHint = async () => {
    if (isCheckmate || isStalemate || turn !== playerColor) {
      toast({ title: "Hint Unavailable", description: "Cannot get a hint now.", variant: "destructive" });
      return;
    }

    setIsLoadingAi(true);
    // Clear previous player/AI analysis when hint is requested
    if (hintLevel === 0 || hintLevel === 2) {
      setPlayerMoveAnalysisOutput(null);
      setAiMoveExplanationOutput(null);
      setHighlightedHintSquares(null); // Clear old highlights
    }
    

    if (hintLevel === 0 || hintLevel === 2) { // Request Vague Hint
      setIsFetchingVagueHint(true);
      setIsFetchingSpecificHint(false);
      try {
        const fen = boardToFen(board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber);
        const result = await getVagueChessHint({
          currentBoardState: fen,
          currentTurn: turn,
          difficultyLevel: difficulty,
        });
        setAiHint({ explanation: result.vagueHint, type: 'vague' });
        setHintLevel(1);
        toast({ title: "General Tip Provided"});
      } catch (error) {
        console.error("Error getting vague AI hint:", error);
        toast({ title: "Error", description: "Could not fetch general tip.", variant: "destructive" });
        setHintLevel(0); // Reset on error
      }
      setIsFetchingVagueHint(false);
    } else if (hintLevel === 1) { // Request Specific Hint
      setIsFetchingSpecificHint(true);
      setIsFetchingVagueHint(false);
      try {
        const hintMove = getRandomAiMove(board, turn, castlingRights, enPassantTarget); 
        if (!hintMove) {
          toast({ title: "No Hint Available", description: "AI could not find a suitable hint.", variant: "destructive"});
          setIsLoadingAi(false);
          setIsFetchingSpecificHint(false);
          setHintLevel(0); // Reset if no move found
          return;
        }
        
        const fen = boardToFen(board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber);
        const pieceBeingMoved = getPieceAtSquare(board, hintMove.from);
        
        const isEnPassantCaptureForHint = pieceBeingMoved?.symbol === 'p' && hintMove.to === enPassantTarget && hintMove.from !== hintMove.to;
        const directCapturedPieceForHint = getPieceAtSquare(board, hintMove.to);
        const actualCapturedForHint = !!directCapturedPieceForHint || isEnPassantCaptureForHint;

        const {isCastlingKingside, isCastlingQueenside} = applyMoveLogic(board, hintMove.from, hintMove.to, castlingRights, enPassantTarget, undefined);

        const algebraicNotation = moveToAlgebraic({
            from: hintMove.from, 
            to: hintMove.to, 
            piece: pieceBeingMoved!.symbol, 
            captured: actualCapturedForHint,
            boardBeforeMove: board,
            boardAfterMove: applyMoveLogic(board, hintMove.from, hintMove.to, castlingRights, enPassantTarget, undefined).newBoard,
            turn: turn,
            isCastlingKingside,
            isCastlingQueenside,
            enPassantTargetOccurred: isEnPassantCaptureForHint
        });
        
        const result = await explainMoveHint({
          currentBoardState: fen,
          suggestedMove: algebraicNotation,
          difficultyLevel: difficulty,
        });
        setAiHint({ move: algebraicNotation, explanation: result.explanation, type: 'specific' });
        setHighlightedHintSquares({ from: hintMove.from, to: hintMove.to });
        setHintLevel(2);
        toast({ title: "AI Hint", description: `Suggested move: ${algebraicNotation}`});
      } catch (error) {
        console.error("Error getting specific AI hint:", error);
        toast({ title: "Error", description: "Could not fetch specific AI hint.", variant: "destructive" });
        setHintLevel(1); // Revert to allow trying for specific again or getting new vague
      }
      setIsFetchingSpecificHint(false);
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
        isDraw={isStalemate} 
        winner={winner}
      />

      <div className="flex flex-col md:flex-row gap-4 md:gap-6 lg:gap-10 mt-4">
        <div className="w-full md:flex-1 flex justify-center items-start p-0">
          <ChessboardComponent
            board={board}
            onSquareClick={handleSquareClick}
            selectedSquare={selectedSquare}
            validMoves={validMoves}
            lastMove={lastMove}
            isPlayerTurn={turn === playerColor && !isLoadingAi && !isCheckmate && !isStalemate}
            playerColor={playerColor}
            kingInCheckSquare={kingInCheckSquare}
            highlightedHintSquares={highlightedHintSquares}
          />
        </div>

        <aside className="w-full md:w-[22rem] lg:w-[24rem] flex flex-col gap-4">
          <GameControls
            onNewGame={resetGame}
            onHint={handleHint}
            isLoadingHint={isFetchingVagueHint || isFetchingSpecificHint}
            difficulty={difficulty}
            onDifficultyChange={setDifficulty}
            isPlayerTurn={turn === playerColor}
            isGameOver={isCheckmate || isStalemate}
            hintLevel={hintLevel}
          />
          <div className="flex-grow min-h-[250px] md:min-h-[300px]">
            <AiTutorPanel 
              hint={aiHint} 
              playerMoveAnalysis={playerMoveAnalysisOutput}
              aiMoveExplanation={aiMoveExplanationOutput}
              isLoading={isLoadingAi} 
            />
          </div>
          <div className="flex-grow min-h-[150px] md:min-h-[200px]">
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
