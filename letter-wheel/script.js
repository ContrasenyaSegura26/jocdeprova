/* Letter Wheel — game logic in plain JavaScript. QUESTIONS comes from questions.js. */
(function () {
  "use strict";

  var LETTERS = QUESTIONS.map(function (q) { return q.letter; });
  var TOTAL = QUESTIONS.length;

  var state = {
    duration: 300,
    timeLeft: 300,
    statuses: [],
    given: [],
    current: 0,
    paused: false,
    timer: null,
  };

  var $ = function (id) { return document.getElementById(id); };

  /* ---------- Rules ---------- */
  function normalize(text) { return String(text).toLowerCase().replace(/[^a-z]/g, ""); }
  function isCorrect(q, input) {
    var guess = normalize(input);
    if (!guess) return false;
    return q.answers.some(function (a) { return normalize(a) === guess; });
  }
  function isOpen(s) { return s === "pending" || s === "passed"; }
  function nextOpenIndex(statuses, from) {
    for (var step = 1; step <= statuses.length; step++) {
      var i = (from + step) % statuses.length;
      if (isOpen(statuses[i])) return i;
    }
    return -1;
  }
  function computeScore(statuses) {
    var r = { correct: 0, wrong: 0, remaining: 0 };
    statuses.forEach(function (s) {
      if (s === "correct") r.correct++;
      else if (s === "wrong") r.wrong++;
      else r.remaining++;
    });
    return r;
  }
  function formatTime(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  /* ---------- Wheel ---------- */
  function buildWheel(container) {
    LETTERS.forEach(function (letter, i) {
      var angle = (i / TOTAL) * Math.PI * 2;
      var el = document.createElement("div");
      el.className = "letter pending";
      el.textContent = letter;
      el.style.left = 50 + 44 * Math.sin(angle) + "%";
      el.style.top = 50 - 44 * Math.cos(angle) + "%";
      container.appendChild(el);
    });
  }
  function paintWheel() {
    var els = $("game-wheel").querySelectorAll(".letter");
    els.forEach(function (el, i) {
      el.className = "letter " + state.statuses[i] + (i === state.current ? " current" : "");
      el.setAttribute("aria-label", LETTERS[i] + ": " + state.statuses[i]);
    });
  }

  function restartAnimation(el) {
    el.classList.remove("pop");
    void el.offsetWidth;
    el.classList.add("pop");
  }

  /* ---------- Screens ---------- */
  function show(id) {
    ["intro", "game", "results"].forEach(function (s) { $(s).hidden = s !== id; });
    window.scrollTo(0, 0);
  }

  function renderScore() {
    var sc = computeScore(state.statuses);
    $("s-correct").textContent = sc.correct;
    $("s-wrong").textContent = sc.wrong;
    $("s-left").textContent = sc.remaining;
    var t = formatTime(state.timeLeft);
    var low = state.timeLeft <= 30;
    $("s-time").textContent = t;
    $("hub-time").textContent = t;
    $("s-time").classList.toggle("low", low);
    $("hub-time").classList.toggle("low", low);
  }

  function renderQuestion() {
    var q = QUESTIONS[state.current];
    var ruleText = q.rule === "starts" ? "Starts with" : "Contains";
    $("hub-rule").textContent = ruleText;
    $("hub-letter").textContent = q.letter;
    $("badge-rule").textContent = ruleText + " " + q.letter;
    var topic = $("badge-topic");
    topic.textContent = q.topic === "modal" ? "Modal verb" : "Suffix";
    topic.classList.toggle("modal", q.topic === "modal");
    $("clue").textContent = q.clue;
    $("answer").value = "";
    $("answer-btn").disabled = true;
    restartAnimation($("hub-letter"));
    restartAnimation($("clue-area"));
    paintWheel();
    renderScore();
    if (!state.paused) $("answer").focus();
  }

  function setFeedback(kind, text) {
    var fb = $("feedback");
    fb.hidden = false;
    fb.className = "feedback";
    void fb.offsetWidth;
    fb.className = "feedback " + kind;
    fb.textContent = (kind === "correct" ? "✓ " : kind === "wrong" ? "✗ " : "") + text;
  }

  /* ---------- Timer ---------- */
  function startTimer() {
    stopTimer();
    state.timer = setInterval(function () {
      state.timeLeft = Math.max(0, state.timeLeft - 1);
      renderScore();
      if (state.timeLeft === 0) finish();
    }, 1000);
  }
  function stopTimer() {
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
  }

  /* ---------- Game flow ---------- */
  function start() {
    state.statuses = QUESTIONS.map(function () { return "pending"; });
    state.given = QUESTIONS.map(function () { return ""; });
    state.current = 0;
    state.timeLeft = state.duration;
    state.paused = false;
    $("feedback").hidden = true;
    $("clue-area").hidden = false;
    $("paused-area").hidden = true;
    $("pause-btn").textContent = "❚❚ Pause";
    show("game");
    renderQuestion();
    startTimer();
  }

  function advance() {
    var idx = nextOpenIndex(state.statuses, state.current);
    if (idx === -1) { finish(); return; }
    state.current = idx;
    renderQuestion();
  }

  function submit() {
    var input = $("answer").value;
    if (!input.trim()) return;
    var q = QUESTIONS[state.current];
    var ok = isCorrect(q, input);
    state.statuses[state.current] = ok ? "correct" : "wrong";
    state.given[state.current] = input.trim();
    if (ok) setFeedback("correct", q.letter + ": “" + q.answers[0] + "” is correct!");
    else setFeedback("wrong", q.letter + ": the answer was “" + q.answers[0] + "”.");
    advance();
  }

  function pass() {
    var q = QUESTIONS[state.current];
    state.statuses[state.current] = "passed";
    setFeedback("passed", q.letter + " passed — it will come back later.");
    advance();
  }

  function togglePause() {
    state.paused = !state.paused;
    $("clue-area").hidden = state.paused;
    $("paused-area").hidden = !state.paused;
    $("feedback").hidden = state.paused || !$("feedback").textContent;
    $("pause-btn").textContent = state.paused ? "▶ Resume" : "❚❚ Pause";
    if (state.paused) stopTimer();
    else { startTimer(); $("answer").focus(); }
  }

  function finish() {
    stopTimer();
    var sc = computeScore(state.statuses);
    var pct = sc.correct / TOTAL;
    $("r-eyebrow").textContent = state.timeLeft === 0 ? "Time's up!" : "Game over";
    $("r-score").textContent = sc.correct;
    $("r-message").textContent =
      pct >= 0.9 ? "Outstanding — truly C1!" :
      pct >= 0.7 ? "Great work!" :
      pct >= 0.5 ? "Good effort — keep practising." :
      "Review the answers below and try again.";
    $("r-correct").textContent = "✓ " + sc.correct + " correct";
    $("r-wrong").textContent = "✗ " + sc.wrong + " wrong";
    $("r-left").textContent = "○ " + sc.remaining + " unanswered";

    var list = $("review");
    list.innerHTML = "";
    QUESTIONS.forEach(function (q, i) {
      var s = state.statuses[i];
      var li = document.createElement("li");
      var letter = document.createElement("span");
      letter.className = "review-letter " + (s === "correct" || s === "wrong" ? s : "");
      letter.textContent = q.letter;
      var body = document.createElement("div");
      body.className = "review-body";
      body.appendChild(el("p", "review-clue", q.clue));
      var ans = el("p", "review-answer", q.answers[0]);
      ans.appendChild(el("span", "review-focus", "(" + q.focus + ")"));
      body.appendChild(ans);
      if (s === "wrong") body.appendChild(el("p", "review-given", "Your answer: " + state.given[i]));
      body.appendChild(el("p", "review-expl", q.explanation));
      li.appendChild(letter);
      li.appendChild(body);
      list.appendChild(li);
    });
    show("results");
    restartAnimation(document.querySelector(".final-score"));
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    e.className = cls;
    e.textContent = text;
    return e;
  }

  /* ---------- Wire up ---------- */
  buildWheel($("intro-wheel"));
  buildWheel($("game-wheel"));

  $("durations").addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-seconds]");
    if (!btn) return;
    state.duration = Number(btn.dataset.seconds);
    this.querySelectorAll("button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b === btn));
    });
  });
  $("start-btn").addEventListener("click", start);
  $("play-hub").addEventListener("click", start);
  $("answer").addEventListener("input", function () {
    $("answer-btn").disabled = !this.value.trim();
  });
  $("answer-form").addEventListener("submit", function (e) { e.preventDefault(); submit(); });
  $("pass-btn").addEventListener("click", pass);
  $("pause-btn").addEventListener("click", togglePause);
  $("resume-btn").addEventListener("click", togglePause);
  $("finish-btn").addEventListener("click", finish);
  $("again-btn").addEventListener("click", function () { show("intro"); });
})();
