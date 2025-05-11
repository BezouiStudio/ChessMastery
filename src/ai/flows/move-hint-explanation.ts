'use server';

/**
 * @fileOverview Suggests a strong chess move, provides its from/to squares, and explains the reasoning.
 *
 * - explainMoveHint - A function that suggests and explains a strong chess move.
 * - ExplainMoveHintInput - The input type for the explainMoveHint function.
 * - ExplainMoveHintOutput - The return type for the explainMoveHint function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExplainMoveHintInputSchema = z.object({
  currentBoardState: z
    .string()
    .describe('FEN representation of the current chess board state.'),
  currentTurn: z.string().describe("The color of the player whose turn it is (w or b)."),
  difficultyLevel: z
    .enum(['beginner', 'intermediate', 'advanced'])
    .describe('The difficulty level of the AI opponent.'),
});
export type ExplainMoveHintInput = z.infer<typeof ExplainMoveHintInputSchema>;

const ExplainMoveHintOutputSchema = z.object({
  suggestedMoveNotation: z.string().describe("The suggested strong chess move in algebraic notation (e.g., e4, Nf3, O-O, Qxg7#)."),
  suggestedMoveFromSquare: z.string().describe("The 'from' square of the suggested move (e.g., 'e2'). For castling, this is the king's starting square."),
  suggestedMoveToSquare: z.string().describe("The 'to' square of the suggested move (e.g., 'e4'). For castling, this is the king's ending square."),
  explanation: z.string().describe('The AI tutor explanation of why the suggested move is strong and what it accomplishes.'),
});
export type ExplainMoveHintOutput = z.infer<typeof ExplainMoveHintOutputSchema>;

export async function explainMoveHint(input: ExplainMoveHintInput): Promise<ExplainMoveHintOutput> {
  return explainMoveHintFlow(input);
}

const prompt = ai.definePrompt({
  name: 'explainMoveHintPrompt',
  input: {schema: ExplainMoveHintInputSchema},
  output: {schema: ExplainMoveHintOutputSchema},
  prompt: `You are an expert chess tutor.
Current Board State (FEN): {{{currentBoardState}}}
It is {{{currentTurn}}}'s turn.
Difficulty Level: {{{difficultyLevel}}}

First, analyze the FEN to determine if the player ({{{currentTurn}}}) is currently in check.
If {{{currentTurn}}} is in check, your suggested move MUST get the king out of check and be a legal move.

Follow these steps to generate your response:
1.  **Suggest Move**: Identify ONE strong, strategic, and legal next move for {{{currentTurn}}}.
2.  **Algebraic Notation**: Provide this move in standard algebraic notation (e.g., e4, Nf3, O-O, Qxg7#). This will be 'suggestedMoveNotation'.
3.  **Identify Squares**:
    *   Determine the 'from' square (e.g., 'e2') for this specific suggested move. This will be 'suggestedMoveFromSquare'.
    *   Determine the 'to' square (e.g., 'e4') for this specific suggested move. This will be 'suggestedMoveToSquare'.
    *   For castling (O-O or O-O-O), the 'from' square is the king's starting square (e.g., e1/e8), and the 'to' square is the king's ending square (g1/c1 or g8/c8 respectively).
4.  **Explain Move**: Provide a clear, concise, and easy-to-understand explanation of why this move is strong and what it accomplishes.
    *   Focus on the strategic and tactical implications of the move.
    *   If the player was in check (based on your FEN analysis), specifically ensure your explanation details how the suggested move addresses the check (e.g., by moving the king, blocking the check, or capturing the attacking piece).
    *   Use markdown bold syntax (**text**) for critical keywords or phrases in your explanation if appropriate for emphasis.

Respond strictly in the format defined by the output schema.
Ensure 'suggestedMoveFromSquare' and 'suggestedMoveToSquare' are accurate for the 'suggestedMoveNotation' you provide.
Example for castling kingside for white: suggestedMoveNotation: "O-O", suggestedMoveFromSquare: "e1", suggestedMoveToSquare: "g1".
Example for pawn move: suggestedMoveNotation: "e4", suggestedMoveFromSquare: "e2", suggestedMoveToSquare: "e4".
Example for knight move: suggestedMoveNotation: "Nf3", suggestedMoveFromSquare: "g1", suggestedMoveToSquare: "f3".
`,
});

const explainMoveHintFlow = ai.defineFlow(
  {
    name: 'explainMoveHintFlow',
    inputSchema: ExplainMoveHintInputSchema,
    outputSchema: ExplainMoveHintOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
