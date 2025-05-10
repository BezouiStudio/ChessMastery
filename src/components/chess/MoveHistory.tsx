'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Move } from '@/types/chess';
import { moveToAlgebraic } from '@/lib/chess-logic'; // Assuming this is correctly implemented

interface MoveHistoryProps {
  moves: string[]; // Using simple string array for now
  // moves: Move[]; // Ideally, use the Move type for richer display
}

const MoveHistory: React.FC<MoveHistoryProps> = ({ moves }) => {
  return (
    <Card className="h-full">
      <CardHeader className="py-3 px-3 sm:py-4 sm:px-4">
        <CardTitle className="text-base sm:text-lg">Move History</CardTitle>
      </CardHeader>
      <CardContent className="h-[calc(100%-2.5rem)] sm:h-[calc(100%-3.25rem)] pb-1 px-1 sm:pb-2 sm:px-2"> {/* Adjusted height based on CardHeader */}
        <ScrollArea className="h-full w-full rounded-md border p-1 sm:p-2">
          {moves.length === 0 ? (
            <p className="text-muted-foreground text-xs sm:text-sm text-center py-4">No moves yet.</p>
          ) : (
            <ol className="space-y-0.5 sm:space-y-1 text-xs sm:text-sm">
              {moves.map((move, index) => (
                <li key={index} className="flex py-0.5 sm:py-1">
                  {index % 2 === 0 && <span className="w-auto min-w-[1.25rem] sm:min-w-[1.5rem] pr-1 text-right font-semibold mr-1">{Math.floor(index / 2) + 1}.</span>}
                  <span className={`px-1 py-0.5 rounded-sm ${index % 2 === 0 ? 'font-medium' : ''}`}>{move}</span>
                </li>
              ))}
            </ol>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default MoveHistory;
