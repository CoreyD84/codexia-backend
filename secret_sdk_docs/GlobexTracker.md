# GlobexTracker SDK

The `GlobexTracker` is a proprietary SDK for tracking user events and analytics.

## Core Methods

### `trackEvent(eventName: String, attributes: Map<String, String>)`

This is the primary method for tracking events.

- **eventName**: The name of the event (e.g., "user_login", "item_purchased").
- **attributes**: A map of key-value pairs providing additional context about the event.

**Example (Kotlin):**
```kotlin
val eventAttributes = mapOf("plan" to "premium", "source" to "organic")
GlobexTracker.trackEvent("user_signup", eventAttributes)
```

### `setUser(userId: String, userProperties: Map<String, String>)`

Associates subsequent events with a user ID.

- **userId**: The unique identifier for the user.
- **userProperties**: A map of user-specific properties (e.g., "name", "email").

**Example (Kotlin):**
```kotlin
val userProps = mapOf("name" to "John Doe", "email" to "john.doe@example.com")
GlobexTracker.setUser("user_123", userProps)
```
