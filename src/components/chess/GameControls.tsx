// src/components/chess/GameControls.tsx
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Difficulty } from '@/types/chess';
import { Lightbulb, RotateCcw, Undo, Redo, Settings2, Brain } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface GameControlsProps {
  onNewGame: () => void;
  onHint: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isLoadingHint: boolean;
  difficulty: Difficulty;
  onDifficultyChange: (difficulty: Difficulty) => void;
  isPlayerTurn: boolean;
  isGameOver: boolean;
  hintLevel: 0 | 1 | 2;
  isAiProcessing: boolean;
  isFullTutoringMode: boolean;
  onFullTutoringModeChange: (enabled: boolean) => void;
}

const GameControls: React.FC<GameControlsProps> = ({
  onNewGame,
  onHint,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  isLoadingHint,
  difficulty,
  onDifficultyChange,
  isPlayerTurn,
  isGameOver,
  hintLevel,
  isAiProcessing,
  isFullTutoringMode,
  onFullTutoringModeChange,
}) => {
  let hintButtonText = 'Get AI Hint';
  if (hintLevel === 0 || hintLevel === 2) {
      hintButtonText = 'Get General Tip';
  } else if (hintLevel === 1) {
      hintButtonText = 'Get Specific Move';
  }

  // Removed React.useCallback for handleSelectDifficultyChange
  // const handleSelectDifficultyChange = React.useCallback((value: string) => {
  //   onDifficultyChange(value as Difficulty);
  // }, [onDifficultyChange]);


  return (
    <Card className="shadow-lg rounded-lg">
      <CardHeader className="pb-2 pt-3 px-3 sm:pb-3 sm:pt-4 sm:px-4">
        <CardTitle className="text-base sm:text-lg font-semibold flex items-center">
          <Settings2 className="mr-2 h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          Game Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-3 sm:space-y-3 sm:px-4 sm:pb-4">
        <Button
          onClick={onNewGame}
          className="w-full text-xs sm:text-sm"
          variant="outline"
          disabled={isAiProcessing}
        >
          <RotateCcw className="mr-2 h-3 w-3 sm:h-4 sm:w-4" /> New Game
        </Button>

        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={onUndo}
            disabled={!canUndo || isAiProcessing}
            className="w-full text-xs sm:text-sm"
            variant="outline"
          >
            <Undo className="mr-2 h-3 w-3 sm:h-4 sm:w-4" /> Undo
          </Button>
          <Button
            onClick={onRedo}
            disabled={!canRedo || isAiProcessing}
            className="w-full text-xs sm:text-sm"
            variant="outline"
          >
            <Redo className="mr-2 h-3 w-3 sm:h-4 sm:w-4" /> Redo
          </Button>
        </div>

        <Button
          onClick={onHint}
          disabled={isLoadingHint || !isPlayerTurn || isGameOver || isAiProcessing || isFullTutoringMode}
          className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-xs sm:text-sm"
        >
          <Lightbulb className="mr-2 h-3 w-3 sm:h-4 sm:w-4" /> {isLoadingHint ? 'Thinking...' : hintButtonText}
        </Button>

        <div className="space-y-1 sm:space-y-1.5 pt-1">
          <Label htmlFor="difficulty-select" className="text-xs sm:text-sm font-medium text-muted-foreground">AI Difficulty</Label>
          <Select
            value={difficulty}
            onValueChange={(value: string) => onDifficultyChange(value as Difficulty)} // Use inline function
            disabled={isAiProcessing}
          >
            <SelectTrigger id="difficulty-select" className="w-full text-xs sm:text-sm h-9 sm:h-10">
              <SelectValue placeholder="Select difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="beginner" className="text-xs sm:text-sm">Beginner</SelectItem>
              <SelectItem value="intermediate" className="text-xs sm:text-sm">Intermediate</SelectItem>
              <SelectItem value="advanced" className="text-xs sm:text-sm">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between space-x-2 pt-2">
          <Label htmlFor="full-tutoring-mode" className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center">
            <Brain className="mr-2 h-4 w-4 text-purple-500" />
            Full Tutoring Mode
          </Label>
          <Switch
            id="full-tutoring-mode"
            checked={isFullTutoringMode}
            onCheckedChange={onFullTutoringModeChange}
            disabled={isAiProcessing}
            className="data-[state=checked]:bg-purple-500"
          />
        </div>

      </CardContent>
    </Card>
  );
};

export default GameControls;
