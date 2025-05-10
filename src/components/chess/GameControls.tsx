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
  isLoadingHint: boolean;
  difficulty: Difficulty;
  onDifficultyChange: (difficulty: Difficulty) => void;
  isPlayerTurn: boolean;
  isGameOver: boolean;
}

const GameControls: React.FC<GameControlsProps> = ({
  onNewGame,
  onHint,
  isLoadingHint,
  difficulty,
  onDifficultyChange,
  isPlayerTurn,
  isGameOver,
}) => {
  return (
    <Card className="shadow-lg rounded-lg">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-xl font-semibold">Game Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4">
        <Button onClick={onNewGame} className="w-full" variant="outline">
          <RotateCcw className="mr-2 h-4 w-4" /> New Game
        </Button>
        <Button 
          onClick={onHint} 
          disabled={isLoadingHint || !isPlayerTurn || isGameOver} 
          className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          <Lightbulb className="mr-2 h-4 w-4" /> {isLoadingHint ? 'Getting Hint...' : 'Get AI Hint'}
        </Button>
        
        <div className="space-y-1.5">
          <Label htmlFor="difficulty-select" className="text-sm font-medium">AI Difficulty</Label>
          <Select value={difficulty} onValueChange={(value) => onDifficultyChange(value as Difficulty)}>
            <SelectTrigger id="difficulty-select" className="w-full">
              <SelectValue placeholder="Select difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="beginner">Beginner</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};

export default GameControls;
