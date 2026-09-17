# Draft: question to Lagos's designated test lab and the Ghana Gaming Commission

**Status:** draft for Triptown to send. **Not sent.** Record the send date, recipients and any reply below (`gate-odds-mvp` task 2.1).

---

**Subject:** Pre-submission question: crash-type RNG game with the result revealed at cash-out and exact live odds

Dear [LSLGA technical desk / designated test laboratory] / [Ghana Gaming Commission, Technical],

Triptown Games is preparing a game for licensed online casino operators in Lagos State and in Ghana. Before submitting it for certification, we would like to confirm that its design is acceptable under your technical standard.

**The game (working title: Gate Rush)**
- It is an RNG casino game with a single animated horse. It is not a race, and it has no field, no race result and no betting odds.
- The player places one stake. A multiplier rises from x1.00.
- At any moment the player may press "IN!" to end the round. The game then shows whether a gate is open, which pays the stake × the multiplier at the moment the server receives the press, or shut, which loses the stake.
- The outcome of every round is fixed at the start by a certified RNG (HMAC-SHA256 with committed server seed, client seed and nonce, verifiable by the player after seed rotation).
- The round uses the same random process as our crash game [config id], whose certification report we can provide. The chance that the gate is open at a multiplier *m* is exactly the RTP ÷ *m* (97% ÷ *m*). This is shown on screen, rounded down, throughout the round, and as a full table in the rules before any bet.
- The only difference from a standard crash game is that the result is shown when the player ends the round (or at the automatic end: auto cash-out value, maximum win, or 60 seconds), not at the moment the round's outcome is reached. Settlement and payouts are identical to the standard crash game for every possible player action.
- Nothing on screen, in the data stream or in the account changes before the player ends the round.
- Return to player is 97% for every strategy, published with its rounding band at the minimum stake.

**Our questions**
1. Is a crash-type game that reveals its result at cash-out, with the exact live probability displayed as described, acceptable under your technical standard?
2. Which technical standard and version do you test against (for example GLI-19 v3.0)?
3. Are there presentation requirements you would expect for this format, for example wording of the rules or of the on-screen probability?
4. Does this game need its own certificate, or can it be assessed as a variant of the crash game certificate?

We can provide the game rules, the RTP simulation reports, the RNG documentation and a demo build.

Kind regards,
[Name, role]
Triptown Games

---

## Send record

| Date | Recipient | Channel | Reply date | Summary of reply |
|---|---|---|---|---|
| | LSLGA designated lab | | | |
| | Ghana Gaming Commission | | | |
