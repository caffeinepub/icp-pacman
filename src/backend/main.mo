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
import Blob "mo:core/Blob";
import Debug "mo:core/Debug";


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
    if (caller.isAnonymous()) {
      Runtime.trap("Unauthorized: Anonymous users cannot access profiles");
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
    if (caller.isAnonymous()) {
      Runtime.trap("Unauthorized: Anonymous users cannot save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // Score functions
  public shared ({ caller }) func submitScore(score : Nat) : async () {
    if (caller.isAnonymous()) {
      Runtime.trap("Unauthorized: Anonymous users cannot submit scores");
    };

    let existingScore = scores.get(caller);
    switch (existingScore) {
      case (?existing) {
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
    if (caller.isAnonymous()) {
      Runtime.trap("Unauthorized: Anonymous users cannot start a game");
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

    switch (payoutWallet) {
      case (null) {
        { ok = false; amount = 0; message = "No payout wallet set" };
      };
      case (?wallet) {
        let amount = jackpotBalance;
        jackpotBalance := 0;

        let transferResult = await performTransfer(wallet, amount);
        switch (transferResult) {
          case (true) {
            { ok = true; amount; message = "Payout triggered successfully" };
          };
          case (false) {
            jackpotBalance := amount;
            { ok = false; amount = 0; message = "Transfer failed" };
          };
        };
      };
    };
  };

  func performTransfer(wallet : Principal, amount : Nat) : async Bool {
    Debug.print("Pretending to send " # amount.toText() # " e8s to " # wallet.toText());
    true;
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

  public query ({ caller }) func getPayoutWallet() : async ?Principal {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admin can view payout wallet");
    };
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

  public query ({ caller }) func getCallerActor() : async UserProfile {
    Debug.print("getCallerActor called by: " # caller.toText());
    Runtime.trap("Should not be called: Any call to getCallerActor is a bug. The frontend code handles all actor spawning via createActor and requests the backend only for existing user profiles. If this happens, it is a bug.");
  };
};
