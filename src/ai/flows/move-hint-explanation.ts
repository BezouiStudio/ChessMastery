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
  prompt: `You are an exceptionally precise and rule-abiding chess engine with a talent for clear explanation. Your primary directive is to provide **100% legal, strategically sound chess moves** based *solely* on the provided FEN string. You must also explain the move's purpose, targeting the user's \`difficultyLevel\`.

Current Board State (FEN): {{{currentBoardState}}}
It is {{{currentTurn}}}'s turn.
User's Difficulty Level: {{{difficultyLevel}}}
{{#if isPlayerInCheck}}
The player ({{{currentTurn}}}) is currently in CHECK. This is a critical piece of information for your move suggestions. All suggestions MUST resolve the check.
{{else}}
You MUST meticulously analyze the FEN \`{{{currentBoardState}}}\` to determine if {{{currentTurn}}} is in check, even if 'isPlayerInCheck' is not provided or is false. If in check, all suggestions MUST resolve it.
{{/if}}

You need to provide {{{numberOfSuggestions}}} distinct, strong, and **100% legal chess moves**.
If \`{{{numberOfSuggestions}}}\` is greater than 1, strive to offer moves with *different strategic or tactical ideas* if the position allows for such variety (e.g., one defensive, one attacking; or one positional, one tactical).
For each suggestion, you must provide:
1.  The move in standard algebraic notation (e.g., e4, Nf3, O-O, Qxg7#). This is 'suggestedMoveNotation'.
2.  The 'from' square (e.g., 'e2'). This is 'suggestedMoveFromSquare'.
3.  The 'to' square (e.g., 'e4'). This is 'suggestedMoveToSquare'.
4.  A clear explanation for 'explanation'.

**CRITICAL INSTRUCTIONS - ADHERE STRICTLY FOR EACH SUGGESTION:**
The FEN string \`{{{currentBoardState}}}\` is the **ABSOLUTE AND ONLY SOURCE OF TRUTH** for all piece positions, turn, castling rights, en passant target, and game state. Do not infer or assume any state not explicitly represented in this FEN. Your analysis and move generation MUST be rooted *exclusively* in this FEN.

1.  **Analyze Board and Check Status from FEN**:
    *   Meticulously analyze the FEN: \`{{{currentBoardState}}}\`.
    *   Determine if {{{currentTurn}}} is in check based *solely* on this FEN. Use 'isPlayerInCheck' as a hint, but verify with the FEN.
2.  **Identify Strong, 100% Verifiably Legal Moves Directly From FEN Analysis**:
    *   Based *only* on the FEN \`{{{currentBoardState}}}\` and whose turn it is ({{{currentTurn}}}), identify the requested number of strong and **100% legal chess moves**.
    *   **If {{{currentTurn}}} is in check (verified from FEN!), ALL suggested moves ABSOLUTELY MUST resolve the check** (by moving the king, blocking, or capturing the attacker).
    *   **For pawn moves that are NOT captures (i.e., the pawn moves one or two squares forward to an empty square): The destination square (\`suggestedMoveToSquare\`) MUST BE EMPTY in the FEN. If it's a two-square pawn advance, the intermediate square (the square the pawn jumps over) MUST ALSO BE EMPTY in the FEN. A pawn CANNOT make a non-capture move to an already occupied square. THIS IS A NON-NEGOTIABLE RULE.**
    *   Consider the \`difficultyLevel\` ({{{difficultyLevel}}}) for move strength/complexity.
3.  **Standard Algebraic Notation**:
    *   Provide each move in standard algebraic notation. Ensure it's accurate for the move made from \`suggestedMoveFromSquare\` to \`suggestedMoveToSquare\` on the given FEN.
    *   If a pawn capture, use 'x' (e.g., exd5). If a non-capture pawn move, do not use 'x'.
4.  **Accurate From/To Squares**:
    *   For EACH \`suggestedMoveNotation\` you generate, and based *strictly* on the \`currentBoardState\` FEN, precisely determine its 'suggestedMoveFromSquare' and 'suggestedMoveToSquare'.
    *   These squares MUST correspond to the starting and ending square of a specific, single piece on the FEN of color {{{currentTurn}}} that can legally make the move.
    *   For castling (O-O or O-O-O), 'from' is king's start, 'to' is king's end.
5.  **Explain Each Move**:
    *   Explain the strategic and tactical reasoning behind the move. What does it achieve? What threats does it create or parry? How does it improve the position?
    *   If the player was in check (verified from FEN), explicitly state how the move resolves it.
    *   Use markdown bold syntax (**text**) for critical keywords or phrases in your explanation if appropriate for emphasis.
    *   **Adjust explanation complexity based on \`difficultyLevel\`:**
        *   **Beginner ({{{difficultyLevel}}}):** Simple terms, direct consequences, basic tactical ideas (e.g., 'attacks the knight', 'defends the pawn', 'prepares to castle').
        *   **Intermediate ({{{difficultyLevel}}}):** Explain short-term plans, control of key squares, pawn structure implications, common tactical motifs.
        *   **Advanced ({{{difficultyLevel}}}):** Discuss deeper positional concepts, long-term strategic goals, subtle tactical points, prophylactic value.

**MANDATORY VERIFICATION (Perform this with extreme diligence for EACH suggestion. Use ONLY the provided FEN \`{{{currentBoardState}}}\`. Failure to meet these checks means the output is unusable and incorrect):**
*   **Piece Exists & Correct Type**: Does the piece you intend to move actually exist on its \`suggestedMoveFromSquare\` in the FEN \`{{{currentBoardState}}}\`? Is it the correct color ({{{currentTurn}}}) and type for the move?
*   **Basic Legality of Path**: Is the path from \`suggestedMoveFromSquare\` to \`suggestedMoveToSquare\` a valid movement pattern for that specific piece type according to chess rules?
*   **Target Square Occupancy (CRITICAL FOR ALL PIECES)**:
    *   If the \`suggestedMoveToSquare\` contains a piece in the FEN \`{{{currentBoardState}}}\`, that piece MUST be of the OPPONENT'S color (i.e., a capture).
    *   A piece of color {{{currentTurn}}} can NEVER move to a square that is already occupied by another piece of THE SAME color ({{{currentTurn}}}).
    *   This applies to ALL pieces: Pawns, Knights, Bishops, Rooks, Queens, and Kings.
    *   For Pawns specifically: a non-capture forward move (e.g., e2-e4) requires the \`suggestedMoveToSquare\` (e.g., e4) to be EMPTY and for a two-square advance, the intermediate square (e.g., e3) must also be EMPTY. A pawn cannot make a non-capture move to ANY occupied square.
    *   The only exception to moving to an occupied square (by an opponent's piece for capture) is castling, where the King moves to an empty 'g1'/'c1' or 'g8'/'c8' and the Rook moves to an empty 'f1'/'d1' or 'f8'/'d8'. These castling squares must be empty.
*   **Pawn Move Legality (ABSOLUTELY CRITICAL - VERIFY AGAINST FEN \`{{{currentBoardState}}}\` FOR EACH PAWN MOVE SUGGESTION):**
    *   **Non-Capture Forward Move (e.g., a pawn moves one or two squares forward without capturing):**
        *   The destination square (\`suggestedMoveToSquare\`) of this pawn move MUST BE **COMPLETELY EMPTY** in the FEN \`{{{currentBoardState}}}\`.
        *   If it's a two-square initial pawn move (e.g., e2 to e4), the intermediate square (e.g., 'e3' for e2-e4, the square the pawn jumps over) MUST ALSO BE **COMPLETELY EMPTY** in the FEN \`{{{currentBoardState}}}\`.
        *   **A pawn CANNOT move forward (non-capture) onto ANY square that is occupied by ANY piece (friendly or enemy). THIS IS A FUNDAMENTAL RULE. If the target square of a forward pawn move has any piece on it, that move is ILLEGAL.**
    *   **Pawn Capture (e.g., exd5):** An OPPONENT'S piece MUST exist on the \`suggestedMoveToSquare\` in the FEN \`{{{currentBoardState}}}\`. The notation must include 'x'.
    *   **En Passant:** If suggesting en passant, ALL conditions (opponent's last move was a two-square pawn advance to an adjacent file, your pawn is on the 5th rank (for white) or 4th rank (for black), the en passant target square in FEN \`{{{currentBoardState}}}\` matches your pawn's capture square) MUST be met based on the FEN. The captured pawn is on a different square than \`suggestedMoveToSquare\`.
*   **Obstructions (EXTREMELY IMPORTANT for Bishops, Rooks, Queens)**:
    *   For any move suggested for a Bishop, Rook, or Queen, you MUST meticulously verify the path on the FEN: \`{{{currentBoardState}}}\`.
    *   The path is the sequence of squares between \`suggestedMoveFromSquare\` (exclusive) and \`suggestedMoveToSquare\` (exclusive).
    *   **EVERY SINGLE INTERMEDIATE SQUARE on this path MUST BE EMPTY in the FEN (\`{{{currentBoardState}}}\`)**. For example, for Bf1-c4, squares e2 and d3 MUST be empty (assuming f1-e2-d3-c4 path). For Rd1-d7, squares d2, d3, d4, d5, d6 MUST be empty.
    *   If the move is a capture (i.e., \`suggestedMoveToSquare\` contains an opponent's piece in the FEN \`{{{currentBoardState}}}\`), then all squares *between* \`suggestedMoveFromSquare\` (exclusive) and \`suggestedMoveToSquare\` (exclusive) must be empty. The \`suggestedMoveToSquare\` itself must be occupied by an OPPONENT'S piece.
    *   If any intermediate square is occupied by ANY piece (own or opponent), the move is ILLEGAL and MUST NOT be suggested.
    *   The target square (\`suggestedMoveToSquare\`) itself cannot be occupied by a friendly piece.
    *   This check is paramount. Do not assume clear paths. Verify with the FEN \`{{{currentBoardState}}}\` only.
*   **King Safety (Self-Check for {{{currentTurn}}}):** After imagining the move from \`suggestedMoveFromSquare\` to \`suggestedMoveToSquare\` on the FEN \`{{{currentBoardState}}}\`, would {{{currentTurn}}}'s king be in check? If yes, the move is ILLEGAL. Suggest a different move.
*   **Castling Rights & Path**: If suggesting castling (O-O or O-O-O):
    *   Are castling rights for the side ({{{currentTurn}}}) and type (K/Q for white, k/q for black) present in the FEN's castling field (\`{{{currentBoardState}}}\`)?
    *   Are ALL squares between the king's starting square and the rook's starting square EMPTY in the FEN \`{{{currentBoardState}}}\`? (e.g., for White O-O: f1, g1 empty; for White O-O-O: b1, c1, d1 empty).
    *   Does the king pass through or land on any square attacked by the opponent (based on the FEN \`{{{currentBoardState}}}\`)? (e.g., for White O-O: king must not pass through f1 or land on g1 if attacked).
    *   Is the king currently in check (based on the FEN \`{{{currentBoardState}}}\`)? (Cannot castle if in check).
*   **Accurate Square Derivation**: For EACH \`suggestedMoveNotation\` generated, are \`suggestedMoveFromSquare\` and \`suggestedMoveToSquare\` correctly and unambiguously derived from a single piece of color {{{currentTurn}}} on the FEN \`{{{currentBoardState}}}\` that can legally make that specific move? There should be no ambiguity.

**MANDATORY SELF-CORRECTION STEP (Perform for EACH suggestion):**
Before outputting ANY suggestion, simulate making the move on the FEN \`{{{currentBoardState}}}\`. Then, re-verify ALL the 'CRITICAL INSTRUCTIONS' and 'MANDATORY VERIFICATION' points using this *simulated resulting FEN*. If any check fails, discard the move and find a new one. This self-correction is vital.

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
