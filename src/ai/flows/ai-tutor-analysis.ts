// src/ai/flows/ai-tutor-analysis.ts
'use server';

/**
 * @fileOverview Provides an AI tutor analysis of the current chess board state,
 * including an evaluation of the player's last move if provided.
 *
 * - aiTutorAnalysis - A function that provides an analysis of the current board state.
 * - AiTutorAnalysisInput - The input type for the aiTutorAnalysis function.
 * - AiTutorAnalysisOutput - The return type for the aiTutorAnalysis function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AiTutorAnalysisInputSchema = z.object({
  boardState: z
    .string()
    .describe('A string representation of the current chess board state in FEN notation, AFTER any last move.'),
  currentTurn: z.string().describe('The current turn in the chess game (w or b), AFTER any last move. This is the AI\'s turn if a player move was just made.'),
  lastPlayerMove: z.string().optional().describe('The last move made by the human player in algebraic notation (e.g., e4, Nf3). If provided, the analysis will include an evaluation of this move.'),
  lastMoveMadeByWhite: z.boolean().optional().describe('True if the lastPlayerMove was made by White. Provide only if lastPlayerMove is present.'),
  lastMoveMadeByBlack: z.boolean().optional().describe('True if the lastPlayerMove was made by Black. Provide only if lastPlayerMove is present.'),
});
export type AiTutorAnalysisInput = z.infer<typeof AiTutorAnalysisInputSchema>;

const AiTutorAnalysisOutputSchema = z.object({
  playerMoveEvaluation: z.string().optional().describe("Evaluation of the player's last move: its quality (e.g., excellent, good, inaccuracy, mistake, blunder), strategic/tactical implications, strengths, and weaknesses. This field is present if a 'lastPlayerMove' was provided in the input."),
  betterPlayerMoveSuggestions: z.array(z.object({ 
    move: z.string().describe("Suggested better move in algebraic notation."), 
    explanation: z.string().describe("Explanation why this move is better.") 
  })).optional().describe("Suggestions for better alternative moves for the player, if any. This field is present if a 'lastPlayerMove' was provided and better moves were identified by the AI. If the player's move was optimal or very good, this might be empty or state that no significantly better alternatives were available."),
  generalBoardAnalysis: z.string().describe("A general analysis of the current board state: material balance, pawn structure, king safety, and key positional advantages or disadvantages for both White and Black. This analysis is from the perspective of the 'currentTurn' player."),
  suggestedMovesForCurrentTurn: z.array(z.object({ 
    move: z.string().describe("Suggested move in algebraic notation for the 'currentTurn' player."), 
    explanation: z.string().describe("Reasoning for this strategic or tactical suggestion for the 'currentTurn' player.") 
  })).optional().describe("Strategic or tactical move suggestions for the player whose turn it is now ('currentTurn').")
});
export type AiTutorAnalysisOutput = z.infer<typeof AiTutorAnalysisOutputSchema>;

export async function aiTutorAnalysis(input: AiTutorAnalysisInput): Promise<AiTutorAnalysisOutput> {
  return aiTutorAnalysisFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiTutorAnalysisPrompt',
  input: {schema: AiTutorAnalysisInputSchema},
  output: {schema: AiTutorAnalysisOutputSchema},
  prompt: `You are an expert chess tutor.

Current Board State (FEN Notation): {{{boardState}}}
It is currently {{{currentTurn}}}'s turn to move.

{{#if lastPlayerMove}}
The player ({{#if lastMoveMadeByWhite}}White{{/if}}{{#if lastMoveMadeByBlack}}Black{{/if}}) just played: {{{lastPlayerMove}}}.
Analyze this specific move for the player who made it:
1.  **Player's Move Evaluation**: Evaluate the strategic and tactical implications of {{{lastPlayerMove}}}. Categorize its quality (e.g., **Excellent**, **Good**, **Inaccuracy**, **Mistake**, **Blunder**). Detail its strengths and weaknesses. Use markdown bold syntax (**text**) for emphasis on key terms like move quality or important concepts.
2.  **Better Alternatives**: If there were clearly better alternative moves for the player instead of {{{lastPlayerMove}}}, list one or two such moves. For each, provide the move in algebraic notation and a concise explanation of why it would have been stronger. If {{{lastPlayerMove}}} was optimal or very good, state that no significantly better alternatives were available or the move was strong. Use markdown bold syntax for emphasis.
{{/if}}

Now, provide a general analysis FOR THE PLAYER WHOSE TURN IT IS NOW ({{{currentTurn}}}):
3.  **General Board Analysis**: Give an overview of the material balance, pawn structure, king safety for both sides, and key positional advantages or disadvantages. Use markdown bold syntax for emphasis.
4.  **Strategic Suggestions for {{{currentTurn}}}**: Suggest one or two potential strategic or tactical moves for {{{currentTurn}}} to consider for their upcoming move. For each suggestion, provide the move in algebraic notation and explain the reasoning behind it (e.g., improving piece activity, exploiting a weakness, setting up an attack, defensive necessity). Use markdown bold syntax for emphasis.

Respond strictly in the format defined by the output schema.
For "playerMoveEvaluation", provide a comprehensive text.
For "betterPlayerMoveSuggestions", provide an array of objects or omit if none. If the player's move was good, explicitly state that in "playerMoveEvaluation" and this array can be empty.
For "generalBoardAnalysis", provide a comprehensive text.
For "suggestedMovesForCurrentTurn", provide an array of objects or omit if none.
`,
});

const aiTutorAnalysisFlow = ai.defineFlow(
  {
    name: 'aiTutorAnalysisFlow',
    inputSchema: AiTutorAnalysisInputSchema,
    outputSchema: AiTutorAnalysisOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
