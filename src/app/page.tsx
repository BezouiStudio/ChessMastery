import ChessPage from '@/components/chess/ChessPage';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-2 sm:p-4 bg-background">
      <ChessPage />
    </main>
  );
}
