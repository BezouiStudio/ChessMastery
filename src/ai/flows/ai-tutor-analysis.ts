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
  difficultyLevel: z
    .enum(['beginner', 'intermediate', 'advanced'])
    .describe('The difficulty level of the AI opponent.'),
});
export type AiTutorAnalysisInput = z.infer<typeof AiTutorAnalysisInputSchema>;

const AiTutorAnalysisOutputSchema = z.object({
  playerMoveEvaluation: z.string().optional().describe("Evaluation of the player's last move: its quality (e.g., brilliant, excellent, good, inaccuracy, mistake, blunder), strategic/tactical implications, strengths, and weaknesses. This field is present if a 'lastPlayerMove' was provided in the input."),
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
  prompt: `You are a world-class chess grandmaster and coach, known for your insightful and pedagogical explanations. Your goal is to help the user improve their chess understanding and strategic thinking.
Current Board State (FEN Notation): {{{boardState}}}
It is currently {{{currentTurn}}}'s turn to move.
User's Difficulty Level: {{{difficultyLevel}}}

{{#if lastPlayerMove}}
The player ({{#if lastMoveMadeByWhite}}White{{/if}}{{#if lastMoveMadeByBlack}}Black{{/if}}) just played: {{{lastPlayerMove}}}.
Analyze this specific move for the player who made it:
1.  **Player's Move Evaluation**: Evaluate the strategic and tactical implications of {{{lastPlayerMove}}}. 
    Categorize its quality using standard chess annotations (e.g., **Brilliant!!**, **Excellent!**, **Good**, **Interesting!?**, **Dubious?!**, **Inaccuracy?**, **Mistake?**, **Blunder(??)**). 
    Explain the immediate tactical consequences and longer-term strategic implications (positive or negative). Use clear chess terminology. Use markdown bold syntax (**text**) for emphasis on key terms like move quality or important concepts. Be thorough in identifying what the move accomplished, what it gave up, and any missed opportunities.
2.  **Better Alternatives**: If significantly better alternative moves existed for the player instead of {{{lastPlayerMove}}}, list one or two such moves. For each, provide the move in algebraic notation and a concise explanation of *why* it would have been stronger, referencing concrete variations (if brief) or resulting positional benefits (e.g., 'gaining a tempo,' 'improving piece coordination,' 'exploiting a weakness'). If {{{lastPlayerMove}}} was among the best available moves or optimal, clearly state that. Use markdown bold syntax for emphasis.
{{/if}}

Now, provide a general analysis FOR THE PLAYER WHOSE TURN IT IS NOW ({{{currentTurn}}}):
3.  **General Board Analysis**: Provide a comprehensive analysis from the perspective of the player whose turn it is ({{{currentTurn}}}). Cover:
    *   **Material Balance**: Note any imbalances and their significance.
    *   **King Safety**: Assess the safety of both kings. Are there any immediate threats or potential future dangers (e.g., exposed king, weak pawn cover, back-rank vulnerabilities)?
    *   **Piece Activity & Coordination**: How well are {{{currentTurn}}}'s pieces working together? Are any pieces passive, undeveloped, or out of play? Identify key active pieces for both sides.
    *   **Pawn Structure**: Analyze strengths (e.g., passed pawns, strong central pawns, pawn chains) and weaknesses (e.g., isolated pawns, doubled pawns, backward pawns, pawn islands) for both sides.
    *   **Space Advantage & Central Control**: Who controls more territory, especially in the center?
    *   **Control of Key Squares/Files/Diagonals**: Identify strategically important squares, open files, or long diagonals that are contested or controlled.
    *   **Immediate Threats & Opportunities**: What are the most pressing tactical threats (from the opponent) or opportunities (for {{{currentTurn}}}) on the board?
    Use markdown bold syntax for emphasis on critical aspects.
4.  **Strategic Suggestions for {{{currentTurn}}}**: Suggest one or two distinct strategic or tactical ideas for {{{currentTurn}}} to consider for their upcoming move. These should be concrete moves. For each suggestion:
    *   **Move**: In algebraic notation.
    *   **Rationale**: Explain the purpose of the move (e.g., exploiting a specific weakness you identified in the general analysis, improving piece placement for future plans, initiating an attack, critical defense, seizing initiative, simplifying to a favorable endgame).
    *   **Follow-up (briefly)**: What is the general idea or plan after this move? What does it aim to achieve in the next few turns?
    Use markdown bold syntax for emphasis.

**Difficulty-Specific Guidance (VERY IMPORTANT - tailor your entire response to this):**
*   **Beginner ({{{difficultyLevel}}}):** Focus on fundamental principles. Explain concepts in simple terms. Emphasize avoiding one-move blunders, recognizing basic tactics (forks, pins, skewers), simple checkmates, and the importance of developing all pieces. Keep variations short and direct. Ensure explanations are concise and focus on the most immediate and obvious consequences.
*   **Intermediate ({{{difficultyLevel}}}):** Introduce more complex tactical patterns and positional concepts (e.g., outposts, pawn weaknesses, opening traps, weak square complexes). Discuss simple multi-move plans and the concept of initiative. Explain "why" a move is good beyond just the immediate capture. Point out tactical vulnerabilities that might arise a few moves later.
*   **Advanced ({{{difficultyLevel}}}):** Discuss deeper strategic nuances, long-term planning, prophylactic thinking (preventing opponent's ideas), complex combinations, converting advantages, and subtle positional factors. You can explore short but relevant variations. Highlight subtle long-term consequences of moves.

Respond strictly in the format defined by the output schema.
For "playerMoveEvaluation", provide a comprehensive text. Ensure it clearly states the pros and cons of the player's move and its overall quality.
For "betterPlayerMoveSuggestions", provide an array of objects or omit if none. If the player's move was good, explicitly state that in "playerMoveEvaluation" and this array can be empty or state "No significantly better alternatives."
For "generalBoardAnalysis", provide a comprehensive text.
For "suggestedMovesForCurrentTurn", provide an array of objects or omit if none. If the position is very balanced with no clear plan, you can state that.
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
