# Git Notes & Commands

## 1. Git HEAD

* `HEAD` is a pointer that tells Git **where you currently are** in the commit history.
* `HEAD` normally points to the current branch.
* You can move `HEAD` between:

  * Branches
  * Commits
  * Relative commit references such as `HEAD~<number>`

### Relative HEAD references

```bash
HEAD~0
```

* `HEAD~0` → current commit.

```bash
HEAD~1
```

* `HEAD~1` → one commit before the current commit.

```bash
HEAD~2
```

* `HEAD~2` → two commits before the current commit.

In general:

```text
HEAD~<number>
```

The larger the number, the further back you travel in the commit history.

> **Detached HEAD:** When `HEAD` points directly to a commit instead of a branch, you are in a detached HEAD state.

---

# 2. Initial Git Commands

## Initialize a repository

```bash
git init
```

Creates a new Git repository in the current directory.

---

## Add a file to the staging area

```bash
git add <filename>
```

Example:

```bash
git add index.js
```

Moves the file's current changes into the **staging area**.

---

## Remove a file from the staging area

```bash
git restore --staged <filename>
```

Example:

```bash
git restore --staged index.js
```

Removes the file from staging while keeping the changes in the working directory.

---

## Create a commit

```bash
git commit -m "<commit message>"
```

Example:

```bash
git commit -m "add authentication"
```

Creates a new commit using the changes currently in the staging area.

### `-am` shortcut

```bash
git commit -am "<commit message>"
```

This stages and commits **already tracked files** in one command.

> `-am` does **not** automatically stage new/untracked files.

---

# 3. Resetting Commits

`git reset` moves `HEAD` to another commit and changes the state of your working tree/staging area depending on the mode.

```bash
git reset --<mode> <commit-id>
```

There are three important modes.

## `--soft`

```bash
git reset --soft <commit-id>
```

* Moves `HEAD` to the specified commit.
* Removes the commits after that point from the current branch history.
* Their changes remain in the **staging area**.

```text
Commit A → Commit B → Commit C

                ↓ reset --soft A

HEAD → A

Changes from B + C → Staged
```

---

## `--mixed`

```bash
git reset --mixed <commit-id>
```

or simply:

```bash
git reset <commit-id>
```

* Moves `HEAD`.
* Removes later commits from the current branch history.
* Keeps their changes in the **working directory**.
* Removes them from the staging area.

```text
Commit A → Commit B → Commit C

                ↓ reset --mixed A

HEAD → A

Changes from B + C → Working directory
```

---

## `--hard`

```bash
git reset --hard <commit-id>
```

* Moves `HEAD`.
* Removes later commits from the current branch history.
* Removes the associated changes from the working directory and staging area.

> Be careful with `--hard` because uncommitted changes can be permanently lost.

---

# 4. Recovering After an Accidental Reset

If you accidentally reset a commit, use:

```bash
git reflog
```

`reflog` records previous positions of `HEAD`.

Find the commit you want to recover:

```text
HEAD@{0}
HEAD@{1}
HEAD@{2}
...
```

Then reset back to that commit:

```bash
git reset --hard <commit-id>
```

Example:

```bash
git reflog

git reset --hard abc1234
```

---

# 5. Branches

## Create a branch

```bash
git branch <branch-name>
```

Example:

```bash
git branch feature/auth
```

Creates a new branch but does not switch to it.

---

## Delete a branch

```bash
git branch --delete <branch-name>
```

or:

```bash
git branch -d <branch-name>
```

Git normally allows this when the branch has been merged.

---

## Force delete a branch

```bash
git branch -D <branch-name>
```

Force deletes the branch even if it contains commits that have not been merged.

---

## Switch branches

```bash
git checkout <branch-name>
```

Example:

```bash
git checkout develop
```

---

## Checkout a specific commit

```bash
git checkout <commit-id>
```

This puts you into a **detached HEAD** state.

---

## Checkout a relative commit

```bash
git checkout HEAD~<number>
```

Example:

```bash
git checkout HEAD~2
```

Moves `HEAD` two commits backward.

---

## Rename a branch

```bash
git branch -m <old-branch-name> <new-branch-name>
```

Example:

```bash
git branch -m master main
```

---

# 6. Modern Branch Switching

Instead of `git checkout`, you can use `git switch`.

## Switch to an existing branch

```bash
git switch <branch-name>
```

---

## Create and switch to a new branch

```bash
git switch -c <branch-name>
```

Example:

```bash
git switch -c feature/auth
```

`-c` creates the branch and switches to it.

---

# 7. Merging

## Merge a branch

First switch to the branch that should receive the changes:

```bash
git switch <target-branch>
```

Then:

```bash
git merge <branch-to-merge>
```

Example:

```bash
git switch main
git merge feature/auth
```

This merges `feature/auth` into `main`.

---

# 8. Cherry-Pick

If you want to bring **one specific commit** from another branch instead of merging the entire branch:

```bash
git cherry-pick <commit-id>
```

Example:

```bash
git cherry-pick a1b2c3d
```

This creates a new commit on the current branch containing the changes from the selected commit.

---

# 9. Merge Conflicts

When Git cannot automatically decide which changes should remain, a merge conflict occurs.

After manually resolving the conflict:

```bash
git add <resolved-file>
git commit
```

If you don't want to continue the merge:

```bash
git merge --abort
```

> Note: The correct flag is `--abort`, not `--about`.

---

# 10. GitHub / Remote Repositories

## See remote information

```bash
git remote show origin
```

Shows information about the `origin` remote.

---

## Add a remote repository

```bash
git remote add <name> <github-repo-url>
```

Example:

```bash
git remote add origin https://github.com/user/project.git
```

---

## Push a branch

```bash
git push -u origin <branch-name>
```

Example:

```bash
git push -u origin main
```

The `-u` option sets the upstream branch, allowing future pushes to be done simply with:

```bash
git push
```

Agar tumhari local branch `main` hai aur remote par `develop` branch mein push karna hai:

```bash
git push origin main:develop
```

---

# 11. Fetch

```bash
git fetch
```

Downloads new commits and other remote-tracking information from the remote repository.

It **does not automatically merge** those changes into your current branch.

A better mental model:

```text
Remote repository
       ↓
   git fetch
       ↓
Remote-tracking branches
       ↓
Your working branch remains unchanged
```

---

# 12. Merge Remote Changes

For example:

```bash
git merge origin/main
```

This merges the remote-tracking `origin/main` branch into your current local branch.

> Syntax is `git merge origin/main`, not `git merge origin <branch-name>`.

---

# 13. Pull

```bash
git pull
```

Normally equivalent to:

```bash
git fetch
git merge
```

It downloads remote changes and then integrates them into the current branch.

Conceptually:

```text
Remote repository
       ↓
    fetch
       ↓
origin/main
       ↓
    merge
       ↓
Current local branch
```

---

# 14. Rename a Remote

```bash
git remote rename <old-name> <new-name>
```

Example:

```bash
git remote rename origin upstream
```

---

# 15. Change Remote URL

```bash
git remote set-url origin <new-repo-url>
```

Example:

```bash
git remote set-url origin https://github.com/user/new-repo.git
```

---

# 16. Clone a Repository

```bash
git clone <repo-url>
```

Example:

```bash
git clone https://github.com/user/project.git
```

Clones the remote repository and creates a local copy.

---

# 17. Reverting Commits

`git revert` is different from `git reset`.

### Reset

Changes branch history:

```text
A → B → C

reset to B

A → B
```

### Revert

Keeps the original commit and creates a **new commit that reverses its changes**:

```text
A → B → C → D

D reverses C
```

This is generally safer for commits that have already been pushed to a shared remote repository.

---

## Revert a commit

```bash
git revert <commit-id>
```

Example:

```bash
git revert abc1234
```

Git creates a new commit that reverses the changes introduced by that commit.

---

## Revert a range of commits

```bash
git revert <from>..<to>
```

Example:

```bash
git revert abc1234..def5678
```

This reverts the commits in the specified range.

> Remember that Git's range notation excludes the first endpoint. If you need exact control over which commits are reverted, verify the range with `git log` first.

---

## Revert without immediately committing

```bash
git revert --no-commit <commit-id>
```

For a range:

```bash
git revert --no-commit <from>..<to>
```

The changes are applied to your working tree/staging state without creating the final revert commit immediately.

You can then create one combined commit:

```bash
git commit -m "revert changes"
```

---

## Abort a revert

If a revert is currently in progress:

```bash
git revert --abort
```

---

# 18. Reverting a Merge Commit

When reverting a merge commit, Git needs to know which parent should be treated as the mainline.

```bash
git revert <merge-commit-id> -m <parent-number>
```

Example:

```bash
git revert abc1234 -m 1
```

### Parent numbers

For a typical merge:

```text
        B
       / \
      A   C
       \ /
        M
```

`M` has two parents:

```text
-m 1 → first parent
-m 2 → second parent
```

Usually, if you merged a feature branch into `main`, `-m 1` represents the `main` side of the merge.

---

# 19. Git Logs

## Show commit history

```bash
git log
```

Shows the commit history of the current branch.

---

## Show all branches

```bash
git log --all
```

Shows commits reachable from all local and remote-tracking references.

---

## Compact log

```bash
git log --all --oneline
```

Example:

```text
a1b2c3d add authentication
e4f5g6h fix login bug
i7j8k9l initial commit
```

---

## Graph view

```bash
git log --all --oneline --graph
```

Useful for visualizing branches and merges:

```text
*   abc123 merge feature
|\
| * def456 feature commit
|/
* ghi789 previous commit
```

---

# 20. Git Objects: Commit, Tree and Blob

Git internally stores objects such as:

```text
Commit
  ↓
Tree
  ↓
Blob
```

### Commit

A commit stores information such as:

* Author
* Commit message
* Parent commit
* Tree reference

### Tree

A tree represents a directory structure and references:

* Files
* Other directories/trees

### Blob

A blob stores the actual content of a file.

---

## Inspect a Git object

```bash
git cat-file -p <object-id>
```

Example:

```bash
git cat-file -p abc1234
```

If the object is a commit, you can see its metadata and tree reference.

You can then inspect the tree:

```bash
git cat-file -p <tree-id>
```

And inspect a blob:

```bash
git cat-file -p <blob-id>
```

---

# 21. Git Stash

`git stash` temporarily stores uncommitted changes so you can switch branches or work on something else without committing unfinished work.

## Create a stash

```bash
git stash -m "message"
```

Example:

```bash
git stash -m "unfinished login work"
```

---

## List stashes

```bash
git stash list
```

Example:

```text
stash@{0}: On main: unfinished login work
stash@{1}: On feature/api: temporary changes
```

---

## Apply a stash

```bash
git stash apply <stash-index>
```

Example:

```bash
git stash apply stash@{0}
```

Applies the stash but keeps it in the stash list.

---

## Drop one stash

```bash
git stash drop <stash-index>
```

Example:

```bash
git stash drop stash@{0}
```

---

## Delete all stashes

```bash
git stash clear
```

> This removes all stashes.

---

# 22. `.gitignore`

`.gitignore` tells Git which files/directories should not be tracked.

Example:

```gitignore
node_modules/
.env
dist/
```

---

## Stop tracking an already-tracked file

If a file is already tracked, simply adding it to `.gitignore` is not enough.

Use:

```bash
git rm --cached <filename>
```

Example:

```bash
git rm --cached .env
```

Then add it to `.gitignore`:

```gitignore
.env
```

Git will stop tracking the file while keeping the file locally.

---

## Stop tracking a directory

Use `-r`:

```bash
git rm -r --cached <directory>
```

Example:

```bash
git rm -r --cached node_modules
```

Then add it to `.gitignore`:

```gitignore
node_modules/
```

---

# 23. Restore a Deleted File from a Commit

If you accidentally deleted a file and want to restore the version that existed in an older commit:

```bash
git checkout <commit-id> -- <filename>
```

Example:

```bash
git checkout abc1234 -- src/index.js
```

The file is restored from that commit into your working tree.

Then:

```bash
git add src/index.js
git commit -m "restore deleted file"
```

> Modern alternative:

```bash
git restore --source <commit-id> -- <filename>
```

---

# 24. Git Configuration

## Open the global Git configuration

```bash
git config --global -e
```

Opens your global Git configuration file in your configured editor.

---

## Set username

```bash
git config --global user.name "Your Name"
```

---

## Set email

```bash
git config --global user.email "you@example.com"
```

---

## Check username

```bash
git config user.name
```

---

## Check email

```bash
git config user.email
```

---

# 25. Quick Mental Model

A useful way to remember Git's main areas:

```text
                 git add
Working Tree ─────────────→ Staging Area
     ↑                           │
     │                           │ git commit
     │                           ↓
     └─────────────────────── Repository
```

### Common workflow

```bash
git status

git add <file>

git commit -m "message"

git push
```

### Undo the last commit but keep changes staged

```bash
git reset --soft HEAD~1
```

### Undo the last commit but keep changes unstaged

```bash
git reset HEAD~1
```

### Completely remove the last commit and its changes

```bash
git reset --hard HEAD~1
```

### Recover after an accidental reset

```bash
git reflog
git reset --hard <old-commit-id>
```

### Temporarily save unfinished work

```bash
git stash
git switch <another-branch>
```

Later:

```bash
git switch <original-branch>
git stash apply
```
