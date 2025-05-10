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
  prompt: `You are a chess tutor. The player is asking for a general hint.
Current Board State (FEN): {{{currentBoardState}}}
It's {{{currentTurn}}}'s turn.
Difficulty: {{{difficultyLevel}}}

Provide a brief, vague strategic tip or an area of the board to focus on.
DO NOT suggest a specific move.
Keep it to 1-2 sentences.
Your response should directly be the hint text.

Examples of good vague hints:
- "Consider improving the coordination of your pieces."
- "Look for ways to control the center of the board."
- "Evaluate the safety of your king."
- "Are there any undefended pieces for either side?"
- "Think about your pawn structure and potential weaknesses."
- "Is there an opportunity to activate your rooks?"
- "Check for any tactical possibilities like forks or pins."
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
