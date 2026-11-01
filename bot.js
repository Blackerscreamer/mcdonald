const URL = "https://radio.mcdonalds.de/api/game/result";
const INTERVAL = 11000;   // Basis-Pause zwischen Versuchen (ms)
const JITTER = 3000;     // zusätzliche Zufallsstreuung (ms)
const LOSE_PRIZE = "rivet"; // solange DAS kommt, läuft es weiter
const MAX_ATTEMPTS = 0;        // 0 = unbegrenzt

const PAYLOAD = {
  username: "redtomatoe37@gmail.com",
  answers: [
    { questionId: "i-kissed-a-girl", variantId: "i-kissed-a-girl-1", optionId: "2008" },
    { questionId: "traum",         variantId: "traum-2",         optionId: "elstner" },
    { questionId: "toxic",         variantId: "toxic-2",         optionId: "stewardess" },
    { questionId: "sk8er-boi",     variantId: "sk8er-boi-2",     optionId: "krawatte" },
    { questionId: "sorry",         variantId: "sorry-1",         optionId: "3" }
  ]
};

let running = true;
let attempt = 0;
let backoff = 0;
let firstPrize = null;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function attemptOnce() {
  attempt++;
  const tag = `#${attempt}`;

  let res, text;
  try {
    res = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(PAYLOAD),
      cache: "no-store"
    });
    text = await res.text();
  } catch (e) {
    console.warn(tag, "Netzwerkfehler:", e.message);
    return "continue";
  }

  if (res.status === 429) {
    backoff = backoff ? Math.min(backoff * 2, 180000) : 30000;
    console.warn(`${tag} [429] Rate-Limit – warte ${backoff} ms`);
    return "continue";
  }
  backoff = 0;

  if (!res.ok) {
    console.warn(`${tag} [HTTP ${res.status}]`, text.slice(0, 300));
    return "continue";
  }

  let data = null;
  try { data = JSON.parse(text); } catch {}

  if (!data || !("prize" in data)) {
    console.warn(tag, "Antwort nicht parsebar / kein prize-Feld:", text.slice(0, 300));
    return "continue";
  }

  console.log(`${tag} [HTTP ${res.status}]`, JSON.stringify(data));

  if (firstPrize === null) firstPrize = data.prize;

  if (data.prize === LOSE_PRIZE) {
    console.log(`    -> ${LOSE_PRIZE} (Niete), weiter…`);
    return "continue";
  }

  console.log(`GEWONNEN: ${data.prize}`);
  console.log(`Nach ${attempt} Versuchen gestoppt.`);
  return "stop";
}

(async function loop() {
  console.log(`Start – stoppt bei allem, was nicht "${LOSE_PRIZE}" ist.`);
  while (running) {
    if (MAX_ATTEMPTS && attempt >= MAX_ATTEMPTS) {
      console.log(`Limit von ${MAX_ATTEMPTS} Versuchen erreicht.`);
      break;
    }

    const outcome = await attemptOnce();
    if (outcome === "stop") break;

    const wait = (backoff || INTERVAL) + Math.random() * JITTER;
    await sleep(wait);
  }
  running = false;
  console.log("Loop beendet.");
})();
