'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function createTrip() {
    setLoading(true);
    const res = await fetch('/api/trips', { method: 'POST' });
    const data = await res.json() as { tripId: string; participantId: string; pseudonym: string };
    localStorage.setItem(`partly_${data.tripId}`, JSON.stringify({
      participantId: data.participantId,
      pseudonym: data.pseudonym,
    }));
    router.push(`/trip/${data.tripId}`);
  }

  return (
    <main className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-8">
        <div>
          <h1 className="text-5xl font-bold text-stone-800 tracking-tight">partly</h1>
          <p className="mt-3 text-stone-500 text-lg">split trip expenses, no fuss</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8 space-y-4">
          <p className="text-stone-600">
            Share expenses with 2–5 people on a trip. No accounts, no logins. Just a link.
          </p>
          <ul className="text-sm text-stone-500 text-left space-y-1 pl-2">
            <li>→ Add expenses as you go</li>
            <li>→ Share the link with your crew</li>
            <li>→ See who owes what at the end</li>
          </ul>
          <button
            onClick={createTrip}
            disabled={loading}
            className="w-full mt-4 bg-stone-800 hover:bg-stone-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Starting...' : 'Start a new trip →'}
          </button>
        </div>

        <p className="text-xs text-stone-400">
          Trips are automatically deleted 60 days after they start.
          Anyone with the link can view and edit — no passwords.
        </p>
      </div>
    </main>
  );
}
