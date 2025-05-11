'use server';
/**
 * @fileOverview Provides a vague, general strategic hint for a chess game.
 *
 * - getVagueChessHint - A function that provides a general strategic tip.
 * - VagueChessHintInput - The input type for the getVagueChessHint function.
 * - VagueChessHintOutput - The return type for the getVagueChessHint function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const VagueChessHintInputSchema = z.object({
  currentBoardState: z.string().describe('FEN representation of the current chess board state.'),
  currentTurn: z.string().describe('The color of the player whose turn it is (w or b).'),
  difficultyLevel: z.enum(['beginner', 'intermediate', 'advanced']).describe('The difficulty level of the game context.'),
  isPlayerInCheck: z.boolean().optional().describe('Whether the current player (whose turn it is) is in check.'),
});
export type VagueChessHintInput = z.infer<typeof VagueChessHintInputSchema>;

const VagueChessHintOutputSchema = z.object({
  vagueHint: z.string().describe('A general strategic tip or area of focus, not a specific move. Max 1-2 sentences.'),
});
export type VagueChessHintOutput = z.infer<typeof VagueChessHintOutputSchema>;

export async function getVagueChessHint(input: VagueChessHintInput): Promise<VagueChessHintOutput> {
  return vagueChessHintFlow(input);
}

const prompt = ai.definePrompt({
  name: 'vagueChessHintPrompt',
  input: {schema: VagueChessHintInputSchema},
  output: {schema: VagueChessHintOutputSchema},
  prompt: `You are a helpful chess coach providing general, guiding hints. Your hints should steer the player towards good thinking habits without giving away specific moves.
Current Board State (FEN): {{{currentBoardState}}}
It's {{{currentTurn}}}'s turn.
User's Difficulty: {{{difficultyLevel}}}
{{#if isPlayerInCheck}}
The player ({{{currentTurn}}}) is currently in CHECK. The hint MUST be about resolving the check.
{{/if}}

Provide a brief, vague strategic tip or an area of the board to focus on.
DO NOT suggest a specific move.
Keep it to 1-2 sentences.
Your response should directly be the hint text.

**Adapt your hint to the \`difficultyLevel\`:**
*   **Beginner ({{{difficultyLevel}}}):**
    *   (If in check): "How can you make your King safe from the check?" or "Look for ways to block the check or move your King."
    *   (Not in check): "Are all your pieces developed and active?" or "Is your King safe?" or "Can you attack one of your opponent's pieces?" or "Look for undefended pieces."
*   **Intermediate ({{{difficultyLevel}}}):**
    *   (If in check): "What are all the ways to get out of check? Which one is safest or most active?" or "Can you block the check while also improving your position or creating a threat?"
    *   (Not in check): "Consider improving the coordination of your pieces." or "Look for ways to control the center of the board." or "Evaluate the safety of your king and opponent's king." or "Are there any pawn breaks you can make?" or "How can you improve your worst-placed piece?" or "Are there any open files for your rooks?"
*   **Advanced ({{{difficultyLevel}}}):**
    *   (If in check): "Evaluate the consequences of each way to meet the check. Does one lead to a better position or counterplay?"
    *   (Not in check): "Consider prophylactic moves to prevent your opponent's plans." or "Evaluate imbalances in the position (e.g., bishop vs knight, pawn structure)." or "Is there a way to change the pawn structure to your favor?" or "Are there any long-term strategic weaknesses to target?" or "Think about king safety for both sides in the long run."

Examples of good vague hints (general, adapt if in check and based on difficulty):
- "Consider improving the coordination of your pieces."
- "Look for ways to control the center of the board."
- "Evaluate the safety of your king." (Especially relevant if in check!)
- "Are there any undefended pieces for either side?"
- "Think about your pawn structure and potential weaknesses."
- "Is there an opportunity to activate your rooks on open files?"
- "Check for any tactical possibilities like forks, pins, or skewers."
- (If in check for Beginner): "Focus on how to get your King out of danger."
- (If in check for Intermediate): "Can you block the check or capture the piece threatening your King, perhaps with a counter-attack?"
`,
});

const vagueChessHintFlow = ai.defineFlow(
  {
    name: 'vagueChessHintFlow',
    inputSchema: VagueChessHintInputSchema,
    outputSchema: VagueChessHintOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
