import { useState } from 'react';
import { todayInLondon } from './dates.js';

const SLOTS = ['08:00', '09:00', '10:00'];

export default function App() {
  const [slot, setSlot] = useState(SLOTS[0]);
  const [date, setDate] = useState(() => todayInLondon());

  return (
    <div className="app">
      <header className="masthead">
        <div className="brand">Chimera Sports Trading</div>
        <h1>FB13 Trade slip</h1>
      </header>

      <div className="banner" role="note">
        This page records what a person did elsewhere. It places nothing.
      </div>

      <main>
        <section className="fields" aria-label="Slip">
          <label>
            <span>Slot</span>
            <select value={slot} onChange={(e) => setSlot(e.target.value)}>
              {SLOTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </section>

        <section className="placeholder" aria-label="Paste box">
          <p>The paste box arrives in step 2.</p>
        </section>
      </main>

      <footer>
        <p>Worksheet, not yet the record. Everything stays in this browser.</p>
        <p className="tag">Born from complexity. Engineered for certainty.</p>
      </footer>
    </div>
  );
}
