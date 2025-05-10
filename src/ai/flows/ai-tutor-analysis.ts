// src/ai/flows/ai-tutor-analysis.ts
'use server';

/**
 * @fileOverview Provides an AI tutor analysis of the current chess board state.
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
    .describe('A string representation of the current chess board state in FEN notation.'),
  currentTurn: z.string().describe('The current turn in the chess game (white or black).'),
});
export type AiTutorAnalysisInput = z.infer<typeof AiTutorAnalysisInputSchema>;

const AiTutorAnalysisOutputSchema = z.object({
  analysis: z.string().describe('An analysis of the current board state, including key threats, opportunities, and potential weaknesses.'),
});
export type AiTutorAnalysisOutput = z.infer<typeof AiTutorAnalysisOutputSchema>;

export async function aiTutorAnalysis(input: AiTutorAnalysisInput): Promise<AiTutorAnalysisOutput> {
  return aiTutorAnalysisFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiTutorAnalysisPrompt',
  input: {schema: AiTutorAnalysisInputSchema},
  output: {schema: AiTutorAnalysisOutputSchema},
  prompt: `You are an expert chess tutor, providing analysis of the current board state to help players improve their understanding and decision-making.

  Analyze the current chess board state, identifying key threats, opportunities, and potential weaknesses for both white and black.

  Board State (FEN Notation): {{{boardState}}}
  Current Turn: {{{currentTurn}}}

  Provide a detailed analysis that includes:
  - Overview of the material balance and pawn structure.
  - Identification of any immediate threats to either player's pieces or king.
  - Assessment of the positional advantages or disadvantages for each player.
  - Suggestions for potential tactical or strategic moves to improve the current player's position.
  - Highlighting any potential weaknesses in the opponent's position that could be exploited.
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
