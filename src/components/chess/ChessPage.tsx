// src/components/chess/ChessPage.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import ChessboardComponent from './ChessboardComponent';
import GameControls from './GameControls';
import MoveHistory from './MoveHistory';
import AiTutorPanel from './AiTutorPanel';
import GameStatus from './GameStatus';
import PromotionDialog from './PromotionDialog';

import {
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
const LOCAL_STORAGE_KEY = 'chessMasteryGameState';

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

interface SavedChessGame {
  board: Board;
  turn: PieceColor;
  castlingRights: string;
  enPassantTarget: string | null;
  halfMoveClock: number;
  fullMoveNumber: number;
  moveHistory: string[];
  lastMove: { from: Square; to: Square } | null;
  difficulty: Difficulty;
  isFullTutoringMode: boolean;
  gameHistoryStack: GameState[];
  historyPointer: number;
  hintLevel: 0 | 1 | 2;
  playerColor: PieceColor;
}


const suggestionColorThemes = [
  {
    name: "Indigo",
    icon: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-500/10 dark:bg-indigo-500/20",
    border: "border-indigo-500/30 dark:border-indigo-500/40",
    selectedBg: "bg-indigo-500/20 dark:bg-indigo-500/30",
    selectedBorder: "border-indigo-500 dark:border-indigo-400",
    ring: "ring-indigo-500 dark:ring-indigo-400",
    boardHighlightBg: "bg-indigo-500/40 dark:bg-indigo-500/50",
    boardHighlightRing: "ring-indigo-500/80 dark:ring-indigo-400/80"
  },
  {
    name: "Teal",
    icon: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-500/10 dark:bg-teal-500/20",
    border: "border-teal-500/30 dark:border-teal-500/40",
    selectedBg: "bg-teal-500/20 dark:bg-teal-500/30",
    selectedBorder: "border-teal-500 dark:border-teal-400",
    ring: "ring-teal-500 dark:ring-teal-400",
    boardHighlightBg: "bg-teal-500/40 dark:bg-teal-500/50",
    boardHighlightRing: "ring-teal-500/80 dark:ring-teal-400/80"
  },
  {
    name: "Amber",
    icon: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10 dark:bg-amber-500/20",
    border: "border-amber-500/30 dark:border-amber-500/40",
    selectedBg: "bg-amber-500/20 dark:bg-amber-500/30",
    selectedBorder: "border-amber-500 dark:border-amber-400",
    ring: "ring-amber-500 dark:ring-amber-400",
    boardHighlightBg: "bg-amber-500/40 dark:bg-amber-500/50",
    boardHighlightRing: "ring-amber-500/80 dark:ring-amber-400/80"
  },
];

const getInitialFenState = () => fenToBoard(INITIAL_FEN);

const getInitialGameStateForHistory = (): GameState => {
  const initial = getInitialFenState();
  return {
    board: initial.board,
    turn: initial.turn,
    castlingRights: initial.castling,
    enPassantTarget: initial.enPassant,
    halfMoveClock: initial.halfmove,
    fullMoveNumber: initial.fullmove,
    currentMoveHistorySnapshot: [],
    moveThatLedToThisStateSquares: null,
  };
};


const ChessPage: React.FC = () => {
  const initialFen = getInitialFenState();
  // Core game state
  const [board, setBoard] = useState<Board>(initialFen.board);
  const [turn, setTurn] = useState<PieceColor>(initialFen.turn);
  const [castlingRights, setCastlingRights] = useState<string>(initialFen.castling);
  const [enPassantTarget, setEnPassantTarget] = useState<string | null>(initialFen.enPassant);
  const [halfMoveClock, setHalfMoveClock] = useState<number>(initialFen.halfmove);
  const [fullMoveNumber, setFullMoveNumber] = useState<number>(initialFen.fullmove);

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
  const [isFetchingFullTutorContent, setIsFetchingFullTutorContent] = useState<boolean>(false);
  const isFetchingFullTutorContentRef = useRef(false);


  // AI Tutor state
  const [aiHint, setAiHint] = useState<{ move?: string; explanation: string; type: 'vague' | 'specific', from?: Square, to?: Square } | undefined>(undefined);
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2>(0);
  const [highlightedHintSquares, setHighlightedHintSquares] = useState<Array<{ from: Square; to: Square, hintIndex?: number }> | { from: Square; to: Square, hintIndex?: number } | null>(null);
  const [playerMoveAnalysis, setPlayerMoveAnalysis] = useState<AiTutorAnalysisOutput | null>(null);
  const [aiMoveExplanationOutput, setAiMoveExplanationOutput] = useState<{ move: string; explanation: string } | null>(null);

  // Full Tutoring Mode state
  const [isFullTutoringMode, setIsFullTutoringMode] = useState<boolean>(false);
  const [fullTutorSuggestions, setFullTutorSuggestions] = useState<ExplainMoveHintOutput[] | null>(null);
  const [fullTutorGeneralTip, setFullTutorGeneralTip] = useState<string | null>(null);
  const [selectedFullTutorSuggestionIndex, setSelectedFullTutorSuggestionIndex] = useState<number | null>(null);


  // Promotion state
  const [isPromotionDialogOpen, setIsPromotionDialogOpen] = useState<boolean>(false);
  const [promotionSquare, setPromotionSquare] = useState<Square | null>(null);
  const [pendingMove, setPendingMove] = useState<{ from: Square, to: Square } | null>(null);

  // History stack for Undo/Redo
  const [gameHistoryStack, setGameHistoryStack] = useState<GameState[]>([getInitialGameStateForHistory()]);
  const [historyPointer, setHistoryPointer] = useState<number>(0);

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

  const clearAiTutorState = useCallback((keepFullTutorModeConfig = false) => {
    setAiHint(undefined);
    setHighlightedHintSquares(null);
    setSelectedFullTutorSuggestionIndex(null);
    setHintLevel(0);
    setPlayerMoveAnalysis(null);
    setAiMoveExplanationOutput(null);
    if (!keepFullTutorModeConfig) {
      setFullTutorSuggestions(null);
      setFullTutorGeneralTip(null);
    }
  }, []);


  const saveCurrentStateToHistory = useCallback((moveSquares: { from: Square, to: Square } | null, algebraicMove: string | null) => {
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
      newHistoryStack.shift(); // Remove oldest state
      setGameHistoryStack(newHistoryStack);
      setHistoryPointer(newHistoryStack.length - 1); // Pointer is now at the end of the shortened array
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
        currentTurn: currentTurnForFen, // AI's turn
        lastPlayerMove: playerLastMove,
        lastMoveMadeByWhite: playerLastMove ? playerWhoMadeLastMoveColor === 'w' : undefined,
        lastMoveMadeByBlack: playerLastMove ? playerWhoMadeLastMoveColor === 'b' : undefined,
        difficultyLevel: difficulty,
      });
      setPlayerMoveAnalysis(result);

      // Enhanced Toast Notification Logic
      const descriptionElements: React.ReactNode[] = [];
      let toastTitle = "Your Move Analyzed";
      let toastDescriptionContent = "";

      if (result.playerMoveEvaluation) {
        const qualityMatch = result.playerMoveEvaluation.match(/\*\*(Brilliant!!|Excellent!|Good|Interesting\!?|Dubious\?!|Inaccuracy\?|Mistake\?|Blunder\(\?\?\)|Okay|Decent|Solid|Reasonable|Acceptable|Suboptimal|Strong|Optimal|Best)\*\*/i);
        if (qualityMatch && qualityMatch[1]) {
          toastTitle = `Your Move: ${qualityMatch[1]}`;
        }
        
        // Get first 1-2 sentences for evaluation, more if short.
        let evalSnippet = result.playerMoveEvaluation;
        const sentences = result.playerMoveEvaluation.split('. ');
        if (sentences.length > 2) {
            evalSnippet = sentences.slice(0, Math.min(3, sentences.length - 1)).join('. ') + '.';
        } else {
           evalSnippet = sentences.slice(0, Math.min(2, sentences.length)).join('. ') + (sentences.length > 1 ? '.' : '');
        }
        if (evalSnippet.length > 250) { // Slightly increased limit
          evalSnippet = evalSnippet.substring(0, 250) + "...";
        }
        toastDescriptionContent += evalSnippet;
      }

      if (result.betterPlayerMoveSuggestions && result.betterPlayerMoveSuggestions.length > 0) {
        const suggestion = result.betterPlayerMoveSuggestions[0]; // Show one best alternative in toast
        let betterMoveText = ` Consider: **${suggestion.move}**. ${suggestion.explanation}`;
        
        // Try to get first sentence of explanation
        const betterMoveSentences = betterMoveText.split('. ');
        if (betterMoveSentences.length > 1) {
            betterMoveText = betterMoveSentences[0] + '.';
        }
        if (betterMoveText.length > 180) { // Increased limit
            betterMoveText = betterMoveText.substring(0, 180) + "...";
        }
        toastDescriptionContent += (toastDescriptionContent ? " " : "") + betterMoveText;

      } else if (result.playerMoveEvaluation) { // Check if the move was good and no alternatives were suggested
         const isPositiveMove = result.playerMoveEvaluation.toLowerCase().includes("excellent") || 
                                result.playerMoveEvaluation.toLowerCase().includes("brilliant") || 
                                result.playerMoveEvaluation.toLowerCase().includes("good") ||
                                result.playerMoveEvaluation.toLowerCase().includes("strong") ||
                                result.playerMoveEvaluation.toLowerCase().includes("optimal") ||
                                result.playerMoveEvaluation.toLowerCase().includes("best");
        if (isPositiveMove && (!result.betterPlayerMoveSuggestions || result.betterPlayerMoveSuggestions.length === 0)) {
            toastDescriptionContent += (toastDescriptionContent ? " " : "") + "This was a strong move! No significantly better alternatives found.";
        }
      }


      if (toastDescriptionContent) {
        descriptionElements.push(
          <p key="analysis-content" className="text-xs line-clamp-5"> 
            {parseAndHighlightText(toastDescriptionContent)}
          </p>
        );
        descriptionElements.push(<p key="details" className="mt-1.5 text-xs italic text-muted-foreground">Full analysis in AI Tutor panel.</p>);
        toast({
          title: toastTitle,
          description: <div className="space-y-0.5">{descriptionElements}</div>,
          duration: 20000, // Extended duration for readability
        });
      }

    } catch (error) {
      console.error("Error getting player move analysis:", error);
       let errorDescription = "Could not fetch player move analysis.";
       if (error instanceof Error && (error.message.includes("parseAndHighlightText") || error.message.includes("Maximum call stack size exceeded"))) {
        // If parsing causes the error, show plain text in panel and a generic error toast.
        // The AiTutorPanel will still attempt to render the raw text.
        errorDescription = "Error displaying analysis. Plain text in panel.";
      }
      toast({ title: "Error", description: errorDescription, variant: "destructive" });
    } finally {
      setIsLoadingAiTutor(false);
    }
  }, [toast, difficulty]);
  
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
      boardBeforeMove: board, // board *before* this move
      boardAfterMove: newBoard, // board *after* this move for check/mate status
      turn: prevTurn, // The player WHO MADE the move
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

    clearAiTutorState(isFullTutoringMode); // Keep full tutor mode config if it's on
    updateGameStatusDisplay(newBoard, newTurn, updatedCastlingRights, updatedEnPassantTarget);
    setSelectedSquare(null);
    setValidMoves([]);

    const currentFenForAnalysis = boardToFen(newBoard, newTurn, updatedCastlingRights, updatedEnPassantTarget, newHalfMoveClock, newFullMoveNumber);
    
    // Fetch analysis only if it was the player's move
    if (prevTurn === playerColor) {
      fetchPlayerMoveAnalysis(currentFenForAnalysis, newTurn, moveNotation);
    } else {
      setPlayerMoveAnalysis(null); // Clear player analysis if it was AI's move
    }
  }, [
    board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber,
    updateGameStatusDisplay, playerColor, 
    isCheckmate, isStalemate, 
    fetchPlayerMoveAnalysis, saveCurrentStateToHistory, clearAiTutorState, moveHistory, isFullTutoringMode
  ]);

  // Load game from localStorage on mount
  useEffect(() => {
    const savedGameJson = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedGameJson) {
      try {
        const savedGame: SavedChessGame = JSON.parse(savedGameJson);
        setBoard(savedGame.board);
        setTurn(savedGame.turn);
        setCastlingRights(savedGame.castlingRights);
        setEnPassantTarget(savedGame.enPassantTarget);
        setHalfMoveClock(savedGame.halfMoveClock);
        setFullMoveNumber(savedGame.fullMoveNumber);
        setMoveHistory(savedGame.moveHistory);
        setLastMove(savedGame.lastMove);
        setDifficulty(savedGame.difficulty);
        setIsFullTutoringMode(savedGame.isFullTutoringMode);
        setGameHistoryStack(savedGame.gameHistoryStack);
        setHistoryPointer(savedGame.historyPointer);
        setHintLevel(savedGame.hintLevel);
        // playerColor is fixed, no need to set from savedGame unless it becomes dynamic

        // updateGameStatusDisplay will be called by its own useEffect based on these new states
        toast({ title: "Game Loaded", description: "Your previous game has been loaded." });
      } catch (error) {
        console.error("Error loading game from localStorage:", error);
        localStorage.removeItem(LOCAL_STORAGE_KEY); // Clear corrupted data
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]); // toast is stable, runs once on mount.

  // Save game to localStorage whenever relevant state changes
  useEffect(() => {
    // Don't save if the component hasn't fully mounted and potentially loaded state
    // This check can be simple; if gameHistoryStack is empty, it's probably not ready to save.
    // However, gameHistoryStack is initialized with one entry.
    // A more robust check might involve a ref like `isInitialLoadCompleteRef`.
    // For now, let's assume saving after any state change post-initialization is fine.

    const gameToSave: SavedChessGame = {
      board,
      turn,
      castlingRights,
      enPassantTarget,
      halfMoveClock,
      fullMoveNumber,
      moveHistory,
      lastMove,
      difficulty,
      isFullTutoringMode,
      gameHistoryStack,
      historyPointer,
      hintLevel,
      playerColor,
    };
    try {
      // Avoid saving if essential parts of game history are missing (e.g., during initial setup quirks)
      if (gameHistoryStack.length > 0 && gameHistoryStack[historyPointer]) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(gameToSave));
      }
    } catch (error) {
      console.error("Error saving game to localStorage:", error);
    }
  }, [
    board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber,
    moveHistory, lastMove, difficulty, isFullTutoringMode, gameHistoryStack,
    historyPointer, hintLevel, playerColor
  ]);


  const handleFullTutoringModeChange = useCallback((enabled: boolean) => {
    setIsFullTutoringMode(enabled);
    if (!enabled) {
      // Clear all full tutor specific states
      setFullTutorSuggestions(null);
      setFullTutorGeneralTip(null);
      setHighlightedHintSquares(null); // Clear all highlights
      setSelectedFullTutorSuggestionIndex(null);
    } else {
      // If enabling, clear regular hint state
      setAiHint(undefined);
      setHintLevel(0);
    }
  }, []);

  const handleDifficultyChange = useCallback((newDiff: Difficulty) => {
    setDifficulty(newDiff);
    clearAiTutorState(); // Clear all AI tutor outputs on difficulty change
  }, [clearAiTutorState]);


  useEffect(() => {
    if (
      isFullTutoringMode &&
      turn === playerColor &&
      !aiHint && // Ensure no regular hint is active
      !isCheckmate &&
      !isStalemate &&
      !isLoadingAiMove && // Not while AI is making its own move
      !isLoadingAiTutor && // Not while any other tutor analysis is loading
      !isFetchingFullTutorContentRef.current // Not while this specific fetch is already in progress
    ) {
      const fetchFullTutorData = async () => {
        isFetchingFullTutorContentRef.current = true; // Set flag before async operation
        setIsFetchingFullTutorContent(true);
        
        // Clear previous full tutor specific UI elements before fetching new ones
        setSelectedFullTutorSuggestionIndex(null);
        setHighlightedHintSquares(null);
        setFullTutorGeneralTip(null);
        setFullTutorSuggestions(null);


        const fen = boardToFen(board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber);
        const playerCurrentlyInCheck = isCheck; // Use the current isCheck state

        try {
          const [vagueHintResult, multipleHintsResult] = await Promise.all([
            getVagueChessHint({
              currentBoardState: fen,
              currentTurn: turn,
              difficultyLevel: difficulty,
              isPlayerInCheck: playerCurrentlyInCheck,
            }),
            explainMultipleMoveHints({
              currentBoardState: fen,
              currentTurn: turn,
              difficultyLevel: difficulty,
              isPlayerInCheck: playerCurrentlyInCheck,
              numberOfSuggestions: 3, // Request 3 suggestions
            })
          ]);

          if (vagueHintResult) {
            setFullTutorGeneralTip(vagueHintResult.vagueHint);
            // Toast for general tip is now handled by GameStatus display
          }

          if (multipleHintsResult.suggestions && multipleHintsResult.suggestions.length > 0) {
            setFullTutorSuggestions(multipleHintsResult.suggestions);
            // Highlight all suggestions initially
            const allSuggestionSquares = multipleHintsResult.suggestions.map((s, index) => ({
              from: s.suggestedMoveFromSquare as Square,
              to: s.suggestedMoveToSquare as Square,
              hintIndex: index // Pass index for theming
            }));
            setHighlightedHintSquares(allSuggestionSquares);
          } else {
            setHighlightedHintSquares(null); // No suggestions, no highlights
          }
        } catch (error) {
          console.error("Error fetching full tutor data:", error);
          setFullTutorGeneralTip(null);
          setFullTutorSuggestions(null);
          setHighlightedHintSquares(null);
          toast({ title: "Tutor Error", description: "Could not get tutor guidance.", variant: "destructive" });
        } finally {
          setIsFetchingFullTutorContent(false);
          isFetchingFullTutorContentRef.current = false; // Reset flag after async operation
        }
      };

      fetchFullTutorData();
      
    } else if (!isFullTutoringMode || turn !== playerColor || isCheckmate || isStalemate || aiHint) {
      // Conditions met to clear full tutor display (e.g., mode off, AI's turn, game over, or regular hint active)
      if (fullTutorGeneralTip) setFullTutorGeneralTip(null);
      if (fullTutorSuggestions) setFullTutorSuggestions(null);
      // Clear highlights if they were from full tutor mode and it's no longer relevant
      if (selectedFullTutorSuggestionIndex !== null || (Array.isArray(highlightedHintSquares) && !aiHint)) {
         setHighlightedHintSquares(null);
         setSelectedFullTutorSuggestionIndex(null);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [
    isFullTutoringMode, turn, playerColor, board, castlingRights, enPassantTarget, 
    halfMoveClock, fullMoveNumber, isCheck, difficulty, 
    isCheckmate, isStalemate, aiHint, toast, 
    // isLoadingAiMove, isLoadingAiTutor are important to prevent re-fetching during other AI activities
    // Not including them directly to avoid loop, managed by isFetchingFullTutorContentRef
  ]);

  const handleSelectFullTutorSuggestion = useCallback((suggestion: ExplainMoveHintOutput) => {
    if (!fullTutorSuggestions) return;
    const index = fullTutorSuggestions.findIndex(s => 
      s.suggestedMoveNotation === suggestion.suggestedMoveNotation &&
      s.suggestedMoveFromSquare === suggestion.suggestedMoveFromSquare &&
      s.suggestedMoveToSquare === suggestion.suggestedMoveToSquare
    );

    if (index !== -1) {
      if (selectedFullTutorSuggestionIndex === index) { // Clicked already selected suggestion
        setSelectedFullTutorSuggestionIndex(null); // Deselect
        // Re-highlight all suggestions
        const allSuggestionSquares = fullTutorSuggestions.map((s, idx) => ({ 
            from: s.suggestedMoveFromSquare as Square, 
            to: s.suggestedMoveToSquare as Square,
            hintIndex: idx 
        }));
        setHighlightedHintSquares(allSuggestionSquares);
      } else { // Clicked a new suggestion
        setSelectedFullTutorSuggestionIndex(index);
        setHighlightedHintSquares({ 
            from: suggestion.suggestedMoveFromSquare as Square, 
            to: suggestion.suggestedMoveToSquare as Square,
            hintIndex: index // Pass index for specific theming
        });
      }
      setAiHint(undefined); // Ensure regular hint is cleared if a tutor suggestion is interacted with
    }
  }, [fullTutorSuggestions, selectedFullTutorSuggestionIndex]);


  const resetGame = useCallback(() => {
    const initial = getInitialFenState();

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

    clearAiTutorState(); // Clears AI tutor info
    setIsFullTutoringMode(false); // Turn off full tutoring mode on reset

    setGameHistoryStack([getInitialGameStateForHistory()]); // Reset history
    setHistoryPointer(0);

    setIsLoadingAiMove(false); // Reset loading flags
    setIsLoadingAiTutor(false);
    setIsFetchingFullTutorContent(false);
    isFetchingFullTutorContentRef.current = false;

    localStorage.removeItem(LOCAL_STORAGE_KEY); // Clear saved game on reset

    toast({ title: "Game Reset", description: "A new game has started." });
  }, [toast, clearAiTutorState]);


  useEffect(() => {
    updateGameStatusDisplay(board, turn, castlingRights, enPassantTarget);
  }, [board, turn, castlingRights, enPassantTarget, updateGameStatusDisplay]);

  const handleSquareClick = useCallback((square: Square) => {
    if (isCheckmate || isStalemate || turn !== playerColor || isLoadingAiMove || isLoadingAiTutor || isFetchingFullTutorContentRef.current) return;

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
      } else { // Clicked on a square not in validMoves
        if (pieceOnClickedSquare && pieceOnClickedSquare.color === turn) { // If clicked own piece, select it
          setSelectedSquare(square);
          setValidMoves(getLegalMoves(board, square, turn, castlingRights, enPassantTarget));
        } else { // Clicked empty or opponent piece (not a valid move target)
          setSelectedSquare(null);
          setValidMoves([]);
        }
      }
    } else if (pieceOnClickedSquare && pieceOnClickedSquare.color === turn) { // No square selected, clicked own piece
      setSelectedSquare(square);
      setValidMoves(getLegalMoves(board, square, turn, castlingRights, enPassantTarget));
    }
  }, [board, selectedSquare, validMoves, turn, playerColor, isCheckmate, isStalemate, processMove, castlingRights, enPassantTarget, isLoadingAiMove, isLoadingAiTutor]);

  const handlePromotionSelect = (pieceSymbol: PieceSymbol) => {
    if (pendingMove) {
      processMove(pendingMove.from, pendingMove.to, pieceSymbol);
    }
    setIsPromotionDialogOpen(false);
    setPromotionSquare(null);
    setPendingMove(null);
  };

  useEffect(() => {
    if (turn === aiColor && !isCheckmate && !isStalemate && !isLoadingAiMove && !isLoadingAiTutor && !isFetchingFullTutorContentRef.current) {
      setIsLoadingAiMove(true);
      setAiMoveExplanationOutput(null); // Clear previous AI move explanation

      if (isFullTutoringMode) { // Clear tutor suggestions if AI is about to move
          setFullTutorSuggestions(null);
          setFullTutorGeneralTip(null);
          setSelectedFullTutorSuggestionIndex(null);
          setHighlightedHintSquares(null);
      }


      const fenBeforeMove = boardToFen(board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber);
      // Simulate the board state accurately for AI move notation and explanation
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
              const { row: toRow } = squareToCoords(aiMove.to);
              if ((aiPiece.color === 'w' && toRow === 0) || (aiPiece.color === 'b' && toRow === 7)) {
                promotionSymbol = 'q'; // Default AI promotion to Queen
              }
            }

            // Get notation *before* calling processMove, using the simulated board state
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
            
            processMove(aiMove.from, aiMove.to, promotionSymbol); // This updates the main board and turn
            
          } else {
            // This case should only occur if the game is already over (checkmate/stalemate),
            // which is handled by the initial checks in this useEffect.
            // If it's reached otherwise, it might indicate an issue.
            console.warn("AI has no legal moves but game is not over. This might be an issue in isCheckmateOrStalemate or getRandomAiMove.");
          }
        } catch (error) {
          console.error("Error during AI physical move execution:", error);
          toast({ title: "AI Error", description: "AI could not make a move.", variant: "destructive" });
        } finally {
          setIsLoadingAiMove(false);
        }

        // Fetch AI move explanation if a move was made and game not over
        // And no other AI tutor task is running
        if (aiPlayedMoveNotation && !isCheckmate && !isStalemate && !isLoadingAiTutor) {
          setIsLoadingAiTutor(true);
          try {
             // Check if AI was in check *before* its move for the hint context
            const kingSqForAICheck = findKing(fenToBoard(fenBeforeMove).board, aiColor);
            const aiInCheckBeforeItsMove = kingSqForAICheck ? checkKingInCheck(fenToBoard(fenBeforeMove).board, aiColor) : false;

            const explanationResult = await explainMoveHint({
              currentBoardState: fenBeforeMove, // FEN *before* AI's move
              currentTurn: aiColor,
              difficultyLevel: difficulty,
              isPlayerInCheck: aiInCheckBeforeItsMove, // Pass AI's check status
              numberOfSuggestions: 1 // Only need explanation for the move AI made
            });
            // Ensure the explanation is for the move AI *actually* played (if random vs. suggested differ)
            // For now, we assume explainMoveHint gives a relevant explanation for the position.
            setAiMoveExplanationOutput({ move: aiPlayedMoveNotation, explanation: explanationResult.explanation });
          } catch (error) {
            console.error("Error fetching AI move explanation:", error);
            // Don't necessarily show a toast here, as the move was made.
            // The panel will just lack the explanation.
          } finally {
            setIsLoadingAiTutor(false);
          }
        }
      }, 1000); // Simulate AI thinking time
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    turn, aiColor, board, processMove, isCheckmate, isStalemate, 
    castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber, 
    difficulty, toast, isFullTutoringMode, 
    // isLoadingAiMove, isLoadingAiTutor not here to avoid loops, managed by ref
    findKing // Added findKing
  ]);


  const handleHint = async () => {
    if (isCheckmate || isStalemate || turn !== playerColor || isLoadingAiMove || isLoadingAiTutor || isFetchingFullTutorContentRef.current) {
      toast({ title: "Hint Unavailable", description: "Cannot get a hint now.", variant: "destructive" });
      return;
    }

    setIsLoadingAiTutor(true);
    if (isFullTutoringMode) { // If full tutoring is on, hints clear its display
        setFullTutorSuggestions(null);
        setFullTutorGeneralTip(null);
        setSelectedFullTutorSuggestionIndex(null);
    }
    if (hintLevel === 0 || hintLevel === 2) { // For vague hint or after specific, reset highlights
        setHighlightedHintSquares(null);
    }


    const fen = boardToFen(board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber);
    const playerCurrentlyInCheck = isCheck; // Use current check state

    try {
      if (hintLevel === 0 || hintLevel === 2) { // Get vague hint
        const result = await getVagueChessHint({
          currentBoardState: fen,
          currentTurn: turn,
          difficultyLevel: difficulty,
          isPlayerInCheck: playerCurrentlyInCheck,
        });
        setAiHint({ explanation: result.vagueHint, type: 'vague' });
        setHighlightedHintSquares(null); // No board highlight for vague hint
        setHintLevel(1); // Next hint will be specific
        toast({ 
          title: "General Tip", 
          description: <p className="text-sm">{parseAndHighlightText(result.vagueHint)}</p>,
          duration: 5000 
        });
      } else if (hintLevel === 1) { // Get specific hint
        const result = await explainMoveHint({
          currentBoardState: fen,
          currentTurn: turn,
          difficultyLevel: difficulty,
          isPlayerInCheck: playerCurrentlyInCheck,
          numberOfSuggestions: 1 // Only need one specific hint
        });
        setAiHint({ 
          move: result.suggestedMoveNotation, 
          explanation: result.explanation, 
          type: 'specific', 
          from: result.suggestedMoveFromSquare as Square, 
          to: result.suggestedMoveToSquare as Square 
        });
        setHighlightedHintSquares({ from: result.suggestedMoveFromSquare as Square, to: result.suggestedMoveToSquare as Square, hintIndex: -1 }); // -1 for default hint color
        setHintLevel(2); // Next hint will be vague again
        
        toast({ 
          title: `Specific Hint: ${result.suggestedMoveNotation}`, 
          description: <div className="text-xs line-clamp-3">{parseAndHighlightText(result.explanation)}</div>,
          duration: 8000 
        });
      }
    } catch (error) {
      console.error("Error getting AI hint:", error);
      toast({ title: "Error", description: "Could not fetch AI hint.", variant: "destructive" });
      // Reset hint level based on where it failed
      if (hintLevel === 0 || hintLevel === 2) setHintLevel(0); else setHintLevel(1);
    } finally {
      setIsLoadingAiTutor(false);
    }
  };

  const handleUndo = () => {
    if (historyPointer <= 0) return; // Can't undo if at the initial state

    // Clear all AI tutor and loading states
    clearAiTutorState();
    setIsLoadingAiMove(false);
    setIsLoadingAiTutor(false);
    setIsFetchingFullTutorContent(false);
    isFetchingFullTutorContentRef.current = false;


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
    toast({ title: "Undo", description: "Reverted to previous move." });
  };

  const handleRedo = () => {
    if (historyPointer >= gameHistoryStack.length - 1) return; // Can't redo if at the latest state

    // Clear all AI tutor and loading states
    clearAiTutorState();
    setIsLoadingAiMove(false);
    setIsLoadingAiTutor(false);
    setIsFetchingFullTutorContent(false);
    isFetchingFullTutorContentRef.current = false;

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
    toast({ title: "Redo", description: "Re-applied next move." });
  };

  const canUndo = historyPointer > 0;
  const canRedo = historyPointer < gameHistoryStack.length - 1;
  const combinedAiProcessing = isLoadingAiMove || isLoadingAiTutor || isFetchingFullTutorContent;

  // Determine custom theme for highlighted hint squares (used by ChessboardComponent)
  let currentSelectedHintThemeForBoard: { bgClass: string; ringClass: string } | null = null;
  if (highlightedHintSquares && !Array.isArray(highlightedHintSquares) && highlightedHintSquares.hintIndex !== undefined) {
    if (highlightedHintSquares.hintIndex === -1) { 
      // This is for the regular "Get Specific Hint" - ChessboardComponent will use its default blue
    } else if (highlightedHintSquares.hintIndex >= 0 && suggestionColorThemes[highlightedHintSquares.hintIndex % suggestionColorThemes.length]) {
      // This is for a selected "Full Tutor Suggestion"
      const theme = suggestionColorThemes[highlightedHintSquares.hintIndex % suggestionColorThemes.length];
      currentSelectedHintThemeForBoard = { bgClass: theme.boardHighlightBg, ringClass: theme.boardHighlightRing };
    }
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
          isDraw={isStalemate} // isDraw is essentially stalemate for now
          winner={winner}
          fullTutorGeneralTip={fullTutorGeneralTip}
          isFullTutoringMode={isFullTutoringMode}
          isPlayerTurn={turn === playerColor && !combinedAiProcessing}
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-2 sm:gap-3 md:gap-4 mt-2 sm:mt-3 flex-grow items-stretch">
        <div
          className="w-full lg:flex-1 lg:max-w-[calc(100vh-20rem)] xl:max-w-[calc(100vh-18rem)] 2xl:max-w-[calc(100vh-16rem)]
                     max-w-[98vw] sm:max-w-[95vw] mx-auto lg:mx-0
                     flex justify-center items-start aspect-square lg:aspect-auto" // Retain aspect-square for mobile consistency
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
            suggestionColorThemes={suggestionColorThemes}
            selectedHintCustomTheme={currentSelectedHintThemeForBoard}
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
            isLoadingHint={isLoadingAiTutor && hintLevel !== 0 && !isFullTutoringMode}
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
              isLoading={isLoadingAiTutor && !isFetchingFullTutorContent} //isLoadingAiTutor is general, isFetchingFullTutorContent is specific
              fullTutorGeneralTip={fullTutorGeneralTip}
              fullTutorSuggestions={fullTutorSuggestions}
              isFullTutoringActive={isFullTutoringMode}
              isLoadingFullTutorContent={isFetchingFullTutorContent}
              onSelectFullTutorSuggestion={handleSelectFullTutorSuggestion}
              highlightedHintSquares={highlightedHintSquares} // Pass all highlighted squares to panel
            />
          </div>
          <div className="flex-grow min-h-[120px] sm:min-h-[150px] md:min-h-[180px] lg:min-h-0 lg:flex-1 max-h-[25vh] lg:max-h-[calc(var(--aside-width)_*_0.6)]"> {/* Use custom prop or calc for max-height */}
            <MoveHistory moves={moveHistory} />
          </div>
        </aside>
      </div>

      <PromotionDialog
        isOpen={isPromotionDialogOpen}
        onSelectPiece={handlePromotionSelect}
        playerColor={playerColor} // Pass playerColor
      />

    </div>
  );
};

export default ChessPage;
