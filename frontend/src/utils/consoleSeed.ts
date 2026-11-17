import { apiFetch } from '../api/client';

export function setupConsoleSeed() {
  const runSeed = async (days: number = 180) => {
    console.log('%c🌱 Seeding ' + days + ' days of Indian grocery sales and batches...', 'color: #16a34a; font-weight: bold; font-size: 14px;');
    try {
      const res = await apiFetch('/sales/generate', {
        method: 'POST',
        body: JSON.stringify({ days, overwrite: true }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('%c❌ Seeding failed: ' + (err.message || 'Unknown error'), 'color: #dc2626; font-weight: bold;');
        return;
      }

      const data = await res.json();
      console.log('%c✅ Products created: ' + data.productsCreated + ' Indian grocery items', 'color: #16a34a;');
      console.log('%c✅ Batches created: ' + data.batchesCreated + ' purchase batches', 'color: #16a34a;');
      console.log('%c✅ Sales created: ' + data.salesRecordsCreated + ' daily transaction records', 'color: #16a34a;');
      console.log('%c🤖 Holdout model evaluation completed and saved to history.', 'color: #0284c7;');
      console.log('%c🎉 Done! Refreshing the dashboard in 1.5 seconds...', 'color: #16a34a; font-weight: bold; font-size: 13px;');

      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      console.error('%c❌ Network error during seeding: ' + err.message, 'color: #dc2626;');
    }
  };

  // Expose window.seed(days) function
  (window as any).seed = runSeed;

  // Enable typing "/seed" in the console
  // When the user enters "/seed", the browser evaluates the RegExp.
  // Overriding Symbol.toPrimitive and valueOf allows executing the seed when evaluated.
  const originalValueOf = RegExp.prototype.valueOf;
  const originalToPrimitive = (RegExp.prototype as any)[Symbol.toPrimitive];

  let lastTriggerTime = 0;
  function handleRegExpEval(regex: RegExp) {
    if (regex.source === 'seed' && regex.flags === '') {
      const now = Date.now();
      // Debounce so it only fires once per console enter
      if (now - lastTriggerTime > 2000) {
        lastTriggerTime = now;
        runSeed();
      }
      return '🌱 Initiating /seed command...';
    }
  }

  (RegExp.prototype as any)[Symbol.toPrimitive] = function (hint: string) {
    const res = handleRegExpEval(this);
    if (res) return res;
    if (originalToPrimitive) return originalToPrimitive.call(this, hint);
    return this.toString();
  };

  RegExp.prototype.toString = function () {
    const res = handleRegExpEval(this);
    if (res) return res;
    return `/${this.source}/${this.flags}`;
  };

  console.log(
    '%c💡 ShelfLife Console Command Ready:%c Type %c/seed%c or %cseed()%c in this console to populate 180 days of Indian grocery sales and batches.',
    'color: #0284c7; font-weight: bold;',
    'color: inherit;',
    'background: #f1f5f9; padding: 2px 5px; border-radius: 4px; font-weight: bold; color: #16a34a;',
    'color: inherit;',
    'background: #f1f5f9; padding: 2px 5px; border-radius: 4px; font-weight: bold; color: #16a34a;',
    'color: inherit;'
  );
}
