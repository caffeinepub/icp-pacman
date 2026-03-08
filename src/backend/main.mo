import Int "mo:core/Int";
import Nat "mo:core/Nat";
import Map "mo:core/Map";
import Time "mo:core/Time";
import Array "mo:core/Array";
import Order "mo:core/Order";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";
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

  func getOrAssignRole(caller : Principal) : AccessControl.UserRole {
    if (caller.isAnonymous()) {
      Runtime.trap("Anonymous users cannot perform this action");
    };

    let role = accessControlState.userRoles.get(caller);

    switch (role) {
      case (null) {
        if (not accessControlState.adminAssigned) {
          accessControlState.adminAssigned := true;
          accessControlState.userRoles.add(caller, #admin);
          #admin;
        } else {
          accessControlState.userRoles.add(caller, #user);
          #user;
        };
      };
      case (?r) { r };
    };
  };

  public shared ({ caller }) func registerOrGetRole() : async AccessControl.UserRole {
    getOrAssignRole(caller);
  };

  // User profile functions
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
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
        if (score > existing.score) {
          let newScore : ScoreEntry = {
            principal = caller;
            score;
            timestamp = Time.now();
          };
          scores.add(caller, newScore);
        };
      };
      case (null) {
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

    let role = getOrAssignRole(caller);

    switch (role) {
      case (#admin) {
        { ok = true; message = "Game started successfully (admin play - no cost)" };
      };
      case (#user) {
        jackpotBalance += 6_250_000;
        totalPlays += 1;
        { ok = true; message = "Game started successfully" };
      };
      case (#guest) {
        Runtime.trap("Unauthorized: Guests cannot start a game");
      };
    };
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
