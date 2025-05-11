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
  isPlayerInCheck: z.boolean().optional().describe('Whether the current player (whose turn it is) is in check. If not provided, the AI should deduce this from the FEN.'),
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
{{#if isPlayerInCheck}}
The player ({{{currentTurn}}}) is currently in CHECK. This is a critical piece of information.
{{else}}
You should analyze the FEN to determine if {{{currentTurn}}} is in check, even if not explicitly stated by 'isPlayerInCheck'.
{{/if}}

**CRITICAL INSTRUCTIONS - ADHERE STRICTLY:**
1.  **Analyze Player's Check Status**:
    *   Carefully analyze the FEN: \`{{{currentBoardState}}}\`.
    *   Determine if the player ({{{currentTurn}}}) is currently in check. Use the 'isPlayerInCheck' input if provided, otherwise deduce from FEN.
2.  **Identify ONE Strong, Legal Move**:
    *   Based on the board state and whose turn it is ({{{currentTurn}}}), identify a single strong and, most importantly, **100% legal chess move**.
    *   **If {{{currentTurn}}} is in check (from step 1 or your FEN analysis), this move ABSOLUTELY MUST resolve the check** (by moving the king, blocking the check, or capturing the attacking piece). Failure to do so makes the move illegal.
    *   Consider the \`difficultyLevel\` ({{{difficultyLevel}}}) when evaluating the strength and complexity of the move.
3.  **Standard Algebraic Notation**:
    *   Provide this move in standard algebraic notation (e.g., e4, Nf3, O-O, Qxg7#). This is 'suggestedMoveNotation'.
4.  **Accurate From/To Squares**:
    *   From the \`suggestedMoveNotation\` and the \`currentBoardState\`, precisely determine the 'from' square (e.g., 'e2') and the 'to' square (e.g., 'e4').
    *   For castling (O-O or O-O-O), 'from' is the king's start square (e1/e8), 'to' is the king's end square (g1/c1 or g8/c8 respectively).
    *   These squares, 'suggestedMoveFromSquare' and 'suggestedMoveToSquare', MUST be accurate for the given notation and board.
5.  **Explain the Move**:
    *   Provide a clear, concise explanation for why this move is strong and what it achieves.
    *   Focus on strategic/tactical implications.
    *   If the player was in check, explicitly state how the move resolves it.
    *   Use markdown bold syntax (**text**) for critical keywords or phrases in your explanation if appropriate for emphasis.

**VERIFICATION (Perform this mentally before outputting):**
*   Is the \`suggestedMoveNotation\` a valid move for the piece on \`suggestedMoveFromSquare\` according to standard chess rules? (e.g., Bishop moves diagonally, Knight in 'L' shape, Rook horizontally/vertically, Pawn special moves).
*   Are there any pieces blocking the path for sliding pieces (Bishop, Rook, Queen) if it's not a capture of the blocking piece?
*   Does the move leave the player's ({{{currentTurn}}}'s) king in check? If so, it's illegal. The suggested move must result in a position where {{{currentTurn}}}'s king is NOT in check.
*   Are \`suggestedMoveFromSquare\` and \`suggestedMoveToSquare\` correctly derived from \`suggestedMoveNotation\` and the board state? For example, if suggesting "Be3", ensure the bishop is actually on a square that can legally move to "e3".

Respond strictly in the format defined by the output schema.
Example for castling kingside for white: suggestedMoveNotation: "O-O", suggestedMoveFromSquare: "e1", suggestedMoveToSquare: "g1".
Example for pawn move: suggestedMoveNotation: "e4", suggestedMoveFromSquare: "e2", suggestedMoveToSquare: "e4".
Example for knight move: suggestedMoveNotation: "Nf3", suggestedMoveFromSquare: "g1", suggestedMoveToSquare: "f3".
Ensure your suggested move is not just plausible but strictly adheres to all chess rules. An illegal suggestion is far worse than no suggestion.
If the board state is unusual or leads to limited options, prioritize legality above all else.
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
