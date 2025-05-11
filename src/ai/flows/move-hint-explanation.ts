// src/ai/flows/move-hint-explanation.ts
'use server';

/**
 * @fileOverview Suggests one or more strong chess moves, provides their from/to squares, and explains the reasoning.
 *
 * - explainMoveHint - For a single hint.
 * - ExplainMoveHintInput - Input for single/multiple hints.
 * - ExplainMoveHintOutput - Output for a single hint.
 * - explainMultipleMoveHints - For multiple suggestions (e.g., full tutoring).
 * - ExplainMultipleMoveHintsOutput - Output for multiple suggestions.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExplainMoveHintInputSchema = z.object({
  currentBoardState: z
    .string()
    .describe('FEN representation of the current chess board state. This FEN is the ABSOLUTE source of truth for piece positions and legality.'),
  currentTurn: z.string().describe("The color of the player whose turn it is (w or b)."),
  difficultyLevel: z
    .enum(['beginner', 'intermediate', 'advanced'])
    .describe('The difficulty level of the AI opponent.'),
  isPlayerInCheck: z.boolean().optional().describe('Whether the current player (whose turn it is) is in check. If not provided, the AI should deduce this from the FEN.'),
  numberOfSuggestions: z.number().optional().describe('Number of move suggestions to provide. Defaults to 1. Max 3 for multiple suggestions.').default(1),
});
export type ExplainMoveHintInput = z.infer<typeof ExplainMoveHintInputSchema>;

const ExplainMoveHintOutputSchema = z.object({
  suggestedMoveNotation: z.string().describe("The suggested strong chess move in algebraic notation (e.g., e4, Nf3, O-O, Qxg7#)."),
  suggestedMoveFromSquare: z.string().describe("The 'from' square of the suggested move (e.g., 'e2'). For castling, this is the king's starting square."),
  suggestedMoveToSquare: z.string().describe("The 'to' square of the suggested move (e.g., 'e4'). For castling, this is the king's ending square."),
  explanation: z.string().describe('The AI tutor explanation of why the suggested move is strong and what it accomplishes.'),
});
export type ExplainMoveHintOutput = z.infer<typeof ExplainMoveHintOutputSchema>;

// Output schema for multiple suggestions
const ExplainMultipleMoveHintsOutputSchema = z.object({
  suggestions: z.array(ExplainMoveHintOutputSchema).describe("An array of suggested moves, each with its notation, from/to squares, and explanation."),
});
export type ExplainMultipleMoveHintsOutput = z.infer<typeof ExplainMultipleMoveHintsOutputSchema>;


// --- Single Hint Functionality (existing) ---
export async function explainMoveHint(input: ExplainMoveHintInput): Promise<ExplainMoveHintOutput> {
  // For single hint, ensure numberOfSuggestions is 1
  const singleHintInput = {...input, numberOfSuggestions: 1};
  const result = await explainMoveHintsFlow(singleHintInput);
  if (result.suggestions && result.suggestions.length > 0) {
    return result.suggestions[0];
  }
  throw new Error("AI failed to provide a single move hint.");
}


// --- Multiple Hints Functionality (new for full tutoring) ---
export async function explainMultipleMoveHints(input: ExplainMoveHintInput): Promise<ExplainMultipleMoveHintsOutput> {
  // Ensure numberOfSuggestions is set, defaulting to e.g., 2 or 3 if not specified for multiple
  const multipleHintsInput = {...input, numberOfSuggestions: input.numberOfSuggestions && input.numberOfSuggestions > 1 ? Math.min(input.numberOfSuggestions, 3) : 2 };
  return explainMoveHintsFlow(multipleHintsInput);
}

const prompt = ai.definePrompt({
  name: 'explainMoveHintsPrompt', // Renamed to reflect potential multiple hints
  input: {schema: ExplainMoveHintInputSchema},
  output: {schema: ExplainMultipleMoveHintsOutputSchema}, // Output is now an array of suggestions
  prompt: `You are an expert chess tutor. Your primary goal is to provide strategically sound and 100% LEGAL chess moves.
Current Board State (FEN): {{{currentBoardState}}}
It is {{{currentTurn}}}'s turn.
Difficulty Level: {{{difficultyLevel}}}
{{#if isPlayerInCheck}}
The player ({{{currentTurn}}}) is currently in CHECK. This is a critical piece of information for your move suggestions.
{{else}}
You MUST analyze the FEN \`{{{currentBoardState}}}\` to determine if {{{currentTurn}}} is in check, even if 'isPlayerInCheck' is not provided or is false.
{{/if}}

You need to provide {{{numberOfSuggestions}}} distinct, strong, and 100% legal chess move suggestions. If providing multiple suggestions, try to offer varied strategic ideas if possible. For each suggestion, provide:
1.  The move in standard algebraic notation.
2.  The 'from' square.
3.  The 'to' square.
4.  A clear explanation.

**CRITICAL INSTRUCTIONS - ADHERE STRICTLY FOR EACH SUGGESTION:**
1.  **Analyze Board and Check Status**:
    *   Carefully analyze the FEN: \`{{{currentBoardState}}}\`. This FEN is the SOLE source of truth for piece positions.
    *   Determine if the player ({{{currentTurn}}}) is currently in check. Use the 'isPlayerInCheck' input if provided, otherwise deduce *correctly* from the FEN.
2.  **Identify Strong, 100% Legal Moves**:
    *   Based *only* on the pieces and their positions as defined in \`{{{currentBoardState}}}\` and whose turn it is ({{{currentTurn}}}), identify the requested number of strong and **100% legal chess moves**.
    *   **If {{{currentTurn}}} is in check, ALL suggested moves ABSOLUTELY MUST resolve the check** (by moving the king, blocking the check, or capturing the attacking piece). Failure to do so makes the move illegal.
    *   Consider the \`difficultyLevel\` ({{{difficultyLevel}}}) when evaluating the strength and complexity of the moves.
3.  **Standard Algebraic Notation**:
    *   Provide each move in standard algebraic notation (e.g., e4, Nf3, O-O, Qxg7#). This is 'suggestedMoveNotation'.
4.  **Accurate From/To Squares**:
    *   For each \`suggestedMoveNotation\` and the \`currentBoardState\`, precisely determine its 'from' square (e.g., 'e2') and 'to' square (e.g., 'e4').
    *   For castling (O-O or O-O-O), 'from' is the king's start square (e1/e8), 'to' is the king's end square (g1/c1 or g8/c8 respectively).
    *   These squares, 'suggestedMoveFromSquare' and 'suggestedMoveToSquare', MUST be accurate for the given notation and board for EACH suggestion.
5.  **Explain Each Move**:
    *   Provide a clear, concise explanation for why EACH move is strong and what it achieves.
    *   Focus on strategic/tactical implications.
    *   If the player was in check, explicitly state how the move resolves it.
    *   Use markdown bold syntax (**text**) for critical keywords or phrases in your explanation if appropriate for emphasis.

**MANDATORY VERIFICATION (Perform this meticulously for EACH suggestion before outputting, using ONLY the provided FEN):**
*   **Piece Exists**: Does the piece you intend to move actually exist on its \`suggestedMoveFromSquare\` in the FEN \`{{{currentBoardState}}}\`?
*   **Correct Piece Type**: Is the piece on its \`suggestedMoveFromSquare\` in the FEN the correct type for the move you are suggesting?
*   **Basic Legality**: Is the \`suggestedMoveNotation\` a valid move pattern for the piece on its \`suggestedMoveFromSquare\`?
*   **Pawn Moves (Crucial Detail):**
    *   **Non-Capture Forward Move:** If a pawn moves one square forward (e.g., e2 to e3), its destination square (\`suggestedMoveToSquare\`) must be **EMPTY** in the FEN.
    *   **Two-Square Initial Pawn Move:** If a pawn moves two squares (e.g., e2 to e4), BOTH intermediate (e.g., e3) AND destination (\`suggestedMoveToSquare\`) squares must be **EMPTY** in the FEN.
    *   **Pawn Capture:** If it's a pawn capture (e.g., exd5), is there an OPPONENT'S piece on the destination square?
    *   **En Passant:** Ensure en passant conditions are met.
*   **Obstructions**: Are there any pieces blocking the path for sliding pieces (Bishop, Rook, Queen) if the move is not a capture of the blocking piece itself?
*   **King Safety (Self-Check)**: Does the move leave the player's ({{{currentTurn}}}'s) king in check? If so, it's illegal.
*   **Castling Rights & Path**: If suggesting castling, are castling rights available? Are squares between king/rook empty? Does king pass through/land on attacked squares?
*   **Correct Squares**: Are \`suggestedMoveFromSquare\` and \`suggestedMoveToSquare\` correctly derived for EACH suggestion?

Respond strictly in the format defined by the output schema, providing an array of suggestion objects under the 'suggestions' key.
Example for castling kingside for white (if it were one of many suggestions): { suggestedMoveNotation: "O-O", suggestedMoveFromSquare: "e1", suggestedMoveToSquare: "g1", explanation: "..." }.
Example for pawn move: { suggestedMoveNotation: "e4", suggestedMoveFromSquare: "e2", suggestedMoveToSquare: "e4", explanation: "..." }. (Assuming e2 white pawn, e3 & e4 empty).

Ensure EACH suggested move is not just plausible but **strictly adheres to all chess rules based on the provided FEN**.
If {{{numberOfSuggestions}}} is 1, provide the single best move. If more than 1, provide that many distinct, strong, legal options.
If you cannot find enough distinct legal and reasonable moves up to {{{numberOfSuggestions}}}, provide as many as you can find, even if it's just one or none (empty array).
The output MUST be a JSON object with a "suggestions" key, which is an array of objects matching the ExplainMoveHintOutputSchema structure.
`,
});

const explainMoveHintsFlow = ai.defineFlow( // Renamed flow
  {
    name: 'explainMoveHintsFlow', // Renamed flow
    inputSchema: ExplainMoveHintInputSchema,
    outputSchema: ExplainMultipleMoveHintsOutputSchema, // Output is now an array
  },
  async input => {
    const {output} = await prompt(input);
    // Ensure output is not null and suggestions is an array, even if empty
    return output || { suggestions: [] };
  }
);
