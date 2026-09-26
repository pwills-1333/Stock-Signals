  // 9. Final signal blending — do NOT mix CTR-A into return scale
  // Use CTR-A as a small bias and as a confidence gate
  const ctrA = ctrAOut.ctrA; // [-1, 1]
  const psiGrade = psiOut.grade; // [0, 1]

  // Mild directional bias from CTR-A (scaled as return contribution, capped)
  const ctrAReturnBias = Math.max(-0.05, Math.min(0.05, ctrA * 0.03));
  expectedReturn = expectedReturn + ctrAReturnBias;

  // Confidence: ensemble + Ψ grade, lightly gated by |CTR-A| stability
  const stabilityBoost = 0.85 + 0.15 * Math.min(1, Math.abs(ctrAOut.stability ?? 0.5));
  confidence = Math.min(
    1,
    Math.max(0, (confidence * 0.55 + psiGrade * 0.45) * stabilityBoost),
  );

  if (psiOut.signal === "buy" && signal === "neutral") signal = "buy";
  if (psiOut.signal === "sell" && signal === "neutral") signal = "sell";
  if (!(entryPrice > 0)) {
    return createEmptyPrediction(ticker, horizonDays, "Invalid last price");
  }

  // Clamp expected return to a sane range for a 14d horizon
  expectedReturn = Math.max(-0.25, Math.min(0.25, expectedReturn));

  // 10. ATR-based risk
  const atrMult = Math.max(volatility, 0.008); // floor ~0.8% daily ATR/price
  const stopLoss =
    signal === "sell"
      ? entryPrice * (1 + 1.8 * atrMult) // stop above for short-style
      : entryPrice * (1 - 1.8 * atrMult);
  const takeProfit =
    signal === "sell"
      ? entryPrice * (1 - 2.5 * atrMult)
      : entryPrice * (1 + 2.5 * atrMult);

  // Kelly: use absolute edge for sizing magnitude; sign follows signal
  const edge = Math.abs(expectedReturn) * confidence;
  const kellyPct = Math.max(0, Math.min(0.25, edge * 0.5));

  const predictedPrice = entryPrice * (1 + expectedReturn);
