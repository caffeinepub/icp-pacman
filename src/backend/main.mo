import Int "mo:core/Int";
import Nat "mo:core/Nat";
import Map "mo:core/Map";
import Time "mo:core/Time";
import Array "mo:core/Array";
import Iter "mo:core/Iter";
import Order "mo:core/Order";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

actor {
  type ScoreEntry = {
    principal : Principal;
    score : Nat;
    timestamp : Time.Time;
  };

  public type UserProfile = {
    name : Text;
  };

  module ScoreEntry {
    public func compare(a : ScoreEntry, b : ScoreEntry) : Order.Order {
      Nat.compare(b.score, a.score);
    };
  };

  // Persistent state
  let scores = Map.empty<Principal, ScoreEntry>();
  var jackpotBalance : Nat = 0;
  var countdownTarget : Int = 0;
  var payoutWallet : ?Principal = null;
  var totalPlays : Nat = 0;
  let userProfiles = Map.empty<Principal, UserProfile>();

  // Initialize the user system state
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // User profile functions
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // Score functions
  public shared ({ caller }) func submitScore(score : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can submit scores");
    };
    
    let existingScore = scores.get(caller);
    switch (existingScore) {
      case (?existing) {
        // Only update if new score is better
        if (score > existing.score) {
          let newScore : ScoreEntry = {
            principal = caller;
            score;
            timestamp = Time.now();
          };
          scores.add(caller, newScore);
        };
      };
      case null {
        let newScore : ScoreEntry = {
          principal = caller;
          score;
          timestamp = Time.now();
        };
        scores.add(caller, newScore);
      };
    };
  };

  public query func getLeaderboard() : async [ScoreEntry] {
    let allScores = scores.values().toArray();
    let sorted = allScores.sort();
    let top20 = Nat.min(20, sorted.size());
    Array.tabulate<ScoreEntry>(top20, func(i) { sorted[i] });
  };

  // Jackpot functions
  public shared ({ caller }) func startGame() : async { ok : Bool; message : Text } {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can start a game");
    };
    jackpotBalance += 6_250_000;
    totalPlays += 1;
    { ok = true; message = "Game started successfully" };
  };

  public query func getJackpotBalance() : async Nat {
    jackpotBalance;
  };

  public shared ({ caller }) func triggerPayout() : async { ok : Bool; amount : Nat; message : Text } {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admin can trigger payout");
    };
    let amount = jackpotBalance;
    jackpotBalance := 0;
    { ok = true; amount; message = "Payout triggered successfully" };
  };

  // Countdown functions
  public query func getCountdownTarget() : async Int {
    countdownTarget;
  };

  public shared ({ caller }) func setCountdown(target : Int) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admin can set countdown");
    };
    countdownTarget := target;
  };

  // Admin functions
  public shared ({ caller }) func setPayoutWallet(wallet : Principal) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admin can set payout wallet");
    };
    payoutWallet := ?wallet;
  };

  public query func getPayoutWallet() : async ?Principal {
    payoutWallet;
  };

  public query ({ caller }) func getAdminStats() : async { jackpotBalance : Nat; totalPlays : Nat; countdownTarget : Int } {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admin can view stats");
    };
    { jackpotBalance; totalPlays; countdownTarget };
  };

  public query func getTotalPlays() : async Nat {
    totalPlays;
  };
};
