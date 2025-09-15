class PokerRange {
    range: Action[];
    name: string;

    constructor(name: string = "My Range", range: Action[] = Array(PokerRangeLength).fill(Action.Fold)) {
        this.range = $state(range);
        this.name = $state(name);
    }

    toJSON() {
        return {
            range: this.range,
            name: this.name
        }
    }

    static fromJSON(json: { range: Action[]; name: string }): PokerRange {
        return new PokerRange(json.name, json.range);
    }
}

enum Action {
    Raise = "Raise",
    Call = "Call",
    Fold = "Fold",
    AllIn = "All in"
}

enum Hand {
    AA, AKs, AQs, AJs, ATs, A9s, A8s, A7s, A6s, A5s, A4s, A3s, A2s,
    AKo, KK, KQs, KJs, KTs, K9s, K8s, K7s, K6s, K5s, K4s, K3s, K2s,
    AQo, KQo, QQ, QJs, QTs, Q9s, Q8s, Q7s, Q6s, Q5s, Q4s, Q3s, Q2s,
    AJo, KJo, QJo, JJ, JTs, J9s, J8s, J7s, J6s, J5s, J4s, J3s, J2s,
    ATo, KTo, QTo, JTo, TT, T9s, T8s, T7s, T6s, T5s, T4s, T3s, T2s,
    A9o, K9o, Q9o, J9o, T9o, N99, N98s, N97s, N96s, N95s, N94s, N93s, N92s,
    A8o, K8o, Q8o, J8o, T8o, N98o, N88, N87s, N86s, N85s, N84s, N83s, N82s,
    A7o, K7o, Q7o, J7o, T7o, N97o, N87o, N77, N76s, N75s, N74s, N73s, N72s,
    A6o, K6o, Q6o, J6o, T6o, N96o, N86o, N76o, N66, N65s, N64s, N63s, N62s,
    A5o, K5o, Q5o, J5o, T5o, N95o, N85o, N75o, N65o, N55, N54s, N53s, N52s,
    A4o, K4o, Q4o, J4o, T4o, N94o, N84o, N74o, N64o, N54o, N44, N43s, N42s,
    A3o, K3o, Q3o, J3o, T3o, N93o, N83o, N73o, N63o, N53o, N43o, N33, N32s,
    A2o, K2o, Q2o, J2o, T2o, N92o, N82o, N72o, N62o, N52o, N42o, N32o, N22
}

const HandStrings: string[] = [
    "AA", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
    "AKo", "KK", "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "K4s", "K3s", "K2s",
    "AQo", "KQo", "QQ", "QJs", "QTs", "Q9s", "Q8s", "Q7s", "Q6s", "Q5s", "Q4s", "Q3s", "Q2s",
    "AJo", "KJo", "QJo", "JJ", "JTs", "J9s", "J8s", "J7s", "J6s", "J5s", "J4s", "J3s", "J2s",
    "ATo", "KTo", "QTo", "JTo", "TT", "T9s", "T8s", "T7s", "T6s", "T5s", "T4s", "T3s", "T2s",
    "A9o", "K9o", "Q9o", "J9o", "T9o", "99", "98s", "97s", "96s", "95s", "94s", "93s", "92s",
    "A8o", "K8o", "Q8o", "J8o", "T8o", "98o", "88", "87s", "86s", "85s", "84s", "83s", "82s",
    "A7o", "K7o", "Q7o", "J7o", "T7o", "97o", "87o", "77", "76s", "75s", "74s", "73s", "72s",
    "A6o", "K6o", "Q6o", "J6o", "T6o", "96o", "86o", "76o", "66", "65s", "64s", "63s", "62s",
    "A5o", "K5o", "Q5o", "J5o", "T5o", "95o", "85o", "75o", "65o", "55", "54s", "53s", "52s",
    "A4o", "K4o", "Q4o", "J4o", "T4o", "94o", "84o", "74o", "64o", "54o", "44", "43s", "42s",
    "A3o", "K3o", "Q3o", "J3o", "T3o", "93o", "83o", "73o", "63o", "53o", "43o", "33", "32s",
    "A2o", "K2o", "Q2o", "J2o", "T2o", "92o", "82o", "72o", "62o", "52o", "42o", "32o", "22"
];

const PokerRangeLength = 13 * 13;

function getButtonClass(action: Action): string {
    switch (action) {
      case Action.Fold:
        return "bg-gray-300 hover:bg-gray-400";
      case Action.Call:
        return "bg-blue-500 hover:bg-blue-600 text-white";
      case Action.Raise:
        return "bg-green-500 hover:bg-green-600 text-white";
      case Action.AllIn:
        return "bg-red-500 hover:bg-red-600 text-white";
      default:
        return "bg-gray-100 hover:bg-gray-200";
    }
  }

export { PokerRange, Action, Hand, HandStrings, PokerRangeLength, getButtonClass };