'use client';

import { Lightbulb, AlertCircle, CheckCircle2, Swords, Info, Loader } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseAndHighlightText } from '@/lib/text-parser';

interface GameStatusProps {
  statusText: string;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  winner: 'w' | 'b' | null;
  fullTutorGeneralTip?: string | null;
  isFullTutoringMode?: boolean;
  isPlayerTurn?: boolean;
  isLoadingAi?: boolean; // Added to indicate general AI processing for its turn
}

const GameStatus: React.FC<GameStatusProps> = ({ 
    statusText, 
    isCheck, 
    isCheckmate, 
    isStalemate,
    isDraw,
    winner,
    fullTutorGeneralTip,
    isFullTutoringMode,
    isPlayerTurn,
    isLoadingAi,
}) => {
  let IconComponent = Info;
  let alertClass = "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300"; 
  let currentText = statusText;
  let applyParsing = false;

  if (isLoadingAi) {
    IconComponent = Loader;
    currentText = "AI is thinking...";
    alertClass = "bg-muted border-border text-muted-foreground animate-pulse";
  } else if (isFullTutoringMode && isPlayerTurn && fullTutorGeneralTip) {
    IconComponent = Lightbulb;
    currentText = fullTutorGeneralTip;
    alertClass = "bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-400";
    applyParsing = true;
  } else if (isCheckmate) {
    IconComponent = CheckCircle2;
    alertClass = "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300";
  } else if (isStalemate || isDraw) {
    IconComponent = AlertCircle;
    alertClass = "bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-300";
  } else if (isCheck) {
    IconComponent = Swords; 
    alertClass = "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300";
  }


  return (
    <div className={cn(
        "p-2 sm:p-3 rounded-lg border flex items-center space-x-2 sm:space-x-3 shadow-md min-h-[48px] sm:min-h-[56px]", 
        alertClass,
        isLoadingAi && "animate-pulse"
      )}>
      <IconComponent className={cn("h-5 w-5 sm:h-6 sm:w-6 shrink-0", isLoadingAi && "animate-spin")} />
      <p className="text-xs sm:text-sm font-medium">
        {applyParsing ? parseAndHighlightText(currentText) : currentText}
      </p>
    </div>
  );
};

export default GameStatus;
