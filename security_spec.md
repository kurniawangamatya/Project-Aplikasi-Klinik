# Security Specification

## Data Invariants
1. A Card must belong to a valid Board and List.
2. A List must belong to a valid Board.
3. A User can only modify their own Notifications.
4. Only Admins or Owners can create/delete Boards and Lists.
5. Keuangan users can only update specific fields on Cards (amount, status).
6. Templates are board-specific and follow similar access patterns as cards.
7. Archived cards are just cards with `archived: true`.

## The "Dirty Dozen" Payloads

1. **Identity Spoofing (Create Card as another user):**
   ```json
   { "title": "Evil Task", "listId": "list123", "boardId": "board123", "assignedTo": "otherUser", "lastModifiedBy": "otherUser" }
   ```
2. **Identity Spoofing (Update Card owner):**
   ```json
   { "lastModifiedBy": "otherUser" }
   ```
3. **Privilege Escalation (User sets self as Admin):**
   ```json
   { "role": "admin" }
   ```
4. **State Shortcutting (Finish task without permission):**
   ```json
   { "status": "completed" } // by a non-assigned user or non-keuangan
   ```
5. **Resource Poisoning (1MB ID):**
   ```bash
   # Attacker sends document creation with id of 1MB string
   ```
6. **Orphaned Record (Create Card in non-existent Board):**
   ```json
   { "boardId": "nonExistentBoard", "title": "Ghost Task" }
   ```
7. **PII Leak (Read all users without being signed in):**
   ```javascript
   getDocs(collection(db, 'users')) // without auth
   ```
8. **PII Leak (Read another user's private info):**
   ```javascript
   getDoc(doc(db, 'users', 'otherUserId')) // if it had PII subcollections
   ```
9. **Bypassing App Logic (Archive card via manual update without permission):**
   ```json
   { "archived": true }
   ```
10. **Shadow Update (Add random fields):**
    ```json
    { "title": "Task", "isHacked": true }
    ```
11. **Malicious Template (Create template with extreme values):**
    ```json
    { "amount": 999999999999, "title": "A".repeat(10000) }
    ```
12. **Notification Spam (Create notification for anyone):**
    ```json
    { "userId": "victim123", "message": "Spam" }
    ```

## Step 4: Verification
I will now draft the rules.
