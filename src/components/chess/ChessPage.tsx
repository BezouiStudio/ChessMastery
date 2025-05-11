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
const AI_EXPLANATION_TIMEOUT_MS = 15000; // 15 seconds

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
  const initialFenState = getInitialFenState();
  // Core game state
  const [board, setBoard] = useState<Board>(initialFenState.board);
  const [turn, setTurn] = useState<PieceColor>(initialFenState.turn);
  const [castlingRights, setCastlingRights] = useState<string>(initialFenState.castling);
  const [enPassantTarget, setEnPassantTarget] = useState<string | null>(initialFenState.enPassant);
  const [halfMoveClock, setHalfMoveClock] = useState<number>(initialFenState.halfmove);
  const [fullMoveNumber, setFullMoveNumber] = useState<number>(initialFenState.fullmove);

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
  const aiTurnProcessingLogicRef = useRef(false);


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
    const inCheckStatus = kingSq ? checkKingInCheck(currentBoard, currentPlayer) : false;
    setIsCheck(inCheckStatus);
    setKingInCheckSquare(inCheckStatus && kingSq ? kingSq : null);

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
      setGameStatusText(`${currentPlayer === 'w' ? 'White' : 'Black'}'s Turn${inCheckStatus ? ' (Check!)' : ''}`);
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

  const saveCurrentStateToHistory = useCallback((
      boardForHistory: Board,
      turnForHistory: PieceColor,
      castlingRightsForHistory: string,
      enPassantTargetForHistory: string | null,
      halfMoveClockForHistory: number,
      fullMoveNumberForHistory: number,
      currentMoveHistorySnapshot: string[], // This is move history *before* the current algebraicMove
      algebraicMove: string | null, // The move just made
      moveSquares: { from: Square, to: Square } | null
    ) => {

    const snapshotHistory = algebraicMove ? [...currentMoveHistorySnapshot, algebraicMove] : [...currentMoveHistorySnapshot];

    const currentSnapshot: GameState = {
      board: boardForHistory, // State *after* move for FEN, but board UI will reflect this
      turn: turnForHistory, // Turn *after* move
      castlingRights: castlingRightsForHistory,
      enPassantTarget: enPassantTargetForHistory,
      halfMoveClock: halfMoveClockForHistory,
      fullMoveNumber: fullMoveNumberForHistory,
      currentMoveHistorySnapshot: snapshotHistory, // History *including* the move
      moveThatLedToThisStateSquares: moveSquares, // The from/to squares of the move just made
    };

    setGameHistoryStack(prevStack => {
      const newHistoryBase = prevStack.slice(0, historyPointer + 1);
      const updatedStack = [...newHistoryBase, currentSnapshot];
      // if (updatedStack.length > MAX_HISTORY_LENGTH) {
      //   updatedStack.shift(); // Keep fixed size
      // }
      // setHistoryPointer(updatedStack.length - 1);

      // Limit stack size and adjust pointer if needed
      let finalStack = updatedStack;
      let finalPointer = updatedStack.length - 1;
      if (finalStack.length > MAX_HISTORY_LENGTH) {
          finalStack = finalStack.slice(finalStack.length - MAX_HISTORY_LENGTH);
          finalPointer = finalStack.length - 1; // Pointer is now relative to the new truncated stack
      }
      setHistoryPointer(finalPointer);
      return finalStack;
    });
  }, [historyPointer]);

  const fetchPlayerMoveAnalysis = useCallback(async (fen: string, currentTurnForFen: PieceColor, playerLastMove: string) => {
    setIsLoadingAiTutor(true);
    try {
      const playerWhoMadeLastMoveColor = currentTurnForFen === 'w' ? 'b' : 'w';
      const result = await aiTutorAnalysis({
        boardState: fen,
        currentTurn: currentTurnForFen, // This is AI's turn if player just moved
        lastPlayerMove: playerLastMove,
        lastMoveMadeByWhite: playerLastMove ? playerWhoMadeLastMoveColor === 'w' : undefined,
        lastMoveMadeByBlack: playerLastMove ? playerWhoMadeLastMoveColor === 'b' : undefined,
        difficultyLevel: difficulty,
      });
      setPlayerMoveAnalysis(result);

      let toastTitle = "Your Move Analyzed";
      let toastDescriptionContent = "";

      if (result.playerMoveEvaluation) {
        const qualityMatch = result.playerMoveEvaluation.match(/\*\*(Brilliant!!|Excellent!|Good|Interesting\!?|Dubious\?!|Inaccuracy\?|Mistake\?|Blunder\(\?\?\)|Okay|Decent|Solid|Reasonable|Acceptable|Suboptimal|Strong|Optimal|Best)\*\*/i);
        if (qualityMatch && qualityMatch[1]) {
          toastTitle = `Your Move: ${qualityMatch[1]}`;
        }
        
        let evalSnippet = result.playerMoveEvaluation;
        const sentences = result.playerMoveEvaluation.split('. ');
        if (sentences.length > 2) {
            evalSnippet = sentences.slice(0, Math.min(3, sentences.length -1)).join('. ') + '.';
        } else {
           evalSnippet = sentences.slice(0, Math.min(2, sentences.length)).join('. ') + (sentences.length > 1 ? '.' : '');
        }
        if (evalSnippet.length > 250) { 
          evalSnippet = evalSnippet.substring(0, 250) + "...";
        }
        toastDescriptionContent += evalSnippet;
      }

      if (result.betterPlayerMoveSuggestions && result.betterPlayerMoveSuggestions.length > 0) {
        const suggestion = result.betterPlayerMoveSuggestions[0]; 
        let betterMoveText = ` Better: **${suggestion.move}**. ${suggestion.explanation}`;
        
        const betterMoveSentences = betterMoveText.split('. ');
        if (betterMoveSentences.length > 1) {
            betterMoveText = betterMoveSentences[0] + '.';
        }
        if (betterMoveText.length > 180) { 
            betterMoveText = betterMoveText.substring(0, 180) + "...";
        }
        toastDescriptionContent += (toastDescriptionContent ? "\n" : "") + betterMoveText;

      } else if (result.playerMoveEvaluation) { 
         const isPositiveMove = result.playerMoveEvaluation.toLowerCase().includes("excellent") || 
                                result.playerMoveEvaluation.toLowerCase().includes("brilliant") || 
                                result.playerMoveEvaluation.toLowerCase().includes("good") ||
                                result.playerMoveEvaluation.toLowerCase().includes("strong") ||
                                result.playerMoveEvaluation.toLowerCase().includes("optimal") ||
                                result.playerMoveEvaluation.toLowerCase().includes("best");
        if (isPositiveMove && (!result.betterPlayerMoveSuggestions || result.betterPlayerMoveSuggestions.length === 0)) {
            toastDescriptionContent += (toastDescriptionContent ? "\n" : "") + "This was a strong move! No significantly better alternatives found.";
        }
      }


      if (toastDescriptionContent) {
        const descriptionElements = [
          <div key="analysis-content" className="text-xs max-h-24 overflow-y-auto whitespace-pre-wrap"> 
            {parseAndHighlightText(toastDescriptionContent)}
          </div>,
          <p key="details" className="mt-1.5 text-xs italic text-muted-foreground">Full analysis in AI Tutor panel.</p>
        ];
        toast({
          title: toastTitle,
          description: <div className="space-y-0.5">{descriptionElements}</div>,
          duration: 20000, 
        });
      }

    } catch (error) {
      console.error("Error getting player move analysis:", error);
       let errorDescription = "Could not fetch player move analysis.";
       if (error instanceof Error && (error.message.includes("parseAndHighlightText") || error.message.includes("Maximum call stack size exceeded"))) {
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
  
    const moveSquares = { from: fromSq, to: toSq };
    const isEnPassantCapture = piece.symbol === 'p' && toSq === enPassantTarget && fromSq !== toSq;
  
    const boardBeforeMoveForAlgebraic = board.map(r => [...r]); 
    const currentTurnForAlgebraic = turn;
  
    const {
      newBoard,
      capturedPiece: directCapturedPiece,
      updatedCastlingRights,
      updatedEnPassantTarget,
      isCastlingKingside,
      isCastlingQueenside
    } = applyMoveLogic(
      board, fromSq, toSq, castlingRights, enPassantTarget, promotionPieceSymbol
    );
  
    const newTurn = turn === 'w' ? 'b' : 'w';
    const newFullMoveNumber = turn === 'b' ? fullMoveNumber + 1 : fullMoveNumber;
    const newHalfMoveClock = (piece.symbol === 'p' || !!directCapturedPiece || isEnPassantCapture) ? 0 : halfMoveClock + 1;
  
    const actualCaptured = !!directCapturedPiece || isEnPassantCapture;
    const moveNotation = moveToAlgebraic({
      from: fromSq, to: toSq, piece: piece.symbol, captured: actualCaptured, promotion: promotionPieceSymbol,
      boardBeforeMove: boardBeforeMoveForAlgebraic, boardAfterMove: newBoard, turn: currentTurnForAlgebraic,
      isCastlingKingside, isCastlingQueenside, enPassantTargetOccurred: isEnPassantCapture
    });
    
    saveCurrentStateToHistory(
      newBoard, newTurn, updatedCastlingRights, updatedEnPassantTarget, newHalfMoveClock, newFullMoveNumber,
      moveHistory, 
      moveNotation, moveSquares
    );
  
    setBoard(newBoard);
    setTurn(newTurn);
    setCastlingRights(updatedCastlingRights);
    setEnPassantTarget(updatedEnPassantTarget);
    setHalfMoveClock(newHalfMoveClock);
    setFullMoveNumber(newFullMoveNumber);
    setMoveHistory(prev => [...prev, moveNotation]);
    setLastMove(moveSquares);
  
    clearAiTutorState(isFullTutoringMode);
    updateGameStatusDisplay(newBoard, newTurn, updatedCastlingRights, updatedEnPassantTarget);
    setSelectedSquare(null);
    setValidMoves([]);
  
    const currentFenForAnalysis = boardToFen(newBoard, newTurn, updatedCastlingRights, updatedEnPassantTarget, newHalfMoveClock, newFullMoveNumber);
    
    if (currentTurnForAlgebraic === playerColor) { 
      fetchPlayerMoveAnalysis(currentFenForAnalysis, newTurn, moveNotation);
    } else {
      setPlayerMoveAnalysis(null);
    }
  }, [
    board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber, moveHistory,
    saveCurrentStateToHistory, clearAiTutorState, updateGameStatusDisplay, 
    fetchPlayerMoveAnalysis, playerColor, isFullTutoringMode, 
    isCheckmate, isStalemate 
  ]);

  useEffect(() => {
    let gameLoaded = false;
    try {
        const savedGameJson = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedGameJson) {
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
            
            setGameHistoryStack(savedGame.gameHistoryStack && savedGame.gameHistoryStack.length > 0 ? savedGame.gameHistoryStack : [getInitialGameStateForHistory()]);
            setHistoryPointer(savedGame.historyPointer >= 0 && savedGame.historyPointer < (savedGame.gameHistoryStack?.length || 0) ? savedGame.historyPointer : 0);
            
            setHintLevel(savedGame.hintLevel);
            
            updateGameStatusDisplay(savedGame.board, savedGame.turn, savedGame.castlingRights, savedGame.enPassantTarget);
            toast({ title: "Game Loaded", description: "Your previous game has been loaded." });
            gameLoaded = true;
        }
    } catch (error) {
        console.error("Error loading game from localStorage:", error);
        localStorage.removeItem(LOCAL_STORAGE_KEY); 
    }

    if (!gameLoaded) {
        const initial = getInitialFenState();
        setBoard(initial.board);
        setTurn(initial.turn);
        setCastlingRights(initial.castling);
        setEnPassantTarget(initial.enPassant);
        setHalfMoveClock(initial.halfmove);
        setFullMoveNumber(initial.fullmove);
        updateGameStatusDisplay(initial.board, initial.turn, initial.castling, initial.enPassant);
        setGameHistoryStack([getInitialGameStateForHistory()]);
        setHistoryPointer(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]); // Only run on mount

  useEffect(() => {
    // Only save if it's not the very initial default state (history stack > 1 implies some action has been taken)
    // or if it's the initial state BUT some moves have been made (moveHistory.length > 0).
    // This prevents saving an empty game on first load if no localStorage existed.
    if (gameHistoryStack.length > 1 || (gameHistoryStack.length === 1 && moveHistory.length > 0)) {
      const gameToSave: SavedChessGame = {
        board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber,
        moveHistory, lastMove, difficulty, isFullTutoringMode, gameHistoryStack,
        historyPointer, hintLevel, playerColor,
      };
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(gameToSave));
      } catch (error) {
        console.error("Error saving game to localStorage:", error);
      }
    }
  }, [
    board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber,
    moveHistory, lastMove, difficulty, isFullTutoringMode, gameHistoryStack,
    historyPointer, hintLevel, playerColor
  ]);

  const handleFullTutoringModeChange = useCallback((enabled: boolean) => {
    setIsFullTutoringMode(enabled);
    if (!enabled) {
      setFullTutorSuggestions(null);
      setFullTutorGeneralTip(null);
      setHighlightedHintSquares(null); 
      setSelectedFullTutorSuggestionIndex(null);
      // Keep player move analysis if it exists
    } else {
      setAiHint(undefined); 
      setHintLevel(0);
      // Clear player move analysis when entering full tutor mode,
      // as new analysis will be based on future moves or general board state for player.
      setPlayerMoveAnalysis(null); 
    }
  }, []);

  const handleDifficultyChange = useCallback((newDiff: Difficulty) => {
    setDifficulty(newDiff);
    clearAiTutorState(); 
  }, [clearAiTutorState]);

  useEffect(() => {
    if (
      isFullTutoringMode && turn === playerColor && !aiHint && !isCheckmate && !isStalemate &&
      !isLoadingAiMove && !isLoadingAiTutor && !isFetchingFullTutorContentRef.current 
    ) {
      const fetchFullTutorData = async () => {
        isFetchingFullTutorContentRef.current = true; 
        setIsFetchingFullTutorContent(true);
        
        if (selectedFullTutorSuggestionIndex !== null && fullTutorSuggestions) {
            const currentSelected = fullTutorSuggestions[selectedFullTutorSuggestionIndex];
            if(currentSelected) {
                 setHighlightedHintSquares({ from: currentSelected.suggestedMoveFromSquare as Square, to: currentSelected.suggestedMoveToSquare as Square, hintIndex: selectedFullTutorSuggestionIndex });
            } else {
                 setSelectedFullTutorSuggestionIndex(null);
                 setHighlightedHintSquares(null);
            }
        } else {
            setSelectedFullTutorSuggestionIndex(null);
            setHighlightedHintSquares(null); 
        }
        setFullTutorGeneralTip(null); 
        setFullTutorSuggestions(null); 

        const fen = boardToFen(board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber);
        const playerCurrentlyInCheck = isCheck; 

        try {
          const [vagueHintResult, multipleHintsResult] = await Promise.all([
            getVagueChessHint({
              currentBoardState: fen, currentTurn: turn, difficultyLevel: difficulty, isPlayerInCheck: playerCurrentlyInCheck,
            }),
            explainMultipleMoveHints({
              currentBoardState: fen, currentTurn: turn, difficultyLevel: difficulty, isPlayerInCheck: playerCurrentlyInCheck, numberOfSuggestions: 3, 
            })
          ]);

          if (vagueHintResult) {
            setFullTutorGeneralTip(vagueHintResult.vagueHint);
            toast({
              title: "Tutor's General Tip",
              description: <p className="text-sm">{parseAndHighlightText(vagueHintResult.vagueHint)}</p>,
              duration: 7000,
            });
          }
          if (multipleHintsResult.suggestions && multipleHintsResult.suggestions.length > 0) {
            setFullTutorSuggestions(multipleHintsResult.suggestions);
            if (selectedFullTutorSuggestionIndex === null) {
                const allSuggestionSquares = multipleHintsResult.suggestions.map((s, index) => ({
                from: s.suggestedMoveFromSquare as Square, to: s.suggestedMoveToSquare as Square, hintIndex: index 
                }));
                setHighlightedHintSquares(allSuggestionSquares);
            }
          } else {
             if(selectedFullTutorSuggestionIndex === null) setHighlightedHintSquares(null); 
          }
        } catch (error) {
          console.error("Error fetching full tutor data:", error);
          toast({ title: "Tutor Error", description: "Could not get tutor guidance.", variant: "destructive" });
        } finally {
          setIsFetchingFullTutorContent(false);
          isFetchingFullTutorContentRef.current = false; 
        }
      };
      fetchFullTutorData();
    } else if (!isFullTutoringMode || turn !== playerColor || isCheckmate || isStalemate || aiHint) {
      if (fullTutorGeneralTip) setFullTutorGeneralTip(null);
      if (fullTutorSuggestions) setFullTutorSuggestions(null);
       if (selectedFullTutorSuggestionIndex !== null || (Array.isArray(highlightedHintSquares) && !aiHint)) {
         setHighlightedHintSquares(null);
         setSelectedFullTutorSuggestionIndex(null);
      }
    }
  }, [
    isFullTutoringMode, turn, playerColor, board, castlingRights, enPassantTarget, 
    halfMoveClock, fullMoveNumber, isCheck, difficulty, 
    isCheckmate, isStalemate, aiHint, toast, 
    isLoadingAiMove, isLoadingAiTutor // Added isLoadingAiMove and isLoadingAiTutor as dependencies
  ]);

  const handleSelectFullTutorSuggestion = useCallback((suggestion: ExplainMoveHintOutput) => {
    if (!fullTutorSuggestions) return;
    const index = fullTutorSuggestions.findIndex(s => 
      s.suggestedMoveNotation === suggestion.suggestedMoveNotation &&
      s.suggestedMoveFromSquare === suggestion.suggestedMoveFromSquare &&
      s.suggestedMoveToSquare === suggestion.suggestedMoveToSquare
    );

    if (index !== -1) {
      if (selectedFullTutorSuggestionIndex === index) { 
        setSelectedFullTutorSuggestionIndex(null); 
        const allSuggestionSquares = fullTutorSuggestions.map((s, idx) => ({ 
            from: s.suggestedMoveFromSquare as Square, 
            to: s.suggestedMoveToSquare as Square,
            hintIndex: idx 
        }));
        setHighlightedHintSquares(allSuggestionSquares);
      } else { 
        setSelectedFullTutorSuggestionIndex(index);
        setHighlightedHintSquares({ 
            from: suggestion.suggestedMoveFromSquare as Square, 
            to: suggestion.suggestedMoveToSquare as Square,
            hintIndex: index 
        });
      }
      setAiHint(undefined); 
    }
  }, [fullTutorSuggestions, selectedFullTutorSuggestionIndex]);

  const resetGame = useCallback((showToast = true) => {
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
    updateGameStatusDisplay(initial.board, initial.turn, initial.castling, initial.enPassant); 
    clearAiTutorState(); 
    setIsFullTutoringMode(false); 
    setGameHistoryStack([getInitialGameStateForHistory()]); 
    setHistoryPointer(0);
    setIsLoadingAiMove(false); 
    setIsLoadingAiTutor(false);
    setIsFetchingFullTutorContent(false);
    isFetchingFullTutorContentRef.current = false;
    aiTurnProcessingLogicRef.current = false;

    localStorage.removeItem(LOCAL_STORAGE_KEY); 
    if (showToast) {
      toast({ title: "Game Reset", description: "A new game has started." });
    }
  }, [toast, clearAiTutorState, updateGameStatusDisplay]); 

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
    if (turn === aiColor && !isCheckmate && !isStalemate) {
      if (aiTurnProcessingLogicRef.current) { 
        return; 
      }
      aiTurnProcessingLogicRef.current = true;

      setIsLoadingAiMove(true);
      setAiMoveExplanationOutput(null);

      if (isFullTutoringMode) {
        setFullTutorSuggestions(null);
        setFullTutorGeneralTip(null);
        setSelectedFullTutorSuggestionIndex(null);
        setHighlightedHintSquares(null);
      }

      const fenBeforeAiMove = boardToFen(board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber);
      const boardForSim = board.map(r => [...r]);
      const castlingForSim = castlingRights;
      const epForSim = enPassantTarget;

      setTimeout(async () => {
        let aiPlayedMoveNotation: string | null = null;
        let moveMade = false;
        try {
          const aiMove = getRandomAiMove(boardForSim, aiColor, castlingForSim, epForSim);
          if (aiMove) {
            const aiPiece = getPieceAtSquare(boardForSim, aiMove.from);
            let promotionSymbol: PieceSymbol | undefined = undefined;
            if (aiPiece?.symbol === 'p') {
              const { row: toRow } = squareToCoords(aiMove.to);
              if ((aiPiece.color === 'w' && toRow === 0) || (aiPiece.color === 'b' && toRow === 7)) {
                promotionSymbol = 'q';
              }
            }
            const { newBoard: boardAfterAiMoveSim, isCastlingKingside, isCastlingQueenside, capturedPiece: simCapturedPiece } = applyMoveLogic(
              boardForSim, aiMove.from, aiMove.to, castlingForSim, epForSim, promotionSymbol
            );
            const isEnPassantCaptureForAi = aiPiece?.symbol === 'p' && aiMove.to === epForSim && aiMove.from !== aiMove.to;
            const actualCapturedForAi = !!simCapturedPiece || isEnPassantCaptureForAi;
            aiPlayedMoveNotation = moveToAlgebraic({
                from: aiMove.from, to: aiMove.to, piece: aiPiece!.symbol, captured: actualCapturedForAi, promotion: promotionSymbol,
                boardBeforeMove: boardForSim, boardAfterMove: boardAfterAiMoveSim, turn: aiColor,
                isCastlingKingside, isCastlingQueenside, enPassantTargetOccurred: isEnPassantCaptureForAi
            });
            processMove(aiMove.from, aiMove.to, promotionSymbol); 
            moveMade = true;
          } else {
            console.warn("AI has no legal moves but game is not over.");
          }
        } catch (error) {
          console.error("Error during AI physical move execution:", error);
          toast({ title: "AI Error", description: "AI could not make a physical move.", variant: "destructive" });
        } finally {
          setIsLoadingAiMove(false); 
        }

        if (moveMade && aiPlayedMoveNotation && !isCheckmate && !isStalemate) { 
          setIsLoadingAiTutor(true);
          try {
            const kingSqForAICheck = findKing(fenToBoard(fenBeforeAiMove).board, aiColor);
            const aiInCheckBeforeItsMove = kingSqForAICheck ? checkKingInCheck(fenToBoard(fenBeforeAiMove).board, aiColor) : false;

            const explanationPromise = explainMoveHint({
              currentBoardState: fenBeforeAiMove, currentTurn: aiColor, difficultyLevel: difficulty,
              isPlayerInCheck: aiInCheckBeforeItsMove, numberOfSuggestions: 1
            });
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error("AI explanation timed out")), AI_EXPLANATION_TIMEOUT_MS)
            );
            
            const raceResult = await Promise.race([explanationPromise, timeoutPromise]);

            if (raceResult && typeof raceResult === 'object' && 'explanation' in raceResult) {
                 const explanationResult = raceResult as ExplainMoveHintOutput;
                 setAiMoveExplanationOutput({ move: aiPlayedMoveNotation, explanation: explanationResult.explanation });
            } else {
                console.warn("AI explanation result was not as expected or timed out without error object.");
                 setAiMoveExplanationOutput({ move: aiPlayedMoveNotation, explanation: "Explanation unavailable."});
            }
          } catch (error) {
            console.error("Error or timeout fetching AI move explanation:", error);
            setAiMoveExplanationOutput({ move: aiPlayedMoveNotation, explanation: (error as Error).message.includes("timed out") ? "Explanation timed out." : "Could not get explanation."});
          } finally {
            setIsLoadingAiTutor(false);
          }
        }
      }, 1000); 
    }
  }, [ 
    turn, aiColor, isCheckmate, isStalemate, board, 
    castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber, 
    difficulty, toast, isFullTutoringMode, findKing, processMove
  ]);

  useEffect(() => {
    if (turn === playerColor || isCheckmate || isStalemate) {
      aiTurnProcessingLogicRef.current = false;
      if (isLoadingAiMove) setIsLoadingAiMove(false); 
      if (isLoadingAiTutor && turn === playerColor) setIsLoadingAiTutor(false); 
      if (isCheckmate || isStalemate) {
          if(isFetchingFullTutorContent) setIsFetchingFullTutorContent(false); 
          isFetchingFullTutorContentRef.current = false; 
      }
    }
  }, [turn, playerColor, isCheckmate, isStalemate, isLoadingAiMove, isLoadingAiTutor, isFetchingFullTutorContent]);


  const handleHint = async () => {
    if (isCheckmate || isStalemate || turn !== playerColor || isLoadingAiMove || isLoadingAiTutor || isFetchingFullTutorContentRef.current) {
      toast({ title: "Hint Unavailable", description: "Cannot get a hint now.", variant: "destructive" });
      return;
    }

    setIsLoadingAiTutor(true);
    if (isFullTutoringMode) { 
        setFullTutorSuggestions(null);
        setFullTutorGeneralTip(null);
        setSelectedFullTutorSuggestionIndex(null);
    }
    if (hintLevel === 0 || hintLevel === 2) { 
        setHighlightedHintSquares(null);
    }

    const fen = boardToFen(board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber);
    const playerCurrentlyInCheck = isCheck; 

    try {
      if (hintLevel === 0 || hintLevel === 2) { 
        const result = await getVagueChessHint({
          currentBoardState: fen, currentTurn: turn, difficultyLevel: difficulty, isPlayerInCheck: playerCurrentlyInCheck,
        });
        setAiHint({ explanation: result.vagueHint, type: 'vague' });
        setHighlightedHintSquares(null); 
        setHintLevel(1); 
        toast({ 
          title: "General Tip", description: <p className="text-sm">{parseAndHighlightText(result.vagueHint)}</p>, duration: 5000 
        });
      } else if (hintLevel === 1) { 
        const result = await explainMoveHint({
          currentBoardState: fen, currentTurn: turn, difficultyLevel: difficulty,
          isPlayerInCheck: playerCurrentlyInCheck, numberOfSuggestions: 1 
        });
        setAiHint({ 
          move: result.suggestedMoveNotation, explanation: result.explanation, type: 'specific', 
          from: result.suggestedMoveFromSquare as Square, to: result.suggestedMoveToSquare as Square 
        });
        setHighlightedHintSquares({ from: result.suggestedMoveFromSquare as Square, to: result.suggestedMoveToSquare as Square, hintIndex: -1 }); 
        setHintLevel(2); 
        toast({ 
          title: `Specific Hint: ${result.suggestedMoveNotation}`, 
          description: <div className="text-xs line-clamp-3">{parseAndHighlightText(result.explanation)}</div>, duration: 8000 
        });
      }
    } catch (error) {
      console.error("Error getting AI hint:", error);
      toast({ title: "Error", description: "Could not fetch AI hint.", variant: "destructive" });
      if (hintLevel === 0 || hintLevel === 2) setHintLevel(0); else setHintLevel(1);
    } finally {
      setIsLoadingAiTutor(false);
    }
  };

  const handleUndo = () => {
    if (historyPointer <= 0) return; 

    aiTurnProcessingLogicRef.current = false; 
    clearAiTutorState(isFullTutoringMode); // Pass true to keep full tutor mode active if it was
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
    toast({ title: "Undo", description: "Reverted to previous state." });
  };

  const handleRedo = () => {
    if (historyPointer >= gameHistoryStack.length - 1) return; 

    aiTurnProcessingLogicRef.current = false; 
    clearAiTutorState(isFullTutoringMode);
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
    toast({ title: "Redo", description: "Re-applied next state." });
  };

  const canUndo = historyPointer > 0;
  const canRedo = historyPointer < gameHistoryStack.length - 1;
  const combinedAiProcessing = isLoadingAiMove || isLoadingAiTutor || isFetchingFullTutorContent;

  let currentSelectedHintThemeForBoard: { bgClass: string; ringClass: string } | null = null;
  if (highlightedHintSquares && !Array.isArray(highlightedHintSquares) && highlightedHintSquares.hintIndex !== undefined) {
    if (highlightedHintSquares.hintIndex === -1) { 
      // Standard hint, no specific theme from array
    } else if (highlightedHintSquares.hintIndex >= 0 && suggestionColorThemes[highlightedHintSquares.hintIndex % suggestionColorThemes.length]) {
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
          isDraw={isStalemate} 
          winner={winner}
          fullTutorGeneralTip={fullTutorGeneralTip}
          isFullTutoringMode={isFullTutoringMode}
          isPlayerTurn={turn === playerColor && !combinedAiProcessing}
          isLoadingAi={isLoadingAiMove || (isLoadingAiTutor && turn === aiColor)}
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-2 sm:gap-3 md:gap-4 mt-2 sm:mt-3 flex-grow items-stretch">
         <div
          className="w-full lg:flex-1 lg:max-w-[calc(100vh-15rem)] xl:max-w-[calc(100vh-12rem)] 2xl:max-w-[calc(100vh-10rem)]
                     max-w-[98vw] sm:max-w-[95vw] mx-auto lg:mx-0
                     flex justify-center items-start aspect-square" 
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
            onNewGame={() => resetGame(true)}
            onHint={handleHint}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={canUndo}
            canRedo={canRedo}
            isLoadingHint={isLoadingAiTutor && hintLevel !== 0 && !isFullTutoringMode && turn === playerColor} 
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
              isLoading={isLoadingAiTutor && !isFetchingFullTutorContent} 
              fullTutorGeneralTip={fullTutorGeneralTip}
              fullTutorSuggestions={fullTutorSuggestions}
              isFullTutoringActive={isFullTutoringMode}
              isLoadingFullTutorContent={isFetchingFullTutorContent}
              onSelectFullTutorSuggestion={handleSelectFullTutorSuggestion}
              highlightedHintSquares={highlightedHintSquares} 
            />
          </div>
           <div className="flex-grow min-h-[100px] sm:min-h-[120px] md:min-h-[150px] lg:min-h-0 lg:flex-1 max-h-[20vh] lg:max-h-[calc(var(--aside-width)_*_0.5)]"> 
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
