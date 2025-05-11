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

const MAX_HISTORY_LENGTH = 50;

interface GameState {
  board: Board;
  turn: PieceColor;
  castlingRights: string;
  enPassantTarget: string | null;
  halfMoveClock: number;
  fullMoveNumber: number;
  currentMoveHistorySnapshot: string[]; // Algebraic moves leading to this state
  moveThatLedToThisStateSquares: { from: Square; to: Square } | null; // Physical move squares
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
  const [moveHistory, setMoveHistory] = useState<string[]>([]); // For display
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null); // For highlighting last move

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

  // AI Tutor state
  const [aiHint, setAiHint] = useState<{ move?: string; explanation: string; type: 'vague' | 'specific' } | undefined>(undefined);
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2>(0); 
  const [highlightedHintSquares, setHighlightedHintSquares] = useState<{ from: Square; to: Square } | null>(null);
  const [playerMoveAnalysisOutput, setPlayerMoveAnalysisOutput] = useState<AiTutorAnalysisOutput | null>(null);
  const [aiMoveExplanationOutput, setAiMoveExplanationOutput] = useState<{ move: string; explanation: string } | null>(null);
  
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
  }, []);

  const saveCurrentStateToHistory = useCallback((moveSquares: {from: Square, to: Square} | null, algebraicMove: string | null) => {
    const currentSnapshot: GameState = {
      board,
      turn,
      castlingRights,
      enPassantTarget,
      halfMoveClock,
      fullMoveNumber,
      currentMoveHistorySnapshot: algebraicMove ? [...moveHistory, algebraicMove] : [...moveHistory], // Add the new move if one was made
      moveThatLedToThisStateSquares: moveSquares,
    };

    const newHistoryStack = gameHistoryStack.slice(0, historyPointer + 1);
    newHistoryStack.push(currentSnapshot);

    if (newHistoryStack.length > MAX_HISTORY_LENGTH) {
      newHistoryStack.shift(); // Remove the oldest state
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
    // setAiHint(undefined);  // Don't clear hint if it was just a player move
    // setHighlightedHintSquares(null);
    // setHintLevel(0);

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
        }
        descriptionElements.push(
            <p key="eval-snippet" className="text-xs line-clamp-2">
              {parseAndHighlightText(result.playerMoveEvaluation.substring(0,150) + (result.playerMoveEvaluation.length > 150 ? "..." : ""))}
            </p>
        );
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
        if (isPositiveMove && (!result.betterPlayerMoveSuggestions || result.betterPlayerMoveSuggestions.length === 0)) {
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
    } finally {
      setIsLoadingAiTutor(false);
    }
  }, [toast]); 

  const fetchAiMoveExplanation = useCallback(async (fenBeforeCurrentAiMove: string, aiMoveNotationValue: string, currentDifficulty: Difficulty) => {
    setAiMoveExplanationOutput(null);
    try {
      const result = await explainMoveHint({ // Using explainMoveHint to explain the AI's own move
        currentBoardState: fenBeforeCurrentAiMove,
        currentTurn: aiColor, // AI's turn when it made the move
        difficultyLevel: currentDifficulty,
      });
      // The flow now suggests a move, but here we are explaining an ALREADY MADE AI move.
      // This is a slight misuse. Ideally, a different flow or prompt for "explain this specific move".
      // For now, let's assume the AI can explain the `aiMoveNotationValue` if we give it the context.
      // Better: modify `explainMoveHint` to take an optional `moveToExplain` and if present, explains that.
      // Or a new simple flow `getExplanationForSpecificMove(fen, move, turn)`
      // For now, we will use the existing `explainMoveHint` as if we are asking for a hint but the AI already made one.
      // This will result in `aiMoveExplanationOutput.move` being the AI's *suggestion from that state*, not necessarily `aiMoveNotationValue`.
      // This part needs refinement for accurate AI move explanation.
      // Let's simplify: for AI move explanation, we use a simpler prompt or a dedicated flow if this becomes problematic.
      // For now, we'll just take the explanation part of the *hint* it would have given for its own move.
      setAiMoveExplanationOutput({ move: aiMoveNotationValue, explanation: result.explanation });


    } catch (error) {
      console.error("Error getting AI move explanation:", error);
      toast({ title: "Error", description: "Could not fetch AI move explanation.", variant: "destructive" });
    }
  }, [aiColor, toast]);


  const processMove = useCallback((fromSq: Square, toSq: Square, promotionPieceSymbol?: PieceSymbol) => {
    if (isCheckmate || isStalemate) return;

    const piece = getPieceAtSquare(board, fromSq);
    if (!piece) return;
    
    // Save state BEFORE applying the move for history
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
    
    setBoard(newBoard);
    setTurn(newTurn);
    setCastlingRights(updatedCastlingRights);
    setEnPassantTarget(updatedEnPassantTarget);
    setHalfMoveClock(newHalfMoveClock);
    setFullMoveNumber(newFullMoveNumber);
    setMoveHistory(prev => [...prev, moveNotation]);
    setLastMove({ from: fromSq, to: toSq });
    
    saveCurrentStateToHistory(moveThatLedToThisStateSquares, moveNotation);
    
    clearAiTutorState(); // Clear previous hints/analysis
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
    fetchPlayerMoveAnalysis, saveCurrentStateToHistory, clearAiTutorState, moveHistory // Added dependencies
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
    setLastMove(null);
    
    setIsCheck(false);
    setIsCheckmate(false);
    setIsStalemate(false);
    setWinner(null);
    setKingInCheckSquare(null);
    setGameStatusText("White's Turn");
    
    clearAiTutorState();

    // Initialize history
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
    toast({ title: "Game Reset", description: "A new game has started." });
  }, [toast, clearAiTutorState]);

  useEffect(() => {
    resetGame();
  }, [resetGame]); // Ensure resetGame is stable or memoized correctly if it causes re-runs
  
  const handleSquareClick = useCallback((square: Square) => {
    if (isCheckmate || isStalemate || turn !== playerColor || isLoadingAiMove || isLoadingAiTutor) return;

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
    if (turn === aiColor && !isCheckmate && !isStalemate && !isLoadingAiMove && !isLoadingAiTutor) {
      setIsLoadingAiMove(true);
      setAiMoveExplanationOutput(null); 

      const fenBeforeMove = boardToFen(board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber);
      const boardBeforeAiMoveForSim = board.map(r => [...r]); // For notation generation
      const castlingRightsBeforeAiMove = castlingRights;
      const enPassantTargetBeforeAiMove = enPassantTarget;

      setTimeout(async () => {
        let aiPlayedMoveNotation: string | null = null;
        let gameEndedByThisAiMove = false;
      
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
            
            // Simulate for notation generation before actual processMove
            const { newBoard: boardAfterAiMoveSim, isCastlingKingside, isCastlingQueenside, updatedCastlingRights: castlingAfterAiSim, updatedEnPassantTarget: epAfterAiSim } = applyMoveLogic(
              boardBeforeAiMoveForSim, aiMove.from, aiMove.to, castlingRightsBeforeAiMove, enPassantTargetBeforeAiMove, promotionSymbol
            );
            const isEnPassantCaptureForAi = aiPiece?.symbol === 'p' && aiMove.to === enPassantTargetBeforeAiMove && aiMove.from !== aiMove.to;
            const directCapturedPieceForAi = getPieceAtSquare(boardBeforeAiMoveForSim, aiMove.to); // Check capture on original board
            const actualCapturedForAi = !!directCapturedPieceForAi || isEnPassantCaptureForAi;

            aiPlayedMoveNotation = moveToAlgebraic({
              from: aiMove.from, to: aiMove.to, piece: aiPiece!.symbol, captured: actualCapturedForAi, promotion: promotionSymbol,
              boardBeforeMove: boardBeforeAiMoveForSim, boardAfterMove: boardAfterAiMoveSim, turn: aiColor, 
              isCastlingKingside, isCastlingQueenside, enPassantTargetOccurred: isEnPassantCaptureForAi
            });
            
            processMove(aiMove.from, aiMove.to, promotionSymbol); // This will update the main board and status
            
            // Check game end status based on the state *after* processMove has updated the board
            // processMove itself calls updateGameStatusDisplay which sets isCheckmate/isStalemate
            // So, we can read these states directly after processMove.
            // gameEndedByThisAiMove = isCheckmate || isStalemate; // This is not perfectly accurate timing-wise for the variable "gameEndedByThisAiMove"

          }
        } catch (error) {
          console.error("Error during AI physical move execution:", error);
          toast({ title: "AI Error", description: "AI could not make a move.", variant: "destructive" });
        } finally {
          setIsLoadingAiMove(false); 
        }

        // Fetch explanation for the AI's move, if a move was made and analysis is not already loading
        // We need to check the game state *after* processMove for checkmate/stalemate.
        // The local variables `isCheckmate`, `isStalemate` will be updated by `processMove` via `updateGameStatusDisplay`.
        // It's tricky to check `gameEndedByThisAiMove` here correctly without re-evaluating.
        // Let's rely on the main state: if `isCheckmate` or `isStalemate` is true after `processMove`, no explanation needed.
        if (aiPlayedMoveNotation && !(isCheckmate || isStalemate) && !isLoadingAiTutor) { 
          setIsLoadingAiTutor(true);
          try {
            // For explaining AI's own move, we give it the FEN *before* its move,
            // and the move it made. We are asking it to explain *that* move.
            // The current `explainMoveHint` is for suggesting a *new* hint.
            // This might need a dedicated flow or a different approach.
            // For now, we will fetch an "explanation" as if it were a hint from previous state.
            const explanationResult = await explainMoveHint({
                currentBoardState: fenBeforeMove, // FEN before AI's move
                currentTurn: aiColor, // AI's turn when it made the move
                difficultyLevel: difficulty,
                // No need for suggestedMove, it will suggest one. We are interested in the explanation for *its context*.
            });
            // We will use the `aiPlayedMoveNotation` as the move for the explanation output,
            // and `explanationResult.explanation` as the explanation.
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
    difficulty, fetchAiMoveExplanation, toast,
    isLoadingAiMove, isLoadingAiTutor
  ]);


  const handleHint = async () => {
    if (isCheckmate || isStalemate || turn !== playerColor || isLoadingAiMove || isLoadingAiTutor) {
      toast({ title: "Hint Unavailable", description: "Cannot get a hint now.", variant: "destructive" });
      return;
    }

    setIsLoadingAiTutor(true);
    setPlayerMoveAnalysisOutput(null); 
    setAiMoveExplanationOutput(null); 
    if (hintLevel === 0 || hintLevel === 2) { 
        setHighlightedHintSquares(null); 
    }
    
    const fen = boardToFen(board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber);
    const playerCurrentlyInCheck = isCheck; 

    try {
      if (hintLevel === 0 || hintLevel === 2) { // Request Vague Hint
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
      } else if (hintLevel === 1) { // Request Specific Move Hint
        const result = await explainMoveHint({
          currentBoardState: fen,
          currentTurn: turn,
          difficultyLevel: difficulty,
        });
        setAiHint({ move: result.suggestedMoveNotation, explanation: result.explanation, type: 'specific' });
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
    if (historyPointer <= 0) return; // Cannot undo initial state further
    
    clearAiTutorState();
    setIsLoadingAiMove(false); // Stop any pending AI move
    setIsLoadingAiTutor(false); // Stop any pending tutor analysis


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
  const combinedLoading = isLoadingAiMove || isLoadingAiTutor;

  return (
    <div className="w-full max-w-6xl mx-auto p-1 sm:p-2 md:p-4 flex flex-col">
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

      <div className="flex flex-col lg:flex-row gap-2 sm:gap-3 md:gap-4 mt-2 sm:mt-3 flex-grow">
         <div 
            className="w-full lg:flex-shrink-0 lg:flex-grow-0 mx-auto max-w-[98vw] sm:max-w-full 
                       lg:basis-[calc(min(80vh-4rem,100vw-2rem-1rem,500px))] 
                       xl:basis-[calc(min(85vh-5rem,100vw-24rem-2rem,600px))]
                       2xl:basis-[calc(min(90vh-6rem,100vw-26rem-2.5rem,700px))] 
                       flex justify-center items-start"
          >
          <ChessboardComponent
            board={board}
            onSquareClick={handleSquareClick}
            selectedSquare={selectedSquare}
            validMoves={validMoves}
            lastMove={lastMove}
            isPlayerTurn={turn === playerColor && !combinedLoading}
            playerColor={playerColor}
            kingInCheckSquare={kingInCheckSquare}
            highlightedHintSquares={highlightedHintSquares}
          />
        </div>

        <aside className="w-full lg:w-[22rem] xl:w-[24rem] 2xl:w-[26rem] flex flex-col gap-2 sm:gap-3 mt-2 sm:mt-3 lg:mt-0">
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
              clearAiTutorState(); // Clear analysis if difficulty changes
            }}
            isPlayerTurn={turn === playerColor}
            isGameOver={isCheckmate || isStalemate}
            hintLevel={hintLevel}
            isAiProcessing={combinedLoading}
          />
          <div className="flex-grow min-h-[200px] sm:min-h-[250px] md:min-h-[300px] lg:min-h-0 lg:flex-1">
            <AiTutorPanel 
              hint={aiHint} 
              playerMoveAnalysis={playerMoveAnalysisOutput}
              aiMoveExplanation={aiMoveExplanationOutput}
              isLoading={isLoadingAiTutor} 
            />
          </div>
           <div className="flex-grow min-h-[120px] sm:min-h-[150px] md:min-h-[180px] lg:min-h-0 lg:flex-1 max-h-[25vh] lg:max-h-none">
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
