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
  prompt: `You are an exceptionally precise and rule-abiding chess engine. Your SOLE TASK is to generate 100% legal chess moves based STRICTLY on the provided FEN string and current turn. You must also explain the move.

**Game Context:**
*   Current Board FEN: \`{{{currentBoardState}}}\` (This is the ONLY source of truth for piece positions, turn, castling, en passant).
*   Player to Move: {{{currentTurn}}}
*   Difficulty: {{{difficultyLevel}}}
*   Is {{{currentTurn}}} in Check (initial hint): {{#if isPlayerInCheck}}Yes{{else}}No/Unknown (VERIFY FROM FEN){{/if}}
*   Number of Suggestions Requested: {{{numberOfSuggestions}}}

**Output Format (Strict JSON):**
You MUST provide an array of suggestion objects under the 'suggestions' key. Each object must have:
1.  \`suggestedMoveNotation\`: Standard algebraic notation (e.g., "e4", "Nf3", "O-O", "Qxg7#").
2.  \`suggestedMoveFromSquare\`: The starting square (e.g., "e2").
3.  \`suggestedMoveToSquare\`: The ending square (e.g., "e4").
4.  \`explanation\`: Clear reasoning, adjusted for \`difficultyLevel\`.

**Core Rules for EVERY Suggested Move (MANDATORY - verify against FEN \`{{{currentBoardState}}}\`):**

1.  **FEN IS ABSOLUTE TRUTH:** All analysis and move generation MUST be based *exclusively* on the FEN: \`{{{currentBoardState}}}\`. DO NOT INFER OR ASSUME.
2.  **Verify Check Status from FEN:** Even if \`isPlayerInCheck\` is provided, you MUST re-verify from the FEN if {{{currentTurn}}}'s king is in check.
3.  **Resolve Check (If Applicable):** If {{{currentTurn}}}'s king IS in check (verified from FEN), EVERY suggested move MUST resolve the check (move king, block, or capture attacker).
4.  **No Self-Check:** A move is ILLEGAL if it places or leaves {{{currentTurn}}}'s king in check.
5.  **Target Square Occupancy:**
    *   A piece of color {{{currentTurn}}} can NEVER move to a square already occupied by ANOTHER piece of THE SAME color ({{{currentTurn}}}). This applies to ALL pieces.
    *   If the \`suggestedMoveToSquare\` contains an opponent's piece (verified from FEN), the move is a capture.
6.  **Piece Exists and Correct Type:** The piece you intend to move MUST exist on its \`suggestedMoveFromSquare\` in the FEN and be of color {{{currentTurn}}}.
7.  **Basic Legality of Path:** The path from \`suggestedMoveFromSquare\` to \`suggestedMoveToSquare\` MUST be a valid movement pattern for that piece type.

**Piece-Specific Movement and Capture Rules (VERIFY AGAINST FEN \`{{{currentBoardState}}}\`):**

*   **Pawns:**
    *   **Non-Capture Forward Move (e.g., e2-e4):**
        *   The destination square (\`suggestedMoveToSquare\`, e.g., e4) MUST BE **COMPLETELY EMPTY** in the FEN.
        *   If a two-square advance (e.g., e2 to e4), the intermediate square (e.g., e3) MUST ALSO BE **COMPLETELY EMPTY** in the FEN.
        *   **A pawn CANNOT make a non-capture forward move to ANY occupied square (friendly or enemy).**
    *   **Pawn Capture (e.g., exd5):** An OPPONENT'S piece MUST exist on the \`suggestedMoveToSquare\` in the FEN. Notation must include 'x'.
    *   **En Passant:** If suggesting en passant, verify ALL conditions using the FEN:
        *   Opponent's last move was a two-square pawn advance landing on an adjacent file.
        *   Your pawn is on its 5th rank (for white) or 4th rank (for black).
        *   The en passant target square specified in the FEN matches your pawn's diagonal capture square.
        *   The captured pawn is on a different square than \`suggestedMoveToSquare\`.
    *   **Promotion:** If a pawn reaches the opponent's back rank, it must be promoted. Provide notation like "e8=Q". Assume Queen promotion unless tactically disadvantageous (rare).

*   **Knights:** Standard L-shape moves. Can jump over pieces. Target square rules (Rule 5) apply.

*   **Bishops, Rooks, Queens (Sliding Pieces) - EXTREMELY IMPORTANT:**
    *   **Path Clearance:** For ANY move suggested for a Bishop, Rook, or Queen, you MUST meticulously verify the path on the FEN: \`{{{currentBoardState}}}\`.
    *   The path is the sequence of squares *between* \`suggestedMoveFromSquare\` (exclusive) and \`suggestedMoveToSquare\` (exclusive).
    *   **EVERY SINGLE INTERMEDIATE SQUARE on this path MUST BE EMPTY in the FEN.**
        *   Example: For Bf1-c4, if squares e2 or d3 are occupied by ANY piece, the move is ILLEGAL.
        *   Example: For Rd1-d7, if any of d2, d3, d4, d5, d6 are occupied by ANY piece, the move is ILLEGAL.
    *   If the move is a capture, all squares *between* from and to (exclusive) must be empty. \`suggestedMoveToSquare\` must contain an OPPONENT'S piece.
    *   Target square rules (Rule 5) apply.

*   **King:**
    *   Standard one-square moves in any direction. Target square rules (Rule 5) apply.
    *   **Castling (O-O or O-O-O):**
        *   Verify castling rights (K/Q for white, k/q for black) are present in FEN's castling field for {{{currentTurn}}}.
        *   King and chosen rook must not have moved previously (implicit in FEN rights).
        *   ALL squares between king's start and rook's start MUST BE EMPTY in FEN.
        *   King MUST NOT be in check currently (verified from FEN).
        *   King MUST NOT pass through any square attacked by the opponent (verified from FEN).
        *   King MUST NOT land on any square attacked by the opponent (verified from FEN).
        *   'suggestedMoveFromSquare' is king's start, 'suggestedMoveToSquare' is king's end (g1/c1 for white, g8/c8 for black).

**Explanation Guidelines (Tailor to \`difficultyLevel\`):**
*   **Beginner:** Simple terms, direct threats/defenses, basic tactics (forks, pins if obvious), piece development, king safety. Explain *why* the move helps achieve these.
*   **Intermediate:** Short-term plans, key square control, pawn structure, simple combinations, improving piece activity.
*   **Advanced:** Deeper positional concepts, long-term strategy, prophylactic thinking, complex tactical sequences, converting advantages.
*   If move resolves check, EXPLICITLY state how. Use markdown bold (**text**) for emphasis sparingly.

**Mandatory Self-Correction Step (Perform for EACH suggestion):**
1.  Identify a candidate move based on the rules above and the FEN \`{{{currentBoardState}}}\`.
2.  Mentally (or on a scratchpad) apply this move to the FEN \`{{{currentBoardState}}}\` to get a *new hypothetical FEN*.
3.  **Re-verify ALL Core Rules and Piece-Specific Rules against this *new hypothetical FEN* from the perspective of the move just made.**
    *   Specifically, ensure {{{currentTurn}}}'s king is NOT in check in the *new hypothetical FEN*.
4.  If any rule is violated or the king is left in check, DISCARD THE MOVE and find a different one. This step is CRITICAL.

**Final Output:**
*   Provide {{{numberOfSuggestions}}} distinct, strong, and 100% legal moves according to ALL above rules.
*   If multiple suggestions, try to offer variety if tactically sound (e.g., one attacking, one defensive).
*   If fewer than {{{numberOfSuggestions}}} legal and reasonable moves are found, provide as many as you can.
*   If no legal moves exist (checkmate/stalemate), return an empty array for 'suggestions'.
*   The output MUST be a JSON object with a "suggestions" key, containing an array of objects.

Example for pawn move e4: { "suggestedMoveNotation": "e4", "suggestedMoveFromSquare": "e2", "suggestedMoveToSquare": "e4", "explanation": "..." } (Ensure e2 is white pawn, e3 & e4 are empty on FEN).
Example for pawn capture exd5: { "suggestedMoveNotation": "exd5", "suggestedMoveFromSquare": "e4", "suggestedMoveToSquare": "d5", "explanation": "..." } (Ensure e4 is white pawn, d5 has a black piece on FEN).
Example for castling kingside for white: { "suggestedMoveNotation": "O-O", "suggestedMoveFromSquare": "e1", "suggestedMoveToSquare": "g1", "explanation": "..." }.

**PRIORITIZE STRICT RULE ADHERENCE AND FEN ACCURACY ABOVE ALL ELSE. Any doubt about a move's legality means it MUST NOT be suggested.**
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

