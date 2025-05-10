'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface AiTutorPanelProps {
  hint?: { move: string; explanation: string };
  analysis?: string;
  isLoading: boolean;
}

const AiTutorPanel: React.FC<AiTutorPanelProps> = ({ hint, analysis, isLoading }) => {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg">AI Tutor</CardTitle>
      </CardHeader>
      <CardContent className="h-[calc(100%-4rem)] pb-2">
        <ScrollArea className="h-full w-full rounded-md border p-3">
          {isLoading && <p className="text-sm text-muted-foreground">AI is thinking...</p>}
          {!isLoading && !hint && !analysis && (
            <p className="text-sm text-muted-foreground text-center py-4">Click "Get AI Hint" or play a move for analysis.</p>
          )}
          {hint && (
            <div className="mb-4 p-3 bg-accent/10 rounded-lg border border-accent/30">
              <h3 className="font-semibold text-md mb-1">Suggested Move: <Badge variant="default" className="bg-accent text-accent-foreground">{hint.move}</Badge></h3>
              <p className="text-sm whitespace-pre-wrap">{hint.explanation}</p>
            </div>
          )}
          {analysis && (
            <div>
              <h3 className="font-semibold text-md mb-1">Board Analysis:</h3>
              <p className="text-sm whitespace-pre-wrap">{analysis}</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default AiTutorPanel;
