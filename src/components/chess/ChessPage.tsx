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

// Duplicating suggestionColorThemes here for ChessPage to use.
// Ideally, this would be in a shared utility file.
const suggestionColorThemes = [
  { 
    name: "Indigo",
    icon: "text-indigo-600 dark:text-indigo-400", 
    bg: "bg-indigo-500/10 dark:bg-indigo-500/20",
    border: "border-indigo-500/30 dark:border-indigo-500/40", 
    selectedBg: "bg-indigo-500/20 dark:bg-indigo-500/30", 
    selectedBorder: "border-indigo-500 dark:border-indigo-400", 
    ring: "ring-indigo-500 dark:ring-indigo-400" 
  },
  { 
    name: "Teal",
    icon: "text-teal-600 dark:text-teal-400", 
    bg: "bg-teal-500/10 dark:bg-teal-500/20", 
    border: "border-teal-500/30 dark:border-teal-500/40", 
    selectedBg: "bg-teal-500/20 dark:bg-teal-500/30", 
    selectedBorder: "border-teal-500 dark:border-teal-400", 
    ring: "ring-teal-500 dark:ring-teal-400" 
  },
  { 
    name: "Amber",
    icon: "text-amber-600 dark:text-amber-400", 
    bg: "bg-amber-500/10 dark:bg-amber-500/20", 
    border: "border-amber-500/30 dark:border-amber-500/40", 
    selectedBg: "bg-amber-500/20 dark:bg-amber-500/30", 
    selectedBorder: "border-amber-500 dark:border-amber-400", 
    ring: "ring-amber-500 dark:ring-amber-400" 
  },
];


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
  const [isLoadingAiTutor, setIsLoadingAiTutor] = useState<boolean>(false); 
  const [isFetchingFullTutorSuggestion, setIsFetchingFullTutorSuggestion] = useState<boolean>(false);


  // AI Tutor state
  const [aiHint, setAiHint] = useState<{ move?: string; explanation: string; type: 'vague' | 'specific', from?: Square, to?: Square } | undefined>(undefined);
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2>(0); 
  const [highlightedHintSquares, setHighlightedHintSquares] = useState<Array<{ from: Square; to: Square }> | { from: Square; to: Square } | null>(null);
  const [playerMoveAnalysis, setPlayerMoveAnalysis] = useState<AiTutorAnalysisOutput | null>(null);
  const [aiMoveExplanationOutput, setAiMoveExplanationOutput] = useState<{ move: string; explanation: string } | null>(null);
  
  // Full Tutoring Mode state
  const [isFullTutoringMode, setIsFullTutoringMode] = useState<boolean>(false);
  const [fullTutorSuggestions, setFullTutorSuggestions] = useState<ExplainMoveHintOutput[] | null>(null);
  const [selectedFullTutorSuggestionIndex, setSelectedFullTutorSuggestionIndex] = useState<number | null>(null);


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

  const clearAiTutorState = useCallback((preserveFullTutorModeHighlights = false) => {
    setAiHint(undefined);
    if (!preserveFullTutorModeHighlights) {
      setHighlightedHintSquares(null);
      setSelectedFullTutorSuggestionIndex(null);
    }
    setHintLevel(0);
    setPlayerMoveAnalysis(null); 
    setAiMoveExplanationOutput(null);
    if (!preserveFullTutorModeHighlights) { 
      setFullTutorSuggestions(null);
    }
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
    
    try {
      const playerWhoMadeLastMoveColor = currentTurnForFen === 'w' ? 'b' : 'w';
      
      const result = await aiTutorAnalysis({
        boardState: fen,
        currentTurn: currentTurnForFen, 
        lastPlayerMove: playerLastMove,
        lastMoveMadeByWhite: playerLastMove ? playerWhoMadeLastMoveColor === 'w' : undefined,
        lastMoveMadeByBlack: playerLastMove ? playerWhoMadeLastMoveColor === 'b' : undefined,
      });
      setPlayerMoveAnalysis(result); 

      const descriptionElements: React.ReactNode[] = [];
      let toastTitle = "Your Move Analyzed";
      
      if (result.playerMoveEvaluation) {
        const qualityMatch = result.playerMoveEvaluation.match(/\*\*(Excellent|Good|Inaccuracy|Mistake|Blunder|Okay|Decent|Solid|Reasonable|Acceptable|Suboptimal|Strong|Optimal|Best)\*\*/i);
        if (qualityMatch && qualityMatch[1]) {
          toastTitle = `Your Move: ${qualityMatch[1]}`;
        }
        
        let evalSnippet = result.playerMoveEvaluation.length > 150 
            ? result.playerMoveEvaluation.substring(0, 150) + "..."
            : result.playerMoveEvaluation;
        
        const goalMatch = result.playerMoveEvaluation.match(/Primary goal achieved: (.*?)\.|Primary goal: (.*?)\.|Key idea: (.*?)\./i);
        if (goalMatch) {
            const goalText = goalMatch[1] || goalMatch[2] || goalMatch[3];
            evalSnippet = `**Goal/Idea:** ${goalText.trim()}. ${evalSnippet}`;
        }

        descriptionElements.push(
            <p key="eval-snippet" className="text-xs line-clamp-5"> {/* Increased line clamp */}
              {parseAndHighlightText(evalSnippet)}
            </p>
        );
      }
      
      if (result.betterPlayerMoveSuggestions && result.betterPlayerMoveSuggestions.length > 0) {
        const suggestion = result.betterPlayerMoveSuggestions[0];
        const betterMoveSnippet = `**Consider:** ${suggestion.move}. ${suggestion.explanation.length > 100 ? suggestion.explanation.substring(0,100) + "..." : suggestion.explanation }`;
        descriptionElements.push(
            <p key="better-move" className="mt-1 text-xs line-clamp-3"> {/* Increased line clamp */}
                {parseAndHighlightText(betterMoveSnippet)}
            </p>
        );
      } else if (result.playerMoveEvaluation) {
        const isPositiveMove = result.playerMoveEvaluation.toLowerCase().includes("excellent") || 
                               result.playerMoveEvaluation.toLowerCase().includes("good") ||
                               result.playerMoveEvaluation.toLowerCase().includes("strong") ||
                               result.playerMoveEvaluation.toLowerCase().includes("optimal") ||
                               result.playerMoveEvaluation.toLowerCase().includes("best");
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
          duration: 20000, // Increased duration
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
    
    clearAiTutorState(isFullTutoringMode); 
    updateGameStatusDisplay(newBoard, newTurn, updatedCastlingRights, updatedEnPassantTarget);
    setSelectedSquare(null);
    setValidMoves([]);

    const currentFenForAnalysis = boardToFen(newBoard, newTurn, updatedCastlingRights, updatedEnPassantTarget, newHalfMoveClock, newFullMoveNumber);

    if (prevTurn === playerColor) {
      fetchPlayerMoveAnalysis(currentFenForAnalysis, newTurn, moveNotation);
    } else {
      setPlayerMoveAnalysis(null);
    }
  }, [
    board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber, 
    updateGameStatusDisplay, playerColor,
    isCheckmate, isStalemate, 
    fetchPlayerMoveAnalysis, saveCurrentStateToHistory, clearAiTutorState, moveHistory,
    isFullTutoringMode 
  ]);

  const handleFullTutoringModeChange = useCallback((enabled: boolean) => {
    setIsFullTutoringMode(enabled);
    if (!enabled) {
      setFullTutorSuggestions(null);
      setHighlightedHintSquares(null); 
      setSelectedFullTutorSuggestionIndex(null);
    }
  }, []);

  const handleDifficultyChange = useCallback((newDiff: Difficulty) => {
    setDifficulty(newDiff);
    clearAiTutorState(); 
  }, [clearAiTutorState]);


  useEffect(() => {
    if (
      isFullTutoringMode &&
      turn === playerColor &&
      !aiHint && 
      !isCheckmate &&
      !isStalemate &&
      !isLoadingAiMove && 
      !isLoadingAiTutor && 
      !isFetchingFullTutorSuggestion
    ) {
      const fetchFullTutorSuggestions = async () => {
        setIsFetchingFullTutorSuggestion(true);
        // If a specific suggestion was selected, clear that selection before fetching new ones
        if (selectedFullTutorSuggestionIndex !== null) {
            setSelectedFullTutorSuggestionIndex(null);
            // highlightedHintSquares will be updated below based on new suggestions
        }

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
            // Only set multi-highlight if no specific tutor suggestion is already selected (which shouldn't happen here due to above clear)
            // and no general aiHint is active
            if (selectedFullTutorSuggestionIndex === null && !aiHint) { 
                const allSuggestionSquares = result.suggestions.map(s => ({
                    from: s.suggestedMoveFromSquare as Square,
                    to: s.suggestedMoveToSquare as Square
                }));
                setHighlightedHintSquares(allSuggestionSquares);
            }
          } else {
            setFullTutorSuggestions(null); 
             // If no suggestions, clear multi-highlights if they were from full tutor
            if (selectedFullTutorSuggestionIndex === null && !aiHint && Array.isArray(highlightedHintSquares)) { 
                 setHighlightedHintSquares(null);
            }
          }
        } catch (error) {
          console.error("Error fetching full tutor suggestions:", error);
          setFullTutorSuggestions(null); 
          if (selectedFullTutorSuggestionIndex === null && !aiHint && Array.isArray(highlightedHintSquares)) { 
              setHighlightedHintSquares(null);
          }
          toast({ title: "Tutor Error", description: "Could not get tutor suggestions.", variant: "destructive" });
        } finally {
          setIsFetchingFullTutorSuggestion(false);
        }
      };
      
      // Fetch if no suggestions or if a specific suggestion isn't selected (implying we need general ones)
      if (!fullTutorSuggestions || fullTutorSuggestions.length === 0 || selectedFullTutorSuggestionIndex === null) {
         fetchFullTutorSuggestions();
      } else if (selectedFullTutorSuggestionIndex !== null && fullTutorSuggestions && fullTutorSuggestions[selectedFullTutorSuggestionIndex]) {
         // A specific suggestion is already selected, ensure its highlight is set
         const selectedSugg = fullTutorSuggestions[selectedFullTutorSuggestionIndex];
         setHighlightedHintSquares({ from: selectedSugg.suggestedMoveFromSquare as Square, to: selectedSugg.suggestedMoveToSquare as Square });
      }
    } else if (!isFullTutoringMode || turn !== playerColor || isCheckmate || isStalemate || aiHint) {
      // Conditions for full tutoring are not met, or a specific hint is active.
      if (fullTutorSuggestions) { 
        setFullTutorSuggestions(null);
      }
      // Clear multi-highlights if they were from full tutor and no aiHint is active
      if (selectedFullTutorSuggestionIndex === null && !aiHint && Array.isArray(highlightedHintSquares)) { 
        setHighlightedHintSquares(null);
      }
       if (selectedFullTutorSuggestionIndex !== null) {
        setSelectedFullTutorSuggestionIndex(null); // Also clear specific selection
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  // `highlightedHintSquares` and `selectedFullTutorSuggestionIndex` are managed by this effect or user interaction.
  }, [
    isFullTutoringMode, turn, playerColor, board, castlingRights, enPassantTarget,
    halfMoveClock, fullMoveNumber, isCheck, difficulty,
    isCheckmate, isStalemate, isLoadingAiMove, isLoadingAiTutor, isFetchingFullTutorSuggestion,
    aiHint, toast, 
    // fullTutorSuggestions // Re-add if direct manipulation outside this effect is needed for it
  ]);

  const handleSelectFullTutorSuggestion = useCallback((suggestion: ExplainMoveHintOutput) => {
    if (!fullTutorSuggestions) return;
    const index = fullTutorSuggestions.findIndex(s => 
        s.suggestedMoveNotation === suggestion.suggestedMoveNotation &&
        s.suggestedMoveFromSquare === suggestion.suggestedMoveFromSquare &&
        s.suggestedMoveToSquare === suggestion.suggestedMoveToSquare
    );

    if (index !== -1) {
        setSelectedFullTutorSuggestionIndex(index);
        setHighlightedHintSquares({ from: suggestion.suggestedMoveFromSquare as Square, to: suggestion.suggestedMoveToSquare as Square });
        setAiHint(undefined); // Clear any generic hint
    }
  }, [fullTutorSuggestions]);


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
    
    clearAiTutorState(); // This will clear fullTutorSuggestions, highlightedHintSquares, selectedFullTutorSuggestionIndex
    setIsFullTutoringMode(false); 

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
      
      // If full tutoring mode was showing suggestions for player, clear them as AI is moving.
      // Preserve other hint states if any.
      if (isFullTutoringMode) {
        setFullTutorSuggestions(null);
        setSelectedFullTutorSuggestionIndex(null);
        if (Array.isArray(highlightedHintSquares)) { // Clear multi-highlights if AI is about to move
          setHighlightedHintSquares(null);
        }
      }


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
            
            const { newBoard: boardAfterAiMoveSim, isCastlingKingside, isCastlingQueenside, capturedPiece: simCapturedPiece } = applyMoveLogic(
              boardBeforeAiMoveForSim, aiMove.from, aiMove.to, castlingRightsBeforeAiMove, enPassantTargetBeforeAiMove, promotionSymbol
            );
            const isEnPassantCaptureForAi = aiPiece?.symbol === 'p' && aiMove.to === enPassantTargetBeforeAiMove && aiMove.from !== aiMove.to;
            const actualCapturedForAi = !!simCapturedPiece || isEnPassantCaptureForAi;

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
        

        if (aiPlayedMoveNotation && !isCheckmate && !isStalemate && !isLoadingAiTutor) { 
          setIsLoadingAiTutor(true);
          try {
             const kingSqForAICheck = findKing(fenToBoard(fenBeforeMove).board, aiColor);
             const aiInCheckBeforeItsMove = kingSqForAICheck ? checkKingInCheck(fenToBoard(fenBeforeMove).board, aiColor) : false;
            
            const explanationResult = await explainMoveHint({
                currentBoardState: fenBeforeMove, 
                currentTurn: aiColor, 
                difficultyLevel: difficulty,
                isPlayerInCheck: aiInCheckBeforeItsMove, 
                numberOfSuggestions: 1
            });
            setAiMoveExplanationOutput({ move: aiPlayedMoveNotation, explanation: explanationResult.explanation });
          } catch (error) {
            console.error("Error fetching AI move explanation:", error);
            // Do not show toast for this, panel will indicate missing explanation if needed
          } finally {
            setIsLoadingAiTutor(false);
          }
        }
      }, 1000);
    }
  // `highlightedHintSquares` removed from deps as it could cause AI move logic to re-trigger if it's an array and its reference changes.
  // It's managed by other states or user interaction.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    turn, aiColor, board, processMove, isCheckmate, isStalemate, 
    castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber, 
    difficulty, toast, isFullTutoringMode,
    isLoadingAiMove, isLoadingAiTutor, isFetchingFullTutorSuggestion, 
    findKing
  ]);


  const handleHint = async () => {
    if (isCheckmate || isStalemate || turn !== playerColor || isLoadingAiMove || isLoadingAiTutor || isFetchingFullTutorSuggestion) {
      toast({ title: "Hint Unavailable", description: "Cannot get a hint now.", variant: "destructive" });
      return;
    }

    setIsLoadingAiTutor(true);
    // If a hint is requested, it takes precedence over full tutor's specific selection visual.
    // Full tutor suggestions themselves (the data) are kept if mode is active, but board highlight changes.
    setSelectedFullTutorSuggestionIndex(null); 
    // If full tutor mode was active and showing multi-highlights, they will be replaced by the specific hint's highlight
    // or cleared for a vague hint. This is handled by setHighlightedHintSquares below.

    if (hintLevel === 0 || hintLevel === 2) { // Reset specific hint highlights when getting a new vague/first hint
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
        setHighlightedHintSquares(null); // No squares for vague hint
        setHintLevel(1);
        toast({ 
            title: "General Tip", 
            description: <p className="text-sm">{parseAndHighlightText(result.vagueHint)}</p>,
            duration: 5000 
        });
      } else if (hintLevel === 1) { 
        const result = await explainMoveHint({ 
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
      if(hintLevel === 0 || hintLevel === 2) setHintLevel(0); else setHintLevel(1); // Revert hint level on error
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

  let selectedHintCustomThemeForBoard: { bgClass: string; ringClass: string } | null = null;
  if (isFullTutoringMode && selectedFullTutorSuggestionIndex !== null && fullTutorSuggestions && fullTutorSuggestions[selectedFullTutorSuggestionIndex]) {
      const theme = suggestionColorThemes[selectedFullTutorSuggestionIndex % suggestionColorThemes.length];
      selectedHintCustomThemeForBoard = { bgClass: theme.bg, ringClass: theme.ring };
  }


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
           className="w-full lg:flex-1 lg:max-w-[calc(100vh-20rem)] xl:max-w-[calc(100vh-18rem)] 2xl:max-w-[calc(100vh-16rem)] 
                     max-w-[98vw] sm:max-w-[95vw] mx-auto lg:mx-0 
                     flex justify-center items-start aspect-square lg:aspect-auto"
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
            selectedHintCustomTheme={selectedHintCustomThemeForBoard}
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
            onDifficultyChange={handleDifficultyChange}
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
              playerMoveAnalysis={playerMoveAnalysis}
              aiMoveExplanation={aiMoveExplanationOutput}
              isLoading={isLoadingAiTutor && !isFetchingFullTutorSuggestion} 
              fullTutorSuggestions={fullTutorSuggestions} 
              isFullTutoringActive={isFullTutoringMode}
              isLoadingFullTutorSuggestion={isFetchingFullTutorSuggestion} 
              onSelectFullTutorSuggestion={handleSelectFullTutorSuggestion}
              highlightedHintSquares={highlightedHintSquares} // Pass this to know which one is "selected" on the panel
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