'use client';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Difficulty } from '@/types/chess';
import { Lightbulb, RotateCcw, Settings } from 'lucide-react';

interface GameControlsProps {
  onNewGame: () => void;
  onHint: () => void;
  isLoadingHint: boolean;
  difficulty: Difficulty;
  onDifficultyChange: (difficulty: Difficulty) => void;
}

const GameControls: React.FC<GameControlsProps> = ({
  onNewGame,
  onHint,
  isLoadingHint,
  difficulty,
  onDifficultyChange,
}) => {
  return (
    <Card className="p-4">
      <CardHeader>
        <CardTitle className="text-lg">Game Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={onNewGame} className="w-full" variant="outline">
          <RotateCcw className="mr-2 h-4 w-4" /> New Game
        </Button>
        <Button onClick={onHint} disabled={isLoadingHint} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
          <Lightbulb className="mr-2 h-4 w-4" /> {isLoadingHint ? 'Getting Hint...' : 'Get AI Hint'}
        </Button>
        
        <div className="space-y-1">
          <Label htmlFor="difficulty-select">AI Difficulty</Label>
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
        {/* Placeholder for future settings */}
        {/* <Button variant="ghost" className="w-full justify-start text-muted-foreground">
          <Settings className="mr-2 h-4 w-4" /> Settings
        </Button> */}
      </CardContent>
    </Card>
  );
};
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';


export default GameControls;
