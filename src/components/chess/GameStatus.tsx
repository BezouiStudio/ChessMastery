'use client';

import { AlertCircle, CheckCircle2, Swords, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GameStatusProps {
  statusText: string;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  winner: 'w' | 'b' | null;
}

const GameStatus: React.FC<GameStatusProps> = ({ 
    statusText, 
    isCheck, 
    isCheckmate, 
    isStalemate,
    isDraw,
    winner 
}) => {
  let IconComponent = Info;
  let alertClass = "bg-blue-500/10 border-blue-500/30 text-blue-300"; // Default informative
  
  if (isCheckmate) {
    IconComponent = CheckCircle2;
    alertClass = "bg-green-500/10 border-green-500/30 text-green-300";
  } else if (isStalemate || isDraw) {
    IconComponent = AlertCircle;
    alertClass = "bg-yellow-500/10 border-yellow-500/30 text-yellow-300";
  } else if (isCheck) {
    IconComponent = Swords; // Using Swords for check, as AlertCircle is used for stalemate
    alertClass = "bg-red-500/10 border-red-500/30 text-red-300";
  }


  return (
    <div className={cn(
        "p-3 rounded-lg border flex items-center space-x-3 shadow-md",
        alertClass
      )}>
      <IconComponent className="h-6 w-6" />
      <p className="text-sm font-medium">{statusText}</p>
    </div>
  );
};

export default GameStatus;
