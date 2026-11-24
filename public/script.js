/* ---------- elements ---------- */
const $ = (s) => document.querySelector(s);
const landing = $('#landing'), chat = $('#chat-screen'), thanks = $('#thank-you');
const area = $('#chat-area'), form = $('#chat-form'), input = $('#answer-input');
const tapBar = $('#sentiment-buttons'), progressLabel = $('#progress-label'), chatBot = $('#chat-bot'), heroBot = $('#hero-bot');

/* ---------- content (edit these to change the flow) ---------- */
const ACKS = {
  great:    ['Glad to hear that!', 'Great to hear!', 'Happy that worked out.'],
  okay:     ['Okay, noted.', 'Thanks for the honesty.', 'Thanks for sharing.'],
  notGreat: ['I’m sorry about that.', 'Thank you for being honest about that.'],
};

const RATING_TAPS = [['😊 Great', 'great'], ['😐 Okay', 'okay'], ['🙁 Not great', 'notGreat']];
const YESNO_TAPS = [['👍 Yes', 'great'], ['🤔 Maybe', 'okay'], ['👎 No', 'notGreat']];

// lead: used only when the answer is a single word ("good" -> "Service was good.")
// phrase: used when the person only tapped, or answered a bare yes/no
let QUESTIONS = [
  {
    id: 'access', taps: RATING_TAPS, lead: 'Getting there was',
    text: 'Accessibility matters to us. Was it easy for you to get to this place? Any feedback on that is welcome.',
    phrase: { great: 'It was easy to get to.', okay: 'Getting there was okay.', notGreat: 'It was hard to get there.' },
    follow: {
      great: 'Anything that made it especially convenient?',
      okay: 'Was there anything that could have made it easier?',
      notGreat: 'What made it difficult to get here?',
    },
  },
  {
    id: 'service', taps: RATING_TAPS, lead: 'Service was',
    text: 'How was the service? Did you run into any trouble? Please tell us openly. We want everyone to feel welcome here, and we’re always working to do better.',
    phrase: { great: 'The service was good.', okay: 'The service was okay.', notGreat: 'I had some trouble with the service.' },
    follow: {
      great: 'Was there anyone or anything that stood out?',
      okay: 'What would have made it better?',
      notGreat: 'What went wrong, and how could we have handled it better?',
    },
  },
  {
    id: 'recommend',
    text: 'Would you recommend this place to a friend or family member?',
    taps: YESNO_TAPS,
    verdict: {
      great: 'I would recommend this place to friends or family.',
      okay: 'I might recommend it, depending on what you are looking for.',
      notGreat: 'I would not recommend this place right now.',
    },
    follow: {
      great: null, // a happy yes: just acknowledge and move on
      okay: 'What would make you more likely to recommend it?',
      notGreat: 'What would we need to change?',
    },
  },
  {
    id: 'overall', taps: RATING_TAPS, tapOnly: true, lead: 'Overall experience was',
    text: 'How would you rate your overall experience?',
    phrase: { great: 'Overall, it was a good experience.', okay: 'Overall, it was an okay experience.', notGreat: 'Overall, it was not a good experience.' },
  },
  {
    id: 'detail', // fully descriptive: no taps, no sentiment, no follow-up
    text: 'Was there something you really liked, or something you didn’t? We’d love to hear it. Honest feedback helps us improve.',
  },
];
const BY_ID = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

/* ---------- small helpers ---------- */
const NOTED = ['Okay, noted.', 'Noted, thank you for telling us.', 'Understood, thanks for letting us know.'];
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const wordCount = (t) => t.split(/\s+/).filter(Boolean).length;
const YES = /^(yes|yep|yeah|yup|haan|ha)[.!]*$/i;
const NO = /^(no|nope|nahi)[.!]*$/i;
const NOTHING = /^(no|nope|nothing|nah|na|none|n\/a|not really)[.!]*$/i;

function sentence(text) {
  const t = text.trim().replace(/[.!?]+$/, '');
  return t ? t.charAt(0).toUpperCase() + t.slice(1) + '.' : '';
}
function lowerFirst(s) {
  return /^I\b/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1);
}
function say(text, kind = 'bot', chip = null) {
  const el = document.createElement('div');
  el.className = `message ${kind}`;
  if (chip) {
    const c = document.createElement('span');
    c.className = 'chip';
    c.textContent = chip;
    el.append(c);
  }
  el.append(text);
  area.append(el);
  area.scrollTop = area.scrollHeight;
}
function askWithTyping(text, after) {
  const typing = document.createElement('div'); typing.className = 'typing'; typing.innerHTML = '<i></i><i></i><i></i>';
  area.append(typing); area.scrollTop = area.scrollHeight;
  setTimeout(() => { typing.remove(); say(text); if (after) after(); }, 520);
}
function setMood(sentiment) {
  const moodClass = sentiment === 'notGreat' ? 'pixel-concerned' : sentiment === 'okay' ? 'pixel-noted' : 'pixel-happy';
  chatBot.className = `mini-character ${moodClass}`;
  heroBot.classList.remove('pixel-happy', 'pixel-concerned', 'pixel-noted');
  heroBot.classList.add(moodClass);
}
function nodAfterNoted() {
  chatBot.classList.remove('pixel-noted');
  void chatBot.offsetWidth; // restart the CSS nod animation for each acknowledgement
  chatBot.classList.add('pixel-noted');
}

/* ---------- sentiment: tap > AI (2s) > keywords > okay ---------- */
const NEG = /slow|too long|little long|took long|late|rude|bad|difficult|dirty|poor|waited|problem|not good|kharab|ganda|bekar/;
const POS = /great|good|excellent|helpful|easy|friendly|amazing|loved|clean|badhiya|mast|achha|accha/;
function keywordSentiment(text) {
  const t = text.toLowerCase();
  if (NEG.test(t)) return 'notGreat'; // negative wins: "good but slow" gets an apology
  if (POS.test(t)) return 'great';
  return 'okay';
}
const THIN = /^(ok(ay)?|okk+|good|fine|nice|great|bad|yes|no|yep|nope|nothing|nah|na|none|idk|hmm+|k|same|average|decent|cool|best|worst|haan|nahi|theek|thik|accha|achha|badhiya|mast)[.!\s]*$/i;
const JUNK = /^[^\p{L}]*$|(.)\1{3,}|asdf|qwer|zxcv|sdfg|dfgh|hjkl/iu;
function localQuality(text) {
  if (/^\d+$/.test(text)) return 'thin';
  if (JUNK.test(text)) return 'junk';
  return THIN.test(text) ? 'thin' : null;
}
// returns { sentiment, quality: rich|thin|junk|none, aiSentiment }
async function analyse(text, tap) {
  if (!text) return { sentiment: tap || 'okay', quality: 'none', aiSentiment: null };
  const local = localQuality(text);
  if (local) return { sentiment: tap || keywordSentiment(text), quality: local, aiSentiment: null };
  let ai = null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 11000);
  try {
    const r = await fetch('/api/sentiment', {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, 500), businessSlug }),
    });
    ai = await r.json();
  } catch { /* use the local fallbacks below */ }
  finally { clearTimeout(timer); }
  const quality = ['rich', 'thin', 'junk'].includes(ai?.quality) ? ai.quality : (wordCount(text) >= 4 ? 'rich' : 'thin');
  return { sentiment: tap || ai?.sentiment || keywordSentiment(text), quality, aiSentiment: ai?.sentiment || null };
}

/* ---------- conversation state ---------- */
let index = 0, answers = [], phase = 'question', tap = null, tapLabel = null, cur = null, busy = false;
let googleUrl = null;
const businessSlug = location.pathname.match(/^\/r\/([^/]+)/)?.[1] || null;
const sessionId = sessionStorage.sayit_session || (sessionStorage.sayit_session = crypto.randomUUID());
const track = (type) => businessSlug && fetch(`/api/public/${businessSlug}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, session: sessionId }) }).catch(() => {});
const configUrl = businessSlug ? `/api/public/${businessSlug}` : '/api/config';
fetch(configUrl).then((r) => r.json()).then((c) => { googleUrl = c.googleUrl; if (c.name) { document.title = `Say It — ${c.name}`; $('#business-kicker').textContent = `THANKS FOR VISITING ${c.name.toUpperCase()}`; $('#business-title').innerHTML = `Your visit at<br><em>${escapeHtml(c.name)}</em> matters.`; $('#chat-business-name').textContent = c.name; } if (c.questions) QUESTIONS.forEach(q => { if (c.questions[q.id]) q.text = c.questions[q.id]; }); track('page_view'); }).catch(() => {});

function setTapBar(taps) {
  tap = null; tapLabel = null;
  tapBar.hidden = !taps;
  tapBar.innerHTML = '';
  (taps || []).forEach(([label, sentiment]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.sentiment = sentiment;
    b.textContent = label;
    tapBar.append(b);
  });
}

function askQuestion() {
  phase = 'question';
  cur = QUESTIONS[index];
  $('#skip-question').hidden = cur.id === 'overall';
  input.placeholder = cur.taps === YESNO_TAPS ? 'Add more if you want (optional)…' : cur.id === 'detail' ? 'Write as much or as little as you like…' : 'Type your answer here…';
  setTapBar(cur.taps);
  form.classList.toggle('tap-only', !!cur.tapOnly);
  progressLabel.textContent = `Question ${index + 1} of ${QUESTIONS.length}`;
  askWithTyping(cur.text);
}

function begin() {
  landing.classList.add('hidden');
  thanks.classList.add('hidden');
  chat.classList.remove('hidden');
  area.innerHTML = '';
  answers = []; index = 0; busy = false;
  track('started');
  say('Hi! I’ll help you gather your own words. Every question is optional.');
  setMood('great');
  setTimeout(askQuestion, 250);
}

function advance() {
  index++;
  index < QUESTIONS.length ? askQuestion() : finish();
}

async function submit(raw) {
  if (busy) return;
  let text = raw.trim();
  const chosen0 = tap;
  const chipLabel = tapLabel;
  if (phase === 'question' && cur.taps && /^\d+$/.test(text)) { // a bare "1" is ambiguous, so ignore it
    if (!chosen0) { say('That looks like a rating. Please tap one of the buttons above, or add a few words.'); input.value = ''; return; }
    text = '';
  }
  if (!text && !chosen0) return;
  busy = true;
  input.value = '';
  if (text || chipLabel) say(text, 'user', chipLabel);

  if (phase === 'followup') { // follow-up words are kept only if they say something real
    const { quality } = await analyse(text, null);
    cur.parent.followup = text;
    cur.parent.followQuality = quality;
    if (cur.parent.sentiment === 'notGreat' && quality !== 'junk' && text) {
      say(pick(NOTED));
      nodAfterNoted();
      setTimeout(() => { busy = false; advance(); }, 700);
    } else {
      busy = false;
      advance();
    }
    return;
  }

  const q = cur;
  let chosen = chosen0;
  if (!chosen && (q.id === 'access' || q.id === 'recommend')) chosen = YES.test(text) ? 'great' : NO.test(text) ? 'notGreat' : null;
  const { sentiment, quality, aiSentiment } = await analyse(text, chosen);
  if (quality === 'junk' && !chosen) { // nothing usable and no rating: let them retry or skip
    say('I couldn’t quite make sense of that. Feel free to try again, or tap Skip.');
    busy = false;
    return;
  }
  const keptText = quality === 'junk' ? '' : text;
  if (q.id !== 'detail') setMood(sentiment);

  // free accuracy test: log when the user's tap disagrees with the classifier
  if (chosen && aiSentiment && aiSentiment !== chosen && q.id !== 'recommend') {
    fetch('/api/sentiment-disagreement', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tap: chosen, classified: aiSentiment }),
    });
  }

  const record = { id: q.id, text: keptText, quality: keptText ? quality : 'none', sentiment, tapped: !!tap, pick: (chipLabel || '').replace(/^[^\p{L}]+/u, ''), skipped: false };
  answers.push(record);
  track('question_answered');
  const followQ = q.follow && q.follow[sentiment];
  if (q.id !== 'detail') {
    const acknowledgement = pick(ACKS[sentiment]);
    say(acknowledgement);
    if (sentiment === 'okay' && acknowledgement === 'Okay, noted.') nodAfterNoted();
  }
  if (!followQ) { // nothing more to ask: move straight on
    setTimeout(() => { busy = false; advance(); }, q.id === 'detail' ? 0 : 700);
    return;
  }
  phase = 'followup';
  cur = { id: `${q.id}-followup`, parent: record };
  $('#skip-question').hidden = false;
  setTapBar(false);
  form.classList.remove('tap-only');
  input.placeholder = 'Add a little more, if you want…';
  progressLabel.textContent = 'One quick follow-up';
  setTimeout(() => { askWithTyping(followQ, () => { busy = false; }); }, 180);
}

function skip() {
  if (busy) return;
  busy = true;
  say('I want to skip this question.', 'user');
  if (phase === 'question') answers.push({ id: cur.id, text: '', sentiment: 'okay', skipped: true });
  setTimeout(() => {
    say('No problem.');
    setTimeout(() => { busy = false; advance(); }, 450);
  }, 260);
}

/* ---------- final review ----------
   Rules: real words (rich) are kept as written. Thin answers ("okay", "1") never appear as raw words;
   they become one short line from a pool of phrasings. Junk is dropped. The layout is picked at random
   and the length follows how much the person actually gave. */
const PHRASES = {
  access: {
    great: ['Getting there was easy.', 'I had no trouble getting there.', 'The place was easy to reach.'],
    okay: ['Getting there was okay.', 'Reaching the place was fine.', 'Getting there was alright.'],
    notGreat: ['It was hard to get there.', 'Getting there was difficult.', 'I found it hard to get there.'],
  },
  service: {
    great: ['The service was good.', 'I was happy with the service.', 'The service was nice.'],
    okay: ['The service was okay.', 'The service was alright.', 'The service was fine.'],
    notGreat: ['I had some trouble with the service.', 'The service was not great.', 'I was not happy with the service.'],
  },
  overall: {
    great: ['Overall, I had a good experience.', 'I had a good experience overall.', 'Overall, it was a good visit.'],
    okay: ['Overall, it was okay.', 'My overall experience was okay.', 'It was an okay experience overall.'],
    notGreat: ['Overall, it was not a good experience.', 'I did not have a good experience overall.', 'Overall it was not great.'],
  },
  recommend: {
    great: ['I would recommend this place to friends or family.', 'I’d recommend it to friends and family.', 'I would recommend this place.'],
    okay: ['I’m not sure I would recommend it.', 'I might recommend it, but I’m not certain.', 'I’m on the fence about recommending it.'],
    notGreat: ['I would not recommend this place right now.', 'I wouldn’t recommend it at the moment.'],
  },
};
const PATTERNS = [
  ['overall', 'access', 'service', 'detail', 'rec'],
  ['detail', 'overall', 'access', 'service', 'rec'],
  ['rec', 'detail', 'access', 'service', 'overall'],
  ['access', 'service', 'detail', 'overall', 'rec'],
  ['service', 'access', 'detail', 'rec', 'overall'],
  ['overall', 'detail', 'service', 'access', 'rec'],
];
const realText = (a) => (a && a.quality === 'rich' ? (a.clean || a.text) : '');
const realFollow = (a) => (a && a.followQuality === 'rich' && !NOTHING.test(a.followup) ? (a.followClean || a.followup) : '');
const sentencesOf = (a) => [realText(a), realFollow(a)].filter(Boolean).map(sentence);

function buildReview() {
  const done = answers.filter((x) => !x.skipped);
  const by = (id) => done.find((x) => x.id === id);
  const blocks = {}, thin = [];

  ['access', 'service', 'overall'].forEach((id) => {
    const a = by(id); if (!a) return;
    const s = sentencesOf(a);
    s.length ? (blocks[id] = { s, sentiment: a.sentiment }) : thin.push({ id, sentiment: a.sentiment });
  });
  const detail = by('detail');
  if (detail && sentencesOf(detail).length) blocks.detail = { s: sentencesOf(detail), sentiment: 'okay' };
  const rec = by('recommend');
  if (rec) {
    const verdict = rec.tapped || !realText(rec) ? [pick(PHRASES.recommend[rec.sentiment])] : [];
    blocks.rec = { s: [...verdict, ...sentencesOf(rec)], sentiment: rec.sentiment };
  }

  // thin ratings: always mention complaints and the overall rating, plus at most one other
  const calm = thin.filter((t) => t.sentiment !== 'notGreat' && t.id !== 'overall');
  const keep = new Set(thin.filter((t) => t.sentiment === 'notGreat' || t.id === 'overall').map((t) => t.id));
  if (calm.length) keep.add(pick(calm).id);
  thin.filter((t) => keep.has(t.id)).forEach((t) => { blocks[t.id] = { s: [pick(PHRASES[t.id][t.sentiment])], sentiment: t.sentiment }; });

  const order = pick(PATTERNS).filter((k) => blocks[k]);
  const out = [];
  order.forEach((k, i) => {
    const s = [...blocks[k].s];
    const prev = i > 0 ? blocks[order[i - 1]] : null;
    if (prev && blocks[k].sentiment === 'notGreat' && prev.sentiment !== 'notGreat' && Math.random() < 0.6 && !/\b(but|however|though)\b/i.test(s[0])) {
      s[0] = pick(['That said, ', 'On the downside, ']) + lowerFirst(s[0]);
    }
    out.push(...s);
  });
  return out.join(' ');
}

/* ---------- optional AI step: tidy spelling/punctuation of each fragment, never rewrite ---------- */
let edited = false;
function fragments() {
  const list = [];
  answers.filter((a) => !a.skipped).forEach((a) => {
    if (realText(a)) list.push({ id: a.id, text: a.text });
    if (realFollow(a)) list.push({ id: `${a.id}:f`, text: a.followup });
  });
  return list;
}
async function cleanWithAI(frags) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch('/api/clean', {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fragments: frags, businessSlug }),
    });
    const data = await r.json();
    return { fragments: data.fragments || null, reason: data.reason || 'unavailable' };
  } catch (err) {
    return { fragments: null, reason: err.name === 'AbortError' ? 'timeout' : 'offline' };
  }
  finally { clearTimeout(timer); }
}

/* small notification that slides in at the top and disappears by itself */
function toast(message, type = 'info') {
  let box = document.getElementById('toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    document.body.append(box);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  const close = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); };
  el.onclick = close;
  box.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(close, 6000);
}

const POLISH_REASONS = {
  not_set_up: 'The AI helper isn’t set up on the server yet (no API key), so your draft is unchanged.',
  busy: 'The AI helper is getting too many requests right now. Please try again in a minute.',
  timeout: 'The AI helper took too long to answer, so your draft is unchanged. Please try again.',
  unavailable: 'The AI helper ran into a problem, so your draft is unchanged. Please try again.',
  offline: 'Couldn’t reach the server. Please check your internet connection and try again.',
};

async function polish() {
  const box = $('#review-draft'), status = $('#polish-status'), again = $('#reword'), button = $('#polish');
  const tell = (message, type) => { status.textContent = message; toast(message, type); };
  track('draft_requested');

  const frags = fragments();
  if (!frags.length) {
    return tell('There’s nothing to tidy yet. This draft comes from your taps, and I only fix spelling in words you type. Add a few words to a question and try again.', 'warn');
  }

  status.textContent = 'Tidying spelling and punctuation…';
  again.disabled = true; button.disabled = true;
  const { fragments: cleaned, reason } = await cleanWithAI(frags);
  again.disabled = false; button.disabled = false;

  if (!cleaned) return tell(POLISH_REASONS[reason] || POLISH_REASONS.unavailable, 'warn');

  let changed = 0;
  cleaned.forEach((f) => {
    const [id, isFollow] = f.id.split(':');
    const a = answers.find((x) => x.id === id);
    if (!a) return;
    if (f.text !== (isFollow ? a.followup : a.text)) changed++;
    a[isFollow ? 'followClean' : 'clean'] = f.text;
  });
  if (!changed) return tell('I checked your spelling and punctuation and it already looked right, so nothing changed.', 'info');
  box.value = buildReview();
  tell('Spelling and punctuation tidied. Your words are unchanged.', 'good');
}
function reword() {
  const box = $('#review-draft'), status = $('#polish-status');
  if (edited && !confirm('This will replace the changes you made. Continue?')) return;
  const before = box.value;
  let next = before;
  for (let i = 0; i < 8 && next === before; i++) next = buildReview();
  box.value = next;
  edited = false;
  status.textContent = next === before
    ? 'That is the only natural way to put what you wrote. A few more words would give it more shape.'
    : 'Rearranged. Edit it however you like.';
}

function finish() {
  chat.classList.add('hidden');
  thanks.classList.remove('hidden');
  edited = false;
  track('finished_questions');
  $('#review-draft').value = buildReview();
  $('#polish-status').textContent = 'This draft uses your own words. You can edit it, or ask for help putting the wording together.';
  $('#reword').hidden = false;
  $('#open-google').disabled = true;
  $('#copy-message').textContent = '';
  $('#final-note').textContent =
    'Thank you for taking a few minutes and staying till the end! Here is a review put together from your own answers. Feel free to edit it however you like, then paste it into the Google Maps link below. Thanks again, and have a great day! 😊';
}

/* ---------- google + buttons ---------- */
function openGoogle() {
  if (!googleUrl) return alert('The Google review link is not set up yet. Add GOOGLE_REVIEW_URL to the .env file.');
  track('google_click');
  window.open(googleUrl, '_blank', 'noopener');
}
async function copyReview() {
  const box = $('#review-draft');
  try { await navigator.clipboard.writeText(box.value); }
  catch { box.select(); document.execCommand('copy'); }
  $('#copy-message').textContent = 'Copied! On Google, tap the review box, press and hold, then Paste.';
  $('#open-google').disabled = false;
  track('copied');
}

$('#start-review').onclick = begin;
$('#google-direct').onclick = openGoogle;
$('#open-google').onclick = openGoogle;
$('#copy-review').onclick = copyReview;
$('#review-draft').oninput = () => { edited = true; };
$('#polish').onclick = () => { edited = false; polish(); };
$('#reword').onclick = reword;
$('#back').onclick = () => { chat.classList.add('hidden'); landing.classList.remove('hidden'); };
$('#start-over').onclick = () => { thanks.classList.add('hidden'); landing.classList.remove('hidden'); };
$('#skip-question').onclick = skip;
form.onsubmit = (e) => { e.preventDefault(); submit(input.value); };
tapBar.onclick = (e) => {
  const b = e.target.closest('[data-sentiment]');
  if (!b) return;
  const same = b.classList.contains('active');
  [...tapBar.children].forEach((x) => x.classList.remove('active'));
  tap = same ? null : b.dataset.sentiment;
  tapLabel = same ? null : b.textContent;
  if (!same) b.classList.add('active');
  if (cur && cur.tapOnly && !same) return submit('');
  input.focus();
};

/* ---------- landing speech bubble ---------- */
const lines = ['Hello there! ✦', 'Welcome, friend!', 'Your words can help a lot.'];
let line = 0;
setInterval(() => { line = (line + 1) % lines.length; $('#speech').textContent = lines[line]; }, 2800);