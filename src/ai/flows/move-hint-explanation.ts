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
  name: 'explainMoveHintsPrompt',
  input: {schema: ExplainMoveHintInputSchema},
  output: {schema: ExplainMultipleMoveHintsOutputSchema},
  prompt: `You are an expert chess tutor. Your primary goal is to provide strategically sound and 100% LEGAL chess moves based *strictly* on the provided FEN.
Current Board State (FEN): {{{currentBoardState}}}
It is {{{currentTurn}}}'s turn.
Difficulty Level: {{{difficultyLevel}}}
{{#if isPlayerInCheck}}
The player ({{{currentTurn}}}) is currently in CHECK. This is a critical piece of information for your move suggestions. All suggestions MUST resolve the check.
{{else}}
You MUST meticulously analyze the FEN \`{{{currentBoardState}}}\` to determine if {{{currentTurn}}} is in check, even if 'isPlayerInCheck' is not provided or is false. If in check, all suggestions MUST resolve it.
{{/if}}

You need to provide {{{numberOfSuggestions}}} distinct, strong, and **100% legal chess moves**. If providing multiple suggestions, try to offer varied strategic ideas if possible. For each suggestion, you must provide:
1.  The move in standard algebraic notation (e.g., e4, Nf3, O-O, Qxg7#). This is 'suggestedMoveNotation'.
2.  The 'from' square (e.g., 'e2'). This is 'suggestedMoveFromSquare'.
3.  The 'to' square (e.g., 'e4'). This is 'suggestedMoveToSquare'.
4.  A clear explanation for 'explanation'.

**CRITICAL INSTRUCTIONS - ADHERE STRICTLY FOR EACH SUGGESTION:**
The FEN string \`{{{currentBoardState}}}\` is the **ABSOLUTE AND ONLY SOURCE OF TRUTH** for all piece positions, turn, castling rights, en passant target, and game state. Do not infer or assume any state not explicitly represented in this FEN.

1.  **Analyze Board and Check Status from FEN**:
    *   Meticulously analyze the FEN: \`{{{currentBoardState}}}\`.
    *   Determine if {{{currentTurn}}} is in check based *solely* on this FEN. Use 'isPlayerInCheck' as a hint, but verify with the FEN.
2.  **Identify Strong, 100% Verifiably Legal Moves Directly From FEN Analysis**:
    *   Based *only* on the FEN \`{{{currentBoardState}}}\` and whose turn it is ({{{currentTurn}}}), identify the requested number of strong and **100% legal chess moves**.
    *   **If {{{currentTurn}}} is in check (verified from FEN!), ALL suggested moves ABSOLUTELY MUST resolve the check** (by moving the king, blocking, or capturing the attacker).
    *   Consider the \`difficultyLevel\` ({{{difficultyLevel}}}) for move strength/complexity.
3.  **Standard Algebraic Notation**:
    *   Provide each move in standard algebraic notation. Ensure it's accurate for the move made from \`suggestedMoveFromSquare\` to \`suggestedMoveToSquare\` on the given FEN.
    *   If a pawn capture, use 'x' (e.g., exd5). If a non-capture pawn move, do not use 'x'.
4.  **Accurate From/To Squares**:
    *   For EACH \`suggestedMoveNotation\` you generate, and based *strictly* on the \`currentBoardState\` FEN, precisely determine its 'suggestedMoveFromSquare' and 'suggestedMoveToSquare'.
    *   These squares MUST correspond to the starting and ending square of a specific, single piece on the FEN of color {{{currentTurn}}} that can legally make the move.
    *   For castling (O-O or O-O-O), 'from' is king's start, 'to' is king's end.
5.  **Explain Each Move**:
    *   Provide a clear, concise explanation. Focus on strategy/tactics.
    *   If the player was in check (verified from FEN), explicitly state how the move resolves it.
    *   Use markdown bold syntax (**text**) for critical keywords or phrases in your explanation if appropriate for emphasis.

**MANDATORY VERIFICATION (Perform this with extreme diligence for EACH suggestion before outputting. Use ONLY the provided FEN \`{{{currentBoardState}}}\`. Failure to meet these checks means the output is unusable and incorrect):**
*   **Piece Exists & Correct Type**: Does the piece you intend to move actually exist on its \`suggestedMoveFromSquare\` in the FEN \`{{{currentBoardState}}}\`? Is it the correct color ({{{currentTurn}}}) and type for the move?
*   **Basic Legality of Path**: Is the path from \`suggestedMoveFromSquare\` to \`suggestedMoveToSquare\` a valid movement pattern for that specific piece type according to chess rules?
*   **Pawn Moves (Crucial Detail - verify against FEN \`{{{currentBoardState}}}\` for EACH suggestion):**
    *   **Non-Capture Forward Move (e.g., e2 to e4, or e6 to e7):** The destination square (\`suggestedMoveToSquare\`) AND any intermediate squares (for two-square moves like e2 to e4) MUST BE EMPTY in the FEN \`{{{currentBoardState}}}\`.
    *   **Pawn Capture (e.g., exd5):** An OPPONENT'S piece MUST exist on the \`suggestedMoveToSquare\` in the FEN \`{{{currentBoardState}}}\`. The notation must include 'x'.
    *   **En Passant:** If suggesting en passant, ALL conditions (opponent's last move was a two-square pawn advance to an adjacent file, your pawn is on the 5th rank (for white) or 4th rank (for black), the en passant target square in FEN \`{{{currentBoardState}}}\` matches your pawn's capture square) MUST be met based on the FEN. The captured pawn is on a different square than \`suggestedMoveToSquare\`.
*   **Obstructions (EXTREMELY IMPORTANT for Bishops, Rooks, Queens)**:
    *   For any move suggested for a Bishop, Rook, or Queen, you MUST meticulously verify the path on the FEN: \`{{{currentBoardState}}}\`.
    *   The path is the sequence of squares between \`suggestedMoveFromSquare\` (exclusive) and \`suggestedMoveToSquare\`.
    *   **EVERY SINGLE INTERMEDIATE SQUARE on this path MUST BE EMPTY in the FEN (\`{{{currentBoardState}}}\`)**. For example, for Bf1-c4, squares e2 and d3 MUST be empty. For Rd1-d7, squares d2, d3, d4, d5, d6 MUST be empty.
    *   If the move is a capture (i.e., \`suggestedMoveToSquare\` contains an opponent's piece in the FEN \`{{{currentBoardState}}}\`), then all squares *between* \`suggestedMoveFromSquare\` (exclusive) and \`suggestedMoveToSquare\` (exclusive) must be empty.
    *   If any intermediate square is occupied by ANY piece (own or opponent), the move is ILLEGAL and MUST NOT be suggested.
    *   This check is paramount. Do not assume clear paths. Verify with the FEN \`{{{currentBoardState}}}\` only.
*   **King Safety (Self-Check for {{{currentTurn}}}):** After imagining the move from \`suggestedMoveFromSquare\` to \`suggestedMoveToSquare\` on the FEN \`{{{currentBoardState}}}\`, would {{{currentTurn}}}'s king be in check? If yes, the move is ILLEGAL. Suggest a different move.
*   **Castling Rights & Path**: If suggesting castling (O-O or O-O-O):
    *   Are castling rights for the side ({{{currentTurn}}}) and type (K/Q for white, k/q for black) present in the FEN's castling field (\`{{{currentBoardState}}}\`)?
    *   Are ALL squares between the king's starting square and the rook's starting square EMPTY in the FEN \`{{{currentBoardState}}}\`? (e.g., for White O-O: f1, g1 empty; for White O-O-O: b1, c1, d1 empty).
    *   Does the king pass through or land on any square attacked by the opponent (based on the FEN \`{{{currentBoardState}}}\`)? (e.g., for White O-O: king must not pass through f1 or land on g1 if attacked).
    *   Is the king currently in check (based on the FEN \`{{{currentBoardState}}}\`)? (Cannot castle if in check).
*   **Accurate Square Derivation**: For EACH \`suggestedMoveNotation\` generated, are \`suggestedMoveFromSquare\` and \`suggestedMoveToSquare\` correctly and unambiguously derived from a single piece of color {{{currentTurn}}} on the FEN \`{{{currentBoardState}}}\` that can legally make that specific move? There should be no ambiguity.

Respond strictly in the format defined by the output schema, providing an array of suggestion objects under the 'suggestions' key.
Example for castling kingside for white: { suggestedMoveNotation: "O-O", suggestedMoveFromSquare: "e1", suggestedMoveToSquare: "g1", explanation: "..." }.
Example for pawn move e4: { suggestedMoveNotation: "e4", suggestedMoveFromSquare: "e2", suggestedMoveToSquare: "e4", explanation: "..." }. (Assuming e2 white pawn, e3 & e4 empty on FEN).
Example for pawn capture exd5: { suggestedMoveNotation: "exd5", suggestedMoveFromSquare: "e4", suggestedMoveToSquare: "d5", explanation: "..." }. (Assuming e4 white pawn, d5 black piece on FEN).

Ensure EACH suggested move is not just plausible but **strictly adheres to all chess rules based on the provided FEN \`{{{currentBoardState}}}\`**.
If {{{numberOfSuggestions}}} is 1, provide the single best legal move. If more than 1, provide that many distinct, strong, legal options.
If you cannot find enough distinct legal and reasonable moves up to {{{numberOfSuggestions}}}, provide as many as you can find, even if it's just one. If no legal moves exist (e.g. checkmate/stalemate), return an empty array for 'suggestions'.
The output MUST be a JSON object with a "suggestions" key, which is an array of objects matching the ExplainMoveHintOutputSchema structure.

**FINAL CHECK**: Before outputting, re-verify ALL conditions for EACH move against the FEN \`{{{currentBoardState}}}\`. Any doubt about legality means the move should not be suggested. Prioritize strict rule adherence above all else.
`,
});

const explainMoveHintsFlow = ai.defineFlow(
  {
    name: 'explainMoveHintsFlow',
    inputSchema: ExplainMoveHintInputSchema,
    outputSchema: ExplainMultipleMoveHintsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output || { suggestions: [] };
  }
);
