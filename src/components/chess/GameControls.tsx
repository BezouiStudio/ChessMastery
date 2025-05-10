// src/components/chess/GameControls.tsx
'use client';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Difficulty } from '@/types/chess';
import { Lightbulb, RotateCcw } from 'lucide-react'; 
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

interface GameControlsProps {
  onNewGame: () => void;
  onHint: () => void;
  isLoadingHint: boolean; // Specifically for the hint button's text "Thinking..."
  difficulty: Difficulty;
  onDifficultyChange: (difficulty: Difficulty) => void;
  isPlayerTurn: boolean;
  isGameOver: boolean;
  hintLevel: 0 | 1 | 2;
  isAiProcessing: boolean; // General AI processing state for disabling controls
}

const GameControls: React.FC<GameControlsProps> = ({
  onNewGame,
  onHint,
  isLoadingHint,
  difficulty,
  onDifficultyChange,
  isPlayerTurn,
  isGameOver,
  hintLevel,
  isAiProcessing,
}) => {
  let hintButtonText = 'Get AI Hint';
  if (hintLevel === 0 || hintLevel === 2) {
      hintButtonText = 'Get General Tip';
  } else if (hintLevel === 1) {
      hintButtonText = 'Get Specific Move';
  }

  return (
    <Card className="shadow-lg rounded-lg">
      <CardHeader className="pb-2 pt-3 px-3 sm:pb-3 sm:pt-4 sm:px-4">
        <CardTitle className="text-lg sm:text-xl font-semibold">Game Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-3 sm:space-y-3 sm:px-4 sm:pb-4">
        <Button onClick={onNewGame} className="w-full text-xs sm:text-sm" variant="outline" disabled={isAiProcessing}>
          <RotateCcw className="mr-2 h-4 w-4" /> New Game
        </Button>
        <Button 
          onClick={onHint} 
          disabled={isLoadingHint || !isPlayerTurn || isGameOver || isAiProcessing} 
          className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-xs sm:text-sm"
        >
          <Lightbulb className="mr-2 h-4 w-4" /> {isLoadingHint ? 'Thinking...' : hintButtonText}
        </Button>
        
        <div className="space-y-1 sm:space-y-1.5">
          <Label htmlFor="difficulty-select" className="text-xs sm:text-sm font-medium">AI Difficulty</Label>
          <Select 
            value={difficulty} 
            onValueChange={(value) => onDifficultyChange(value as Difficulty)}
            disabled={isAiProcessing}
          >
            <SelectTrigger id="difficulty-select" className="w-full text-xs sm:text-sm">
              <SelectValue placeholder="Select difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="beginner" className="text-xs sm:text-sm">Beginner</SelectItem>
              <SelectItem value="intermediate" className="text-xs sm:text-sm">Intermediate</SelectItem>
              <SelectItem value="advanced" className="text-xs sm:text-sm">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};

export default GameControls;
