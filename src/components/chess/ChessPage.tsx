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
import { parseAndHighlightText } from '@/lib/text-parser'; 


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
  const [aiHint, setAiHint] = useState<{ move?: string; explanation: string; type: 'vague' | 'specific' } | undefined>(undefined);
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2>(0); 
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
  
  const findKing = useCallback((b: Board, color: PieceColor): Square | null => {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = b[r][c];
        if (piece && piece.symbol === 'k' && piece.color === color) {
          return coordsToSquare(r, c);
        }
      }
    }
    return null;
  }, []);

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
  }, [findKing]);


  const fetchPlayerMoveAnalysis = useCallback(async (fen: string, currentTurnForFen: PieceColor, playerLastMove: string) => {
    setIsLoadingAi(true);
    setPlayerMoveAnalysisOutput(null);
    // setAiMoveExplanationOutput(null); // Don't clear AI move explanation here
    
    setAiHint(undefined); 
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

      const descriptionElements: React.ReactNode[] = [];
      let toastTitle = "Your Move Analyzed";
      
      if (result.playerMoveEvaluation) {
        const qualityMatch = result.playerMoveEvaluation.match(/\*\*(Excellent|Good|Inaccuracy|Mistake|Blunder)\*\*/i);
        if (qualityMatch && qualityMatch[1]) {
          toastTitle = `Your Move: ${qualityMatch[1]}`;
          descriptionElements.push(
            <p key="eval-snippet" className="text-xs line-clamp-2">
              {parseAndHighlightText(result.playerMoveEvaluation.replace(qualityMatch[0], '').replace(/^[:\s,-]+/, '').trim())}
            </p>
          );
        } else {
           descriptionElements.push(
            <div key="eval-snippet" className="text-xs line-clamp-2"> 
              {parseAndHighlightText(result.playerMoveEvaluation)}
            </div>
           );
        }
      }
      
      if (result.betterPlayerMoveSuggestions && result.betterPlayerMoveSuggestions.length > 0) {
        const suggestion = result.betterPlayerMoveSuggestions[0];
        descriptionElements.push(
            <p key="better-move" className="mt-1 text-xs">
                {parseAndHighlightText(`Consider: **${suggestion.move}**. ${suggestion.explanation.substring(0, 70)}...`)}
            </p>
        );
      } else if (result.playerMoveEvaluation) {
        const isPositiveMove = result.playerMoveEvaluation.toLowerCase().includes("excellent") || result.playerMoveEvaluation.toLowerCase().includes("good");
        if (isPositiveMove) {
            descriptionElements.push(
                <p key="no-better-move" className="mt-1 text-xs">
                    {parseAndHighlightText("This was a strong move!")}
                </p>
            );
        }
      }
      
      descriptionElements.push(<p key="details" className="mt-1.5 text-xs italic text-muted-foreground">Full analysis in AI Tutor panel.</p>);

      toast({ 
        title: toastTitle, 
        description: <div className="space-y-0.5">{descriptionElements}</div>,
        duration: 12000, 
      });

    } catch (error) {
      console.error("Error getting player move analysis:", error);
      toast({ title: "Error", description: "Could not fetch player move analysis.", variant: "destructive" });
    }

    if (isCheckmate || isStalemate || currentTurnForFen !== aiColor) {
        setIsLoadingAi(false);
    }
  }, [aiColor, isCheckmate, isStalemate, toast]);


  const fetchAiMoveExplanation = useCallback(async (fenBeforeCurrentAiMove: string, aiMoveNotationValue: string, currentDifficulty: Difficulty) => {
    try {
      const result = await explainMoveHint({
        currentBoardState: fenBeforeCurrentAiMove,
        suggestedMove: aiMoveNotationValue,
        difficultyLevel: currentDifficulty,
        isPlayerInCheckBeforeHintedMove: checkKingInCheck(fenToBoard(fenBeforeCurrentAiMove).board, aiColor)
      });
      setAiMoveExplanationOutput({ move: aiMoveNotationValue, explanation: result.explanation });
      
      // No toast here for AI move explanation, it appears directly in the panel.
      // User already sees the move on board and history. Panel gives details.

    } catch (error) {
      console.error("Error getting AI move explanation:", error);
      toast({ title: "Error", description: "Could not fetch AI move explanation.", variant: "destructive" });
    }
  }, [aiColor, toast]);

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
    
    setAiHint(undefined);
    setHintLevel(0);
    setHighlightedHintSquares(null);
    setIsFetchingVagueHint(false);
    setIsFetchingSpecificHint(false);

    updateGameStatus(newBoard, newTurn, updatedCastlingRights, updatedEnPassantTarget);
    setSelectedSquare(null);
    setValidMoves([]);

    const currentFenForAnalysis = boardToFen(newBoard, newTurn, updatedCastlingRights, updatedEnPassantTarget, newHalfMoveClock, newFullMoveNumber);

    if (prevTurn === playerColor) {
      fetchPlayerMoveAnalysis(currentFenForAnalysis, newTurn, moveNotation);
      const gameJustEndedAfterPlayerMove = isCheckmateOrStalemate(newBoard, newTurn, updatedCastlingRights, updatedEnPassantTarget) !== null;
      if (gameJustEndedAfterPlayerMove || newTurn !== aiColor) {
          setIsLoadingAi(false);
      }
    } else if (prevTurn === aiColor) { 
        setIsLoadingAi(false);
    }

  }, [
    board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber, 
    updateGameStatus, playerColor, aiColor, toast, 
    isCheckmate, isStalemate, 
    fetchPlayerMoveAnalysis
  ]);

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
  
  useEffect(() => {
    if (turn === aiColor && !isCheckmate && !isStalemate && !isLoadingAi) {
      const fenBeforeMove = boardToFen(board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber);
      const boardBeforeAiMove = board.map(r => [...r]); // Capture board state for notation context
      const castlingRightsBeforeAiMove = castlingRights;
      const enPassantTargetBeforeAiMove = enPassantTarget;


      setIsLoadingAi(true);
      setAiMoveExplanationOutput(null); 

      setTimeout(async () => {
        const aiMove = getRandomAiMove(board, aiColor, castlingRights, enPassantTarget);
        if (aiMove) {
          const aiPiece = getPieceAtSquare(boardBeforeAiMove, aiMove.from);
          let promotionSymbol: PieceSymbol | undefined = undefined;
          if (aiPiece?.symbol === 'p') {
            const {row: toRow} = squareToCoords(aiMove.to);
            if ((aiPiece.color === 'w' && toRow === 0) || (aiPiece.color === 'b' && toRow === 7)) {
              promotionSymbol = 'q'; 
            }
          }
          
          const isEnPassantCaptureForAi = aiPiece?.symbol === 'p' && aiMove.to === enPassantTargetBeforeAiMove && aiMove.from !== aiMove.to;
          const directCapturedPieceForAi = getPieceAtSquare(boardBeforeAiMove, aiMove.to);
          const actualCapturedForAi = !!directCapturedPieceForAi || isEnPassantCaptureForAi;

          // Simulate applying the move to get the board *after* the AI move for notation
          const { newBoard: boardAfterAiMoveSim, isCastlingKingside, isCastlingQueenside, updatedCastlingRights: castlingAfterAi, updatedEnPassantTarget: epAfterAi } = applyMoveLogic(
            boardBeforeAiMove, aiMove.from, aiMove.to, castlingRightsBeforeAiMove, enPassantTargetBeforeAiMove, promotionSymbol
          );
          
          const aiMoveNotation = moveToAlgebraic({
            from: aiMove.from, 
            to: aiMove.to, 
            piece: aiPiece!.symbol, 
            captured: actualCapturedForAi, 
            promotion: promotionSymbol,
            boardBeforeMove: boardBeforeAiMove, 
            boardAfterMove: boardAfterAiMoveSim, 
            turn: aiColor, 
            isCastlingKingside,
            isCastlingQueenside,
            enPassantTargetOccurred: isEnPassantCaptureForAi
          });

          processMove(aiMove.from, aiMove.to, promotionSymbol);
          
          // Check game status based on the *actual* new board state after processMove finishes updating it for the next turn (player's turn)
          // We use boardAfterAiMoveSim for this check as processMove will have advanced the turn.
           const gameStatusAfterAiMove = isCheckmateOrStalemate(boardAfterAiMoveSim, playerColor, castlingAfterAi, epAfterAi);
           if(gameStatusAfterAiMove === null) { 
            await fetchAiMoveExplanation(fenBeforeMove, aiMoveNotation, difficulty);
           } else {
             // If game ended by AI's move, still might want to show explanation if not already loading player analysis
             if (!isLoadingAi) { //isLoadingAI would be true if player analysis is pending
                await fetchAiMoveExplanation(fenBeforeMove, aiMoveNotation, difficulty);
             }
           }
        }
        // Ensure isLoadingAi is set to false *after* all async operations within the timeout are complete
        // If fetchPlayerMoveAnalysis was triggered by processMove for the AI's turn (which it shouldn't),
        // then that would handle its own isLoadingAi.
        // This setIsLoadingAi(false) is for the AI's turn processing itself.
        // If processMove already set isLoadingAi to false because AI's move ended the game, this is fine.
        setIsLoadingAi(false); 
      }, 1000);
    }
  }, [
    turn, aiColor, board, processMove, isCheckmate, isStalemate, 
    castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber, 
    difficulty, isLoadingAi, playerColor,
    fetchAiMoveExplanation 
  ]);


  const handleHint = async () => {
    if (isCheckmate || isStalemate || turn !== playerColor) {
      toast({ title: "Hint Unavailable", description: "Cannot get a hint now.", variant: "destructive" });
      return;
    }

    setIsLoadingAi(true);
    setPlayerMoveAnalysisOutput(null); 
    setAiMoveExplanationOutput(null); 
    if (hintLevel === 0 || hintLevel === 2) { 
        setHighlightedHintSquares(null); 
    }
    
    const fen = boardToFen(board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber);
    const playerCurrentlyInCheck = isCheck; 

    if (hintLevel === 0 || hintLevel === 2) { 
      setIsFetchingVagueHint(true);
      setIsFetchingSpecificHint(false);
      try {
        const result = await getVagueChessHint({
          currentBoardState: fen,
          currentTurn: turn,
          difficultyLevel: difficulty,
          isPlayerInCheck: playerCurrentlyInCheck,
        });
        setAiHint({ explanation: result.vagueHint, type: 'vague' });
        setHintLevel(1);
        toast({ 
            title: "General Tip", 
            description: <p className="text-sm">{parseAndHighlightText(result.vagueHint)}</p>,
            duration: 5000 
        });
      } catch (error) {
        console.error("Error getting vague AI hint:", error);
        toast({ title: "Error", description: "Could not fetch general tip.", variant: "destructive" });
        setHintLevel(0); 
      }
      setIsFetchingVagueHint(false);
    } else if (hintLevel === 1) { 
      setIsFetchingSpecificHint(true);
      setIsFetchingVagueHint(false);
      try {
        const hintMove = getRandomAiMove(board, turn, castlingRights, enPassantTarget); 
        if (!hintMove) {
          toast({ title: "No Hint Available", description: "AI could not find a suitable hint.", variant: "destructive"});
          setIsLoadingAi(false);
          setIsFetchingSpecificHint(false);
          setHintLevel(0); 
          return;
        }
        
        const pieceBeingMoved = getPieceAtSquare(board, hintMove.from);
        
        const isEnPassantCaptureForHint = pieceBeingMoved?.symbol === 'p' && hintMove.to === enPassantTarget && hintMove.from !== hintMove.to;
        const directCapturedPieceForHint = getPieceAtSquare(board, hintMove.to);
        const actualCapturedForHint = !!directCapturedPieceForHint || isEnPassantCaptureForHint;

        const { newBoard: boardAfterHintMove, isCastlingKingside, isCastlingQueenside } = applyMoveLogic(board, hintMove.from, hintMove.to, castlingRights, enPassantTarget, undefined);

        const algebraicNotation = moveToAlgebraic({
            from: hintMove.from, 
            to: hintMove.to, 
            piece: pieceBeingMoved!.symbol, 
            captured: actualCapturedForHint,
            boardBeforeMove: board,
            boardAfterMove: boardAfterHintMove,
            turn: turn,
            isCastlingKingside,
            isCastlingQueenside,
            enPassantTargetOccurred: isEnPassantCaptureForHint
        });
        
        const result = await explainMoveHint({
          currentBoardState: fen,
          suggestedMove: algebraicNotation,
          difficultyLevel: difficulty,
          isPlayerInCheckBeforeHintedMove: playerCurrentlyInCheck,
        });
        setAiHint({ move: algebraicNotation, explanation: result.explanation, type: 'specific' });
        setHighlightedHintSquares({ from: hintMove.from, to: hintMove.to });
        setHintLevel(2);
        
        toast({ 
            title: `Specific Hint: ${algebraicNotation}`, 
            description: <div className="text-xs line-clamp-3">{parseAndHighlightText(result.explanation)}</div>,
            duration: 8000
        });
      } catch (error) {
        console.error("Error getting specific AI hint:", error);
        toast({ title: "Error", description: "Could not fetch specific AI hint.", variant: "destructive" });
        setHintLevel(1); 
      }
      setIsFetchingSpecificHint(false);
    }
    setIsLoadingAi(false);
  };
  

  return (
    <div className="w-full max-w-6xl mx-auto p-1 sm:p-2 md:p-4 flex flex-col">
      <header className="mb-1 sm:mb-2 md:mb-4 text-center">
        <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-primary">ChessMastery</h1>
        <p className="text-xs sm:text-sm md:text-base text-muted-foreground">Hone your chess skills with AI guidance.</p>
      </header>

      <div className="mt-1 sm:mt-2 md:mt-3">
        <GameStatus 
          statusText={gameStatusText} 
          isCheck={isCheck} 
          isCheckmate={isCheckmate} 
          isStalemate={isStalemate} 
          isDraw={isStalemate} 
          winner={winner}
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-2 sm:gap-3 md:gap-4 lg:gap-6 mt-2 sm:mt-3 md:mt-4 flex-grow">
      <div className="w-full lg:flex-shrink-0 lg:flex-grow-0 lg:basis-[calc(min(80vh,100vw-2rem-1rem,500px))] sm:lg:basis-[calc(min(85vh,100vw-22rem-2rem,600px))] xl:lg:basis-[calc(min(90vh,100vw-24rem-2.5rem,700px))] flex justify-center items-start mx-auto max-w-[98vw] sm:max-w-full">
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

        <aside className="w-full lg:w-[20rem] xl:w-[24rem] flex flex-col gap-2 sm:gap-3 md:gap-4 mt-2 sm:mt-3 lg:mt-0">
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
          <div className="flex-grow min-h-[200px] sm:min-h-[250px] md:min-h-[300px] lg:min-h-[calc(50%-0.5rem)]"> {/* Adjusted for consistent sizing */}
            <AiTutorPanel 
              hint={aiHint} 
              playerMoveAnalysis={playerMoveAnalysisOutput}
              aiMoveExplanation={aiMoveExplanationOutput}
              isLoading={isLoadingAi} 
            />
          </div>
          <div className="flex-grow min-h-[120px] sm:min-h-[150px] md:min-h-[180px] lg:min-h-[calc(50%-0.5rem)]"> {/* Adjusted for consistent sizing */}
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
