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
import { explainMoveHint, explainMultipleMoveHints, ExplainMoveHintOutput } from '@/ai/flows/move-hint-explanation';
import { getVagueChessHint } from '@/ai/flows/vague-chess-hint';
import { aiTutorAnalysis, AiTutorAnalysisOutput } from '@/ai/flows/ai-tutor-analysis';
import { useToast } from '@/hooks/use-toast';
import { parseAndHighlightText } from '@/lib/text-parser'; 

const MAX_HISTORY_LENGTH = 50;

interface GameState {
  board: Board;
  turn: PieceColor;
  castlingRights: string;
  enPassantTarget: string | null;
  halfMoveClock: number;
  fullMoveNumber: number;
  currentMoveHistorySnapshot: string[]; 
  moveThatLedToThisStateSquares: { from: Square; to: Square } | null; 
}


const ChessPage: React.FC = () => {
  // Core game state
  const [board, setBoard] = useState<Board>(createInitialBoard());
  const [turn, setTurn] = useState<PieceColor>('w');
  const [castlingRights, setCastlingRights] = useState<string>("KQkq");
  const [enPassantTarget, setEnPassantTarget] = useState<string | null>(null);
  const [halfMoveClock, setHalfMoveClock] = useState<number>(0);
  const [fullMoveNumber, setFullMoveNumber] = useState<number>(1);
  
  // UI and interaction state
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [validMoves, setValidMoves] = useState<Square[]>([]);
  const [moveHistory, setMoveHistory] = useState<string[]>([]); 
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null); 

  // Game status state
  const [gameStatusText, setGameStatusText] = useState<string>("White's Turn");
  const [isCheck, setIsCheck] = useState<boolean>(false);
  const [isCheckmate, setIsCheckmate] = useState<boolean>(false);
  const [isStalemate, setIsStalemate] = useState<boolean>(false);
  const [winner, setWinner] = useState<PieceColor | null>(null);
  const [kingInCheckSquare, setKingInCheckSquare] = useState<Square | null>(null);

  // Player and AI settings
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner');
  const [playerColor] = useState<PieceColor>('w'); 
  const aiColor = playerColor === 'w' ? 'b' : 'w';

  // Loading states
  const [isLoadingAiMove, setIsLoadingAiMove] = useState<boolean>(false);
  const [isLoadingAiTutor, setIsLoadingAiTutor] = useState<boolean>(false); // For manual hints & analysis
  const [isFetchingFullTutorSuggestion, setIsFetchingFullTutorSuggestion] = useState<boolean>(false);


  // AI Tutor state
  const [aiHint, setAiHint] = useState<{ move?: string; explanation: string; type: 'vague' | 'specific', from?: Square, to?: Square } | undefined>(undefined);
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2>(0); 
  const [highlightedHintSquares, setHighlightedHintSquares] = useState<{ from: Square; to: Square } | null>(null);
  const [playerMoveAnalysisOutput, setPlayerMoveAnalysisOutput] = useState<AiTutorAnalysisOutput | null>(null);
  const [aiMoveExplanationOutput, setAiMoveExplanationOutput] = useState<{ move: string; explanation: string } | null>(null);
  
  // Full Tutoring Mode state
  const [isFullTutoringMode, setIsFullTutoringMode] = useState<boolean>(false);
  const [fullTutorSuggestions, setFullTutorSuggestions] = useState<ExplainMoveHintOutput[] | null>(null);

  // Promotion state
  const [isPromotionDialogOpen, setIsPromotionDialogOpen] = useState<boolean>(false);
  const [promotionSquare, setPromotionSquare] = useState<Square | null>(null);
  const [pendingMove, setPendingMove] = useState<{ from: Square, to: Square } | null>(null);

  // History stack for Undo/Redo
  const [gameHistoryStack, setGameHistoryStack] = useState<GameState[]>([]);
  const [historyPointer, setHistoryPointer] = useState<number>(-1);

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

  const updateGameStatusDisplay = useCallback((currentBoard: Board, currentPlayer: PieceColor, currentCastlingRights: string, currentEnPassantTarget: string | null) => {
    const kingSq = findKing(currentBoard, currentPlayer);
    const inCheck = kingSq ? checkKingInCheck(currentBoard, currentPlayer) : false;
    setIsCheck(inCheck);
    setKingInCheckSquare(inCheck && kingSq ? kingSq : null);
    
    const mateStatus = isCheckmateOrStalemate(currentBoard, currentPlayer, currentCastlingRights, currentEnPassantTarget);

    if (mateStatus === 'checkmate') {
      setIsCheckmate(true);
      const gameWinner = currentPlayer === 'w' ? 'b' : 'w';
      setWinner(gameWinner);
      setGameStatusText(`Checkmate! ${gameWinner === 'w' ? 'White' : 'Black'} wins.`);
    } else if (mateStatus === 'stalemate') {
      setIsStalemate(true);
      setWinner(null); // Draw
      setGameStatusText("Stalemate! It's a draw.");
    } else {
      setIsCheckmate(false);
      setIsStalemate(false);
      setWinner(null);
      setGameStatusText(`${currentPlayer === 'w' ? 'White' : 'Black'}'s Turn${inCheck ? ' (Check!)' : ''}`);
    }
  }, [findKing]);

  const clearAiTutorState = useCallback(() => {
    setAiHint(undefined);
    setHighlightedHintSquares(null);
    setHintLevel(0);
    setPlayerMoveAnalysisOutput(null);
    setAiMoveExplanationOutput(null);
    setFullTutorSuggestions(null);
  }, []);


  const saveCurrentStateToHistory = useCallback((moveSquares: {from: Square, to: Square} | null, algebraicMove: string | null) => {
    const currentSnapshot: GameState = {
      board,
      turn,
      castlingRights,
      enPassantTarget,
      halfMoveClock,
      fullMoveNumber,
      currentMoveHistorySnapshot: algebraicMove ? [...moveHistory, algebraicMove] : [...moveHistory],
      moveThatLedToThisStateSquares: moveSquares,
    };

    const newHistoryStack = gameHistoryStack.slice(0, historyPointer + 1);
    newHistoryStack.push(currentSnapshot);

    if (newHistoryStack.length > MAX_HISTORY_LENGTH) {
      newHistoryStack.shift(); 
      setGameHistoryStack(newHistoryStack);
      setHistoryPointer(newHistoryStack.length - 1);
    } else {
      setGameHistoryStack(newHistoryStack);
      setHistoryPointer(newHistoryStack.length - 1);
    }
  }, [board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber, moveHistory, gameHistoryStack, historyPointer]);


  const fetchPlayerMoveAnalysis = useCallback(async (fen: string, currentTurnForFen: PieceColor, playerLastMove: string) => {
    setIsLoadingAiTutor(true);
    setPlayerMoveAnalysisOutput(null); 

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
        const qualityMatch = result.playerMoveEvaluation.match(/\*\*(Excellent|Good|Inaccuracy|Mistake|Blunder|Okay|Decent|Solid|Reasonable|Acceptable|Suboptimal|Strong)\*\*/i);
        if (qualityMatch && qualityMatch[1]) {
          toastTitle = `Your Move: ${qualityMatch[1]}`;
        }
        
        const evalSnippet = result.playerMoveEvaluation.length > 150 
            ? result.playerMoveEvaluation.substring(0, 150) + "..."
            : result.playerMoveEvaluation;
        descriptionElements.push(
            <p key="eval-snippet" className="text-xs line-clamp-3">
              {parseAndHighlightText(evalSnippet)}
            </p>
        );
      }
      
      if (result.betterPlayerMoveSuggestions && result.betterPlayerMoveSuggestions.length > 0) {
        const suggestion = result.betterPlayerMoveSuggestions[0];
        const betterMoveSnippet = `Consider: **${suggestion.move}**. ${suggestion.explanation.length > 100 ? suggestion.explanation.substring(0,100) + "..." : suggestion.explanation }`;
        descriptionElements.push(
            <p key="better-move" className="mt-1 text-xs line-clamp-2">
                {parseAndHighlightText(betterMoveSnippet)}
            </p>
        );
      } else if (result.playerMoveEvaluation) {
        const isPositiveMove = result.playerMoveEvaluation.toLowerCase().includes("excellent") || 
                               result.playerMoveEvaluation.toLowerCase().includes("good") ||
                               result.playerMoveEvaluation.toLowerCase().includes("strong");
        if (isPositiveMove && (!result.betterPlayerMoveSuggestions || result.betterPlayerMoveSuggestions.length === 0)) {
             descriptionElements.push(
                <p key="no-better-move" className="mt-1 text-xs">
                    {parseAndHighlightText("This was a strong move! No clearly better alternatives found.")}
                </p>
            );
        }
      }
      
      if (descriptionElements.length > 0) {
        descriptionElements.push(<p key="details" className="mt-1.5 text-xs italic text-muted-foreground">Full analysis in AI Tutor panel.</p>);
        toast({ 
          title: toastTitle, 
          description: <div className="space-y-0.5">{descriptionElements}</div>,
          duration: 15000, 
        });
      }

    } catch (error) {
      console.error("Error getting player move analysis:", error);
      toast({ title: "Error", description: "Could not fetch player move analysis.", variant: "destructive" });
    } finally {
      setIsLoadingAiTutor(false);
    }
  }, [toast]); 

  const processMove = useCallback((fromSq: Square, toSq: Square, promotionPieceSymbol?: PieceSymbol) => {
    if (isCheckmate || isStalemate) return;

    const piece = getPieceAtSquare(board, fromSq);
    if (!piece) return;
    
    const moveThatLedToThisStateSquares = { from: fromSq, to: toSq };
    const isEnPassantCapture = piece.symbol === 'p' && toSq === enPassantTarget && fromSq !== toSq;

    const { 
        newBoard, 
        capturedPiece: directCapturedPiece, 
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
    
    saveCurrentStateToHistory(moveThatLedToThisStateSquares, moveNotation); 

    setBoard(newBoard);
    setTurn(newTurn);
    setCastlingRights(updatedCastlingRights);
    setEnPassantTarget(updatedEnPassantTarget);
    setHalfMoveClock(newHalfMoveClock);
    setFullMoveNumber(newFullMoveNumber);
    setMoveHistory(prev => [...prev, moveNotation]);
    setLastMove({ from: fromSq, to: toSq });
    
    clearAiTutorState(); 
    updateGameStatusDisplay(newBoard, newTurn, updatedCastlingRights, updatedEnPassantTarget);
    setSelectedSquare(null);
    setValidMoves([]);

    const currentFenForAnalysis = boardToFen(newBoard, newTurn, updatedCastlingRights, updatedEnPassantTarget, newHalfMoveClock, newFullMoveNumber);

    if (prevTurn === playerColor) {
      fetchPlayerMoveAnalysis(currentFenForAnalysis, newTurn, moveNotation);
    }
  }, [
    board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber, 
    updateGameStatusDisplay, playerColor,
    isCheckmate, isStalemate, 
    fetchPlayerMoveAnalysis, saveCurrentStateToHistory, clearAiTutorState, moveHistory 
  ]);

  const handleFullTutoringModeChange = useCallback((enabled: boolean) => {
    setIsFullTutoringMode(enabled);
    if (!enabled) {
      setFullTutorSuggestions(null);
      if (!aiHint) { 
          setHighlightedHintSquares(null);
      }
    }
  }, [aiHint]);


  useEffect(() => {
    if (
      isFullTutoringMode &&
      turn === playerColor &&
      !aiHint && 
      !fullTutorSuggestions && 
      !isCheckmate &&
      !isStalemate &&
      !isLoadingAiMove && 
      !isLoadingAiTutor && 
      !isFetchingFullTutorSuggestion
    ) {
      const fetchFullTutorSuggestions = async () => {
        setIsFetchingFullTutorSuggestion(true);
        const fen = boardToFen(board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber);
        const playerCurrentlyInCheck = isCheck;

        try {
          const result = await explainMultipleMoveHints({
            currentBoardState: fen,
            currentTurn: turn,
            difficultyLevel: difficulty,
            isPlayerInCheck: playerCurrentlyInCheck,
            numberOfSuggestions: 3, 
          });

          if (result.suggestions && result.suggestions.length > 0) {
            setFullTutorSuggestions(result.suggestions);
            const firstSuggestion = result.suggestions[0];
             if (!aiHint) { // Only auto-highlight if no manual hint is active
                setHighlightedHintSquares({ 
                    from: firstSuggestion.suggestedMoveFromSquare as Square, 
                    to: firstSuggestion.suggestedMoveToSquare as Square 
                });
            }
          } else {
            setFullTutorSuggestions(null);
            if (!aiHint) setHighlightedHintSquares(null);
            toast({ title: "Tutor Mode", description: "No specific suggestions found at the moment.", variant: "default" });
          }
        } catch (error) {
          console.error("Error fetching full tutor suggestions:", error);
          setFullTutorSuggestions(null); 
          if (!aiHint) setHighlightedHintSquares(null);
          toast({ title: "Tutor Error", description: "Could not get tutor suggestions.", variant: "destructive" });
        } finally {
          setIsFetchingFullTutorSuggestion(false);
        }
      };
      fetchFullTutorSuggestions();
    } else if (fullTutorSuggestions && (!isFullTutoringMode || turn !== playerColor || isCheckmate || isStalemate || aiHint)) {
      setFullTutorSuggestions(null);
      if (!aiHint) { 
        setHighlightedHintSquares(null);
      }
    }
  }, [
    isFullTutoringMode, turn, playerColor, board, castlingRights, enPassantTarget,
    halfMoveClock, fullMoveNumber, isCheck, difficulty,
    isCheckmate, isStalemate, isLoadingAiMove, isLoadingAiTutor, isFetchingFullTutorSuggestion,
    aiHint, fullTutorSuggestions,
    toast 
  ]);

  const handleSelectFullTutorSuggestion = useCallback((suggestion: ExplainMoveHintOutput) => {
    setHighlightedHintSquares({ from: suggestion.suggestedMoveFromSquare as Square, to: suggestion.suggestedMoveToSquare as Square });
  }, []);


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
    setLastMove(null);
    
    setIsCheck(false);
    setIsCheckmate(false);
    setIsStalemate(false);
    setWinner(null);
    setKingInCheckSquare(null);
    setGameStatusText("White's Turn");
    
    clearAiTutorState();
    setIsFullTutoringMode(false); 
    setFullTutorSuggestions(null); 


    const initialGameState: GameState = {
      board: initial.board,
      turn: initial.turn,
      castlingRights: initial.castling,
      enPassantTarget: initial.enPassant,
      halfMoveClock: initial.halfmove,
      fullMoveNumber: initial.fullmove,
      currentMoveHistorySnapshot: [],
      moveThatLedToThisStateSquares: null,
    };
    setGameHistoryStack([initialGameState]);
    setHistoryPointer(0);
    
    setIsLoadingAiMove(false);
    setIsLoadingAiTutor(false);
    setIsFetchingFullTutorSuggestion(false);
    toast({ title: "Game Reset", description: "A new game has started." });
  }, [toast, clearAiTutorState]);

  useEffect(() => {
    const initial = fenToBoard(INITIAL_FEN);
    const initialGameState: GameState = {
      board: initial.board,
      turn: initial.turn,
      castlingRights: initial.castling,
      enPassantTarget: initial.enPassant,
      halfMoveClock: initial.halfmove,
      fullMoveNumber: initial.fullmove,
      currentMoveHistorySnapshot: [],
      moveThatLedToThisStateSquares: null,
    };
    setGameHistoryStack([initialGameState]);
    setHistoryPointer(0);
    updateGameStatusDisplay(initial.board, initial.turn, initial.castling, initial.enPassant);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    updateGameStatusDisplay(board, turn, castlingRights, enPassantTarget);
  }, [board, turn, castlingRights, enPassantTarget, updateGameStatusDisplay]);
  
  const handleSquareClick = useCallback((square: Square) => {
    if (isCheckmate || isStalemate || turn !== playerColor || isLoadingAiMove || isLoadingAiTutor || isFetchingFullTutorSuggestion) return;

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
  }, [board, selectedSquare, validMoves, turn, playerColor, isCheckmate, isStalemate, processMove, castlingRights, enPassantTarget, isLoadingAiMove, isLoadingAiTutor, isFetchingFullTutorSuggestion]);

  const handlePromotionSelect = (pieceSymbol: PieceSymbol) => {
    if (pendingMove) {
      processMove(pendingMove.from, pendingMove.to, pieceSymbol);
    }
    setIsPromotionDialogOpen(false);
    setPromotionSquare(null);
    setPendingMove(null);
  };
  
  useEffect(() => {
    if (turn === aiColor && !isCheckmate && !isStalemate && !isLoadingAiMove && !isLoadingAiTutor && !isFetchingFullTutorSuggestion) {
      setIsLoadingAiMove(true);
      setAiMoveExplanationOutput(null); 
      setPlayerMoveAnalysisOutput(null); 
      setFullTutorSuggestions(null); 

      const fenBeforeMove = boardToFen(board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber);
      const boardBeforeAiMoveForSim = board.map(r => [...r]); 
      const castlingRightsBeforeAiMove = castlingRights;
      const enPassantTargetBeforeAiMove = enPassantTarget;

      setTimeout(async () => {
        let aiPlayedMoveNotation: string | null = null;
      
        try {
          const aiMove = getRandomAiMove(board, aiColor, castlingRights, enPassantTarget);
          if (aiMove) {
            const aiPiece = getPieceAtSquare(boardBeforeAiMoveForSim, aiMove.from);
            let promotionSymbol: PieceSymbol | undefined = undefined;
            if (aiPiece?.symbol === 'p') {
              const {row: toRow} = squareToCoords(aiMove.to);
              if ((aiPiece.color === 'w' && toRow === 0) || (aiPiece.color === 'b' && toRow === 7)) {
                promotionSymbol = 'q'; 
              }
            }
            
            const { newBoard: boardAfterAiMoveSim, isCastlingKingside, isCastlingQueenside } = applyMoveLogic(
              boardBeforeAiMoveForSim, aiMove.from, aiMove.to, castlingRightsBeforeAiMove, enPassantTargetBeforeAiMove, promotionSymbol
            );
            const isEnPassantCaptureForAi = aiPiece?.symbol === 'p' && aiMove.to === enPassantTargetBeforeAiMove && aiMove.from !== aiMove.to;
            const directCapturedPieceForAi = getPieceAtSquare(boardBeforeAiMoveForSim, aiMove.to); 
            const actualCapturedForAi = !!directCapturedPieceForAi || isEnPassantCaptureForAi;

            aiPlayedMoveNotation = moveToAlgebraic({
              from: aiMove.from, to: aiMove.to, piece: aiPiece!.symbol, captured: actualCapturedForAi, promotion: promotionSymbol,
              boardBeforeMove: boardBeforeAiMoveForSim, boardAfterMove: boardAfterAiMoveSim, turn: aiColor, 
              isCastlingKingside, isCastlingQueenside, enPassantTargetOccurred: isEnPassantCaptureForAi
            });
            
            processMove(aiMove.from, aiMove.to, promotionSymbol); 

          } else {
             console.warn("AI has no legal moves but game is not over. This might be an issue in isCheckmateOrStalemate or getRandomAiMove.");
          }
        } catch (error) {
          console.error("Error during AI physical move execution:", error);
          toast({ title: "AI Error", description: "AI could not make a move.", variant: "destructive" });
        } finally {
          setIsLoadingAiMove(false); 
        }
        
        const localIsCheckmate = isCheckmate; 
        const localIsStalemate = isStalemate; 

        if (aiPlayedMoveNotation && !localIsCheckmate && !localIsStalemate && !isLoadingAiTutor) { 
          setIsLoadingAiTutor(true);
          try {
            // For AI move explanation, we use the single explainMoveHint for its own best move
            const explanationResult = await explainMoveHint({
                currentBoardState: fenBeforeMove, 
                currentTurn: aiColor, 
                difficultyLevel: difficulty,
                isPlayerInCheck: checkKingInCheck(fenToBoard(fenBeforeMove).board, aiColor),
                numberOfSuggestions: 1
            });
            setAiMoveExplanationOutput({ move: aiPlayedMoveNotation, explanation: explanationResult.explanation });
          } catch (error) {
            console.error("Error fetching AI move explanation:", error);
          } finally {
            setIsLoadingAiTutor(false);
          }
        }
      }, 1000);
    }
  }, [
    turn, aiColor, board, processMove, isCheckmate, isStalemate, 
    castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber, 
    difficulty, toast,
    isLoadingAiMove, isLoadingAiTutor, isFetchingFullTutorSuggestion 
  ]);


  const handleHint = async () => {
    if (isCheckmate || isStalemate || turn !== playerColor || isLoadingAiMove || isLoadingAiTutor || isFetchingFullTutorSuggestion) {
      toast({ title: "Hint Unavailable", description: "Cannot get a hint now.", variant: "destructive" });
      return;
    }

    setIsLoadingAiTutor(true);
    setPlayerMoveAnalysisOutput(null); 
    setAiMoveExplanationOutput(null); 
    setFullTutorSuggestions(null); 

    if (hintLevel === 0 || hintLevel === 2) { 
        setHighlightedHintSquares(null); 
    }
    
    const fen = boardToFen(board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber);
    const playerCurrentlyInCheck = isCheck; 

    try {
      if (hintLevel === 0 || hintLevel === 2) { 
        const result = await getVagueChessHint({
          currentBoardState: fen,
          currentTurn: turn,
          difficultyLevel: difficulty,
          isPlayerInCheck: playerCurrentlyInCheck,
        });
        setAiHint({ explanation: result.vagueHint, type: 'vague' });
        setHighlightedHintSquares(null); 
        setHintLevel(1);
        toast({ 
            title: "General Tip", 
            description: <p className="text-sm">{parseAndHighlightText(result.vagueHint)}</p>,
            duration: 5000 
        });
      } else if (hintLevel === 1) { 
        const result = await explainMoveHint({ // Uses the single hint function
          currentBoardState: fen,
          currentTurn: turn,
          difficultyLevel: difficulty,
          isPlayerInCheck: playerCurrentlyInCheck,
          numberOfSuggestions: 1
        });
        setAiHint({ 
            move: result.suggestedMoveNotation, 
            explanation: result.explanation, 
            type: 'specific',
            from: result.suggestedMoveFromSquare as Square,
            to: result.suggestedMoveToSquare as Square
        });
        setHighlightedHintSquares({ from: result.suggestedMoveFromSquare as Square, to: result.suggestedMoveToSquare as Square });
        setHintLevel(2);
        
        toast({ 
            title: `Specific Hint: ${result.suggestedMoveNotation}`, 
            description: <div className="text-xs line-clamp-3">{parseAndHighlightText(result.explanation)}</div>,
            duration: 8000
        });
      }
    } catch (error) {
      console.error("Error getting AI hint:", error);
      toast({ title: "Error", description: "Could not fetch AI hint.", variant: "destructive" });
      if(hintLevel === 0 || hintLevel === 2) setHintLevel(0); else setHintLevel(1);
    } finally {
      setIsLoadingAiTutor(false);
    }
  };
  
  const handleUndo = () => {
    if (historyPointer <= 0) return; 
    
    clearAiTutorState();
    setIsLoadingAiMove(false); 
    setIsLoadingAiTutor(false); 
    setIsFetchingFullTutorSuggestion(false);


    const newPointer = historyPointer - 1;
    setHistoryPointer(newPointer);
    const stateToLoad = gameHistoryStack[newPointer];

    setBoard(stateToLoad.board);
    setTurn(stateToLoad.turn);
    setCastlingRights(stateToLoad.castlingRights);
    setEnPassantTarget(stateToLoad.enPassantTarget);
    setHalfMoveClock(stateToLoad.halfMoveClock);
    setFullMoveNumber(stateToLoad.fullMoveNumber);
    setMoveHistory(stateToLoad.currentMoveHistorySnapshot);
    setLastMove(stateToLoad.moveThatLedToThisStateSquares);

    updateGameStatusDisplay(stateToLoad.board, stateToLoad.turn, stateToLoad.castlingRights, stateToLoad.enPassantTarget);
    setSelectedSquare(null);
    setValidMoves([]);
    toast({title: "Undo", description: "Reverted to previous move."});
  };

  const handleRedo = () => {
    if (historyPointer >= gameHistoryStack.length - 1) return;

    clearAiTutorState();
    setIsLoadingAiMove(false);
    setIsLoadingAiTutor(false);
    setIsFetchingFullTutorSuggestion(false);

    const newPointer = historyPointer + 1;
    setHistoryPointer(newPointer);
    const stateToLoad = gameHistoryStack[newPointer];

    setBoard(stateToLoad.board);
    setTurn(stateToLoad.turn);
    setCastlingRights(stateToLoad.castlingRights);
    setEnPassantTarget(stateToLoad.enPassantTarget);
    setHalfMoveClock(stateToLoad.halfMoveClock);
    setFullMoveNumber(stateToLoad.fullMoveNumber);
    setMoveHistory(stateToLoad.currentMoveHistorySnapshot);
    setLastMove(stateToLoad.moveThatLedToThisStateSquares);
    
    updateGameStatusDisplay(stateToLoad.board, stateToLoad.turn, stateToLoad.castlingRights, stateToLoad.enPassantTarget);
    setSelectedSquare(null);
    setValidMoves([]);
    toast({title: "Redo", description: "Re-applied next move."});
  };

  const canUndo = historyPointer > 0;
  const canRedo = historyPointer < gameHistoryStack.length - 1;
  const combinedAiProcessing = isLoadingAiMove || isLoadingAiTutor || isFetchingFullTutorSuggestion;

  return (
    <div className="w-full max-w-6xl mx-auto p-1 sm:p-2 md:p-4 flex flex-col min-h-screen">
      <header className="mb-1 sm:mb-2 text-center">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-primary">ChessMastery</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">Hone your chess skills with AI guidance.</p>
      </header>

      <div className="mt-1 sm:mt-2">
        <GameStatus 
          statusText={gameStatusText} 
          isCheck={isCheck} 
          isCheckmate={isCheckmate} 
          isStalemate={isStalemate} 
          isDraw={isStalemate} 
          winner={winner}
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-2 sm:gap-3 md:gap-4 mt-2 sm:mt-3 flex-grow items-stretch">
        <div 
          className="w-full lg:max-w-[calc(100vh-16rem)] xl:max-w-[calc(100vh-14rem)] 2xl:max-w-[calc(100vh-12rem)] 
                     max-w-[98vw] sm:max-w-[95vw] mx-auto lg:mx-0 
                     flex justify-center items-start"
        >
          <ChessboardComponent
            board={board}
            onSquareClick={handleSquareClick}
            selectedSquare={selectedSquare}
            validMoves={validMoves}
            lastMove={lastMove}
            isPlayerTurn={turn === playerColor && !combinedAiProcessing}
            playerColor={playerColor}
            kingInCheckSquare={kingInCheckSquare}
            highlightedHintSquares={highlightedHintSquares}
          />
        </div>

        <aside className="w-full lg:w-[22rem] xl:w-[24rem] 2xl:w-[26rem] flex-shrink-0 flex flex-col gap-2 sm:gap-3 mt-2 sm:mt-3 lg:mt-0">
          <GameControls
            onNewGame={resetGame}
            onHint={handleHint}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={canUndo}
            canRedo={canRedo}
            isLoadingHint={isLoadingAiTutor && hintLevel !== 0} 
            difficulty={difficulty}
            onDifficultyChange={(newDiff) => {
              setDifficulty(newDiff);
              clearAiTutorState(); 
            }}
            isPlayerTurn={turn === playerColor}
            isGameOver={isCheckmate || isStalemate}
            hintLevel={hintLevel}
            isAiProcessing={combinedAiProcessing}
            isFullTutoringMode={isFullTutoringMode}
            onFullTutoringModeChange={handleFullTutoringModeChange}
          />
          <div className="flex-grow min-h-[200px] sm:min-h-[250px] md:min-h-[300px] lg:min-h-0 lg:flex-1">
            <AiTutorPanel 
              hint={aiHint} 
              playerMoveAnalysis={playerMoveAnalysisOutput}
              aiMoveExplanation={aiMoveExplanationOutput}
              isLoading={isLoadingAiTutor} // General loading for hints/analysis
              fullTutorSuggestions={fullTutorSuggestions} // Changed from single to multiple
              isFullTutoringActive={isFullTutoringMode}
              isLoadingFullTutorSuggestion={isFetchingFullTutorSuggestion} // Loading specifically for full tutor suggestions
              onSelectFullTutorSuggestion={handleSelectFullTutorSuggestion}
              highlightedHintSquares={highlightedHintSquares}
            />
          </div>
           <div className="flex-grow min-h-[120px] sm:min-h-[150px] md:min-h-[180px] lg:min-h-0 lg:flex-1 max-h-[25vh] lg:max-h-[calc(var(--aside-width)_*_0.6)]">
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
