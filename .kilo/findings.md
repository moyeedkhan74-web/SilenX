- path: backend/src/websocket/socketStore.ts
  line: 48-49
  confidence: high
  why: "isUserVisible() returns true for unknown users (userVisibility.get(userId) !== false → undefined !== false → true). If a client connects but never emits client-visibility (e.g., opens app in background tab, or visibility listeners fail to fire), server treats them as visible and won't send push → missed notification."
  finding: "Default visibility = visible causes missed push for hidden tabs that never reported visibility"
  suggestion: "Default to hidden (return userVisibility.get(userId) === true) so push fires unless explicitly marked visible, or require explicit visibility report before suppressing push."

- path: frontend/src/App.tsx
  line: 116-133
  confidence: high
  why: "Visibility effect has empty deps [] — runs once on mount. On socket reconnect, backend calls clearUserVisibility() (handlers.ts:873) but client never re-emits client-visibility. Server defaults to visible again → missed pushes after reconnect if tab is hidden."
  finding: "Visibility not re-reported on socket reconnect"
  suggestion: "Add socket connection state to effect deps, or emit client-visibility in socket.ts connect handler after reconnect."

- path: backend/src/websocket/handlers.ts
  line: 656
  confidence: high
  why: "Fabricated conversationId: `direct_${userId}_${data.targetUserId}` for Firebase push may not match any real conversation in DB. Deep link `/?chat=direct_<caller>_<callee>` may not route to valid conversation when recipient clicks notification."
  finding: "call-initiate uses fabricated conversationId for Firebase push"
  suggestion: "Look up or create the actual direct conversation ID before sending push, or omit conversationId for call pushes (Web Push version already omits it)."

- path: frontend/src/hooks/usePushNotifications.ts
  line: 65-66
  confidence: high
  why: "getPushServiceWorker() prefers existing registration at scope '/'. Firebase SW (pushNotification.ts:206) registers first at scope '/'. VAPID subscription uses Firebase SW registration → pushes go to Firebase SW which expects Firebase format (payload.notification, payload.data). Backend sends Web Push format (type, title, body, conversationId...). Firebase SW shows generic 'SilenX / 🔒 Encrypted Message' for all Web Push messages. The new sw.js normalization is never used."
  finding: "Firebase SW receives Web Push payload but doesn't understand it"
  suggestion: "Register sw.js at a different scope (e.g., '/push/') and use it for VAPID subscription, or make Firebase SW handle both payload formats."

- path: frontend/src/App.tsx
  line: 123
  confidence: high
  why: "Initial reportVisibility() runs before socket connects (socket connects at line 219/237/257). socket?.connected is false → returns early. Visibility never reported until user interaction (focus/blur/visibilitychange). User hidden at load won't get push for first message."
  finding: "Initial visibility report runs before socket connects"
  suggestion: "Emit client-visibility in socket.ts connect handler after successful connection, or make visibility effect depend on socket connection state."

- path: frontend/src/hooks/usePushNotifications.ts
  line: 277-282
  confidence: high
  why: "Auto-enable effect depends on enable, permission, isAuthenticated. enable() calls persistState() which updates permission state. Effect re-runs when permission changes, but subscriptionRef.current check at line 280 may be stale (ref not in deps). Could cause double POST to backend or missed auto-enable."
  finding: "Auto-enable effect stale closure / double-registration risk"
  suggestion: "Add subscriptionRef.current to effect deps via a state tracker, or move auto-enable logic into the subscription adoption effect which already handles re-registration."