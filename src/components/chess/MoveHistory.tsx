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
      <CardHeader>
        <CardTitle className="text-lg">Move History</CardTitle>
      </CardHeader>
      <CardContent className="h-[calc(100%-4rem)] pb-2"> {/* Adjust height based on CardHeader */}
        <ScrollArea className="h-full w-full rounded-md border p-2">
          {moves.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">No moves yet.</p>
          ) : (
            <ol className="space-y-1 text-sm">
              {moves.map((move, index) => (
                <li key={index} className="flex">
                  {index % 2 === 0 && <span className="w-6 font-semibold mr-1">{Math.floor(index / 2) + 1}.</span>}
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
